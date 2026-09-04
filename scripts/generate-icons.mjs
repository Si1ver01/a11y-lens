import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(rootDirectory, 'public/icon');
const sizes = [16, 32, 48, 128];

function createCrcTable() {
  return Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
}

const crcTable = createCrcTable();

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function distanceToSegment(x, y, startX, startY, endX, endY) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const ratio = Math.max(
    0,
    Math.min(1, ((x - startX) * deltaX + (y - startY) * deltaY) / lengthSquared),
  );
  return Math.hypot(x - (startX + ratio * deltaX), y - (startY + ratio * deltaY));
}

function pixelAt(size, x, y) {
  const center = size * 0.42;
  const radius = size * 0.29;
  const ringWidth = Math.max(2, size * 0.1);
  const distance = Math.hypot(x - center, y - center);
  const handleDistance = distanceToSegment(
    x,
    y,
    size * 0.61,
    size * 0.61,
    size * 0.84,
    size * 0.84,
  );

  if (handleDistance <= ringWidth * 0.58) return [225, 82, 65, 255];
  if (distance <= radius && distance >= radius - ringWidth) return [17, 112, 105, 255];
  if (distance < radius - ringWidth) return [247, 250, 249, 255];
  return [0, 0, 0, 0];
}

function createPng(size) {
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    scanlines[rowOffset] = 0;
    for (let x = 0; x < size; x += 1) {
      const [red, green, blue, alpha] = pixelAt(size, x + 0.5, y + 0.5);
      const offset = rowOffset + 1 + x * 4;
      scanlines[offset] = red;
      scanlines[offset + 1] = green;
      scanlines[offset + 2] = blue;
      scanlines[offset + 3] = alpha;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createChunk('IHDR', header),
    createChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  sizes.map((size) => writeFile(resolve(outputDirectory, `${size}.png`), createPng(size))),
);

process.stdout.write(
  `${JSON.stringify({ level: 'INFO', scope: 'icon-generator', event: 'icons-generated', sizes })}\n`,
);
