import { ROOT, serve, mockApis, seed, report } from "./_harness.mjs";

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const server = await serve(ROOT, { indexFile: "app.html" });
const browser = await chromium.launch();
const result = report("ocr-image-privacy");
const context = await browser.newContext();
const page = await context.newPage();
let capturedOcrBody = null;

try {
  await mockApis(page, {
    role: "premium",
    profiles: { id: "u1", approved: true, role: "premium" },
    extra: [["**/api/ocr", async (route) => {
      capturedOcrBody = route.request().postDataJSON();
      await route.fulfill({ json: { ok: true, readable: true, text: "synthetic OCR", confidence: 0.95, uncertain: [] } });
    }]],
  });
  await seed(page, { user: { id: "u1", email: "synthetic@example.invalid" }, role: "premium" });
  await page.goto(`${server.url}/app.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.prepareImageForAi === "function");
  await page.waitForFunction(() => window.ExGenEngine && typeof window.ExGenEngine.ocr === "function");

  const originalJpeg = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext("2d");
    context.fillStyle = "#347c74";
    context.fillRect(0, 0, 2, 2);
    return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
  });
  const jpeg = Buffer.from(originalJpeg, "base64");
  const metadata = Buffer.alloc(6 + 44);
  metadata.write("Exif\0\0", 0, "binary");
  const tiff = 6;
  metadata.write("II", tiff, "ascii");
  metadata.writeUInt16LE(42, tiff + 2);
  metadata.writeUInt32LE(8, tiff + 4);
  metadata.writeUInt16LE(1, tiff + 8); // IFD0: one GPSInfo pointer
  metadata.writeUInt16LE(0x8825, tiff + 10);
  metadata.writeUInt16LE(4, tiff + 12); // LONG
  metadata.writeUInt32LE(1, tiff + 14);
  metadata.writeUInt32LE(26, tiff + 18); // GPS IFD offset
  metadata.writeUInt32LE(0, tiff + 22); // next IFD
  metadata.writeUInt16LE(1, tiff + 26); // GPS IFD: GPSLatitudeRef
  metadata.writeUInt16LE(1, tiff + 28);
  metadata.writeUInt16LE(2, tiff + 30); // ASCII
  metadata.writeUInt32LE(2, tiff + 32);
  metadata.write("N\0", tiff + 36, "binary");
  metadata.writeUInt32LE(0, tiff + 40); // next IFD
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1, (metadata.length + 2) >> 8, (metadata.length + 2) & 0xff]),
    metadata,
  ]);
  const withMetadata = Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]).toString("base64");
  const prepared = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const file = new File([bytes], "student-photo.jpg", { type: "image/jpeg" });
    const output = await window.prepareImageForAi(file, 1600, 0.85);
    return { output, decoded: await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ ok: true, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ ok: false });
      image.src = output;
    }) };
  }, withMetadata);

  const outputBytes = Buffer.from(prepared.output.split(",")[1], "base64");
  result.ok("preparation returns a new JPEG data URL", prepared.output.startsWith("data:image/jpeg;base64,"));
  result.ok("prepared image remains decodable", prepared.decoded.ok && prepared.decoded.width === 2 && prepared.decoded.height === 2, JSON.stringify(prepared.decoded));
  result.ok("valid EXIF GPS metadata is absent from prepared bytes", !outputBytes.includes(Buffer.from("Exif\0\0", "binary")));
  result.ok("output stays within OCR request size limit", prepared.output.length <= 3_700_000, String(prepared.output.length));

  await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    return window.ExGenEngine.ocr(new File([bytes], "student-photo.jpg", { type: "image/jpeg" }));
  }, withMetadata);
  const sentImage = Buffer.from(capturedOcrBody.imageDataUrl.split(",")[1], "base64");
  result.ok("OCR route receives normalized JPEG, not the selected file bytes", capturedOcrBody.imageDataUrl.startsWith("data:image/jpeg;base64,"));
  result.ok("selected EXIF GPS metadata is absent from actual OCR request", !sentImage.includes(Buffer.from("Exif\0\0", "binary")));

  await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    return window.ExGenEngine.readSolution(new File([bytes], "solution.jpg", { type: "image/jpeg" }), "synthetic question");
  }, withMetadata);
  const sentSolution = Buffer.from(capturedOcrBody.imageDataUrl.split(",")[1], "base64");
  result.ok("handwritten-solution OCR retains its solution mode", capturedOcrBody.mode === "solution");
  result.ok("handwritten-solution OCR also strips EXIF GPS metadata", !sentSolution.includes(Buffer.from("Exif\0\0", "binary")));

  const rejected = await page.evaluate(async () => {
    try {
      await window.prepareImageForAi(new File(["not an image"], "broken.jpg", { type: "image/jpeg" }));
      return false;
    } catch {
      return true;
    }
  });
  result.ok("decode failure rejects instead of returning original bytes", rejected);
  result.ok("OCR privacy copy is visible on material page", /Bilden skickas till AI/.test(await page.locator("#tOcrPrivacy").innerText()));

  await page.evaluate(() => document.getElementById("langBtnDesktop")?.click());
  result.ok("OCR privacy copy follows English localization", /image is sent to AI/i.test(await page.locator("#tOcrPrivacy").innerText()));
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
process.exitCode = result.finish();
