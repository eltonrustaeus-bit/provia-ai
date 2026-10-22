#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const taskIndex = args.indexOf("--task");
const task = taskIndex >= 0 ? args.slice(taskIndex + 1).join(" ").trim() : "";

if (!task) {
  console.error('Usage: npm run xeliov:context -- --task "<short task description>"');
  process.exit(2);
}

const [playbook, ledger, status] = await Promise.all([
  readFile(path.join(root, "docs/codex/15_AGENT_PLAYBOOK.md"), "utf8"),
  readFile(path.join(root, "docs/codex/16_LEARNING_LEDGER.md"), "utf8"),
  readFile(path.join(root, "docs/codex/08_CURRENT_STATUS.md"), "utf8"),
]);

const stopWords = new Set("about after also and are as at be before by can do for from has have how in into is it its of on or that the their then this to under use using was what when where which with you your över efter även att av blev de den det där eller en ett för från genom har hur i inte kan med mellan och om på till under vad vilka vid är".split(/\s+/));
const tokens = (value) => (value.toLowerCase().match(/[a-z0-9åäö]{3,}/g) || [])
  .filter((word) => !stopWords.has(word));
const taskTokens = new Set(tokens(task));

function redact(value) {
  return value
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|sk-proj-[A-Za-z0-9_-]{12,}|sb_secret_[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|xox[baprs]-[A-Za-z0-9-]{12,})\b/g, "[REDACTED SECRET]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED EMAIL]");
}

function reviewedFields(body) {
  const allowed = new Set(["Status", "Evidence", "Finding", "Limitation"]);
  const fields = [];
  let current = null;
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^- (Status|Evidence|Finding|Limitation):\s*(.*)$/);
    if (match) {
      current = { name: match[1], value: match[2].trim() };
      if (allowed.has(current.name)) fields.push(current);
    } else if (current && line.trim() && !line.startsWith("- ")) {
      current.value += ` ${line.trim()}`;
    } else if (line.startsWith("- ")) {
      current = null;
    }
  }
  return fields.map(({ name, value }) => `- ${name}: ${redact(value)}`).join("\n");
}

function sections(markdown, headingPattern, stopPattern) {
  const lines = markdown.split(/\r?\n/);
  const result = [];
  let current = null;
  for (const line of lines) {
    if (headingPattern.test(line)) {
      if (current) result.push(current);
      current = { title: line.replace(/^###\s+/, ""), body: [] };
    } else if (current && stopPattern.test(line)) {
      result.push(current);
      current = null;
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) result.push(current);
  return result.map((section) => ({ ...section, body: section.body.join("\n").trim() }));
}

function score(section) {
  const words = tokens(`${section.title} ${section.body}`);
  let points = 0;
  for (const word of words) if (taskTokens.has(word)) points++;
  const roleHints = {
    "Exam Quality and Assessment": ["exam", "question", "questions", "generation", "prov", "quality"],
    "Generation API and Timeout": ["api", "timeout", "deadline", "generation", "exam", "prov"],
    "Tests and Failure Recovery": ["test", "retry", "recovery", "partial", "question", "exam"],
    "Assessment and Source Grounding": ["grounding", "validator", "source", "material", "assessment"],
    "Security, Idempotency, and Quota": ["security", "ownership", "rls", "idempotency", "quota", "lease", "database"],
    "P.E.R. Context and Assessment Boundaries": ["per", "chat", "help", "hint"],
    "End-to-End Recovery": ["recovery", "reload", "network", "grading", "exam"],
  };
  if ((roleHints[section.title] || []).some((hint) => taskTokens.has(hint))) points += 3;
  return points;
}

const roleCards = playbook.split("## Role Cards")[1]?.split("## Ready-to-Use Review Bundles")[0] || "";
const roles = sections(roleCards, /^### /, /^## /);
const pickedRoles = roles
  .map((section, index) => ({ ...section, score: score(section), index }))
  .filter((section) => section.score > 0)
  .sort((a, b) => b.score - a.score || a.index - b.index)
  .slice(0, 3);
if (!pickedRoles.length) {
  for (const title of ["Tests and Failure Recovery", "Security, Idempotency, and Quota"]) {
    const fallback = roles.find((role) => role.title === title);
    if (fallback) pickedRoles.push(fallback);
  }
}

const entries = sections(ledger, /^### \d{4}-\d{2}-\d{2} — /, /^## /)
  .filter((section) => /^- Status: VERIFIED\s*$/m.test(section.body))
  .map((section, index) => ({ ...section, score: score(section), index }))
  .sort((a, b) => b.score - a.score || a.index - b.index)
  .slice(0, 4);

const latestStatus = status.split(/\r?\n/).slice(0, 18).join("\n").trim();
console.log(`# ExGen task context\n\nA task-specific packet was generated; the input text is not repeated or stored. Use this packet as an index. Verify current source and Git state; keep one writer, use read-only reviewers, and distinguish offline, staging, and production evidence. Never store credentials, private reasoning, or raw transcripts.\n\n## Current project status (header)\n\n${latestStatus}\n\nRead the relevant current-status section before external or deployment work.\n\n## Suggested reviewer roles`);
for (const role of pickedRoles) console.log(`\n### ${role.title}\n\n${role.body}`);
console.log("\n## Relevant reviewed learning");
for (const entry of entries) console.log(`\n### ${entry.title}\n\n${reviewedFields(entry.body)}`);
console.log("\n## Closeout\n\nUpdate current status when project state materially changes. Add only concise, reusable, source-checked findings to the learning ledger. Finish with the structured XelioV handoff. This generated packet is not stored and does not update XelioV automatically.");
