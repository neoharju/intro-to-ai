// Packs starter/ into files/intro-to-ai-starter.zip: the course folder that students download from the front
// page ("What you need"), a uv project with the course's packages locked in uv.lock. The zip holds the
// files directly in starter/ (not .venv or other folders) under intro-to-ai/. They are stored uncompressed,
// in a fixed order and with a fixed date, so the same sources give the same zip, byte for byte, with any
// version of Node.js; the Check workflow relies on that.
//
//   npm run starter      (also part of npm run build)
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'starter');
const target = path.join(root, 'files', 'intro-to-ai-starter.zip');
const FOLDER = 'intro-to-ai/';

// 1 January 2026 00:00 in the MS-DOS format of zip files.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
const UNIX_FILE = 0o100644;
const UNIX_FOLDER = 0o040755;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;

  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }

  return c >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

const entries = [{ name: FOLDER, data: Buffer.alloc(0), mode: UNIX_FOLDER }];

for (const file of (await readdir(source, { withFileTypes: true })).filter(entry => entry.isFile()).map(entry => entry.name).sort()) {
  entries.push({ name: FOLDER + file, data: await readFile(path.join(source, file)), mode: UNIX_FILE });
}

const locals = [];
const centrals = [];
let offset = 0;

entries.forEach(({ name, data, mode }) => {
  const nameBytes = Buffer.from(name, 'utf8');
  const crc = crc32(data);
  const local = Buffer.alloc(30);

  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(10, 4); // version needed: 1.0 (stored)
  local.writeUInt16LE(0x0800, 6); // the name is UTF-8
  local.writeUInt16LE(0, 8); // stored, not compressed
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28);

  const central = Buffer.alloc(46);

  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE((3 << 8) | 20, 4); // made on Unix, zip 2.0
  central.writeUInt16LE(10, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt16LE(0, 30); // extra field
  central.writeUInt16LE(0, 32); // comment
  central.writeUInt16LE(0, 34); // disk
  central.writeUInt16LE(0, 36); // internal attributes
  central.writeUInt32LE(((mode << 16) | (mode === UNIX_FOLDER ? 0x10 : 0)) >>> 0, 38);
  central.writeUInt32LE(offset, 42);

  locals.push(local, nameBytes, data);
  centrals.push(central, nameBytes);
  offset += local.length + nameBytes.length + data.length;
});

const directory = Buffer.concat(centrals);
const end = Buffer.alloc(22);

end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);

const zip = Buffer.concat([...locals, directory, end]);
let before = null;

try {
  before = await readFile(target);
} catch (error) {
  // No zip yet.
}

if (before && before.equals(zip)) {
  console.log('files/intro-to-ai-starter.zip is up to date.');
} else {
  await writeFile(target, zip);
  console.log(`Wrote files/intro-to-ai-starter.zip (${entries.length - 1} files, ${zip.length} bytes).`);
}
