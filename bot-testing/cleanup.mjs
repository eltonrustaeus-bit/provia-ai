// Deletes every bot test account from Supabase auth.
// Matches emails containing "+proviabot_". Dry-run by default.
//
//   node bot-testing/cleanup.mjs           # list what WOULD be deleted
//   node bot-testing/cleanup.mjs --delete  # actually delete
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/env.mjs";

loadEnv();
const DELETE = process.argv.includes("--delete");
const MARKER = "+proviabot_";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY saknas i .env.local");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const victims = [];
  let page = 1;
  // paginate through all users
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data?.users || [];
    for (const u of users) if ((u.email || "").includes(MARKER)) victims.push(u);
    if (users.length < 200) break;
    page++;
  }

  if (!victims.length) {
    console.log("Inga bot-konton hittades (marker: " + MARKER + ").");
    return;
  }
  console.log(`Hittade ${victims.length} bot-konton:`);
  for (const v of victims) console.log(`  - ${v.email}  (${v.id})`);

  if (!DELETE) {
    console.log(`\nDry-run. Kör med --delete för att radera.`);
    return;
  }
  let ok = 0;
  for (const v of victims) {
    const { error } = await sb.auth.admin.deleteUser(v.id);
    if (error) console.error(`  ✗ ${v.email}: ${error.message}`);
    else ok++;
  }
  console.log(`\n🧹 Raderade ${ok}/${victims.length} konton.`);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
