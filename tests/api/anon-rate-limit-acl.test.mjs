import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const migration = await readFile(new URL("../../supabase/migrations/20261012103946_restrict_anon_rate_limit_table_access.sql", import.meta.url), "utf8");
const rollback = await readFile(new URL("../../supabase/migrations/20261012103946_restrict_anon_rate_limit_table_access_ROLLBACK.sql", import.meta.url), "utf8");
assert.match(migration, /revoke\s+all\s+on\s+table\s+public\.anon_rate_limit\s+from\s+public\s*,\s*anon\s*,\s*authenticated/i,
  "browser-facing roles have no direct ACL on the internal limiter table");
assert.match(rollback, /raise exception/i,
  "rollback cannot silently restore broad direct table access");

const apiDir = new URL("../../api/", import.meta.url);
const apiFiles = await readdir(apiDir);
const apiSources = await Promise.all(apiFiles.filter((name) => name.endsWith(".js")).map((name) =>
  readFile(new URL(`../../api/${name}`, import.meta.url), "utf8")
));
const browserSources = await Promise.all(["../../shared.js", "../../app.html"].map((path) =>
  readFile(new URL(path, import.meta.url), "utf8")
));
assert.doesNotMatch([...apiSources, ...browserSources].join("\n"), /from\(["']anon_rate_limit["']\)/,
  "runtime does not access the limiter table directly");
assert.match(apiSources.join("\n"), /rpc\(["']consume_anon_rate["']/,
  "server runtime uses the intended RPC boundary");

console.log("anon-rate-limit ACL: direct client grants removed; RPC boundary retained");
