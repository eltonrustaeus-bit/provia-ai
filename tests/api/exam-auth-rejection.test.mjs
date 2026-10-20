import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const generateExam = require("../../api/generate-exam.js");

const previousWarn = console.warn;
const warnings = [];
console.warn = (line) => warnings.push(String(line));

try {
  const req = Readable.from([]);
  req.method = "POST";
  req.headers = {};
  const result = await new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      setHeader() {},
      end(raw) {
        try { resolve({ status: this.statusCode, body: JSON.parse(raw) }); }
        catch (error) { reject(error); }
      },
    };
    Promise.resolve(generateExam(req, res)).catch(reject);
  });

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { ok: false, error: "Unauthorized" });
  assert.equal(warnings.length, 1);
  const diagnostic = JSON.parse(warnings[0]);
  assert.deepEqual(diagnostic, {
    event: "exam_auth_rejected",
    stage: "missing_bearer_token",
  });
  assert.equal(JSON.stringify(diagnostic).includes("authorization"), false);
  assert.equal(JSON.stringify(diagnostic).includes("token"), true,
    "only the non-secret reason label may mention a missing token");
} finally {
  console.warn = previousWarn;
}
