import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const { normalizeOcrImageDataUrl } = require("../../api/_ocr-image.cjs");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, data]);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([header, body, crc]);
}

function insertPngMetadata(png, type, data) {
  let cursor = 8;
  const chunks = [];
  while (cursor + 12 <= png.length) {
    const length = png.readUInt32BE(cursor);
    const end = cursor + 12 + length;
    const name = png.toString("ascii", cursor + 4, cursor + 8);
    if (name === "IDAT") chunks.push(pngChunk(type, data));
    chunks.push(png.subarray(cursor, end));
    cursor = end;
    if (name === "IEND") break;
  }
  return Buffer.concat([png.subarray(0, 8), ...chunks]);
}

function exifWithGps() {
  const exif = Buffer.alloc(6 + 44);
  exif.write("Exif\0\0", 0, "binary");
  const tiff = 6;
  exif.write("II", tiff, "ascii");
  exif.writeUInt16LE(42, tiff + 2);
  exif.writeUInt32LE(8, tiff + 4);
  exif.writeUInt16LE(1, tiff + 8);
  exif.writeUInt16LE(0x8825, tiff + 10);
  exif.writeUInt16LE(4, tiff + 12);
  exif.writeUInt32LE(1, tiff + 14);
  exif.writeUInt32LE(26, tiff + 18);
  exif.writeUInt32LE(0, tiff + 22);
  exif.writeUInt16LE(1, tiff + 26);
  exif.writeUInt16LE(1, tiff + 28);
  exif.writeUInt16LE(2, tiff + 30);
  exif.writeUInt32LE(2, tiff + 32);
  exif.write("N\0", tiff + 36, "binary");
  exif.writeUInt32LE(0, tiff + 40);
  return exif;
}

const toDataUrl = (mime, bytes) => `data:${mime};base64,${bytes.toString("base64")}`;

const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#428877" } }).png().toBuffer();
const taggedPng = insertPngMetadata(png, "eXIf", Buffer.from("SYNTHETIC-GPS-SECRET"));
const taggedPngWithUnknown = insertPngMetadata(taggedPng, "vpAg", Buffer.from("SYNTHETIC-PRIVATE-SECRET"));
const cleanPngUrl = normalizeOcrImageDataUrl(toDataUrl("image/png", taggedPngWithUnknown));
assert.ok(cleanPngUrl, "PNG with valid metadata is accepted");
const cleanPngBytes = Buffer.from(cleanPngUrl.split(",")[1], "base64");
assert.ok(!cleanPngBytes.includes(Buffer.from("SYNTHETIC-GPS-SECRET")), "PNG eXIf metadata is removed");
assert.ok(!cleanPngBytes.includes(Buffer.from("SYNTHETIC-PRIVATE-SECRET")), "unknown private PNG ancillary data is removed");
assert.equal((await sharp(cleanPngBytes).metadata()).width, 2, "normalized PNG remains decodable");

const jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#428877" } }).jpeg().toBuffer();
const exif = exifWithGps();
const app1 = Buffer.alloc(4);
app1[0] = 0xff;
app1[1] = 0xe1;
app1.writeUInt16BE(exif.length + 2, 2);
const app0Payload = Buffer.from("JFXX\0APP0-THUMBNAIL-SECRET", "binary");
const app0 = Buffer.alloc(4);
app0[0] = 0xff;
app0[1] = 0xe0;
app0.writeUInt16BE(app0Payload.length + 2, 2);
const taggedJpeg = Buffer.concat([jpeg.subarray(0, 2), app0, app0Payload, app1, exif, jpeg.subarray(2)]);
const cleanJpegUrl = normalizeOcrImageDataUrl(toDataUrl("image/jpeg", taggedJpeg));
assert.ok(cleanJpegUrl, "JPEG with EXIF GPS metadata is accepted");
const cleanJpegBytes = Buffer.from(cleanJpegUrl.split(",")[1], "base64");
assert.ok(!cleanJpegBytes.includes(Buffer.from("Exif\0\0", "binary")), "JPEG EXIF segment is removed");
assert.ok(!cleanJpegBytes.includes(Buffer.from("APP0-THUMBNAIL-SECRET")), "JPEG APP0 thumbnail metadata is removed");
assert.equal((await sharp(cleanJpegBytes).metadata()).width, 2, "normalized JPEG remains decodable");

assert.equal(normalizeOcrImageDataUrl("data:image/webp;base64,UklGRg=="), null, "unsupported formats fail closed");
assert.equal(normalizeOcrImageDataUrl("data:image/jpeg;base64,not-base64!"), null, "malformed data URLs fail closed");
const badCrcPng = Buffer.from(png);
badCrcPng[badCrcPng.length - 1] ^= 1;
assert.equal(normalizeOcrImageDataUrl(toDataUrl("image/png", badCrcPng)), null, "PNG with invalid chunk CRC fails closed");
const outOfOrderPng = Buffer.concat([png.subarray(0, 8), pngChunk("IDAT", Buffer.alloc(0)), png.subarray(8)]);
assert.equal(normalizeOcrImageDataUrl(toDataUrl("image/png", outOfOrderPng)), null, "PNG with invalid chunk ordering fails closed");
assert.equal(normalizeOcrImageDataUrl(toDataUrl("image/png", Buffer.concat([png, Buffer.from("trailing")]))), null, "PNG trailing data fails closed");
console.log("ocr-image-sanitize: 13 assertions passed");
