import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { readJsonBody } = require("../../api/generate-exam.js");

assert.deepEqual(await readJsonBody(Readable.from([Buffer.from('{"course":"Matematik"}')])), { course: "Matematik" });

const oversized = Readable.from([
  Buffer.from('{"padding":"'),
  Buffer.alloc(64 * 1024, 97),
  Buffer.from('"}')
]);
await assert.rejects(readJsonBody(oversized), (error) => error.code === "BODY_TOO_LARGE");

console.log("generate-body-size: streamed request cap passed");
