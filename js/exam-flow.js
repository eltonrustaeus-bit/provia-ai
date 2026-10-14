/* js/exam-flow.js — P.E.R-ledd provskapare.
 *
 * Ersätter den fyrstegs-wizard som låg synlig i app.html. Den gamla wizarden
 * finns kvar i DOM:en bakom `hidden` och är fortfarande MOTORN: kvot,
 * generering, rättning, felbank, Supabase-persistens och P.E.R-kontext körs
 * oförändrat därifrån via window.ExGenEngine. Den här filen äger bara ytan.
 *
 * Bärande principer, i tur och ordning:
 *
 * 1. P.E.R föreslår, eleven bekräftar. Varje steg kostar ett tryck, inte ett
 *    svar. En öppen fråga ställs bara när det inte finns något att gissa på.
 * 2. Hjälp under provet är gratis att ta men syns i resultatet. Två poäng —
 *    en med hjälp, en utan — gör hjälpknappen till ett verktyg i stället för
 *    en genväg, och gör siffran värd något för en lärare.
 * 3. P.E.R avbryter bara när något faktiskt hänt. Aldrig på timer, aldrig
 *    beröm utan orsak. Tre inpass per prov, som mest.
 */
(function () {
  "use strict";

  /* Utkastet nycklas per användare. En global nyckel räckte inte: på en
     skoldator eller en familjedator hade nästa elev fått knappen "Fortsätt
     provet du började" och därmed föregående elevs material, frågor och
     skrivna svar. uid läggs dessutom i objektet och kontrolleras vid läsning,
     så att en nyckel som råkar överleva ett kontobyte ändå avvisas. */
  var LS_DRAFT_BASE = "exgen_flow_draft";
  var LS_PROGRESS_BASE = "exgen_flow_progress";
  var LS_HISTORY = "proviaai_history";
  var LS_MISTAKES = "proviaai_mistakes";
  var LS_TRAIN_PICK = "proviaai_train_pick";

  // Ett övergivet utkast slutar vara till hjälp och börjar bli förvirrande.
  var DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  var MAX_NUDGES = 3;
  var NUDGE_GAP_MS = 45000;
  var STUCK_MS = 90000;

  // Utkastet sparas vid varje tangenttryck i svarsrutan. Ett 20-frågorsprov
  // med alternativ och källhänvisningar är tiotals kB, och att serialisera om
  // allt per tecken märks som hack på en mobil. Frågebyten och flervalsval
  // sparas fortfarande direkt — det är bara skrivandet som väntar.
  var DRAFT_DEBOUNCE_MS = 800;

  /* Serverns tak på pastedText i api/generate-exam.js. Speglas här så att
     eleven ser gränsen medan hen klistrar in i stället för att upptäcka den
     genom att halva materialet tyst försvann. */
  var MATERIAL_MAX = 3000;

  // ── Små hjälpare ─────────────────────────────────────────────────────────

  /* Fota din lösning.
   *
   * Ingen skriver en ekvation i ett textfält. Matematik löses på papper, och
   * fram till nu var provflödets fritextruta därför oanvändbar för just det
   * ämne där flest elever behöver hjälp.
   *
   * Avläsningen skriver in transkriptionen i textarean — den ersätter inte
   * eleven som avsändare. Rutan förblir redigerbar, inget skickas in
   * automatiskt, och granskningsraden ber eleven kontrollera innan de går
   * vidare. Det är skyddet mot en felläst siffra: den som vet vad de skrev
   * ser felet, och en modell som läser 3x som 8x kan aldrig tyst sätta ett
   * betyg.
   *
   * Bilden lagras aldrig. Den skickas en gång och kastas. Eleverna är till
   * stor del minderåriga och ett räknepapper bär ofta namn i marginalen. */
  function buildSolutionPhoto(ta, q, id) {
    var wrap = el("div", "xf-photo");

    var file = el("input");
    file.type = "file";
    file.accept = "image/*";
    file.setAttribute("capture", "environment");
    file.style.display = "none";
    file.className = "xf-photo-input";

    var LABEL = "📷 Fota din lösning";
    var btn = el("button", "xf-btn ghost xf-photo-btn", LABEL);
    btn.type = "button";
    btn.addEventListener("click", function () { file.click(); });

    var note = el("div", "xf-photo-note");
    note.setAttribute("role", "status");
    note.setAttribute("aria-live", "polite");
    note.setAttribute("aria-atomic", "true");
    note.hidden = true;

    function say(text, kind) {
      note.hidden = !text;
      note.textContent = text || "";
      note.className = "xf-photo-note" + (kind ? " " + kind : "");
    }

    file.addEventListener("change", function () {
      if (!file.files || !file.files[0]) return;
      var engine = window.ExGenEngine;
      if (!engine || !engine.readSolution) { say("Fotoinlämning är inte tillgänglig här.", "bad"); return; }

      btn.disabled = true;
      btn.textContent = "Läser din lösning…";
      say("", null);

      engine.readSolution(file.files[0], q && q.question).then(function (r) {
        btn.disabled = false;
        btn.textContent = LABEL;
        // Samma fil två gånger i rad ger annars ingen change-händelse.
        file.value = "";

        if (!r || !r.ok) {
          say((r && r.error) || "Kunde inte läsa bilden.", "bad");
          return;
        }
        if (!r.readable) {
          // Textarean lämnas orörd — eleven kan ha skrivit något själv.
          say("Jag kunde inte tyda bilden. Försök igen med bättre ljus, eller skriv svaret i rutan.", "bad");
          return;
        }

        /* Lägg till, skriv aldrig över. Ett svar som försvinner är värre än ett
           svar som behöver städas. */
        ta.value = (ta.value ? ta.value.replace(/\s+$/, "") + "\n" : "") + r.text;
        S.answers[id] = ta.value;
        saveDraft();
        publish();
        armStuck();

        var delar = ["Kontrollera att det stämmer innan du skickar in."];
        if (r.uncertain && r.uncertain.length) {
          delar.push("Jag var osäker på: " + r.uncertain.join("; ") + ".");
        }
        say(delar.join(" "), r.confidence < 0.7 ? "warn" : null);
        ta.focus();
      });
    });

    wrap.appendChild(btn);
    wrap.appendChild(file);
    wrap.appendChild(note);
    return wrap;
  }

  /* Matematikrendering.
   *
   * js/math-render.js laddar KaTeX först när en text faktiskt innehåller
   * matematik, så en ren samhällskunskapsfråga betalar ingenting. Den filen
   * är ESM och den här är ett klassiskt skript — därför dynamisk import med
   * absolut sökväg (relativ skulle lösas mot dokumentets bas, inte skriptets).
   *
   * Renderingen är alltid bäst-möjliga: går KaTeX inte att hämta står LaTeX-
   * källan kvar, vilket är läsbart. Ett prov får aldrig falla för att ett
   * CDN är nere.
   *
   * Utan detta såg en elev som fick $\frac{x}{2}$ i ett vanligt prov den råa
   * strängen i stället för läsbar matematik. */
  var _mathMod = null;
  function renderMathIn(node) {
    if (!node) return;
    try {
      if (!_mathMod) _mathMod = import("/js/math-render.js");
      _mathMod
        .then(function (m) { return m && m.renderMath ? m.renderMath(node) : null; })
        .catch(function () {});
    } catch (_) {}
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }

  function isEnglish() {
    return Boolean(window.ExGenEngine && window.ExGenEngine.language && window.ExGenEngine.language() === "en");
  }

  function tx(sv, en) {
    return isEnglish() ? en : sv;
  }

  function updateReviewActionLabels() {
    Array.prototype.forEach.call(document.querySelectorAll("#xf .xf-review-action"), function (button) {
      button.textContent = isEnglish() ? button.dataset.labelEn : button.dataset.labelSv;
    });
  }

  function $(sel, root) { return (root || document).querySelector(sel); }

  function lsGet(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch (_) { return fallback; }
  }

  /* Returnerar om skrivningen gick igenom. Den gamla versionen svalde
     QuotaExceededError tyst, vilket bröt löftet att halvfärdiga prov överlever
     en stängd flik utan att någon fick veta det — och utrymmet är verkligen
     trångt: proviaai_history (60 poster), proviaai_mistakes (200) och
     proviaai_last_result (ett helt prov med resultat) delar samma kvot. */
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (_) { return false; }
  }

  function lsDel(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  function weakResultItems(result, questionsById) {
    return (result && Array.isArray(result.per_question) ? result.per_question : [])
      .map(function (item) {
        var id = String(item.id || "");
        var q = questionsById[id] || {};
        var got = Number(item.points) || 0;
        var max = Number(item.max_points) || 0;
        return {
          id: id,
          q: q,
          got: got,
          max: max,
          ratio: max > 0 ? got / max : 1,
          unanswered: item.unanswered === true,
          concept: String(q.concept_tag || q.topic || q.subtopic || "").trim(),
          feedback: String(item.feedback || "").trim()
        };
      })
      .filter(function (item) { return !item.unanswered && item.max > 0 && item.got < item.max; })
      .sort(function (a, b) {
        if (a.ratio !== b.ratio) return a.ratio - b.ratio;
        return (b.max - b.got) - (a.max - a.got);
      });
  }

  function addNextTrainingCard(root, result, questionsById) {
    var weak = weakResultItems(result, questionsById);
    var skipped = (result && Array.isArray(result.per_question) ? result.per_question : [])
      .filter(function (item) { return item.unanswered === true; }).length;
    if (!weak.length) {
      var clean = el("div", "xf-next");
      clean.appendChild(el("div", "xf-next-k", "Nästa träning"));
      clean.appendChild(el("h3", null, skipped ? "Pröva det du lämnade obesvarat" : "Bra: inga tydliga luckor i det här provet"));
      clean.appendChild(el("p", null, skipped
        ? "Du fick 0 poäng på de obesvarade frågorna, men de visar inte vad du kan ännu. Skapa ett nytt prov på samma material och försök själv innan du tittar på facit."
        : "Gör ett nytt prov på samma material med högre nivå eller fler frågor för att se om det sitter även när frågorna vrids om."));
      root.appendChild(clean);
      return;
    }

    var primary = weak[0];
    var card = el("div", "xf-next");
    card.appendChild(el("div", "xf-next-k", "Nästa träning"));
    card.appendChild(el("h3", null, primary.concept ? "Börja med " + primary.concept : "Börja med den svagaste frågan"));

    var intro = primary.feedback
      ? primary.feedback.replace(/^\s*Poäng:\s*\d+\s*\/\s*\d+\.?\s*/i, "")
      : "Det här är den tydligaste luckan från rättningen.";
    card.appendChild(el("p", null, intro.slice(0, 210)));

    var chips = el("div", "xf-next-list");
    weak.slice(0, 4).forEach(function (item, i) {
      var label = item.concept || ("Fråga " + (i + 1));
      chips.appendChild(el("span", null, label + " " + item.got + "/" + item.max));
    });
    card.appendChild(chips);

    var actions = el("div", "xf-next-actions");
    var train = el("a", "xf-btn primary", "Träna misstagen");
    train.href = "app.html#train";
    train.addEventListener("click", function () {
      lsSet(LS_TRAIN_PICK, {
        ids: weak.slice(0, 8).map(function (item) { return item.id; }),
        course: S.course || ""
      });
    });
    actions.appendChild(train);

    var ask = el("button", "xf-btn ghost", "Fråga P.E.R vad du ska göra");
    ask.type = "button";
    ask.addEventListener("click", function () {
      var total = Number(result && result.total_points) || 0;
      var max = Number(result && result.max_points) || 0;
      if (window.setPerContext) {
        window.setPerContext({
          page: "resultat",
          course: S.course || "",
          userScore: max > 0 ? total / max : undefined,
          weakAreas: weak.slice(0, 4).map(function (item) {
            return item.concept || (item.q && (item.q.topic || item.q.subtopic)) || "Fråga";
          })
        });
      }
      if (window.PER && window.PER.describe) {
        window.PER.describe({
          page: "resultat",
          state: { phase: "result" }
        });
      }
      var bubble = document.getElementById("perBubble");
      if (bubble && !bubble.classList.contains("per-open")) bubble.click();
    });
    actions.appendChild(ask);
    card.appendChild(actions);

    root.appendChild(card);
  }

  function buildGraphRetry(item, graphUi) {
    var english = Boolean(window.ExGenEngine && window.ExGenEngine.language && window.ExGenEngine.language() === "en");
    var copy = english ? {
      answer: "Check the graph and show the full-score answer", retry: "Try the graph again", check: "Check new attempt",
      unavailable: "The graph tool could not load. Reload the page and try again.", pending: "Checking the graph…",
      noEngine: "Graph retry is unavailable. Your exam score is unchanged.", failed: "Could not check the graph. Try again.",
      checked: "Attempt checked.", network: "Network error. Try again; your exam score is unchanged.", full: "Full-score answer",
      reveal: "Show full-score answer"
    } : {
      answer: "Kontrollera grafen och visa fullpoängssvaret", retry: "Försök igen på grafen", check: "Kontrollera nytt försök",
      unavailable: "Grafverktyget kunde inte laddas. Ladda om sidan och försök igen.", pending: "Kontrollerar grafen…",
      noEngine: "Omförsöket är inte tillgängligt. Dina provpoäng påverkas inte.", failed: "Kunde inte kontrollera grafen. Försök igen.",
      checked: "Försöket har kontrollerats.", network: "Nätverksfel. Försök igen; ditt provresultat påverkas inte.", full: "Fullpoängssvar",
      reveal: "Visa fullpoängssvar"
    };
    var wrap = el("div", "xf-graph-retry");
    var open = el("button", "xf-btn ghost", Number(item.points) >= Number(item.max_points)
      ? copy.answer
      : copy.retry);
    open.type = "button";
    open.setAttribute("aria-expanded", "false");

    var panel = el("div", "xf-graph-retry-panel");
    panel.hidden = true;
    var answer = String(S.answers[String(item.id)] || "");
    var graph = el("div", "graph-answer");
    var status = el("p", "xf-graph-retry-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    var check = el("button", "xf-btn primary", copy.check);
    check.type = "button";
    check.disabled = !window.ExGenGraphAnswer || !window.ExGenGraphAnswer.isComplete(answer, graphUi);
    var checking = false;
    var answerRevision = 0;
    var model = el("div", "xf-item-model");
    model.hidden = true;
    model.appendChild(el("em", null, copy.full));
    var modelText = el("span", null, "");
    var reveal = item.model_answer ? el("button", "xf-btn quiet", copy.reveal) : null;
    if (reveal) {
      reveal.type = "button";
      reveal.addEventListener("click", function () {
        modelText.textContent = item.model_answer;
        if (!modelText.parentNode) model.appendChild(modelText);
        model.hidden = false;
        if (!model.parentNode) panel.appendChild(model);
        renderMathIn(model);
        reveal.hidden = true;
      });
    }

    if (window.ExGenGraphAnswer) {
      window.ExGenGraphAnswer(graph, answer, function (value) {
        answer = value;
        answerRevision++;
        check.disabled = checking || !window.ExGenGraphAnswer.isComplete(value, graphUi);
        status.textContent = "";
        model.hidden = true;
        check.hidden = false;
        if (reveal) reveal.hidden = false;
      }, english ? "en" : "sv", graphUi);
    } else {
      graph.appendChild(el("p", "xf-photo-note bad", copy.unavailable));
    }

    check.addEventListener("click", function () {
      if (checking || !window.ExGenGraphAnswer || !window.ExGenGraphAnswer.isComplete(answer, graphUi)) return;
      checking = true;
      check.disabled = true;
      status.textContent = copy.pending;
      var engine = window.ExGenEngine;
      if (!engine || typeof engine.gradeGraphRetry !== "function") {
        checking = false;
        status.textContent = copy.noEngine;
        check.disabled = !window.ExGenGraphAnswer.isComplete(answer, graphUi);
        return;
      }
      var submittedRevision = answerRevision;
      engine.gradeGraphRetry(String(item.id), answer).then(function (response) {
        if (submittedRevision !== answerRevision) return;
        if (!response || !response.ok || !response.result) {
          status.textContent = response && response.error || copy.failed;
          return;
        }
        status.textContent = response.result.feedback || copy.checked;
        if (response.result.correct && response.result.model_answer) {
          modelText.textContent = response.result.model_answer;
          model.appendChild(modelText);
          model.hidden = false;
          panel.appendChild(model);
          renderMathIn(model);
          check.hidden = true;
          if (reveal) reveal.hidden = true;
        } else {
          check.disabled = false;
        }
      }).catch(function () {
        if (submittedRevision !== answerRevision) return;
        status.textContent = copy.network;
      }).finally(function () {
        checking = false;
        if (!check.hidden) check.disabled = !window.ExGenGraphAnswer.isComplete(answer, graphUi);
      });
    });

    open.addEventListener("click", function () {
      panel.hidden = !panel.hidden;
      open.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) check.focus();
    });
    panel.appendChild(graph);
    panel.appendChild(check);
    if (reveal) panel.appendChild(reveal);
    panel.appendChild(status);
    wrap.appendChild(open);
    wrap.appendChild(panel);
    return wrap;
  }

  /* Användar-id läses ur samma Supabase-session som resten av appen. Går det
     inte att läsa faller vi tillbaka på "anon" — då blir utkastet i praktiken
     enhetsbundet igen, men bara för den som ändå inte är inloggad och därför
     inte kan generera något prov. */
  function uid() {
    try {
      var s = JSON.parse(localStorage.getItem(window.ExGenRuntime.authStorageKey) || "{}");
      return (s && s.user && s.user.id) ? String(s.user.id) : "anon";
    } catch (_) { return "anon"; }
  }

  function draftKey() { return LS_DRAFT_BASE + "_" + uid(); }
  function progressKey() { return LS_PROGRESS_BASE + "_" + uid(); }
  function clearDraft() {
    lsDel(draftKey());
    lsDel(progressKey());
  }

  function questionState(source) {
    var state = Object.create(null);
    if (source && typeof source === "object" && !Array.isArray(source)) {
      Object.keys(source).forEach(function (key) { state[key] = source[key]; });
    }
    return state;
  }

  // ── Tillstånd ────────────────────────────────────────────────────────────

  var S = {
    course: "",
    level: "C",
    qType: "mix",
    num: 12,
    nonGraphNum: 12,
    material: "",
    exam: null,
    answers: questionState(),   // qid -> svar
    helped: questionState(),    // qid -> true om P.E.R öppnades på just den frågan
    idx: 0,
    startedAt: 0,
    nudges: 0,
    lastNudge: 0,
    generating: false,  // spärr mot dubbel generering (kostar kvot)
    submitting: false   // spärr mot dubbel inlämning
  };

  var UI = {};          // cache av noder
  var examReturnFocus = null;
  var examInertState = null;
  var typing = null;    // pågående skrivanimation
  var startVersion = 0;
  var stuckTimer = null;
  var draftTimer = null;
  var prevOverflow = null;   // body-overflow som gällde innan vi låste den

  // ── Prov-DNA ─────────────────────────────────────────────────────────────
  /* Allt P.E.R "vet sedan tidigare" kommer härifrån: samma historik och
     felbank som förbättringssidan redan bygger på. Ingen ny lagring, inget
     nytt API. Kallstart hanteras genom att erkännas, inte döljas. */

  function historyPercent(value) {
    if ((typeof value !== "number" && typeof value !== "string")
      || (typeof value === "string" && value.trim() === "")) return null;
    var percent = Number(value);
    return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : null;
  }

  function dna() {
    var hist = lsGet(LS_HISTORY, []) || [];
    var miss = lsGet(LS_MISTAKES, []) || [];
    if (!Array.isArray(hist)) hist = [];
    if (!Array.isArray(miss)) miss = [];

    var last = hist.length ? hist[hist.length - 1] : null;
    var scored = hist.map(function (x) { return historyPercent(x && x.percent); })
      .filter(function (percent) { return percent !== null; });
    var recent = scored.slice(-5);
    var avg = recent.length
      ? Math.round(recent.reduce(function (sum, percent) { return sum + percent; }, 0) / recent.length)
      : null;

    // Kurser i fallande aktualitet, utan dubbletter.
    var courses = [];
    for (var i = hist.length - 1; i >= 0 && courses.length < 4; i--) {
      var c = String(hist[i].course || "").trim();
      if (c && courses.indexOf(c) === -1) courses.push(c);
    }

    /* Nivåförslag: håller nivån tills resultaten säger något annat. Två prov
       i RAD över 85 % lyfter, två i rad under 50 % sänker. Ett enstaka bra
       prov flyttar ingenting — det är brus, inte utveckling.

       Regeln såg tidigare på snittet över de fem senaste proven, vilket inte
       är samma sak och gav fel svar åt båda håll: 40, 40, 40, 100, 100 gav
       snittet 64 och inget lyft trots två raka toppresultat, medan 80 följt av
       92 gav snittet 86 och ett lyft trots att bara ett prov nådde gränsen. */
    var lvl = last ? String(last.level || "C") : "C";
    var lastTwo = scored.slice(-2);
    if (lastTwo.length === 2) {
      var bothHigh = lastTwo[0] >= 85 && lastTwo[1] >= 85;
      var bothLow = lastTwo[0] < 50 && lastTwo[1] < 50;
      if (bothHigh && lvl === "C") lvl = "A";
      else if (bothHigh && lvl === "E") lvl = "C";
      else if (bothLow && lvl === "A") lvl = "C";
      else if (bothLow && lvl === "C") lvl = "E";
    }

    var qType = last ? String(last.qType || "mix") : "mix";
    return {
      count: hist.length,
      last: last,
      avg: avg,
      courses: courses,
      level: lvl,
      qType: qType,
      num: last && qType !== "graph" ? clamp(Number(last.numQuestions) || 12, 3, 20) : 12,
      missCountFor: function (course) {
        var c = String(course || "").trim().toLowerCase();
        return miss.filter(function (m) {
          return String(m.course || "").trim().toLowerCase() === c;
        }).length;
      }
    };
  }

  // ── P.E.R:s röst ─────────────────────────────────────────────────────────

  function say(text, sub) {
    var line = UI.say, subEl = UI.sub;
    if (!line) return;
    if (typing) { clearInterval(typing); typing = null; }

    line.setAttribute("aria-label", text);
    subEl.textContent = "";
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      line.textContent = text;
      subEl.textContent = sub || "";
      return;
    }

    line.textContent = "";
    line.classList.add("typing");
    var i = 0;
    // 16 ms/tecken är snabbare än läshastighet — raden känns skriven, inte
    // uppläst. Långsammare blir väntan; direkt blir det ingen närvaro alls.
    typing = setInterval(function () {
      i++;
      line.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(typing);
        typing = null;
        line.classList.remove("typing");
        if (sub) {
          subEl.textContent = sub;
          subEl.style.animation = "xf-rise 250ms cubic-bezier(.22,.61,.36,1) both";
        }
      }
    }, 16);
  }

  function busy(on) {
    if (UI.orb) UI.orb.classList.toggle("busy", !!on);
  }

  // ── Skärmar ──────────────────────────────────────────────────────────────

  var STEPS = ["start", "subject", "aim", "material", "contract", "result"];
  var STEP_LABELS = {
    start: { sv: "Start", en: "Start" },
    subject: { sv: "Ämne", en: "Subject" },
    aim: { sv: "Mål", en: "Goal" },
    material: { sv: "Material", en: "Material" },
    contract: { sv: "Sammanfattning", en: "Review" },
    result: { sv: "Resultat", en: "Results" },
  };

  function updateProgress(name) {
    if (!UI.progress || !STEPS.includes(name)) return;
    UI.progress.dataset.step = name;
    var english = Boolean(window.ExGenEngine && window.ExGenEngine.language && window.ExGenEngine.language() === "en");
    var step = STEPS.indexOf(name) + 1;
    UI.progress.setAttribute("aria-label", english ? "Exam creation progress" : "Framsteg i provskapandet");
    UI.progress.setAttribute("aria-valuenow", String(step));
    UI.progress.setAttribute("aria-valuetext",
      (english ? "Step " : "Steg ") + step + (english ? " of " : " av ") + STEPS.length + ": " + STEP_LABELS[name][english ? "en" : "sv"]);
  }

  function screen(name) {
    if (name === "contract") {
      var panel = document.getElementById("perPanel");
      var bubble = document.getElementById("perBubble");
      if (panel && panel.classList.contains("per-open") && bubble) bubble.click();
    }
    document.body.classList.toggle("xf-result", name === "result");
    document.body.classList.toggle("xf-contract", name === "contract");
    if (name !== "result") document.body.classList.remove("xf-result-per-open");
    STEPS.forEach(function (s) {
      var n = UI.screens[s];
      if (!n) return;
      var on = s === name;
      n.classList.toggle("on", on);
      // display:none räcker för seende, men en skärmläsare som traverserar
      // DOM:en hittar annars alla sex skärmarnas rubriker på en gång.
      if (on) n.removeAttribute("aria-hidden");
      else n.setAttribute("aria-hidden", "true");
    });
    var pct = (STEPS.indexOf(name) / (STEPS.length - 1)) * 100;
    if (UI.bar) UI.bar.style.width = pct + "%";
    updateProgress(name);
    // "instant" är ett giltigt ScrollBehavior-värde men aldrig en egenskap på
    // window, så den gamla feature-detekteringen valde alltid "auto" och gav
    // en mjuk scroll där en omedelbar var meningen.
    window.scrollTo({ top: 0, behavior: "instant" });

    /* Flytta fokus till den nya skärmens rubrik. Utan detta blir fokus kvar på
       knappen eleven just tryckte — en knapp som nu är display:none — och både
       tangentbord och skärmläsare tappar var de är. Rubriken har tabindex="-1"
       så att den går att fokusera utan att hamna i tabbordningen. */
    var sc = UI.screens[name];
    var head = sc && sc.querySelector(".xf-say");
    if (head) {
      try { head.focus({ preventScroll: true }); } catch (_) { head.focus(); }
    }
  }

  /* Varje steg börjar med mount(): den pekar om P.E.R:s röst till skärmen som
     är på väg in och tömmer dess kropp. Ordningen spelar roll — stegen anropar
     say() innan de byter skärm, så pekas rösten om för sent skrivs raden i den
     skärm eleven just lämnat. */
  function mount(name) {
    var sc = UI.screens[name];
    UI.say = sc.querySelector(".xf-say");
    UI.sub = sc.querySelector(".xf-sub");
    UI.orb = sc.querySelector(".xf-orb");
    var b = sc.querySelector(".xf-body");
    b.innerHTML = "";
    return b;
  }

  // ── Steg 0: start ────────────────────────────────────────────────────────

  function stepStart() {
    UI.languageRerender = stepStart;
    var renderVersion = ++startVersion;
    var d = dna();
    var b = mount("start");

    if (d.count === 0) {
      say(tx("Vad ska vi plugga på?", "What are we studying?"), tx("Klistra in ditt material så bygger jag ett prov som liknar det du faktiskt får.", "Add your study material and I'll build a practice exam based on it."));
    } else if (d.avg != null) {
      say(tx("Redo för nästa prov?", "Ready for your next exam?"), tx("Du ligger på " + d.avg + " % i snitt över dina senaste prov.", "Your average across your latest exams is " + d.avg + "%."));
    } else {
      say(tx("Redo för nästa prov?", "Ready for your next exam?"), null);
    }

    var act = el("div", "xf-act");
    var go = el("button", "xf-btn primary", tx("Skapa prov", "Create an exam"));
    go.type = "button";
    go.addEventListener("click", function () { stepSubject(); });
    act.appendChild(go);

    // Ett halvfärdigt prov ska aldrig gå förlorat för att mobilen låste sig
    // eller täckningen försvann på bussen.
    var draft = readDraft();
    if (draft) {
      var legacyDraft = !draft.exam.exam_manifest;
      if (legacyDraft) {
        var legacyNote = el("p", "xf-sub", tx("Det här provet skapades med en äldre version och kan inte rättas säkert. Ditt material finns kvar; skapa ett nytt prov för att fortsätta.", "This exam was created with an older version and cannot be graded safely. Your material is still here; create a new exam to continue."));
        act.appendChild(legacyNote);
      }
      var back = el("button", "xf-btn ghost", legacyDraft ? tx("Skapa nytt prov av materialet", "Create a new exam from this material") : tx("Fortsätt provet du började", "Continue your exam"));
      back.type = "button";
      var resumeStatus = el("p", "xf-sub");
      resumeStatus.hidden = true;
      resumeStatus.setAttribute("role", "status");
      if (!legacyDraft) act.appendChild(resumeStatus);
      back.addEventListener("click", async function () {
        if (!legacyDraft && back.dataset.expired !== "true") {
          back.disabled = true;
          resumeStatus.hidden = false;
          resumeStatus.textContent = tx("Kontrollerar att provet fortfarande är aktivt…", "Checking that the exam is still active…");
          var issuanceState = await window.ExGenEngine.examState(draft.exam.exam_manifest);
          if (issuanceState !== "active") {
            back.disabled = false;
            if (issuanceState === null) {
              resumeStatus.textContent = tx("Provet kunde inte verifieras just nu. Kontrollera anslutningen och försök igen.", "The exam could not be verified. Check your connection and try again.");
              return;
            }
            if (issuanceState === "grading") {
              resumeStatus.textContent = tx("Provet håller på att rättas. Vänta tills rättningen är klar innan du fortsätter.", "The exam is being graded. Wait until grading is complete before continuing.");
              return;
            }
            clearDraft();
            S.material = draft.material || "";
            back.textContent = tx("Skapa nytt prov av materialet", "Create a new exam from this material");
            resumeStatus.textContent = issuanceState === "completed"
              ? tx("Provet är redan inlämnat. Materialet finns kvar om du vill skapa ett nytt.", "This exam has already been submitted. Your material is still here if you want to create a new one.")
              : tx("Det tidigare provet har avslutats eller gått ut. Materialet finns kvar; skapa ett nytt prov för att fortsätta.", "The previous exam has ended or expired. Your material is still here; create a new exam to continue.");
            back.dataset.expired = "true";
            return;
          }
        }
        S.course = draft.course || "";
        S.level = draft.level || "C";
        S.qType = draft.qType || "mix";
        S.num = draft.num || 12;
        S.nonGraphNum = clamp(Number(draft.nonGraphNum) || (S.qType === "graph" ? 12 : S.num), 3, 20);
        S.material = draft.material || "";
        if (legacyDraft || back.dataset.expired === "true") { stepMaterial(); return; }
        S.exam = draft.exam;
        S.answers = questionState(draft.answers);
        S.helped = questionState(draft.helped);
        S.idx = clamp(Number(draft.idx) || 0, 0, draft.exam.questions.length - 1);
        S.submitting = false;
        // Motorn måste känna till provet igen — den startade om med sidan och
        // har ingen currentExam att rätta mot.
        window.ExGenEngine.setInputs({
          course: S.course, level: S.level, qType: S.qType,
          num: S.num, material: S.material
        });
        window.ExGenEngine.adoptExam(S.exam);
        openExam(Number(draft.startedAt) || 0);
      });
      act.appendChild(back);
    }

    b.appendChild(act);
    if ((!draft || !draft.exam.exam_manifest) && window.ExGenEngine && window.ExGenEngine.activeExamCount) {
      var recovery = el("div", "xf-err xf-exam-recovery");
      recovery.hidden = true;
      recovery.setAttribute("role", "status");
      var recoveryText = el("p");
      var reset = el("button", "xf-btn ghost", tx("Avsluta tidigare prov", "End previous exams"));
      reset.type = "button";
      reset.addEventListener("click", function () {
        if (!window.confirm(tx("Avsluta alla pågående prov på ditt konto? De kan då inte lämnas in, även om de är öppna på en annan enhet.", "End all active exams on your account? They can no longer be submitted, even if open on another device."))) return;
        reset.disabled = true;
        window.ExGenEngine.abandonAllActiveExams().then(function (result) {
          if (!result || !result.ok) {
            recoveryText.textContent = tx("Proven kunde inte avslutas just nu. Försök igen när anslutningen fungerar.", "The exams could not be ended. Try again when your connection is working.");
            return;
          }
          clearDraft();
          stepStart();
        }).catch(function () {
          recoveryText.textContent = tx("Proven kunde inte avslutas just nu. Försök igen när anslutningen fungerar.", "The exams could not be ended. Try again when your connection is working.");
        }).finally(function () { reset.disabled = false; });
      });
      recovery.appendChild(recoveryText);
      recovery.appendChild(reset);
      b.appendChild(recovery);
      window.ExGenEngine.activeExamCount().then(function (count) {
        if (renderVersion !== startVersion || !UI.screens.start.classList.contains("on")) return;
        if (count > 0) {
          recovery.hidden = false;
          recoveryText.textContent = count === 1
            ? tx("Ett prov finns kvar på ditt konto men inte på den här enheten. Du kan avsluta det här om du inte kan fortsätta det.", "One exam is active on your account but not on this device. You can end it here if you cannot resume it.")
            : tx(count + " prov finns kvar på ditt konto men inte på den här enheten. Avsluta dem bara om du inte behöver fortsätta på en annan enhet.", count + " exams are active on your account but not on this device. End them only if you do not need to continue on another device.");
        }
      }).catch(function () {});
    }
    if (window.ExGenEngine && window.ExGenEngine.getPendingAccountSaves) {
      var pendingBox = el("div", "xf-err xf-save-warning xf-pending-saves");
      pendingBox.hidden = true;
      var pendingIntro = el("p");
      pendingBox.appendChild(pendingIntro);
      var pendingList = el("div", "xf-pending-list");
      pendingBox.appendChild(pendingList);
      b.appendChild(pendingBox);
      window.ExGenEngine.getPendingAccountSaves().then(function (rows) {
        if (renderVersion !== startVersion || !UI.screens.start.classList.contains("on") || !rows || !rows.length) return;
        if (window.dismissWelcome) window.dismissWelcome();
        pendingBox.hidden = false;
        pendingIntro.textContent = rows.length === 1
          ? tx("Ett prov väntar på att sparas till ditt konto. Det finns kvar på den här enheten.", "One exam is waiting to be saved to your account. It is still on this device.")
          : tx(rows.length + " prov väntar på att sparas till ditt konto. De finns kvar på den här enheten.", rows.length + " exams are waiting to be saved to your account. They are still on this device.");
        rows.forEach(function (row) {
          var label = [String(row.course || tx("Prov", "Exam")).slice(0, 60), new Date(row.created_at).toLocaleDateString(isEnglish() ? "en-GB" : "sv-SE")].filter(Boolean).join(" · ");
          var retry = el("button", "xf-btn quiet", tx("Spara " + label, "Save " + label));
          retry.type = "button";
          retry.addEventListener("click", function () {
            if (retry.disabled) return;
            retry.disabled = true;
            retry.textContent = tx("Sparar…", "Saving…");
            window.ExGenEngine.retryAccountSave(row.local_id).then(function (saved) {
              if (saved && saved.ok) {
                retry.remove();
                var remaining = pendingList.querySelectorAll("button").length;
                pendingIntro.textContent = remaining
                  ? tx("Provet sparades till kontot. " + remaining + (remaining === 1 ? " prov väntar fortfarande." : " prov väntar fortfarande."), "The exam was saved. " + remaining + (remaining === 1 ? " exam is still waiting." : " exams are still waiting."))
                  : tx("Alla väntande prov är nu sparade till kontot.", "All waiting exams are now saved to your account.");
                if (!remaining) pendingBox.classList.add("saved");
              } else {
                retry.disabled = false;
                retry.textContent = tx("Försök spara " + label + " igen", "Try saving " + label + " again");
                pendingIntro.textContent = tx("Kontosparningen kunde inte bekräftas. Provet finns kvar på den här enheten.", "The save could not be confirmed. Your exam is still on this device.");
              }
            }).catch(function () {
              retry.disabled = false;
              retry.textContent = tx("Försök spara " + label + " igen", "Try saving " + label + " again");
              pendingIntro.textContent = tx("Kontosparningen kunde inte bekräftas. Provet finns kvar på den här enheten.", "The save could not be confirmed. Your exam is still on this device.");
            });
          });
          pendingList.appendChild(retry);
        });
      }).catch(function () {});
    }
    screen("start");
  }

  /* ── Kurskatalogen ──────────────────────────────────────────────────────
     Ämnen, kurser och nivåer ur Skolverkets läroplaner
     (config/education-catalog.web.json, genererad av tools/sync-skolverket.mjs).
     Både GY11 och Gy25 finns med: en elev som började före ämnesbetygsreformen
     läser fortfarande "Matematik 1b", och hela hens provhistorik hänger på just
     den strängen.

     Fältet är fortfarande fritext. Katalogen föreslår, den begränsar inte —
     eleven som pluggar något vi inte har en kod för ska inte stoppas av att en
     lista saknar raden.

     Filen är ~175 kB och hämtas därför först när ämnessteget faktiskt visas,
     aldrig vid sidladdning. */
  var eduCatalog = null, eduPending = null;

  function loadEduCatalog() {
    if (eduCatalog) return Promise.resolve(eduCatalog);
    if (eduPending) return eduPending;
    eduPending = fetch("/config/education-catalog.web.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { eduCatalog = d; return d; })
      .catch(function () { return null; });
    return eduPending;
  }

  /* Positionerna speglar webCatalog() i tools/sync-skolverket.mjs:
     ämne [kod, namn, skolform, läroplan, aktiv]
     nivå [kod, ämneskod, visningsnamn, läroplan, aktiv] */
  function eduSuggestions(query) {
    if (!eduCatalog) return [];
    var q = String(query || "").trim().toLowerCase();
    if (q.length < 2) return [];

    /* Träffar som BÖRJAR på det eleven skrev går först. Utan rangordningen
       fyllde katalogordningen listan med kurser som bara råkar innehålla ordet:
       "Biologi" gav fyrtio rader med Bevarandebiologi och Djurens biologi innan
       "Biologi 1" och "Biologi (grundskola)" ens syntes. Det är rätt data men
       fel svar på frågan. */
    var prefix = [], inuti = [], i, namn;

    var levels = eduCatalog.levels || [];
    for (i = 0; i < levels.length; i++) {
      namn = levels[i][2];
      var pos = namn.toLowerCase().indexOf(q);
      if (pos === 0) prefix.push(namn);
      else if (pos > 0) inuti.push(namn);
    }

    var subjects = eduCatalog.subjects || [];
    for (i = 0; i < subjects.length; i++) {
      if (subjects[i][2] !== "GR") continue;
      namn = subjects[i][1] + " (grundskola)";
      if (subjects[i][1].toLowerCase().indexOf(q) === 0) prefix.push(namn);
      else if (subjects[i][1].toLowerCase().indexOf(q) > 0) inuti.push(namn);
    }

    /* Inom prefixgruppen vinner det kortaste namnet. Katalogordningen är
       alfabetisk på ÄMNESKOD, vilket gav "Biologi – naturbruk – specialisering"
       före "Biologi 1". Längden är en grov men träffsäker närhetsmätning: ju
       mindre som står efter det eleven skrev, desto närmare är det det hen
       menade. */
    prefix.sort(function (a, b) { return a.length - b.length || a.localeCompare(b, "sv"); });
    return prefix.concat(inuti).slice(0, 40);
  }

  // ── Steg 1: ämne ─────────────────────────────────────────────────────────

  function stepSubject() {
    UI.languageRerender = stepSubject;
    var d = dna();
    var b = mount("subject");

    if (d.courses.length) {
      say(tx("Samma som sist?", "Same course as last time?"), tx("Tryck på en kurs, eller skriv en annan.", "Choose a course or type a different one."));
    } else {
      say(tx("Vilken kurs gäller det?", "Which course is this for?"), tx("Skriv kursens namn — t.ex. Biologi 1 eller Historia 1b.", "Enter the course name, for example Biology 1 or History 1b."));
    }

    if (d.courses.length) {
      var chips = el("div", "xf-chips");
      d.courses.forEach(function (c) {
        var ch = el("button", "xf-chip", c);
        ch.type = "button";
        ch.addEventListener("click", function () {
          S.course = c;
          stepAim();
        });
        chips.appendChild(ch);
      });
      b.appendChild(chips);
    }

    var inp = el("input", "xf-input");
    inp.type = "text";
    inp.placeholder = d.courses.length ? tx("…eller skriv en annan kurs", "…or enter another course") : tx("Kurs eller ämne", "Course or subject");
    inp.value = S.course || "";
    inp.setAttribute("autocomplete", "off");
    inp.setAttribute("aria-label", tx("Kurs eller ämne", "Course or subject"));
    inp.setAttribute("list", "xfCourseList");
    b.appendChild(inp);

    /* En datalist och inte en egen rullgardin: den ärver systemets tangent- och
       skärmläsarbeteende gratis, och fungerar likadant på mobil. Listan fylls om
       vid varje tangenttryck och kapas — 2192 poster i en datalist är oanvändbart
       på telefon, vilket är där de flesta pluggar. */
    var dl = el("datalist");
    dl.id = "xfCourseList";
    b.appendChild(dl);

    function paintSuggestions() {
      var rows = eduSuggestions(inp.value);
      dl.textContent = "";
      for (var i = 0; i < rows.length; i++) {
        var o = document.createElement("option");
        o.value = rows[i];
        dl.appendChild(o);
      }
    }

    var courseNotice = el("div", "xf-note");
    courseNotice.id = "xfCourseCatalogNotice";
    courseNotice.setAttribute("role", "status");
    courseNotice.setAttribute("aria-live", "polite");
    courseNotice.setAttribute("aria-atomic", "true");
    b.appendChild(courseNotice);

    function paintCourseNotice() {
      var value = inp.value.trim();
      if (!value) {
        courseNotice.textContent = "";
        return;
      }
      if (!eduCatalog) {
        courseNotice.textContent = tx("Kurslistan kunde inte kontrolleras. Du kan fortsätta, men ExGen kan inte bekräfta kursplanen.", "The course list could not be checked. You can continue, but ExGen cannot confirm the curriculum.");
        return;
      }
      var normalized = value.toLowerCase().replace(/\s+/g, " ");
      var exactMatch = eduSuggestions(value).some(function (suggestion) {
        return suggestion.toLowerCase().replace(/\s+/g, " ") === normalized;
      });
      courseNotice.textContent = exactMatch
        ? ""
        : tx("Kursen matchar inte kurskatalogen. Du kan fortsätta, men ExGen kan inte bekräfta kursplanen.", "The course does not match the course catalogue. You can continue, but ExGen cannot confirm the curriculum.");
    }

    loadEduCatalog().then(function () {
      paintSuggestions();
      paintCourseNotice();
    });

    var err = el("div", "xf-err");
    err.id = "xfCourseError";
    err.setAttribute("role", "alert");
    err.setAttribute("aria-atomic", "true");
    inp.setAttribute("aria-describedby", err.id + " " + courseNotice.id);
    b.appendChild(err);

    function next() {
      var v = inp.value.trim();
      if (!v) {
        err.textContent = tx("Skriv vilken kurs det gäller så kan jag matcha nivån.", "Enter the course so I can match the level.");
        inp.setAttribute("aria-invalid", "true");
        inp.focus();
        return;
      }
      S.course = v;
      stepAim();
    }

    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") next(); });
    inp.addEventListener("input", function () {
      S.course = inp.value;
      err.textContent = "";
      inp.removeAttribute("aria-invalid");
      paintSuggestions();
      paintCourseNotice();
    });

    var act = el("div", "xf-act");
    var go = el("button", "xf-btn primary", tx("Vidare", "Continue"));
    go.type = "button";
    go.addEventListener("click", next);
    act.appendChild(go);
    act.appendChild(backBtn(stepStart));
    b.appendChild(act);

    screen("subject");
    setTimeout(function () { if (!d.courses.length) inp.focus(); }, 320);
  }

  // ── Steg 2: sikte ────────────────────────────────────────────────────────
  /* Här ligger hela skillnaden mot en vanlig inställningssida: P.E.R har redan
     fyllt i allt utifrån Prov-DNA. Eleven ska kunna trycka en gång och vara
     klar; ändringarna finns men kostar ett extra tryck att öppna. */

  function stepAim() {
    var preserveSelection = arguments.length > 0 && arguments[0] === true;
    UI.languageRerender = function () { stepAim(true); };
    var d = dna();
    var b = mount("aim");

    if (!preserveSelection) {
      S.level = d.level;
      S.qType = d.qType;
      S.nonGraphNum = d.num;
      S.num = S.qType === "graph" ? 1 : d.num;
    }

    var misses = d.missCountFor(S.course);

    if (d.count === 0) {
      say(tx("Första provet i " + S.course + ".", "Your first exam in " + S.course + "."),
          tx("Jag siktar brett den här gången och kalibrerar efter ditt resultat.", "I'll cover a broad range and adjust future practice based on your result."));
    } else if (misses > 0) {
      say(tx("Jag siktar på nivå " + S.level + ".", "I'm aiming for level " + S.level + "."),
          tx("Du har " + misses + " tidigare fel i " + S.course + " — dem viktar jag upp.", "You have " + misses + " earlier mistakes in " + S.course + "; I'll give those extra weight."));
    } else {
      say(tx("Jag siktar på nivå " + S.level + ".", "I'm aiming for level " + S.level + "."),
          tx("Baserat på dina senaste prov. Ändra om du vill något annat.", "Based on your recent exams. Change it if you'd prefer something else."));
    }

    var card = el("div", "xf-card");
    var dl = el("dl");
    dl.style.margin = "0";

    function row(label, value, hint) {
      var r = el("div", "xf-row");
      r.appendChild(el("dt", null, label));
      var dd = el("dd", null, value);
      if (hint) dd.appendChild(el("small", null, hint));
      r.appendChild(dd);
      return r;
    }

    var levelText = isEnglish()
      ? { E: "E — show you know the basics", C: "C — explain and apply", A: "A — analyse and evaluate" }
      : { E: "E — visa att du kan grunderna", C: "C — förklara och tillämpa", A: "A — analysera och värdera" };
    var typeText = isEnglish()
      ? { mix: "Mixed", mc: "Multiple choice only", short: "Short answers only", graph: "Interactive graph" }
      : { mix: "Blandat", mc: "Bara flerval", short: "Bara kortsvar", graph: "Interaktiv graf" };

    var rLevel = row(tx("Nivå", "Level"), S.level, levelText[S.level]);
    var rType = row(tx("Frågetyp", "Question type"), typeText[S.qType], null);
    var rNum = row(tx("Antal frågor", "Number of questions"), S.qType === "graph" ? tx("1 grafuppgift", "1 graph task") : String(S.num), null);
    dl.appendChild(rLevel);
    dl.appendChild(rType);
    dl.appendChild(rNum);
    card.appendChild(dl);
    var graphHint = el("p", "xf-graph-limit-note",
      tx("Matematik: en uttrycklig rät linje y = mx + b med heltalsvärden. Natur- och samhällsvetenskap: en tabell med två rubriker avdelade med | och exakt tre heltalsrader mellan −5 och 5 med olika x-värden. Andra graf- och diagramformat stöds inte ännu.", "Math: an explicit straight line y = mx + b with integer values. Natural and social sciences: a table with two headings separated by | and exactly three integer rows from −5 to 5 with distinct x-values. Other graph and chart formats are not supported yet.") );
    graphHint.hidden = S.qType !== "graph";
    card.appendChild(graphHint);
    b.appendChild(card);

    // Justeringarna ligger vikta. Den som är nöjd ser dem aldrig.
    var tweak = el("div");
    tweak.hidden = true;

    tweak.appendChild(pickerRow(tx("Nivå", "Level"), ["E", "C", "A"], S.level, function (v) {
      S.level = v;
      rLevel.querySelector("dd").firstChild.nodeValue = v;
      rLevel.querySelector("small").textContent = levelText[v];
    }));

    tweak.appendChild(pickerRow(tx("Frågetyp", "Question type"), ["mix", "mc", "short", "graph"], S.qType, function (v) {
      var wasGraph = S.qType === "graph";
      S.qType = v;
      rType.querySelector("dd").textContent = typeText[v];
      graphHint.hidden = v !== "graph";
      if (v === "graph") {
        if (!wasGraph && S.num >= 3) S.nonGraphNum = S.num;
        S.num = 1;
      } else if (wasGraph) {
        S.num = clamp(Number(S.nonGraphNum) || d.num, 3, 20);
        S.nonGraphNum = S.num;
      }
      rNum.querySelector("dd").textContent = v === "graph" ? tx("1 grafuppgift", "1 graph task") : String(S.num);
      setGraphCountMode(v === "graph", String(S.num));
    }, function (v) { return typeText[v]; }));

    var countPicker = pickerRow(tx("Antal", "Count"), ["1", "3", "6", "10", "12", "16", "20"], String(S.num), function (v) {
      var count = Number(v);
      if ((S.qType === "graph" && count !== 1) || (S.qType !== "graph" && count < 3)) return;
      S.num = count;
      if (S.qType !== "graph") S.nonGraphNum = count;
      rNum.querySelector("dd").textContent = S.qType === "graph" ? tx("1 grafuppgift", "1 graph task") : v;
    });
    function setGraphCountMode(enabled, selected) {
      Array.prototype.forEach.call(countPicker.querySelectorAll(".xf-chip"), function (button) {
        var value = button.textContent.trim();
        var one = value === "1";
        button.disabled = enabled ? !one : one;
        button.classList.toggle("sel", value === selected);
      });
    }
    tweak.appendChild(countPicker);
    setGraphCountMode(S.qType === "graph", String(S.num));

    b.appendChild(tweak);

    var act = el("div", "xf-act");
    var go = el("button", "xf-btn primary", tx("Stämmer — vidare", "Looks good — continue"));
    go.type = "button";
    go.addEventListener("click", stepMaterial);
    act.appendChild(go);

    var adj = el("button", "xf-btn quiet", tx("Ändra", "Adjust"));
    adj.type = "button";
    adj.addEventListener("click", function () {
      tweak.hidden = !tweak.hidden;
      adj.textContent = tweak.hidden ? tx("Ändra", "Adjust") : tx("Dölj", "Hide");
    });
    act.appendChild(adj);
    act.appendChild(backBtn(stepSubject));
    b.appendChild(act);

    screen("aim");
  }

  function pickerRow(label, values, current, onPick, labeller) {
    var wrap = el("div");
    wrap.style.marginBottom = "18px";
    wrap.appendChild(el("div", "xf-eyebrow", label));
    var chips = el("div", "xf-chips");
    values.forEach(function (v) {
      var ch = el("button", "xf-chip" + (v === current ? " sel" : ""), labeller ? labeller(v) : v);
      ch.type = "button";
      ch.addEventListener("click", function () {
        Array.prototype.forEach.call(chips.children, function (c) { c.classList.remove("sel"); });
        ch.classList.add("sel");
        onPick(v);
      });
      chips.appendChild(ch);
    });
    wrap.appendChild(chips);
    return wrap;
  }

  // ── Steg 3: material ─────────────────────────────────────────────────────

  var STOP = ("och att det en som för med den de var på är av till om inte har " +
    "ett kan man vid han hon jag vi ni du sig men så där när eller alla också " +
    "detta denna dessa vilket vilken samt under efter före mellan genom mycket " +
    "andra vara blir blev hade skulle kunna finns bland utan över").split(" ");

  /* Begreppsläsning i klienten. Ingen AI, inget anrop — ord som återkommer i
     elevens egen text, filtrerade mot stoppord. Det är därför raden får heta
     "hittade begrepp" och inte "analyserat": den påstår bara det den vet. */
  function terms(text) {
    var words = String(text).toLowerCase().match(/[a-zåäö][a-zåäö\-]{4,}/g) || [];
    var freq = {};
    words.forEach(function (w) {
      if (STOP.indexOf(w) !== -1) return;
      freq[w] = (freq[w] || 0) + 1;
    });
    var all = Object.keys(freq);

    // Ord som återkommer är den starkaste signalen och kommer först.
    var repeated = all
      .filter(function (w) { return freq[w] >= 2; })
      .sort(function (a, b) { return freq[b] - freq[a]; });

    /* En kort inklistring — några meningar från en anteckning — innehåller
       ofta varje begrepp exakt en gång. Med enbart återkomstregeln blev raden
       då tom och föll tillbaka på ett teckenantal, vilket sett från elevens
       håll ser ut som att ingenting lästes. Mätt på produktionssajten:
       "Cellandning sker i mitokondrien. Glykolysen ger 2 ATP…" gav noll
       begrepp. Fyll därför på med de längsta orden — fortfarande elevens egna
       ord, bara valda på särprägel i stället för på upprepning. */
    if (repeated.length < 3) {
      var byLength = all
        .filter(function (w) { return repeated.indexOf(w) === -1 && w.length >= 7; })
        .sort(function (a, b) { return b.length - a.length; });
      repeated = repeated.concat(byLength);
    }

    return repeated.slice(0, 6);
  }

  function stepMaterial() {
    UI.languageRerender = stepMaterial;
    var b = mount("material");

    say(tx("Ge mig materialet.", "Add your study material."),
        tx("Klistra in anteckningar, en sammanfattning eller lärarens presentation. Rubriker och punktlistor ger bättre frågor.", "Paste notes, a summary or your teacher's slides. Headings and bullet points help create better questions."));

    var ta = el("textarea", "xf-area");
    ta.placeholder = tx("Klistra in här…", "Paste your material here…");
    ta.value = S.material || "";
    ta.setAttribute("aria-label", tx("Studiematerial", "Study material"));
    b.appendChild(ta);

    var read = el("div", "xf-read");
    b.appendChild(read);

    // Bild → text ligger utanför den avgränsade elevpiloten.
    if (!(window.ExGenRuntime && window.ExGenRuntime.environment === "pilot")) {
    var ocrWrap = el("div", "xf-act");
    ocrWrap.style.marginTop = "14px";
    var file = el("input");
    file.type = "file";
    file.accept = "image/*";
    file.setAttribute("capture", "environment");
    file.style.display = "none";
    var ocrBtn = el("button", "xf-btn ghost", tx("Fota en sida i stället", "Take a photo of a page instead"));
    ocrBtn.type = "button";
    ocrBtn.addEventListener("click", function () { file.click(); });
    file.addEventListener("change", function () {
      if (!file.files || !file.files[0]) return;
      var selectedFile = file.files[0];
      file.value = "";
      ocrBtn.disabled = true;
      ocrBtn.textContent = tx("Läser bilden…", "Reading image…");
      busy(true);
      window.ExGenEngine.ocr(selectedFile).then(function (r) {
        busy(false);
        ocrBtn.disabled = false;
        ocrBtn.textContent = tx("Fota en sida i stället", "Take a photo of a page instead");
        if (r && r.ok && r.text) {
          ta.value = (ta.value ? ta.value + "\n\n" : "") + r.text;
          onType();
        } else {
          err.textContent = (r && r.error) || tx("Kunde inte läsa bilden. Prova en tydligare bild.", "Could not read the image. Try a clearer photo.");
        }
      });
    });
    ocrWrap.appendChild(ocrBtn);
    ocrWrap.appendChild(file);
    b.appendChild(ocrWrap);
    }

    var err = el("div", "xf-err");
    err.setAttribute("role", "alert");
    err.setAttribute("aria-atomic", "true");
    b.appendChild(err);

    var act = el("div", "xf-act");
    var go = el("button", "xf-btn primary", tx("Klart", "Continue"));
    go.type = "button";
    go.disabled = true;
    go.addEventListener("click", function () {
      S.material = ta.value.trim().slice(0, MATERIAL_MAX);
      stepContract();
    });
    act.appendChild(go);
    act.appendChild(backBtn(stepAim));
    b.appendChild(act);

    function onType() {
      var v = ta.value.trim();
      S.material = ta.value;
      err.textContent = "";
      go.disabled = !v;

      read.innerHTML = "";
      if (!v) return;

      if (v.length < 120) {
        read.appendChild(el("span", null, tx("Kort underlag — lägg gärna till sammanhang för fler varierade frågor.", "This is a short source. Add more context for a wider range of questions.")));
        return;
      }

      var t = terms(v);
      read.appendChild(el("b", null, tx("Hittade begrepp", "Key terms")));
      if (t.length) {
        t.forEach(function (w) {
          read.appendChild(el("span", "xf-term", w));
        });
      } else {
        read.appendChild(el("span", null, v.length + " tecken"));
      }
      if (v.length > MATERIAL_MAX) {
        var warn = el("span", null, tx("· använder de första " + MATERIAL_MAX + " tecknen", "· using the first " + MATERIAL_MAX + " characters"));
        warn.style.color = "var(--exgen-warning-text)";
        read.appendChild(warn);
      }
    }

    ta.addEventListener("input", onType);
    onType();

    screen("material");
    setTimeout(function () { ta.focus(); }, 320);
  }

  // ── Steg 4: provkontraktet ───────────────────────────────────────────────
  /* Vad som ska byggas, innan det byggs. Fel rättas här — inte efter fyrtio
     sekunders väntan på fel prov. */

  function stepContract() {
    UI.languageRerender = stepContract;
    var d = dna();
    var b = mount("contract");
    var misses = d.missCountFor(S.course);

    say(tx("Så här blir provet.", "Review your exam."), tx("Titta igenom. Ändrar du något nu slipper du göra om det sen.", "Check the details. Make any changes now before you create it."));

    var mins = estimateMinutes(S.num, S.qType);

    var card = el("div", "xf-card");
    var dl = el("dl");
    dl.style.margin = "0";

    function row(label, value, hint) {
      var r = el("div", "xf-row");
      r.appendChild(el("dt", null, label));
      var dd = el("dd", null, value);
      if (hint) dd.appendChild(el("small", null, hint));
      r.appendChild(dd);
      return r;
    }

    dl.appendChild(row(tx("Kurs", "Course"), S.course));
    dl.appendChild(row(tx("Nivå", "Level"), S.level));
    dl.appendChild(row(tx("Omfattning", "Format"), S.num + " " + tx("frågor", "questions"),
      S.qType === "mc" ? tx("Flervalsfrågor", "Multiple choice") : S.qType === "short" ? tx("Kortsvar", "Short answer") : S.qType === "graph" ? tx("Interaktiv graf", "Interactive graph") : tx("Blandat flerval och kortsvar", "Mixed multiple choice and short answer")));
    dl.appendChild(row(tx("Tar ungefär", "Estimated time"), "~" + mins + " " + tx("min", "min"), tx("Räknat på din svarstid, inte på lästid", "Based on answer time, not reading time")));
    if (misses > 0) {
      dl.appendChild(row(tx("Extra vikt", "Extra focus"), misses + " " + tx("tidigare fel", "earlier mistakes"), tx("Från din felbank i " + S.course, "From your mistake bank for " + S.course)));
    }
    card.appendChild(dl);
    b.appendChild(card);

    var t = terms(S.material);
    if (t.length) {
      var cov = el("div");
      cov.appendChild(el("div", "xf-eyebrow", tx("Begrepp jag hittade i ditt material", "Key terms found in your material")));
      var chips = el("div", "xf-cov");
      t.forEach(function (w) { chips.appendChild(el("span", null, w)); });
      cov.appendChild(chips);
      b.appendChild(cov);
    }

    var err = el("div", "xf-err");
    err.setAttribute("role", "alert");
    err.setAttribute("aria-atomic", "true");
    b.appendChild(err);

    var act = el("div", "xf-act");
    var go = el("button", "xf-btn primary", tx("Skapa provet", "Create exam"));
    go.type = "button";
    go.addEventListener("click", function () { build(go, err); });
    act.appendChild(go);
    var perButton = el("button", "xf-btn ghost xf-contract-per", tx("Fråga P.E.R", "Ask P.E.R"));
    perButton.type = "button";
    perButton.setAttribute("aria-expanded", "false");
    perButton.addEventListener("click", function () {
      var bubble = document.getElementById("perBubble");
      var panel = document.getElementById("perPanel");
      if (!bubble || !panel) return;
      bubble.click();
      perButton.setAttribute("aria-expanded", panel.classList.contains("per-open") ? "true" : "false");
    });
    act.appendChild(backBtn(stepMaterial));
    act.appendChild(perButton);
    b.appendChild(act);

    b.appendChild(el("div", "xf-note",
      tx("AI skapar frågor med ditt material som underlag, men kan missa detaljer. Kontrollera att de passar kursen medan du arbetar igenom provet.", "AI creates questions using your material as a reference, but may miss details. Check that they fit your course as you work through the exam.")));

    screen("contract");
  }

  function estimateMinutes(num, qType) {
    // Mätt mot faktiska svarstider i provläget: flerval ~1 min, kortsvar ~3.
    var per = qType === "mc" ? 1 : qType === "short" ? 3 : qType === "graph" ? 3 : 2;
    return Math.max(5, Math.round(num * per));
  }

  // ── Generering ───────────────────────────────────────────────────────────

  function build(btn, err) {
    // Varje generering drar ur elevens kvot. Ett dubbelklick, eller "Gör om"
    // tryckt två gånger, får inte kosta två prov.
    if (S.generating) return;
    S.generating = true;

    btn.disabled = true;
    btn.textContent = tx("Bygger…", "Building…");
    busy(true);
    err.textContent = "";
    say(tx("Bygger ditt prov.", "Building your exam."), tx("Tar oftast under en minut.", "This usually takes less than a minute."));

    function done() {
      S.generating = false;
      busy(false);
      btn.disabled = false;
      btn.textContent = tx("Skapa provet", "Create exam");
    }

    window.ExGenEngine.setInputs({
      course: S.course, level: S.level, qType: S.qType,
      num: S.num, material: S.material
    });

    window.ExGenEngine.generate().then(function (r) {
      done();
      if (!r || !r.ok || !r.exam || !Array.isArray(r.exam.questions) || !r.exam.questions.length) {
        err.textContent = (r && r.error) || tx("Provet kunde inte byggas. Försök igen.", "The exam could not be created. Please try again.");
        say(tx("Det gick inte den här gången.", "That did not work this time."), tx("Försök igen, gärna med färre frågor.", "Try again, perhaps with fewer questions."));
        return;
      }
      S.exam = normalizeIds(r.exam);
      S.answers = questionState();
      S.helped = questionState();
      S.idx = 0;
      S.nudges = 0;
      S.lastNudge = 0;
      S.submitting = false;
      saveDraft();
      openExam();

      /* Kvalitetskontrollen i generate-exam.js sorterar bort frågor den inte
         litar på, och gör det tyst: ett prov på tolv frågor kan landa på sju.
         Mätt skarpt mot gpt-4o-mini underkände verifieraren tre av sex. Utan
         det här beskedet ser eleven bara att kontraktet lovade ett antal och
         provet visar ett annat, vilket läser som en bugg i stället för som
         kvalitetsarbete. */
      var got = S.exam.questions.length;
      if (got < S.num) {
        nudge(tx("Jag skrev " + S.num + " frågor men kastade " + (S.num - got) +
              " som inte höll måttet. Du får " + got + " — hellre färre och rätt.", "I drafted " + S.num + " questions but removed " + (S.num - got) +
              " that did not meet the quality bar. You will get " + got + " instead — fewer, but better."), true);
      }
    }).catch(function (e) {
      /* generate() går via runGenerate i app.html. postJson kastar aldrig,
         men andra auth-/UI-anrop kan göra det. Återställ alltid knappen så att
         ett tillfälligt klientfel inte låser eleven ute från ett nytt försök. */
      done();
      err.textContent = tx("Något gick fel på vägen. Kontrollera uppkopplingen och försök igen.", "Something went wrong. Check your connection and try again.");
      say(tx("Det gick inte den här gången.", "That did not work this time."), tx("Försök igen om en stund.", "Please try again shortly."));
      if (window.console && console.warn) console.warn("[exam-flow] generate:", e);
    });
  }

  /* Fråge-id kommer ordagrant från modellen och JSON-schemat i
     api/generate-exam.js kräver ingen unikhet. Två frågor med samma id delade
     tidigare samma post i S.answers och S.helped: eleven svarade på fråga 4 och
     såg svaret dyka upp på fråga 9. Normaliseringen sker på plats, på samma
     objekt som motorn redan håller i currentExam, så att rättningens payload,
     felbanken och resultatmatchningen ser samma unika id:n. */
  function normalizeIds(exam) {
    var seen = Object.create(null);
    exam.questions.forEach(function (q, i) {
      var id = String(q.id != null && String(q.id).trim() ? q.id : i + 1);
      if (seen[id]) id = id + "-" + (i + 1);
      seen[id] = true;
      q.id = id;
    });
    return exam;
  }

  // ── Provläget ────────────────────────────────────────────────────────────

  function qid(q, i) { return String(q.id != null ? q.id : i + 1); }

  /* Låser och låser upp sidans scroll utan att glömma vad som gällde innan.
     Att alltid återställa till tom sträng raderade ett eventuellt inline-värde
     som någon annan del av sidan hade satt. */
  function lockScroll(on) {
    if (on) {
      if (prevOverflow === null) prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else if (prevOverflow !== null) {
      document.body.style.overflow = prevOverflow;
      prevOverflow = null;
    }
  }

  function setExamBackgroundInert(on) {
    if (on) {
      if (examInertState) return;
      var root = UI.exam && UI.exam.parentElement;
      var per = document.getElementById("perWidget");
      var nodes = [];
      Array.prototype.forEach.call(root ? root.children : [], function (node) {
        if (node !== UI.exam) nodes.push(node);
      });
      Array.prototype.forEach.call(document.body.children, function (node) {
        if (node !== root && node !== per && !/^(SCRIPT|STYLE)$/.test(node.tagName)) nodes.push(node);
      });
      examInertState = nodes.map(function (node) {
        return [node, node.inert, node.getAttribute("aria-hidden")];
      });
      examInertState.forEach(function (entry) {
        entry[0].inert = true;
        entry[0].setAttribute("aria-hidden", "true");
      });
      return;
    }
    (examInertState || []).forEach(function (entry) {
      entry[0].inert = entry[1];
      if (entry[2] === null) entry[0].removeAttribute("aria-hidden");
      else entry[0].setAttribute("aria-hidden", entry[2]);
    });
    examInertState = null;
  }

  function examTabStops() {
    var selector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    var stops = Array.prototype.filter.call(UI.exam.querySelectorAll(selector), function (node) {
      return node.getClientRects().length > 0 && !node.closest('[inert]');
    });
    var per = document.getElementById("perWidget");
    if (per && per.getClientRects().length > 0) {
      stops = stops.concat(Array.prototype.filter.call(per.querySelectorAll(selector), function (node) {
        return node.getClientRects().length > 0 && !node.disabled;
      }));
    }
    return stops;
  }

  function openExam(resumedAt) {
    UI.languageRerender = null;
    if (window.dismissWelcome) window.dismissWelcome();
    document.body.classList.remove("xf-contract");
    // Vid återupptagning behålls den tid provet redan pågått. Att nollställa
    // klockan hade dolt att eleven redan suttit en halvtimme och gjort både
    // tidsangivelsen och tempo-varningen missvisande.
    S.startedAt = typeof resumedAt === "number" && resumedAt > 0 ? resumedAt : Date.now();
    if (!examReturnFocus && document.activeElement && document.activeElement !== document.body) {
      examReturnFocus = document.activeElement;
    }
    setExamBackgroundInert(true);
    UI.exam.inert = false;
    UI.exam.removeAttribute("aria-hidden");
    UI.exam.setAttribute("aria-modal", "true");
    UI.exam.setAttribute("aria-owns", "perWidget");
    UI.exam.classList.add("on");
    document.body.classList.add("xf-in-exam");
    lockScroll(true);
    tick();
    renderQuestion(true);
    watchKeyboard(true);
  }

  function closeExam(restoreFocus) {
    UI.exam.classList.remove("on");
    UI.exam.setAttribute("aria-hidden", "true");
    UI.exam.removeAttribute("aria-modal");
    UI.exam.removeAttribute("aria-owns");
    document.body.classList.remove("xf-in-exam", "xf-per-open");
    if (restoreFocus === false) {
      UI.exam.inert = true;
      UI.machine.inert = false;
      UI.machine.removeAttribute("aria-hidden");
    } else {
      setExamBackgroundInert(false);
      UI.exam.inert = false;
    }
    lockScroll(false);
    clearTimeout(stuckTimer);
    clearTimeout(UI.nudgeTimer);
    UI.nudge.classList.remove("on");
    if (UI.clock) clearInterval(UI.clock);
    watchKeyboard(false);
    /* Fritextsvar publiceras debouncat (publishSoon, 500ms). Skriver eleven
       klart sista kortsvarsfrågan och trycker "Lämna in" inom den halv-
       sekunden hinner PER.describe(null) nedan köras först — och sedan
       brinner den redan schemalagda timern och kör publish() på nytt, mot
       ett S.exam som fortfarande finns kvar i minnet. Resultatet: manifestet
       återuppstår på resultatskärmen efter att just ha nollställts. Måste
       clear:as INNAN describe(null), annars hinner ingenting förhindra den. */
    clearTimeout(publishTimer);
    /* Samma felklass, en rad ovanför löste den för manifestet: saveDraftSoon()
       (längre ner i filen) har en egen debouncad timer på 800ms. Fyller eleven
       sista kortsvarsfältet och trycker "Lämna in" hinner den timern schemaläggas
       precis innan closeExam() körs. clearDraft() tar bort utkastet så fort
       rättningen kommer tillbaka — men saveDraft() bryr sig bara om !S.exam, och
       S.exam nollställs först vid "Nytt ämne". Otömd brinner draftTimer under
       maskinytans animation och skriver tillbaka utkastet, så eleven erbjuds
       "Fortsätt provet du började" för ett prov som redan är rättat.*/
    clearTimeout(draftTimer);
    /* Manifestet hörde till frågan som stod på skärmen, inte till det som
       kommer efteråt (resultat, eller en helt annan skärm om eleven väljer
       "Nytt ämne"). Utan den här raden stod P.E.R kvar på "fråga 12 av 12"
       mitt på resultatskärmen — exakt den felklass branchen finns för att
       döda, bara flyttad hit. */
    if (window.PER && window.PER.describe) window.PER.describe(null);
    if (restoreFocus !== false && examReturnFocus) {
      var target = examReturnFocus;
      examReturnFocus = null;
      if (target.isConnected && typeof target.focus === "function") target.focus({ preventScroll: true });
    }
  }

  /* Det virtuella tangentbordet på mobil läggs ovanpå sidan utan att ändra
     window.innerHeight, så .xf-exam-nav (position:fixed; bottom:0) hamnar bakom
     det så fort eleven skriver ett kortsvar — "Nästa" går inte att nå.
     visualViewport vet var den synliga ytan faktiskt slutar; skillnaden skickas
     till CSS som --xf-kb och navigeringen lyfts lika mycket. */
  function onViewport() {
    var vv = window.visualViewport;
    if (!vv) return;
    var hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty("--xf-kb", Math.round(hidden) + "px");
  }

  function watchKeyboard(on) {
    var vv = window.visualViewport;
    if (!vv) return;
    if (on) {
      vv.addEventListener("resize", onViewport);
      vv.addEventListener("scroll", onViewport);
      onViewport();
    } else {
      vv.removeEventListener("resize", onViewport);
      vv.removeEventListener("scroll", onViewport);
      document.documentElement.style.setProperty("--xf-kb", "0px");
    }
  }

  function updateExamClockLabel() {
    if (!UI.time) return;
    var elapsed = UI.time.dataset.elapsed || "00:00";
    UI.time.textContent = tx("Tid hittills: " + elapsed, "Elapsed: " + elapsed);
    UI.time.setAttribute("aria-label", tx("Tid som gått: " + elapsed, "Elapsed time: " + elapsed));
  }
  window.addEventListener("exgen:languagechange", updateExamClockLabel);

  function tick() {
    if (UI.clock) clearInterval(UI.clock);
    var publishedMinute = null;
    // Klockan räknar uppåt. En nedräkning skapar panik utan att lära någon
    // någonting — men eleven ska ändå se att tiden går.
    function paint() {
      var s = Math.floor((Date.now() - S.startedAt) / 1000);
      UI.time.dataset.elapsed = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
      updateExamClockLabel();
      var minute = Math.floor(s / 60);
      if (publishedMinute === null) publishedMinute = minute;
      else if (minute !== publishedMinute) {
        publishedMinute = minute;
        publish();
      }
    }
    // Rita direkt, inte först vid nästa tick. Vid återupptagning står klockan
    // annars kvar på 00:00 i upp till en sekund och hoppar sedan till rätt tid,
    // vilket ser ut som att den nollställdes.
    paint();
    UI.clock = setInterval(paint, 1000);
  }

  /* Manifestet publiceras vid varje frågebyte, inte bara när hjälpknappen
     trycks. Före detta såg P.E.R { page: "prov" } och ingenting mer om eleven
     öppnade bubblan själv — och svarade om fel fråga.

     targets ger P.E.R en väg tillbaka: "ta mig till fråga 7" blir [GOTO:#q7],
     som shared.js slår upp här och kör med go() nedan. */
  var publishTimer = null;

  function publish() {
    updateQuestionDotLabels();
    if (!window.PER || !window.PER.describe) return;
    var qs = (S.exam && S.exam.questions) || [];
    if (!qs.length) return;
    var i = clamp(S.idx, 0, qs.length - 1);
    var q = qs[i];
    if (!q) return;
    var ans = String(S.answers[qid(q, i)] || "");
    var currentAnswered = isAnswerComplete(q, ans);
    var answered = 0;
    qs.forEach(function (qq, n) {
      if (isAnswerComplete(qq, S.answers[qid(qq, n)])) answered++;
    });
    window.PER.describe({
      page: "prov",
      focus: {
        kind: "question",
        number: i + 1,
        of: qs.length,
        text: String(q.question || "").slice(0, 400),
        type: q.type || "short",
        graphMode: q.type === "graph" && q.graph_ui
          && (q.graph_ui.mode === "line" || q.graph_ui.mode === "scatter") ? q.graph_ui.mode : undefined,
        options: Array.isArray(q.options) ? q.options : [],
        category: String(q.topic || ""),
        answer: ans.slice(0, 200),
        answered: currentAnswered
      },
      targets: qs.map(function (qq, n) {
        return {
          id: "q" + (n + 1),
          label: "Fråga " + (n + 1),
          hint: String(qq.question || "").slice(0, 90),
          go: function () { S.idx = n; renderQuestion(); }
        };
      }),
      state: {
        answered: answered,
        remaining: qs.length - answered,
        elapsed: (UI.time && UI.time.dataset.elapsed) || "",
        submissionId: (String(S.exam.exam_manifest || "").match(/^v2\.([a-f0-9]{32})\./) || [])[1] || "",
        /* Visningsfas för P.E.R. Servern litar inte på den som rättningsbevis. */
        phase: "exam"
      }
    });
  }

  function isAnswerComplete(q, raw) {
    if (q && q.type === "graph") return Boolean(window.ExGenGraphAnswer && window.ExGenGraphAnswer.isComplete(raw, q.graph_ui));
    return String(raw || "").trim().length > 0;
  }

  function updateQuestionDotLabels() {
    var qs = (S.exam && S.exam.questions) || [];
    var english = Boolean(window.ExGenEngine && window.ExGenEngine.language && window.ExGenEngine.language() === "en");
    UI.dots.setAttribute("aria-label", english ? "Exam question navigation" : "Provfrågor");
    Array.prototype.forEach.call(UI.dots.children, function (dot, n) {
      var answered = isAnswerComplete(qs[n], S.answers[qid(qs[n], n)]);
      var current = n === S.idx;
      var state = current
        ? (answered ? (english ? "current, answered" : "aktuell, besvarad") : (english ? "current, unanswered" : "aktuell, obesvarad"))
        : (answered ? (english ? "answered" : "besvarad") : (english ? "unanswered" : "obesvarad"));
      dot.setAttribute("aria-label", (english ? "Question " : "Fråga ") + (n + 1) + ", " + state);
      if (current) dot.setAttribute("aria-current", "step");
      else dot.removeAttribute("aria-current");
    });
  }
  window.addEventListener("exgen:languagechange", updateQuestionDotLabels);

  function renderGraphUnavailable(sheet, lang) {
    var en = lang === "en";
    var wrap = el("div", "xf-graph-unavailable");
    var error = el("p", "xf-photo-note bad", en
      ? "The graph tool did not load. You can retry without leaving the exam."
      : "Grafverktyget kunde inte laddas. Försök igen utan att lämna provet.");
    error.setAttribute("role", "alert");

    var retry = el("button", "xf-btn ghost", en ? "Retry graph tool" : "Försök igen");
    retry.type = "button";
    var status = el("p", "xf-graph-retry-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    retry.addEventListener("click", function () {
      if (retry.disabled) return;
      retry.disabled = true;
      error.hidden = true;
      status.textContent = en ? "Loading the graph tool…" : "Laddar grafverktyget…";

      var script = document.createElement("script");
      script.src = "/js/graph-answer.js?retry=" + Date.now();
      var retryTimer = null;
      var settled = false;

      function failed(timedOut) {
        if (settled) return;
        settled = true;
        if (retryTimer) window.clearTimeout(retryTimer);
        script.onload = null;
        script.onerror = null;
        script.remove();
        error.textContent = timedOut
          ? (en ? "Loading the graph tool took too long. Check your connection and retry."
            : "Det tog för lång tid att ladda grafverktyget. Kontrollera anslutningen och försök igen.")
          : (en ? "The graph tool still could not load. Check your connection and retry."
            : "Grafverktyget kunde fortfarande inte laddas. Kontrollera anslutningen och försök igen.");
        error.hidden = false;
        status.textContent = "";
        retry.disabled = false;
      }

      script.onload = function () {
        if (settled) return;
        if (typeof window.ExGenGraphAnswer !== "function") {
          failed(false);
          return;
        }
        settled = true;
        if (retryTimer) window.clearTimeout(retryTimer);
        script.remove();
        renderQuestion();
        var firstInput = $(".graph-answer input:not([type=hidden])", UI.sheetWrap);
        if (firstInput) firstInput.focus();
      };
      script.onerror = function () { failed(false); };
      retryTimer = window.setTimeout(function () { failed(true); }, 10000);
      document.head.appendChild(script);
    });

    wrap.appendChild(error);
    wrap.appendChild(retry);
    wrap.appendChild(status);
    sheet.appendChild(wrap);
  }

  function renderGraphSourceTable(sheet, graphUi, lang) {
    var source = graphUi && graphUi.mode === "scatter" ? graphUi.source_table : null;
    if (!source || !Array.isArray(source.headers) || source.headers.length !== 2
      || !Array.isArray(source.rows) || source.rows.length !== 3
      || !source.headers.every(function (value) { return typeof value === "string" && value.length <= 32; })
      || !source.rows.every(function (row) {
        return Array.isArray(row) && row.length === 2 && row.every(Number.isInteger);
      })) return;

    var wrap = el("div", "xf-source-table-wrap");
    var table = el("table", "xf-source-table");
    table.appendChild(el("caption", null, lang === "en" ? "Values from your material" : "Värden från materialet"));
    var thead = el("thead");
    var headerRow = el("tr");
    source.headers.forEach(function (label) {
      var header = el("th", null, label);
      header.scope = "col";
      headerRow.appendChild(header);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = el("tbody");
    source.rows.forEach(function (row) {
      var tr = el("tr");
      row.forEach(function (value) { tr.appendChild(el("td", null, value)); });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    sheet.appendChild(wrap);
  }

  /* Fritextsvar skickas 500 ms efter senaste tangenttryck. Varje tecken hade
     annars blivit ett nytt manifest. */
  function publishSoon() {
    clearTimeout(publishTimer);
    publishTimer = setTimeout(publish, 500);
  }

  function renderQuestion(focusQuestion) {
    var qs = S.exam.questions;
    var i = clamp(S.idx, 0, qs.length - 1);
    S.idx = i;
    var q = qs[i];
    var id = qid(q, i);

    // P.E.R:s svar gällde föregående fråga. Bubblan går tillbaka i sitt gömda
    // läge vid frågebyte så att den inte ligger kvar över svarstexten.
    closePerPanel();

    // Prickraden: hela provets form på en gång, och en genväg till varje fråga.
    UI.dots.innerHTML = "";
    UI.dots.setAttribute("role", "group");
    qs.forEach(function (qq, n) {
      var d = el("button", "xf-dot");
      d.type = "button";
      var did = qid(qq, n);
      if (n === i) d.classList.add("here");
      else if (isAnswerComplete(qq, S.answers[did])) d.classList.add("done");
      d.addEventListener("click", function () { S.idx = n; renderQuestion(); });
      UI.dots.appendChild(d);
    });
    updateQuestionDotLabels();

    UI.count.textContent = "Fråga " + (i + 1) + " / " + qs.length;

    var sheet = el("div", "xf-sheet");

    var head = el("div", "xf-q-head");
    head.appendChild(el("span", null, String(q.cognitive_level || "").trim() || "Uppgift"));
    head.appendChild(el("span", "xf-q-pts", (Number(q.points) || 0) + " p"));
    sheet.appendChild(head);

    var qText = el("h2", "xf-q-text", q.question || "");
    qText.id = "xf-current-question";
    qText.tabIndex = -1;
    UI.exam.setAttribute("aria-labelledby", qText.id);
    sheet.appendChild(qText);
    renderMathIn(qText);

    if (q.type === "mc" && Array.isArray(q.options) && q.options.length) {
      var group = el("div", "xf-mc");
      q.options.forEach(function (opt, n) {
        var letter = String.fromCharCode(65 + n);
        var btn = el("button", "xf-mc-opt");
        btn.type = "button";
        btn.appendChild(el("span", "xf-mc-let", letter));
        btn.appendChild(el("span", null, opt));
        if (S.answers[id] === letter) btn.classList.add("sel");
        btn.addEventListener("click", function () {
          Array.prototype.forEach.call(group.children, function (c) { c.classList.remove("sel"); });
          btn.classList.add("sel");
          S.answers[id] = letter;
          saveDraft();
          publish();
          armStuck();
          // Sista frågan kräver ett uttryckligt klick på Lämna in.
          if (i < S.exam.questions.length - 1) {
            setTimeout(function () { if (S.idx === i) next(true); }, 260);
          }
        });
        group.appendChild(btn);
      });
      sheet.appendChild(group);
    } else if (q.type === "graph") {
      var lang = window.ExGenEngine && window.ExGenEngine.language && window.ExGenEngine.language() === "en" ? "en" : "sv";
      if (!window.ExGenGraphAnswer) {
        renderGraphUnavailable(sheet, lang);
      } else {
        renderGraphSourceTable(sheet, q.graph_ui, lang);
        window.ExGenGraphAnswer(sheet, S.answers[id] || "", function (value) {
          S.answers[id] = value;
          saveDraftSoon(); publishSoon(); armStuck();
        }, lang, q.graph_ui);
      }
    } else {
      var ta = el("textarea", "xf-answer");
      ta.placeholder = "Ditt svar…";
      ta.value = S.answers[id] || "";
      ta.setAttribute("aria-label", "Svar på fråga " + (i + 1));
      ta.addEventListener("input", function () {
        S.answers[id] = ta.value;
        saveDraftSoon();
        publishSoon();
        armStuck();
      });
      sheet.appendChild(ta);
      if (!(window.ExGenRuntime && window.ExGenRuntime.environment === "pilot")) {
        sheet.appendChild(buildSolutionPhoto(ta, q, id));
      }
    }

    /* Tillståndsraden (#perSees i shared.js) syns bara vid hover över den
       flytande bubblan, och bubblan är helt dold under provet — så eleven kan
       aldrig se den där den skulle betytt något. Knappen är däremot alltid
       synlig. Den bär därför själv beskedet om vilken fråga P.E.R har: säger
       den "fråga 7" vet eleven att det är den frågan som gäller utan att
       behöva fråga. */
    var ask = el("button", "xf-ask" + (S.helped[id] ? " used" : ""),
      S.helped[id] ? "✦ P.E.R öppnades här" : "✦ Fråga P.E.R om fråga " + (i + 1));
    ask.type = "button";
    ask.addEventListener("click", function () {
      /* This local marker records that the P.E.R panel opened for this question,
         not that the learner understood or relied on the hint. */
      if (!askPer()) return;
      S.helped[id] = true;
      ask.className = "xf-ask used";
      ask.textContent = "✦ P.E.R öppnades här";
      saveDraft();
    });
    sheet.appendChild(ask);

    UI.sheetWrap.innerHTML = "";
    UI.sheetWrap.appendChild(sheet);
    UI.sheetWrap.scrollTop = 0;
    if (focusQuestion) qText.focus({ preventScroll: true });

    UI.prev.disabled = i === 0;
    UI.next.textContent = i === S.exam.questions.length - 1 ? "Lämna in" : "Nästa";

    armStuck();
    pace();
    publish();
  }

  /* Öppnar P.E.R-panelen åt eleven. Frågekontexten sätts INTE här — publish()
     skickar redan rätt fråga till manifestet vid varje frågebyte (se ovan).
     Den här funktionen gör bara knapptrycket verkningsfullt: den släpper fram
     den annars dolda bubblan under provet och öppnar panelen om den inte
     redan är öppen.
     Returnerar om panelen faktiskt öppnades — anroparen sätter hjälpflaggan
     bara då. */
  function askPer() {
    var bubble = document.getElementById("perBubble");
    if (!bubble) return false;

    // shared.js sätter .per-open på bubblan medan panelen är uppe. Är den redan
    // öppen finns inget att göra — ett klick hade stängt den i stället.
    if (bubble.classList.contains("per-open")) {
      document.body.classList.add("xf-per-open");
      return true;
    }

    // Den flytande bubblan är dold under provet (den låg över svarstexten på
    // mobil). Klassen släpper fram widgeten så att panelen syns; den tas bort
    // igen vid frågebyte och när provet lämnas.
    document.body.classList.add("xf-per-open");
    bubble.click();
    scrollSheetClear();
    return true;
  }

  function closePerPanel() {
    var bubble = document.getElementById("perBubble");
    if (bubble && bubble.classList.contains("per-open")) bubble.click();
    document.body.classList.remove("xf-per-open");
  }

  /* Panelen lägger sig över arkets nedre del på en telefon. exam-flow.css ger
     arket luft under sig så att ingenting blir instängt; den här raden gör att
     eleven slipper scrolla dit själv — frågans början hamnar överst i det band
     som är kvar ovanför panelen. Ingen effekt på en bred skärm, där panelen
     ligger vid sidan av arket. */
  function scrollSheetClear() {
    var wrap = document.querySelector(".xf-sheet-wrap");
    var sheet = wrap && wrap.querySelector(".xf-sheet");
    if (!wrap || !sheet) return;
    if (window.innerWidth > 600) return;
    var top = sheet.offsetTop - 8;
    if (top < 0) top = 0;
    try { wrap.scrollTo({ top: top, behavior: "smooth" }); }
    catch (_) { wrap.scrollTop = top; }
  }

  function next(focusQuestion) {
    if (S.idx >= S.exam.questions.length - 1) { submit(); return; }
    S.idx++;
    renderQuestion(focusQuestion);
    saveDraft();
  }

  function prev() {
    if (S.idx <= 0) return;
    S.idx--;
    renderQuestion();
    saveDraft();
  }

  // ── P.E.R:s inpass ───────────────────────────────────────────────────────
  /* Tre regler, alla utlösta av något som hänt. Ingen timer som bara går,
     ingen slumpad peppning. Max tre gånger, aldrig tätare än 45 sekunder. */

  /* system:true för besked som inte är coachning utan fakta om provet — de får
     inte tystas av inpasskvoten, för då blir de aldrig sagda. */
  function nudge(text, system) {
    if (!system) {
      if (S.nudges >= MAX_NUDGES) return;
      if (Date.now() - S.lastNudge < NUDGE_GAP_MS) return;
      S.nudges++;
    }
    S.lastNudge = Date.now();
    UI.nudgeText.textContent = text;
    UI.nudge.classList.add("on");
    clearTimeout(UI.nudgeTimer);
    UI.nudgeTimer = setTimeout(function () { UI.nudge.classList.remove("on"); }, 11000);
  }

  function armStuck() {
    clearTimeout(stuckTimer);
    var i = S.idx;
    stuckTimer = setTimeout(function () {
      if (S.idx !== i) return;
      var q = S.exam.questions[i];
      var id = qid(q, i);
      if (isAnswerComplete(q, S.answers[id])) return;
      nudge("Fastnat? Fråga mig om frågan, eller hoppa vidare och kom tillbaka. Blankt ger noll — en påbörjad tanke ger ofta poäng.");
    }, STUCK_MS);
  }

  function pace() {
    var qs = S.exam.questions;
    if (S.idx !== Math.floor(qs.length / 2)) return;
    var budget = estimateMinutes(qs.length, S.qType) * 60000;
    var spent = Date.now() - S.startedAt;
    if (spent > budget * 0.6) {
      nudge("Halvvägs, men du har använt mer än halva tiden. Korta ner svaren — full poäng kräver sällan mer än några meningar.");
    }
  }

  // ── Inlämning ────────────────────────────────────────────────────────────

  function abandon() {
    if (S.submitting || UI.exit.disabled) return;
    if (!window.confirm("Avsluta provet utan rättning? Dina svar tas bort och provet kan inte lämnas in senare.")) return;
    UI.exit.disabled = true;
    window.ExGenEngine.abandonExam().then(function (result) {
      if (!result || !result.ok) {
        nudge((result && result.error) || "Provet kunde inte avslutas säkert. Försök igen.");
        return;
      }
      closeExam();
      clearDraft();
      S.exam = null;
      S.answers = questionState();
      S.helped = questionState();
      S.submitting = false;
      stepStart();
    }).catch(function () {
      nudge("Provet kunde inte avslutas säkert. Försök igen.");
    }).finally(function () {
      UI.exit.disabled = false;
    });
  }

  function submit() {
    /* Flervalsklick på sista frågan schemalägger next() om 260 ms, och next()
       på sista frågan lämnar in. Hann eleven trycka "Lämna in" däremellan kördes
       submit() två gånger: den andra fick tillbaka "Rättning pågår redan." från
       motorn, tolkade det som ett rättningsfel och öppnade provet igen — mitt
       under den första rättningen, som sedan landade bakom provöverlägget. */
    if (S.submitting) return;
    S.submitting = true;

    var qs = S.exam.questions;
    var graphWithoutTool = qs.findIndex(function (q, n) {
      return q.type === "graph" && String(S.answers[qid(q, n)] || "").trim()
        && !window.ExGenGraphAnswer;
    });
    if (graphWithoutTool >= 0) {
      S.submitting = false;
      S.idx = graphWithoutTool;
      renderQuestion();
      nudge(window.ExGenEngine && window.ExGenEngine.language && window.ExGenEngine.language() === "en"
        ? "Your saved graph answer is still here, but the graph tool could not load. Retry the graph tool before submitting."
        : "Ditt sparade grafsvar finns kvar, men grafverktyget kunde inte laddas. Försök ladda grafverktyget igen innan du lämnar in.", true);
      return;
    }
    var blank = qs.filter(function (q, n) {
      return !isAnswerComplete(q, S.answers[qid(q, n)]);
    }).length;

    if (blank > 0) {
      var ok = window.confirm(
        blank === 1
          ? "Du har 1 obesvarad fråga. Den får 0 poäng och du kan se facit efter rättningen. Provet kan inte ändras. Lämna in ändå?"
          : "Du har " + blank + " obesvarade frågor. De får 0 poäng och du kan se facit efter rättningen. Provet kan inte ändras. Lämna in ändå?"
      );
      if (!ok) {
        S.submitting = false;
        for (var n = 0; n < qs.length; n++) {
          if (!isAnswerComplete(qs[n], S.answers[qid(qs[n], n)])) { S.idx = n; renderQuestion(); return; }
        }
        return;
      }
    }

    var resumeAt = S.startedAt;
    closeExam(false);
    machine();

    var answers = qs.map(function (q, n) {
      var id = qid(q, n);
      return { id: id, answer: isAnswerComplete(q, S.answers[id])
        ? String(S.answers[id] || "").trim() : "" };
    });

    // Rättningen föll — lämna tillbaka eleven till provet med svaren kvar i
    // stället för till en död skärm. S.nudges nollställs så att beskedet om
    // felet aldrig tystas av inpasskvoten.
    function backToExam(msg) {
      stopMachine().then(function () {
        S.submitting = false;
        S.nudges = 0;
        S.lastNudge = 0;
        openExam(resumeAt);
        nudge(msg);
      });
    }

    window.ExGenEngine.grade(answers).then(function (r) {
      if (!r || !r.ok || !r.result) {
        backToExam((r && r.error) || "Rättningen gick inte igenom. Dina svar är kvar — prova att lämna in igen.");
        return;
      }
      // Rättningen är i hamn: utkastet får försvinna först nu.
      clearDraft();
      stopMachine().then(function () { stepResult(r.result, r.persistence, r.examProof, answers); });
    }).catch(function (e) {
      /* Utan den här grenen blir ett oväntat avslag från motorn en mörk skärm
         med låst scroll, utan knappar, som bara går att lämna med omladdning —
         och då är svaren borta. */
      backToExam("Något gick fel under rättningen. Dina svar är kvar — prova igen.");
      if (window.console && console.warn) console.warn("[exam-flow] grade:", e);
    });
  }

  // ── Maskinytan ───────────────────────────────────────────────────────────
  /* Raderna beskriver det som faktiskt sker på servern, i den ordning det
     sker. En påhittad förloppsmätare hade varit billigare att bygga och värd
     mindre: den som väntar ska få veta vad väntan går åt till. */

  var LOG = [
    ["01", "läser dina svar"],
    ["02", "matchar mot bedömningsmallen"],
    ["03", "väger delpoäng per fråga"],
    ["04", "jämför med dina tidigare prov"],
    ["05", "skriver din återkoppling"]
  ];

  var PEP = [
    "Det du gjorde nyss räknas oavsett vad siffran blir.",
    "Fel svar är den billigaste informationen du kan få.",
    "Ett prov säger var du är, inte vem du är."
  ];

  // Rättningen tar normalt tiotals sekunder, men ett cachat eller felande svar
  // kan komma på en tiondel. Utan golv blinkar hela skärmen mörk och ljus igen,
  // vilket läser som en bugg snarare än som ett steg.
  var MACHINE_MIN_MS = 1400;
  var machineShownAt = 0;

  function machine() {
    machineShownAt = Date.now();
    UI.machine.classList.add("on");
    UI.log.focus({ preventScroll: true });
    document.body.classList.add("xf-grading");
    /* lockScroll(true), inte en direkt tilldelning. Att sätta stilen här utan
       att gå genom lockScroll lämnade prevOverflow som null, och lockScroll(false)
       i stopMachine() gör ingenting när prevOverflow är null — den grenen finns
       just för att inte radera ett inline-värde som någon annan satt.

       Följden var att body.overflow blev "hidden" och satt kvar när
       resultatskärmen visades. Eleven såg sina poäng men kunde inte scrolla ner
       till frågorna, feedbacken eller modellsvaren. Hela värdet av rättningen
       låg utanför rutan. */
    lockScroll(true);
    UI.log.innerHTML = "";
    UI.pep.textContent = "";
    var n = 0;

    function step() {
      if (n >= LOG.length) return;
      Array.prototype.forEach.call(UI.log.children, function (c) { c.classList.remove("now"); });
      var row = el("div", "now");
      row.appendChild(el("i", null, LOG[n][0]));
      row.appendChild(el("span", null, LOG[n][1]));
      UI.log.appendChild(row);
      n++;
    }

    // Första raden direkt. Väntar den på intervallet står skärmen tom i nästan
    // två sekunder, och en tom mörk skärm läser som att något hängt sig.
    step();
    UI.machineTimer = setInterval(step, 1900);

    var p = 0;
    UI.pepTimer = setInterval(function () {
      UI.pep.textContent = PEP[p % PEP.length];
      p++;
    }, 6500);
    UI.pep.textContent = PEP[0];
  }

  function stopMachine() {
    return new Promise(function (done) {
      var left = Math.max(0, MACHINE_MIN_MS - (Date.now() - machineShownAt));
      setTimeout(function () {
        clearInterval(UI.machineTimer);
        clearInterval(UI.pepTimer);
        UI.machine.classList.remove("on");
        document.body.classList.remove("xf-grading");
        setExamBackgroundInert(false);
        lockScroll(false);
        done();
      }, left);
    });
  }

  // ── Resultat ─────────────────────────────────────────────────────────────

  function stepResult(r, persistence, examProof, submittedAnswers) {
    closePerPanel();
    var b = mount("result");

    /* Resultatsidan har ingen aktiv provfråga. En separat signerad proof från
       rättningen krävs när eleven ber om en fullständig frågeförklaring. */
    if (window.PER && window.PER.describe) {
      window.PER.describe({ page: "resultat", state: { phase: "result" } });
    }
    var qs = S.exam.questions;
    var byId = {};
    qs.forEach(function (q, n) { byId[qid(q, n)] = q; });

    function answerText(q, raw) {
      var answer = String(raw || "").trim();
      if (!answer) return "Inget svar";
      if (q.type === "mc") {
        var option = Array.isArray(q.options) ? q.options[answer.charCodeAt(0) - 65] : null;
        return option ? answer + ". " + option : answer;
      }
      if (q.type === "graph") {
        try {
          var points = JSON.parse(answer).points;
          if (Array.isArray(points) && points.length >= 2 && points.every(function (p) {
            return p && Number.isInteger(p.x) && Number.isInteger(p.y);
          })) {
            return points.map(function (p, index) {
              return "Punkt " + String.fromCharCode(65 + index) + " (" + p.x + ", " + p.y + ")";
            }).join(" · ");
          }
        } catch (_) {}
        return "Ingen fullständig graf angiven";
      }
      return answer;
    }

    var total = Number(r.total_points) || 0;
    var max = Number(r.max_points) || 0;

    // Keep the official score intact. This optional self-check covers only
    // questions whose P.E.R panel was not opened; it is not a counterfactual
    // grade or a server-verified measure of independent mastery.
    var resultRows = Array.isArray(r.per_question) ? r.per_question : [];
    var independentPoints = 0;
    var independentMax = 0;
    var independentCount = 0;
    var helpedCount = 0;
    resultRows.forEach(function (item) {
      if (S.helped[String(item.id)]) {
        helpedCount++;
      } else {
        independentCount++;
        independentPoints += Number(item.points) || 0;
        independentMax += Number(item.max_points) || 0;
      }
    });
    var pct = max > 0 ? Math.round((total / max) * 100) : 0;
    var hasIndependentCheck = helpedCount > 0 && independentCount > 0 && independentMax > 0;
    var independentPct = independentMax > 0 ? Math.round((independentPoints / independentMax) * 100) : 0;

    if (hasIndependentCheck) {
      say("Du fick " + total + " av " + max + ".",
          "P.E.R öppnades på " + helpedCount + " " + (helpedCount === 1 ? "fråga" : "frågor") +
          ". På de " + independentCount + " frågor där P.E.R inte öppnades fick du " + independentPoints + " av " + independentMax + " poäng.");
    } else if (helpedCount > 0 && independentCount === 0) {
      say("Du fick " + total + " av " + max + ".",
          "P.E.R öppnades på alla frågor, så det finns inget separat resultat för frågor utan P.E.R.");
    } else if (helpedCount > 0) {
      say("Du fick " + total + " av " + max + ".",
          "P.E.R öppnades under provet. Ditt resultat ovan ändras inte av det.");
    } else {
      say("Du fick " + total + " av " + max + ".", "P.E.R öppnades inte under provet.");
    }

    var scores = el("div", "xf-scores" + (hasIndependentCheck ? "" : " solo"));
    var s1 = el("div", "xf-score lead");
    s1.appendChild(el("b", null, total + "/" + max));
    s1.appendChild(el("span", null, "Ditt resultat · " + pct + " %"));
    scores.appendChild(s1);

    if (hasIndependentCheck) {
      var s2 = el("div", "xf-score");
      s2.appendChild(el("b", null, independentPoints + "/" + independentMax));
      s2.appendChild(el("span", null, "Frågor utan P.E.R · " + independentPct + " %"));
      scores.appendChild(s2);
    }
    b.appendChild(scores);

    if (persistence && persistence.accountSaveFailed) {
      var saveWarning = el("div", "xf-err xf-save-warning");
      saveWarning.setAttribute("role", "status");
      saveWarning.setAttribute("aria-live", "polite");
      var saveMessage = el("p", null, persistence.message || "Resultatet har inte sparats till kontot ännu.");
      saveWarning.appendChild(saveMessage);
      if (persistence.localId && window.ExGenEngine && window.ExGenEngine.retryAccountSave) {
        var retrySave = el("button", "xf-btn quiet", "Försök spara till kontot igen");
        retrySave.type = "button";
        retrySave.addEventListener("click", function () {
          if (retrySave.disabled) return;
          retrySave.disabled = true;
          retrySave.textContent = "Sparar…";
          window.ExGenEngine.retryAccountSave(persistence.localId).then(function (saved) {
            if (saved && saved.ok) {
              saveMessage.textContent = "Resultatet är nu sparat till kontot och tillgängligt i lärarvyn.";
              retrySave.remove();
              saveWarning.classList.add("saved");
            } else {
              retrySave.disabled = false;
              retrySave.textContent = "Försök spara till kontot igen";
              saveMessage.textContent = "Kontosparningen kunde inte bekräftas. Resultatet finns kvar på den här enheten.";
            }
          }).catch(function () {
            retrySave.disabled = false;
            retrySave.textContent = "Försök spara till kontot igen";
            saveMessage.textContent = "Kontosparningen kunde inte bekräftas. Resultatet finns kvar på den här enheten.";
          });
        });
        saveWarning.appendChild(retrySave);
      }
      b.appendChild(saveWarning);
    }

    // Vad provet faktiskt täckte, och var poängen läckte. topic kommer från
    // generate-exam.js — det behövde bara visas.
    var topics = {};
    (r.per_question || []).forEach(function (item) {
      var q = byId[String(item.id)] || {};
      var t = String(q.topic || "").trim();
      if (!t) return;
      if (!topics[t]) topics[t] = { got: 0, max: 0, attemptedGot: 0, attemptedMax: 0, skipped: 0 };
      topics[t].got += Number(item.points) || 0;
      topics[t].max += Number(item.max_points) || 0;
      if (item.unanswered === true) topics[t].skipped += 1;
      else {
        topics[t].attemptedGot += Number(item.points) || 0;
        topics[t].attemptedMax += Number(item.max_points) || 0;
      }
    });
    var tKeys = Object.keys(topics);
    if (tKeys.length) {
      b.appendChild(el("div", "xf-eyebrow", "Vad provet täckte"));
      var cov = el("div", "xf-cov");
      tKeys.forEach(function (t) {
        var o = topics[t];
        var ratio = o.attemptedMax > 0 ? o.attemptedGot / o.attemptedMax : 1;
        var note = o.skipped ? " · " + o.skipped + " obesvarad" + (o.skipped === 1 ? "" : "e") : "";
        var chip = el("span", ratio < 0.6 ? "weak" : null, t + " " + o.got + "/" + o.max + note);
        cov.appendChild(chip);
      });
      b.appendChild(cov);
    }

    addNextTrainingCard(b, r, byId);

    var list = el("div");
    list.style.marginTop = "28px";
    (r.per_question || []).forEach(function (item, n) {
      var q = byId[String(item.id)] || {};
      var got = Number(item.points) || 0;
      var m = Number(item.max_points) || 0;

      var it = el("div", "xf-item");
      var head = el("div", "xf-item-head");
      head.appendChild(el("span", null, "Fråga " + (n + 1) + (S.helped[String(item.id)] ? " · P.E.R öppnades" : "")));
      var score = el("b", got >= m && m > 0 ? "full" : got === 0 ? "miss" : null, got + "/" + m);
      head.appendChild(score);
      it.appendChild(head);

      if (q.question) it.appendChild(el("div", "xf-item-q", q.question));

      var own = el("div", "xf-item-own");
      own.appendChild(el("span", "xf-item-label", "Ditt svar"));
      own.appendChild(el("span", null, answerText(q, S.answers[String(item.id)])));
      it.appendChild(own);

      /* Modellen inleder ofta sin återkoppling med "Poäng: 0/1." — samma
         siffra som redan står i rubriken en rad ovanför. Prefixet stryks här
         i stället för i prompten, eftersom grade.js svarar likadant till den
         gamla vyn och till lärarrapporten, som båda saknar den rubriken. */
      var fb = String(item.feedback || "").replace(/^\s*Poäng:\s*\d+\s*\/\s*\d+\.?\s*/i, "");
      if (fb) it.appendChild(el("div", "xf-item-fb", fb));

      if (q.type === "graph") {
        it.appendChild(buildGraphRetry(item, q.graph_ui));
      } else if (item.model_answer) {
        var mo = el("div", "xf-item-model");
        mo.appendChild(el("em", null, "Fullpoängssvar"));
        mo.appendChild(el("span", null, item.model_answer));
        it.appendChild(mo);
      }

      if (examProof && q.grade_task && window.PER && window.PER.send) {
        var review = el("button", "xf-btn quiet xf-review-action");
        review.dataset.labelSv = "✦ Förklara min rättning";
        review.dataset.labelEn = "✦ Explain my grading";
        review.textContent = isEnglish() ? review.dataset.labelEn : review.dataset.labelSv;
        review.type = "button";
        review.addEventListener("click", function () {
          window.PER.describe({
            page: "resultat",
            focus: { kind: "question", number: n + 1, text: q.question, options: q.options || [] },
            state: { phase: "result" }
          });
          var bubble = document.getElementById("perBubble");
          if (bubble && !bubble.classList.contains("per-open")) bubble.click();
          var english = isEnglish();
          window.PER.send((english ? "Please explain my grading on question " : "Förklara min rättning på fråga ") +
            (n + 1) + (english ? " step by step" : " steg för steg"), {
            helpLevel: 3,
            examProof: {
              receipt: examProof,
              course: S.course,
              material: S.material.slice(0, 3000),
              questions: qs,
              answers: submittedAnswers,
              selectedQuestionId: String(item.id)
            }
          });
        });
        it.appendChild(review);
      }

      /* Rättningsvyn bär tre texter som kan innehålla matematik: frågan,
         återkopplingen och fullpoängssvaret. Sedan fotoinlämningen kom bär
         även elevens EGET svar LaTeX, eftersom transkriptionen skriver $...$.
         Renderas hela posten på en gång i stället för fält för fält. */
      renderMathIn(it);

      // Källraden — vilken del av elevens eget material frågan byggde på.
      var src = Array.isArray(q.source_references) ? q.source_references.filter(Boolean) : [];
      if (src.length) {
        var sourceLabel = isEnglish() ? "Text from your material: " : "Text ur ditt material: ";
        it.appendChild(el("div", "xf-src", sourceLabel + src.slice(0, 2).join(" · ")));
      }

      list.appendChild(it);
    });
    b.appendChild(list);

    // Ett resultat ska sluta i en handling, inte i en siffra.
    var act = el("div", "xf-act");
    act.style.marginTop = "28px";

    // En felruta, återanvänd. Att skapa en ny per klick gav tre rader under
    // varandra efter tre misslyckade försök.
    var againErr = el("div", "xf-err");

    var again = el("button", "xf-btn primary", "Gör om — nya frågor, samma nivå");
    again.type = "button";
    again.addEventListener("click", function () { build(again, againErr); });
    act.appendChild(again);

    var toImprove = el("a", "xf-btn ghost", "Träna sparade misstag");
    toImprove.href = "app.html#train";
    toImprove.addEventListener("click", function () { lsDel(LS_TRAIN_PICK); });
    act.appendChild(toImprove);

    var fresh = el("button", "xf-btn quiet", "Nytt ämne");
    fresh.type = "button";
    fresh.addEventListener("click", function () {
      S.exam = null; S.answers = questionState(); S.helped = questionState(); S.material = "";
      S.submitting = false;
      // Eleven har uttryckligen övergett provet. Låg utkastet kvar erbjöds det
      // tillbaka vid nästa sidladdning som "Fortsätt provet du började".
      clearDraft();
      stepSubject();
    });
    act.appendChild(fresh);
    b.appendChild(act);
    b.appendChild(againErr);

    screen("result");
  }

  // ── Utkast ───────────────────────────────────────────────────────────────

  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = null;
    if (!S.exam) return;
    var draft = {
      ts: Date.now(),
      uid: uid(),
      startedAt: S.startedAt,
      course: S.course, level: S.level, qType: S.qType, num: S.num, nonGraphNum: S.nonGraphNum,
      material: S.material, exam: S.exam,
      answers: S.answers, helped: S.helped, idx: S.idx
    };

    if (lsSet(draftKey(), draft)) {
      lsDel(progressKey());
      return;
    }

    /* Keep the signed exam/material snapshot intact. The small progress record
       is usable only alongside that exact snapshot and can never replace it. */
    var saved = lsGet(draftKey(), null);
    var resumableBase = saved && String(saved.uid || "") === uid()
      && saved.exam && Array.isArray(saved.exam.questions) && saved.exam.questions.length
      && typeof saved.material === "string"
      && saved.exam.exam_manifest
      && saved.exam.exam_manifest === S.exam.exam_manifest;
    var progressSaved = resumableBase && lsSet(progressKey(), {
      ts: Date.now(), uid: uid(), startedAt: S.startedAt,
      examManifest: S.exam.exam_manifest,
      answers: S.answers, helped: S.helped, idx: S.idx
    });
    if (!progressSaved && !S.warnedStorage) {
      S.warnedStorage = true;
      nudge("Minnet i webbläsaren är fullt. Ditt senast sparade prov finns kvar, men de senaste svaren kunde inte sparas. Lämna in innan du stänger eller laddar om fliken.", true);
    }
  }

  // Skrivande sparas fördröjt; allt annat direkt. Se DRAFT_DEBOUNCE_MS.
  function saveDraftSoon() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, DRAFT_DEBOUNCE_MS);
  }

  function flushDraftSoon() {
    if (draftTimer === null) return;
    clearTimeout(draftTimer);
    draftTimer = null;
    saveDraft();
  }

  window.addEventListener("pagehide", flushDraftSoon);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushDraftSoon();
  });

  /* Progress is merged only into the exact signed exam snapshot it belongs to. */
  function readDraft() {
    var d = lsGet(draftKey(), null);
    if (!d || String(d.uid || "") !== uid() || !d.exam
        || !Array.isArray(d.exam.questions) || !d.exam.questions.length) {
      lsDel(progressKey());
      return null;
    }

    var progress = lsGet(progressKey(), null);
    var progressTs = Number(progress && progress.ts);
    var progressIdx = Number(progress && progress.idx);
    var progressMatches = progress && String(progress.uid || "") === uid()
      && progress.examManifest && progress.examManifest === d.exam.exam_manifest
      && Number.isFinite(progressTs) && progressTs > 0
      && progressTs <= Date.now() + 5 * 60 * 1000
      && Date.now() - progressTs <= DRAFT_MAX_AGE_MS
      && progress.answers && typeof progress.answers === "object" && !Array.isArray(progress.answers)
      && progress.helped && typeof progress.helped === "object" && !Array.isArray(progress.helped)
      && Number.isInteger(progressIdx) && progressIdx >= 0 && progressIdx < d.exam.questions.length;
    if (progressMatches) {
      d.answers = progress.answers;
      d.helped = progress.helped;
      d.idx = progress.idx;
      d.startedAt = Number(progress.startedAt) || Number(d.startedAt) || 0;
      d.ts = progressTs;
    } else if (progress) {
      lsDel(progressKey());
    }

    if (d.ts && Date.now() - Number(d.ts) > DRAFT_MAX_AGE_MS) {
      clearDraft();
      return null;
    }
    return d;
  }

  function backBtn(fn) {
    var b = el("button", "xf-btn quiet", tx("Tillbaka", "Back"));
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  // ── Uppbyggnad av DOM ────────────────────────────────────────────────────

  function buildDom(root) {
    var prog = el("div", "xf-progress");
    prog.setAttribute("role", "progressbar");
    prog.setAttribute("aria-valuemin", "1");
    prog.setAttribute("aria-valuemax", String(STEPS.length));
    UI.bar = el("i");
    UI.progress = prog;
    prog.appendChild(UI.bar);
    root.appendChild(prog);
    window.addEventListener("exgen:languagechange", function () {
      updateProgress(UI.progress && UI.progress.dataset.step);
      updateReviewActionLabels();
      var focusTarget = document.activeElement;
      if (typeof UI.languageRerender === "function") UI.languageRerender();
      if (focusTarget && focusTarget.isConnected && focusTarget.matches("#langBtnDesktop, #langBtn")) {
        focusTarget.focus({ preventScroll: true });
      }
    });

    /* Sidans enda h1. Skärmarnas egna rubriker är h2 — sex h1 samtidigt i
       DOM:en (en per flödessteg) gav ingen dokumentstruktur alls. Den här är
       visuellt dold men läses av skärmläsare och ger sidan ett namn. */
    var pageTitle = el("h1", null, "Skapa prov");
    pageTitle.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;" +
      "clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0";
    root.appendChild(pageTitle);

    UI.screens = {};
    STEPS.forEach(function (name) {
      var sc = el("section", "xf-screen");
      sc.dataset.screen = name;
      sc.setAttribute("aria-hidden", "true");
      var inner = el("div", "xf-inner");

      var per = el("div", "xf-per");
      var orb = el("div", "xf-orb");
      orb.setAttribute("aria-hidden", "true");
      var voice = el("div");
      voice.style.flex = "1";
      var h = el("h2", "xf-say");
      // Fokuseras vid varje skärmbyte, se screen(). tabindex="-1" gör den
      // fokuserbar programmatiskt utan att lägga den i tabbordningen.
      h.tabIndex = -1;
      var sub = el("p", "xf-sub");
      // Rubriken skrivs fram tecken för tecken. aria-live här hade läst upp
      // varje delsträng; fokusflytten i screen() annonserar hela raden en gång.
      sub.setAttribute("aria-live", "polite");
      voice.appendChild(h);
      voice.appendChild(sub);
      per.appendChild(orb);
      per.appendChild(voice);

      inner.appendChild(per);
      inner.appendChild(el("div", "xf-body"));
      sc.appendChild(inner);
      root.appendChild(sc);
      UI.screens[name] = sc;
    });

    // Provläget
    UI.exam = el("div", "xf-exam");
    UI.exam.setAttribute("role", "dialog");
    UI.exam.setAttribute("aria-modal", "false");
    UI.exam.setAttribute("aria-hidden", "true");
    UI.exam.tabIndex = -1;
    var top = el("div", "xf-exam-top");
    UI.count = el("span", null, "Fråga 1");
    UI.dots = el("div", "xf-exam-dots");
    UI.time = el("span", "xf-exam-time", "00:00");
    UI.time.dataset.elapsed = "00:00";
    UI.time.setAttribute("role", "timer");
    UI.time.setAttribute("aria-live", "off");
    updateExamClockLabel();
    UI.exit = el("button", "xf-exam-exit", "×");
    UI.exit.type = "button";
    UI.exit.title = "Avbryt prov";
    UI.exit.setAttribute("aria-label", "Avbryt prov");
    UI.exit.addEventListener("click", abandon);
    top.appendChild(UI.count);
    top.appendChild(UI.dots);
    top.appendChild(UI.time);
    top.appendChild(UI.exit);
    UI.exam.appendChild(top);

    UI.sheetWrap = el("div", "xf-sheet-wrap");
    UI.exam.appendChild(UI.sheetWrap);

    var nav = el("div", "xf-exam-nav");
    UI.prev = el("button", "xf-btn ghost", "Föregående");
    UI.prev.type = "button";
    UI.prev.addEventListener("click", prev);
    UI.next = el("button", "xf-btn primary", "Nästa");
    UI.next.type = "button";
    UI.next.addEventListener("click", next);
    nav.appendChild(UI.prev);
    nav.appendChild(UI.next);
    UI.exam.appendChild(nav);

    UI.nudge = el("div", "xf-nudge");
    UI.nudge.setAttribute("role", "status");
    UI.nudge.setAttribute("aria-live", "polite");
    UI.nudge.setAttribute("aria-atomic", "true");
    UI.nudgeText = el("span");
    var close = el("button", null, "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Stäng");
    close.addEventListener("click", function () { UI.nudge.classList.remove("on"); });
    UI.nudge.appendChild(UI.nudgeText);
    UI.nudge.appendChild(close);
    UI.exam.appendChild(UI.nudge);

    root.appendChild(UI.exam);

    // Maskinytan
    UI.machine = el("div", "xf-machine");
    UI.machine.setAttribute("role", "region");
    UI.machine.setAttribute("aria-label", "Rättningen pågår");
    UI.machine.tabIndex = -1;
    UI.machine.appendChild(el("div", "xf-orb"));
    UI.log = el("div", "xf-log");
    UI.log.setAttribute("role", "status");
    UI.log.setAttribute("aria-live", "polite");
    UI.log.setAttribute("aria-atomic", "true");
    UI.log.tabIndex = -1;
    UI.machine.appendChild(UI.log);
    UI.pep = el("div", "xf-pep");
    UI.machine.appendChild(UI.pep);
    root.appendChild(UI.machine);
  }

  // ── Start ────────────────────────────────────────────────────────────────

  function boot() {
    var root = document.getElementById("xf");
    if (!root) return;
    // Talar om för motorn att ytan är bemannad: dess egna toaster om lyckade
    // steg tystas, felen släpps igenom. Se showToast i app.html.
    window.__xfActive = true;
    buildDom(root);
    stepStart();
    window.addEventListener("exgen:history-updated", function () {
      if (UI.screens.start && UI.screens.start.classList.contains("on")) stepStart();
    });

    document.addEventListener("keydown", function (e) {
      if (!UI.exam.classList.contains("on")) return;
      if (e.key === "Tab") {
        var stops = examTabStops();
        if (!stops.length) {
          e.preventDefault();
          UI.exam.focus();
          return;
        }
        var first = stops[0];
        var last = stops[stops.length - 1];
        var active = document.activeElement;
        if (!UI.exam.contains(active) && !document.getElementById("perWidget")?.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && (active === first || !stops.includes(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (e.target && /^(TEXTAREA|INPUT)$/.test(e.target.tagName)) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      // Utan detta scrollar arket i sidled samtidigt som frågan byts.
      e.preventDefault();
      if (e.key === "ArrowRight") next();
      else prev();
    });

    /* Ingången från felbanken. förbättring.html skickar eleven till
       app.html#train, och runTrainModeIfRequested() i app.html bygger ihop ett
       material av de fel eleven valt. Innan flödet fanns skrevs det rakt in i
       wizardens textruta; nu är den rutan dold, så materialet måste in här i
       stället. Hoppet går direkt till kontraktet — kurs och material är redan
       kända, och att fråga om dem igen vore att låtsas. */
    window.__xfPrefill = function (material, course) {
      var mat = String(material || "").trim();
      if (!mat) return false;
      S.material = mat.slice(0, MATERIAL_MAX);
      if (course) S.course = String(course).trim();
      if (!S.course) S.course = dna().courses[0] || "Repetition";
      var d = dna();
      S.level = d.level;
      S.qType = "mix";
      S.num = clamp(d.num, 3, 20);
      S.nonGraphNum = S.num;
      stepContract();
      return true;
    };
  }

  /* Motorn bor i app.html och initieras på DOMContentLoaded. Vänta in den
     hellre än att gissa ordningen mellan två script-taggar.

     Kommer den aldrig får eleven INTE en tom sida: den gamla wizarden tas fram
     ur sitt hidden-läge igen. Den är ful men fungerande, och en fungerande ful
     sida är oändligt mycket bättre än en vit. */
  function waitForEngine(tries) {
    if (window.ExGenEngine && window.ExGenEngine.ready) { boot(); return; }
    if (tries > 200) {
      var main = document.getElementById("main-content");
      if (main) main.removeAttribute("hidden");
      var xf = document.getElementById("xf");
      if (xf) xf.style.display = "none";
      if (window.console && console.error) {
        console.error("[exam-flow] ExGenEngine blev aldrig ready — föll tillbaka på wizarden.");
      }
      return;
    }
    setTimeout(function () { waitForEngine(tries + 1); }, 50);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { waitForEngine(0); });
  } else {
    waitForEngine(0);
  }
})();
