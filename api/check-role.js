import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "./_auth.js";
import { currentPeriodKey, getEntitlementSnapshot, getFeatureLimit, normalizeRole } from "./_provia-rules.js";
import { clearLongMemory } from "./_per-memory.js";
import { callAI } from "./_per-core.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Teacher dashboard is in private demo — locked to a single owner account.
// Remove this gate (and the isClassAction check below) to open the B2B feature publicly.
const OWNER_ID = "4a2d4593-16d3-4f9f-bc6c-54c856c21553"; // elton.rustaeus@gmail.com

// Join codes: no ambiguous chars (0/O/1/I), 6 long
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genJoinCode(len = 6) {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

async function getRole(userId) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return normalizeRole(data?.role);
}

// Top weak categories from driving_progress.cat_prog ({ cat: { best } })
function weakFromCatProg(catProg, limit = 3) {
  if (!catProg || typeof catProg !== "object") return [];
  return Object.entries(catProg)
    .filter(([, v]) => typeof v?.best === "number" && v.best < 75)
    .sort(([, a], [, b]) => (a.best || 0) - (b.best || 0))
    .slice(0, limit)
    .map(([cat, v]) => ({ category: cat, best: Math.round(v.best) }));
}

// Aggregate per-student progress for a class. Bulk queries — no N+1.
async function getStudentSummaries(classId) {
  const { data: members } = await supabase
    .from("class_members")
    .select("student_id, joined_at")
    .eq("class_id", classId);
  const ids = (members || []).map((m) => m.student_id);
  if (!ids.length) return [];

  const [progressRes, resultsRes, userResults] = await Promise.all([
    supabase.from("driving_progress").select("user_id, cat_prog, xp").in("user_id", ids),
    supabase
      .from("driving_results")
      .select("user_id, percent, passed, created_at")
      .in("user_id", ids)
      .order("created_at", { ascending: false }),
    // Resolve emails per member id — scales with class size, not platform size.
    // (Avoids listUsers({perPage:1000}), which silently dropped emails past 1000 users.)
    Promise.all(ids.map((id) => supabase.auth.admin.getUserById(id))),
  ]);

  const progById = {};
  for (const p of progressRes.data || []) progById[p.user_id] = p;

  const resultsById = {};
  for (const r of resultsRes.data || []) (resultsById[r.user_id] ||= []).push(r);

  const emailById = {};
  for (const u of userResults) {
    const usr = u?.data?.user;
    if (usr) emailById[usr.id] = usr.email;
  }

  return ids.map((id) => {
    const prog = progById[id] || {};
    const results = resultsById[id] || [];
    const percents = results.map((r) => Math.round(r.percent || 0));
    const avg = percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : null;
    const last = results[0] || null;
    // Last up to 8 tests, oldest→newest, for an inline trend sparkline
    const trend = results.slice(0, 8).map((r) => Math.round(r.percent || 0)).reverse();
    return {
      student_id: id,
      email: emailById[id] || "—",
      xp: prog.xp || 0,
      tests_taken: results.length,
      avg_percent: avg,
      last_percent: last ? Math.round(last.percent || 0) : null,
      last_passed: last ? !!last.passed : null,
      last_at: last?.created_at || null,
      weak_categories: weakFromCatProg(prog.cat_prog),
      trend,
    };
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Access code verification (no auth required)
  if (req.body && req.body.code !== undefined) {
    const secret = process.env.ACCESS_CODE;
    if (!secret) return res.status(500).json({ error: "Server misconfigured" });
    const ok = (req.body.code || "").trim() === secret;
    return ok ? res.status(200).json({ ok: true }) : res.status(401).json({ error: "Invalid code" });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const action = req.body?.action;

  if (action === "entitlements") {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) return res.status(500).json({ error: "Role lookup failed" });
      const role = normalizeRole(data?.role);
      return res.status(200).json({ ok: true, entitlements: getEntitlementSnapshot(role) });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (action === "per_memory_clear") {
    const ok = await clearLongMemory(supabase, user.id);
    return ok
      ? res.status(200).json({ ok: true })
      : res.status(500).json({ ok: false, error: "Memory clear failed" });
  }

  // Save korkortet progress
  if (action === "kk_save") {
    const { srs_data, xp, wrong_ids, cat_prog, bookmarks } = req.body;
    try {
      const { error } = await supabase.from("driving_progress").upsert(
        { user_id: user.id, srs_data: srs_data ?? {}, xp: xp ?? 0, wrong_ids: wrong_ids ?? [], cat_prog: cat_prog ?? {}, bookmarks: bookmarks ?? [], updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) return res.status(500).json({ error: "Save failed" });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Load korkortet progress
  if (action === "kk_load") {
    try {
      const { data, error } = await supabase.from("driving_progress").select("srs_data,xp,wrong_ids,cat_prog,bookmarks,updated_at").eq("user_id", user.id).maybeSingle();
      if (error) return res.status(500).json({ error: "Load failed" });
      return res.status(200).json({ data: data || null });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Server-side korkortet teoriprov quota check + bump
  if (action === "bump_kk") {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) return res.status(500).json({ error: "DB error" });

      const role = normalizeRole(data?.role);
      const cfg = getFeatureLimit(role, "drivingTest");

      if (cfg.cap === Infinity) return res.status(200).json({ ok: true, count: 0, limit: Infinity });

      // cap=0 means teoriprov is not available on this plan (e.g. gratis)
      if (cfg.cap === 0) return res.status(429).json({ error: "Teoriprov kräver Basic eller Premium.", count: 0, limit: 0 });

      const periodKey = currentPeriodKey(cfg.period);

      // Atomic check-and-increment — prevents quota bypass via concurrent requests
      const { data: q, error: qErr } = await supabase.rpc("consume_kk_test_quota", {
        p_user_id: user.id,
        p_period_key: periodKey,
        p_limit: cfg.cap,
      });
      if (qErr) return res.status(500).json({ error: "DB error" });
      if (!q?.ok) return res.status(429).json({ error: "Quota exceeded", count: q?.count ?? cfg.cap, limit: cfg.cap });

      return res.status(200).json({ ok: true, count: q.count, limit: cfg.cap });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Open Stripe Customer Portal
  if (action === "portal") {
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!prof?.stripe_customer_id) {
        return res.status(400).json({ error: "no_subscription", message: "Inget Stripe-konto kopplat till din profil." });
      }

      const stripeKey = (process.env.STRIPE_SECRET_KEY || "").replace(/^﻿/, "").trim();
      const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: `customer=${encodeURIComponent(prof.stripe_customer_id)}&return_url=${encodeURIComponent("https://proviaai.se/app.html")}&configuration=bpc_1TdEAsCrGHQN9aRpV0vCLM03`,
      });
      const portalSession = await portalRes.json();
      if (!portalRes.ok) return res.status(500).json({ error: "portal_failed", details: portalSession });
      return res.status(200).json({ url: portalSession.url });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // Cancel Stripe subscription
  if (action === "cancel_sub") {
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("stripe_subscription_id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!prof?.stripe_subscription_id) {
        return res.status(400).json({ error: "No active subscription found" });
      }

      const stripeKey = (process.env.STRIPE_SECRET_KEY || "").replace(/^﻿/, "").trim();
      const r = await fetch(`https://api.stripe.com/v1/subscriptions/${prof.stripe_subscription_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      const result = await r.json();
      if (!r.ok) return res.status(500).json({ error: "Stripe cancellation failed", details: result });

      await supabase.from("profiles").update({ role: "gratis", stripe_subscription_id: null }).eq("id", user.id);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ── Class feature (teacher dashboard + student join) — PRIVATE DEMO ──
  // Locked to OWNER_ID while in development. 404 hides existence from everyone else.
  const isClassAction =
    (action && action.startsWith("teacher_")) ||
    action === "student_join" ||
    action === "student_leave" ||
    action === "student_classes";
  if (isClassAction && user.id !== OWNER_ID) {
    return res.status(404).json({ error: "Not found" });
  }

  // ── Teacher dashboard (B2B) ──
  if (action && action.startsWith("teacher_")) {
    const role = await getRole(user.id);
    if (role !== "teacher" && role !== "admin") {
      return res.status(403).json({ error: "Lärarbehörighet krävs." });
    }

    // Create a class with a unique join code
    if (action === "teacher_create_class") {
      const name = String(req.body?.name || "").trim().slice(0, 80);
      if (!name) return res.status(400).json({ error: "Klassnamn krävs." });
      try {
        let cls = null;
        for (let attempt = 0; attempt < 5 && !cls; attempt++) {
          const code = genJoinCode();
          const { data, error } = await supabase
            .from("classes")
            .insert({ teacher_id: user.id, name, join_code: code })
            .select("id, name, join_code, created_at")
            .maybeSingle();
          if (!error) { cls = data; break; }
          if (error.code !== "23505") return res.status(500).json({ error: "Kunde inte skapa klass." });
        }
        if (!cls) return res.status(500).json({ error: "Kunde inte generera unik kod." });
        return res.status(200).json({ ok: true, class: { ...cls, member_count: 0 } });
      } catch (e) {
        return res.status(500).json({ error: "Internal server error" });
      }
    }

    // List teacher's classes with member counts
    if (action === "teacher_classes") {
      try {
        const { data: classes, error } = await supabase
          .from("classes")
          .select("id, name, join_code, created_at")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: true });
        if (error) return res.status(500).json({ error: "Kunde inte hämta klasser." });

        const ids = (classes || []).map((c) => c.id);
        const counts = {};
        if (ids.length) {
          const { data: members } = await supabase
            .from("class_members")
            .select("class_id")
            .in("class_id", ids);
          for (const m of members || []) counts[m.class_id] = (counts[m.class_id] || 0) + 1;
        }
        return res.status(200).json({
          ok: true,
          classes: (classes || []).map((c) => ({ ...c, member_count: counts[c.id] || 0 })),
        });
      } catch (e) {
        return res.status(500).json({ error: "Internal server error" });
      }
    }

    // Aggregated student progress for one class (teacher must own it)
    if (action === "teacher_students") {
      const classId = String(req.body?.classId || "");
      if (!UUID_RE.test(classId)) return res.status(400).json({ error: "Ogiltigt klass-id." });
      try {
        const { data: cls } = await supabase
          .from("classes")
          .select("id, name, teacher_id")
          .eq("id", classId)
          .maybeSingle();
        if (!cls || cls.teacher_id !== user.id) {
          return res.status(403).json({ error: "Åtkomst nekad." });
        }
        const students = await getStudentSummaries(classId);
        return res.status(200).json({ ok: true, class: { id: cls.id, name: cls.name }, students });
      } catch (e) {
        return res.status(500).json({ error: "Internal server error" });
      }
    }

    // Per-student drilldown: full history + per-category mastery + percent trend.
    // Re-verifies BOTH class ownership AND that the student is a member (deny-by-default).
    if (action === "teacher_student_detail") {
      const classId = String(req.body?.classId || "");
      const studentId = String(req.body?.studentId || "");
      if (!UUID_RE.test(classId) || !UUID_RE.test(studentId)) {
        return res.status(400).json({ error: "Ogiltigt id." });
      }
      try {
        const { data: cls } = await supabase
          .from("classes")
          .select("id, name, teacher_id")
          .eq("id", classId)
          .maybeSingle();
        if (!cls || cls.teacher_id !== user.id) return res.status(403).json({ error: "Åtkomst nekad." });

        const { data: mem } = await supabase
          .from("class_members")
          .select("student_id")
          .eq("class_id", classId)
          .eq("student_id", studentId)
          .maybeSingle();
        if (!mem) return res.status(404).json({ error: "Eleven finns inte i klassen." });

        const [progRes, resultsRes, userRes] = await Promise.all([
          supabase.from("driving_progress").select("cat_prog, xp").eq("user_id", studentId).maybeSingle(),
          supabase
            .from("driving_results")
            .select("category, num_questions, num_correct, percent, passed, created_at")
            .eq("user_id", studentId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase.auth.admin.getUserById(studentId),
        ]);

        const prog = progRes.data || {};
        const results = resultsRes.data || [];
        const email = userRes.data?.user?.email || "—";

        const categories = Object.entries(prog.cat_prog || {})
          .filter(([, v]) => v && typeof v === "object")
          .map(([category, v]) => ({ category, best: Math.round(v.best || 0), attempts: v.attempts || 0 }))
          .sort((a, b) => a.best - b.best);

        const tests = results
          .map((r) => ({
            at: r.created_at,
            category: r.category || null,
            percent: Math.round(r.percent || 0),
            passed: !!r.passed,
            correct: r.num_correct ?? null,
            total: r.num_questions ?? null,
          }))
          .reverse(); // oldest → newest

        return res.status(200).json({
          ok: true,
          class: { id: cls.id, name: cls.name },
          student: { student_id: studentId, email, xp: prog.xp || 0, tests_taken: tests.length, categories, tests },
        });
      } catch (e) {
        return res.status(500).json({ error: "Internal server error" });
      }
    }

    // P.E.R class insight: AI summary for the TEACHER. Student data is anonymized
    // (labels Elev 1..N, no email/PII) before it ever reaches OpenAI.
    if (action === "teacher_class_insight") {
      const classId = String(req.body?.classId || "");
      if (!UUID_RE.test(classId)) return res.status(400).json({ error: "Ogiltigt klass-id." });
      if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "AI ej konfigurerad." });
      try {
        const { data: cls } = await supabase
          .from("classes")
          .select("id, name, teacher_id")
          .eq("id", classId)
          .maybeSingle();
        if (!cls || cls.teacher_id !== user.id) return res.status(403).json({ error: "Åtkomst nekad." });

        const students = await getStudentSummaries(classId);
        const withData = students.filter((s) => s.tests_taken > 0);
        if (withData.length < 1) {
          return res.status(400).json({ error: "För lite data — eleverna behöver göra minst ett prov." });
        }

        // Anonymize — never send email/PII to the model
        const anon = withData.map((s, i) => ({
          elev: `Elev ${i + 1}`,
          xp: s.xp,
          prov: s.tests_taken,
          snitt: s.avg_percent,
          senaste: s.last_percent,
          godkand: s.last_passed,
          svaga: s.weak_categories.map((w) => `${w.category} ${w.best}%`),
        }));
        const classAvg = Math.round(
          withData.reduce((a, s) => a + (s.avg_percent || 0), 0) / withData.length
        );
        const weakCount = {};
        for (const s of withData) for (const w of s.weak_categories) weakCount[w.category] = (weakCount[w.category] || 0) + 1;
        const topWeak = Object.entries(weakCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([c, n]) => `${c} (${n} ${n === 1 ? "elev" : "elever"})`);

        const systemPrompt = `Du är P.E.R — Provias AI och en erfaren lärarcoach. Skriv en kort, konkret klassrapport till LÄRAREN (inte eleven) om klassens läge i körkortsteorin.
KRAV:
- Saklig, professionell, max 200 ord.
- Använd elevernas anonyma etiketter (Elev 1, Elev 2 …) — aldrig namn.
- Peka ut konkret vilka elever som behöver stöd och varför.
FORMAT (exakt rubriker):
Klassläge:
Elever som behöver stöd:
Svagaste områden i klassen:
Rekommenderad träning (nästa 1–2 veckor):`;
        const userPrompt = `Klass: ${cls.name}
Antal elever med provdata: ${withData.length}
Klassens snitt: ${classAvg}%
Svagaste områden (flest svaga elever): ${topWeak.join(", ") || "—"}

Elevdata (anonymiserad):
${JSON.stringify(anon, null, 2)}

Skriv rapporten enligt formatet.`;

        const insight = await callAI(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          { timeout: 45_000 }
        );
        if (!insight) return res.status(500).json({ error: "Tom rapport." });
        return res.status(200).json({
          ok: true,
          insight,
          class_avg: classAvg,
          students_with_data: withData.length,
          top_weak: topWeak,
        });
      } catch (e) {
        return res.status(500).json({ error: "Kunde inte skapa insikt." });
      }
    }

    // Delete a class (teacher must own it)
    if (action === "teacher_delete_class") {
      const classId = String(req.body?.classId || "");
      if (!UUID_RE.test(classId)) return res.status(400).json({ error: "Ogiltigt klass-id." });
      try {
        const { error } = await supabase
          .from("classes")
          .delete()
          .eq("id", classId)
          .eq("teacher_id", user.id);
        if (error) return res.status(500).json({ error: "Kunde inte radera klass." });
        return res.status(200).json({ ok: true });
      } catch (e) {
        return res.status(500).json({ error: "Internal server error" });
      }
    }

    return res.status(400).json({ error: "Okänd åtgärd." });
  }

  // ── Student: join / leave / list classes (any authenticated user) ──
  if (action === "student_classes") {
    try {
      const { data: rows } = await supabase
        .from("class_members")
        .select("class_id, classes(id, name)")
        .eq("student_id", user.id);
      const classes = (rows || [])
        .map((r) => r.classes)
        .filter(Boolean)
        .map((c) => ({ id: c.id, name: c.name }));
      return res.status(200).json({ ok: true, classes });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (action === "student_join") {
    const code = String(req.body?.code || "").trim().toUpperCase().slice(0, 12);
    if (!code) return res.status(400).json({ error: "Klasskod krävs." });
    try {
      const { data: cls } = await supabase
        .from("classes")
        .select("id, name")
        .eq("join_code", code)
        .maybeSingle();
      if (!cls) return res.status(404).json({ error: "Ingen klass med den koden." });
      const { error } = await supabase
        .from("class_members")
        .upsert({ class_id: cls.id, student_id: user.id }, { onConflict: "class_id,student_id" });
      if (error) return res.status(500).json({ error: "Kunde inte gå med." });
      return res.status(200).json({ ok: true, class: { id: cls.id, name: cls.name } });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (action === "student_leave") {
    const classId = String(req.body?.classId || "");
    if (!UUID_RE.test(classId)) return res.status(400).json({ error: "Ogiltigt klass-id." });
    try {
      const { error } = await supabase
        .from("class_members")
        .delete()
        .eq("class_id", classId)
        .eq("student_id", user.id);
      if (error) return res.status(500).json({ error: "Kunde inte lämna klass." });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role, swish_expires_at, stripe_subscription_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: "Role lookup failed" });

    if (!data) return res.status(200).json({ role: "gratis" });

    let role = String(data.role || "gratis");

    // Lazy expiry: downgrade if Swish payment expired and no active subscription
    if (data.swish_expires_at && !data.stripe_subscription_id && role !== "gratis") {
      if (new Date(data.swish_expires_at) < new Date()) {
        await supabase
          .from("profiles")
          .update({ role: "gratis", swish_expires_at: null })
          .eq("id", user.id);
        role = "gratis";
      }
    }

    return res.status(200).json({ role });
  } catch (e) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
