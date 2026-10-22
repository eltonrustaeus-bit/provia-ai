import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/xeliov-agent-context.mjs");

test("context packet selects generation roles and related verified lessons", () => {
  const result = spawnSync(process.execPath, [script, "--task", "12-question exam generation timeout and retry"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Generation API and Timeout/);
  assert.match(result.stdout, /Exam Quality and Assessment/);
  assert.match(result.stdout, /Back off repeated preflight misses and verify retry salvage over HTTP/);
  assert.match(result.stdout, /not stored and does not update XelioV automatically/);
});

test("context command requires a task description", () => {
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});

test("context packet excludes proposed and rejected lessons", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "xeliov-context-status-"));
  try {
    await mkdir(path.join(tempRoot, "scripts"), { recursive: true });
    await mkdir(path.join(tempRoot, "docs/codex"), { recursive: true });
    await writeFile(path.join(tempRoot, "scripts/xeliov-agent-context.mjs"), await readFile(script));
    await writeFile(path.join(tempRoot, "docs/codex/15_AGENT_PLAYBOOK.md"), "## Role Cards\n### Generation API and Timeout\nFollow timeout and exam generation.\n## Ready-to-Use Review Bundles\n");
    await writeFile(path.join(tempRoot, "docs/codex/08_CURRENT_STATUS.md"), "# Status\n\nRead current project status.\n");
    await writeFile(path.join(tempRoot, "docs/codex/16_LEARNING_LEDGER.md"), [
      "# Learning Ledger",
      "### 2026-10-22 — Verified timeout finding",
      "- Status: VERIFIED",
      "- Finding: Keep timeout and generation safe.",
      "### 2026-10-22 — Proposed timeout finding",
      "- Status: PROPOSED",
      "- Finding: Change timeout and generation quickly.",
      "### 2026-10-22 — Rejected timeout finding",
      "- Status: REJECTED",
      "- Finding: Ignore timeout in exam generation.",
      "## Promotion Rules",
    ].join("\n"));

    const result = spawnSync(process.execPath, [path.join(tempRoot, "scripts/xeliov-agent-context.mjs"), "--task", "exam generation timeout"], {
      cwd: tempRoot,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Verified timeout finding/);
    assert.doesNotMatch(result.stdout, /Proposed timeout finding|Rejected timeout finding/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("context packet does not echo task text and redacts sensitive ledger content", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "xeliov-context-redaction-"));
  try {
    await mkdir(path.join(tempRoot, "scripts"), { recursive: true });
    await mkdir(path.join(tempRoot, "docs/codex"), { recursive: true });
    await writeFile(path.join(tempRoot, "scripts/xeliov-agent-context.mjs"), await readFile(script));
    await writeFile(path.join(tempRoot, "docs/codex/15_AGENT_PLAYBOOK.md"), "## Role Cards\n### Generation API and Timeout\nFollow timeout and exam generation.\n## Ready-to-Use Review Bundles\n");
    await writeFile(path.join(tempRoot, "docs/codex/08_CURRENT_STATUS.md"), "# Status\n\nRead current project status.\n");
    await writeFile(path.join(tempRoot, "docs/codex/16_LEARNING_LEDGER.md"), [
      "# Learning Ledger",
      "### 2026-10-22 — Verified timeout finding",
      "- Status: VERIFIED",
      "- Evidence: offline; tests passed; contact dev@example.com",
      "- Finding: Keep timeout safe; key=sk-proj-abcdefghijklmnop1234",
      "- Limitation: Does not prove live behavior.",
      "## Promotion Rules",
    ].join("\n"));

    const task = "exam generation timeout sk-proj-private-task-value-123456";
    const result = spawnSync(process.execPath, [path.join(tempRoot, "scripts/xeliov-agent-context.mjs"), "--task", task], {
      cwd: tempRoot,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /private-task-value|dev@example\.com|abcdefghijklmnop1234/);
    assert.match(result.stdout, /\[REDACTED EMAIL\]/);
    assert.match(result.stdout, /\[REDACTED SECRET\]/);
    assert.match(result.stdout, /Does not prove live behavior/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
