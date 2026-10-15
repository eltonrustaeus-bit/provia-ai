import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const [roleApi, memory, profile, app, improvement, konto, checklist, deletionDoc, apiFiles] = await Promise.all([
  readFile(new URL("../../api/check-role.js", import.meta.url), "utf8"),
  readFile(new URL("../../api/_per-memory.js", import.meta.url), "utf8"),
  readFile(new URL("../../api/_learner-profile.js", import.meta.url), "utf8"),
  readFile(new URL("../../app.html", import.meta.url), "utf8"),
  readFile(new URL("../../förbättring.html", import.meta.url), "utf8"),
  readFile(new URL("../../konto.html", import.meta.url), "utf8"),
  readFile(new URL("../../docs/codex/11_PILOT_READINESS_CHECKLIST.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/codex/12_DATA_DELETION_GAP.md", import.meta.url), "utf8"),
  readdir(new URL("../../api/", import.meta.url)),
]);
const apiSources = (await Promise.all(apiFiles.filter((file) => file.endsWith(".js")).map((file) =>
  readFile(new URL(`../../api/${file}`, import.meta.url), "utf8")
))).join("\n");

const examsStart = roleApi.indexOf('if (action === "delete_exams")');
const examsEnd = roleApi.indexOf("// ── Teacher dashboard", examsStart);
const examsRoute = roleApi.slice(examsStart, examsEnd);
assert.match(examsRoute, /\.rpc\("clear_user_exam_history", \{ p_user_id: user\.id \}\)/,
  "one atomic exam-history clear is scoped to the authenticated user");
assert.match(examsRoute, /error \|\| data !== true/,
  "a failed or unconfirmed clear cannot be reported as success");
assert.doesNotMatch(examsRoute, /auth\.admin\.deleteUser/, "exam-history deletion is not account deletion");
assert.match(memory, /export async function clearLongMemory[\s\S]*?\.rpc\("clear_per_memory", \{ p_user_id: userId \}\)/,
  "P.E.R memory/session deletion is a separate user-scoped transactional action");
assert.doesNotMatch(memory, /export async function clearLongMemory[\s\S]*?\.from\("per_long_memory"\)\.delete\(/,
  "P.E.R clearing cannot bypass the epoch barrier with direct deletes");
assert.match(profile, /export async function forgetAllFacts[\s\S]*?\.from\("learner_profile_facts"\)\.delete\(\)\.eq\("user_id", userId\)/,
  "profile facts have their own user-scoped deletion");
assert.match(apiSources, /if \(action === "delete_account"\)[\s\S]*?confirmationEmail[\s\S]*?stripe_customer_id[\s\S]*?teacher_id[\s\S]*?auth\.admin\.signOut\(token, "global"\)[\s\S]*?auth\.admin\.deleteUser\(user\.id, false\)/,
  "account deletion requires ownership confirmation, blocks billing/class side effects, revokes refresh sessions, and hard-deletes only the signed-in user");
assert.match(app, /Kontodata kunde inte bekräftas raderad/, "the app does not claim account data was erased after local clearing alone");
assert.match(app, /P\.E\.R:s minne och kunskapsöversikten påverkas inte/, "the app discloses that P.E.R memory and learning overview are outside this clear action");
const appClearStart = app.indexOf('onClick("clearBtn"');
const appClearEnd = app.indexOf('// Floating grade-knapp', appClearStart);
assert.match(app.slice(appClearStart, appClearEnd), /let remoteHistoryDeleted = false/, "missing Supabase configuration cannot be treated as confirmed remote deletion");
assert.match(app.slice(appClearStart, appClearEnd), /clearSession\?\.user\?\.id[\s\S]*?clearSession\?\.access_token/, "app clear binds the remote token and local queue to one session snapshot");
assert.match(app.slice(appClearStart, appClearEnd), /\(clearUserId \|\| localDataOwner\) && localDataOwner !== clearUserId/, "app clear fails closed when the session is missing or account owner changed");
const improvementClearStart = improvement.indexOf("const btn=$('resetBtn')");
const improvementClearEnd = improvement.indexOf("/* ── INIT ── */", improvementClearStart);
const improvementClear = improvement.slice(improvementClearStart, improvementClearEnd);
assert.match(improvementClear, /let remoteHistoryDeleted=false/, "the coach page reports remote deletion only after server confirmation");
assert.match(improvementClear, /deleteAllUserExamsFromAccount\(clearSession\)/, "coach deletion uses the captured session rather than re-reading another account");
assert.match(improvementClear, /\(clearUserId\|\|localDataOwner\)&&localDataOwner!==clearUserId/, "coach clear fails closed when the session is missing or account owner changed");
assert.match(app.slice(appClearStart, appClearEnd), /clearLocalExamData\(clearUserId\)/, "app clear removes only the active account's draft, progress and pending queue");
assert.match(improvementClear, /clearLocalExamData\(clearUserId\)/, "coach clear removes only the active account's draft, progress and pending queue");
const appLogoutStart = app.indexOf("async function logout(options={})");
const appLogoutEnd = app.indexOf("// ── CENTRAL: läser roll", appLogoutStart);
assert.match(app.slice(appLogoutStart, appLogoutEnd), /await db\.auth\.signOut\(\)[\s\S]*?await db\.auth\.getSession\(\)[\s\S]*?afterSignOut\?\.session\?\.user\?\.id[\s\S]*?location\.reload\(\);return;[\s\S]*?clearForSignOut\(\)/,
  "app logout rechecks the active account after sign-out before clearing shared local data");
const deletionFinishStart = konto.indexOf("async function finishAccountDeletion");
const deletionFinishEnd = konto.indexOf("document.getElementById(\"deleteAccountBtn\")", deletionFinishStart);
assert.match(konto.slice(deletionFinishStart, deletionFinishEnd), /await sb\.auth\.signOut\(\{scope:\"local\"\}\)[\s\S]*?await sb\.auth\.getSession\(\)[\s\S]*?afterSignOut\.session\.user\.id!==userId[\s\S]*?clearLocalExamData\(userId\)[\s\S]*?return false;[\s\S]*?clearDeletedAccountLocalData\(userId\)/,
  "account deletion rechecks ownership after sign-out and preserves a newly active account");
assert.match(checklist, /docs\/codex\/12_DATA_DELETION_GAP\.md/, "pilot start criteria point to the complete deletion gate");
assert.match(deletionDoc, /local, unpublished self-service deletion candidate/i,
  "the deletion document distinguishes the local candidate from a verified release");
assert.match(deletionDoc, /not a staging\/end-to-end deletion test and the route is not deployed/i,
  "the deletion document keeps staging and deployment gaps explicit");
console.log("data deletion scope: exam, memory, profile and account deletion boundaries passed");
