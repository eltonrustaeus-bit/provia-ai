import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = await readFile(path.join(root, "index.html"), "utf8");
const section = html.match(/<section class="perSec[\s\S]*?<\/section>/)?.[0] || "";

assert.ok(section, "landing page includes the P.E.R section");
assert.match(section, /Under ett aktivt prov får du vägledning utan facit/i);
assert.match(section, /efter inlämning och rättning kan du gå igenom svaret steg för steg/i);
assert.match(section, /Under provet får du ledtrådar, inte färdiga svar/i);
