/**
 * simple-zip.js
 * Dependency-free ZIP writer using the ZIP "store" method (no compression).
 * Extracted from the video-caption-overlay export approach and made reusable.
 *
 * This module is suitable for PNG/WAV/TSV/JSON packages. It intentionally does
 * not implement ZIP64 or compression. Files and the completed archive must fit
 * in browser memory.
 */

const UTF8_FLAG = 0x0800;
const ZIP_VERSION = 20;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function encodeUtf8(value) {
  return new TextEncoder().encode(String(value ?? ""));
}

export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export function concatUint8(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function writeU16(view, offset, value) {
  view.setUint16(offset, value & 0xFFFF, true);
}

function writeU32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function dosDateTime(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue || Date.now());
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    time: ((hours << 11) | (minutes << 5) | seconds) & 0xFFFF,
    date: (((year - 1980) << 9) | (month << 5) | day) & 0xFFFF,
  };
}

function normalizeEntryName(name) {
  const normalized = String(name ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter(part => part && part !== "." && part !== "..")
    .join("/");
  if (!normalized) throw new Error("ZIP entry name is empty.");
  return normalized;
}

export async function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  return encodeUtf8(value);
}

/**
 * Build a ZIP Blob.
 * entries: [{ name, data, modifiedAt? }]
 */
export async function createZipBlob(entries, { mimeType = "application/zip" } = {}) {
  if (!Array.isArray(entries) || !entries.length) {
    throw new Error("At least one ZIP entry is required.");
  }
  if (entries.length > 0xFFFF) {
    throw new Error("This ZIP writer supports at most 65,535 entries.");
  }

  const prepared = [];
  const names = new Set();
  for (const entry of entries) {
    const name = normalizeEntryName(entry?.name);
    if (names.has(name)) throw new Error(`Duplicate ZIP entry: ${name}`);
    names.add(name);
    prepared.push({
      name,
      nameBytes: encodeUtf8(name),
      data: await toUint8Array(entry?.data),
      modifiedAt: entry?.modifiedAt || new Date(),
    });
  }

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of prepared) {
    const { nameBytes, data } = entry;
    if (data.length > 0xFFFFFFFF) {
      throw new Error(`ZIP64 would be required for ${entry.name}.`);
    }
    const crc = crc32(data);
    const stamp = dosDateTime(entry.modifiedAt);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    writeU32(lv, 0, 0x04034B50);
    writeU16(lv, 4, ZIP_VERSION);
    writeU16(lv, 6, UTF8_FLAG);
    writeU16(lv, 8, 0); // store, no compression
    writeU16(lv, 10, stamp.time);
    writeU16(lv, 12, stamp.date);
    writeU32(lv, 14, crc);
    writeU32(lv, 18, data.length);
    writeU32(lv, 22, data.length);
    writeU16(lv, 26, nameBytes.length);
    writeU16(lv, 28, 0);
    local.set(nameBytes, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    writeU32(cv, 0, 0x02014B50);
    writeU16(cv, 4, ZIP_VERSION);
    writeU16(cv, 6, ZIP_VERSION);
    writeU16(cv, 8, UTF8_FLAG);
    writeU16(cv, 10, 0);
    writeU16(cv, 12, stamp.time);
    writeU16(cv, 14, stamp.date);
    writeU32(cv, 16, crc);
    writeU32(cv, 20, data.length);
    writeU32(cv, 24, data.length);
    writeU16(cv, 28, nameBytes.length);
    writeU16(cv, 30, 0);
    writeU16(cv, 32, 0);
    writeU16(cv, 34, 0);
    writeU16(cv, 36, 0);
    writeU32(cv, 38, 0);
    writeU32(cv, 42, offset);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length + data.length;
    if (offset > 0xFFFFFFFF) throw new Error("ZIP64 would be required for this archive.");
  }

  const centralBytes = concatUint8(centralParts);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  writeU32(ev, 0, 0x06054B50);
  writeU16(ev, 4, 0);
  writeU16(ev, 6, 0);
  writeU16(ev, 8, prepared.length);
  writeU16(ev, 10, prepared.length);
  writeU32(ev, 12, centralBytes.length);
  writeU32(ev, 16, offset);
  writeU16(ev, 20, 0);

  return new Blob([concatUint8([...localParts, centralBytes, end])], { type: mimeType });
}

export function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = String(filename || "download.zip");
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function canvasToPngBlob(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new TypeError("canvasToPngBlob requires an HTMLCanvasElement.");
  }
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("PNG generation failed.")),
      "image/png"
    );
  });
}

export default {
  encodeUtf8,
  crc32,
  concatUint8,
  toUint8Array,
  createZipBlob,
  downloadBlob,
  canvasToPngBlob,
};
