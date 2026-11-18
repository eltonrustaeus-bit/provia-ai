"use strict";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_RENDERING_CHUNKS = new Set(["tRNS", "sRGB", "gAMA", "cHRM", "pHYs", "bKGD", "sBIT", "hIST"]);
const PNG_CRITICAL_CHUNKS = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function pngChunkCrc(input, typeStart, dataEnd) {
  let crc = 0xffffffff;
  for (let i = typeStart; i < dataEnd; i++) crc = CRC_TABLE[(crc ^ input[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function stripJpegMetadata(input) {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return null;
  const out = [input.subarray(0, 2)];
  let cursor = 2;
  let sawScan = false;
  let sawEnd = false;

  while (cursor < input.length) {
    const markerStart = cursor;
    if (input[cursor++] !== 0xff) return null;
    while (cursor < input.length && input[cursor] === 0xff) cursor++;
    if (cursor >= input.length) return null;
    const marker = input[cursor++];

    if (marker === 0x00) return null;
    if (marker === 0xd9) {
      out.push(input.subarray(markerStart, cursor));
      sawEnd = true;
      break; // Drop any trailing bytes after the actual JPEG end marker.
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(input.subarray(markerStart, cursor));
      continue;
    }
    if (cursor + 2 > input.length) return null;
    const segmentLength = input.readUInt16BE(cursor);
    if (segmentLength < 2 || cursor + segmentLength > input.length) return null;
    const segmentEnd = cursor + segmentLength;
    // Drop every application segment, including APP0/JFXX thumbnails, plus
    // comments. Pixel scan/quantization/frame data remains intact.
    const isMetadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) out.push(input.subarray(markerStart, segmentEnd));
    cursor = segmentEnd;

    if (marker === 0xda) {
      sawScan = true;
      let scanStart = cursor;
      while (cursor < input.length) {
        if (input[cursor] !== 0xff) { cursor++; continue; }
        let markerCursor = cursor + 1;
        while (markerCursor < input.length && input[markerCursor] === 0xff) markerCursor++;
        if (markerCursor >= input.length) return null;
        const scanMarker = input[markerCursor];
        if (scanMarker === 0x00 || (scanMarker >= 0xd0 && scanMarker <= 0xd7)) {
          cursor = markerCursor + 1;
          continue;
        }
        out.push(input.subarray(scanStart, cursor));
        cursor = markerCursor - 1;
        break;
      }
      if (cursor >= input.length) return null;
    }
  }

  return sawScan && sawEnd ? Buffer.concat(out) : null;
}

function stripPngMetadata(input) {
  if (input.length < 20 || !input.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  const out = [input.subarray(0, 8)];
  let cursor = 8;
  let sawHeader = false;
  let sawData = false;
  let dataEnded = false;
  let sawPalette = false;
  let sawEnd = false;
  let colorType = null;

  while (cursor + 12 <= input.length) {
    const length = input.readUInt32BE(cursor);
    const end = cursor + 12 + length;
    if (end > input.length) return null;
    const type = input.toString("ascii", cursor + 4, cursor + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) return null;
    if (!PNG_CRITICAL_CHUNKS.has(type) && !/^[a-z]/.test(type)) return null;
    if (!sawHeader && type !== "IHDR") return null;
    if (input.readUInt32BE(end - 4) !== pngChunkCrc(input, cursor + 4, end - 4)) return null;
    if (type === "IHDR") {
      if (sawHeader || cursor !== 8 || length !== 13) return null;
      sawHeader = true;
      colorType = input[cursor + 17];
    }
    if (type === "PLTE") {
      if (sawPalette || sawData || length < 3 || length > 768 || length % 3 !== 0) return null;
      sawPalette = true;
    }
    if (type === "IDAT") {
      if (dataEnded || (colorType === 3 && !sawPalette)) return null;
      sawData = true;
    } else if (sawData && type !== "IEND") {
      dataEnded = true;
    }
    if (type === "IEND") {
      if (length !== 0 || !sawData || end !== input.length) return null;
      sawEnd = true;
      break;
    }
    // Preserve only known ancillary chunks that affect image rendering. Strip
    // text, EXIF, timestamps, private/unknown chunks and other metadata.
    if (PNG_CRITICAL_CHUNKS.has(type) || PNG_RENDERING_CHUNKS.has(type)) out.push(input.subarray(cursor, end));
    cursor = end;
  }

  return sawHeader && sawData && sawEnd ? Buffer.concat(out) : null;
}

function normalizeOcrImageDataUrl(value) {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(value || ""));
  if (!match || match[2].length % 4 !== 0) return null;
  const bytes = Buffer.from(match[2], "base64");
  const normalized = match[1] === "image/jpeg" ? stripJpegMetadata(bytes) : stripPngMetadata(bytes);
  if (!normalized) return null;
  return `data:${match[1]};base64,${normalized.toString("base64")}`;
}

module.exports = { normalizeOcrImageDataUrl };
