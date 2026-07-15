// シンプルな単色+文字なしPNGアイコンを生成する（PWA用）。外部ライブラリ不使用。
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makeIcon(size, outPath) {
  const bg = [37, 99, 235]; // #2563eb
  const fg = [255, 255, 255];
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const margin = Math.round(size * 0.22);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter type none
    for (let x = 0; x < size; x++) {
      const inBar = x >= margin && x <= size - margin && y >= size * 0.55 && y <= size - margin && (
        (x < margin + (size - 2 * margin) / 3 && y >= size * 0.68) ||
        (x >= margin + (size - 2 * margin) / 3 && x < margin + 2 * (size - 2 * margin) / 3 && y >= size * 0.55) ||
        (x >= margin + 2 * (size - 2 * margin) / 3 && y >= size * 0.42)
      );
      const color = inBar ? fg : bg;
      const off = rowStart + 1 + x * 4;
      raw[off] = color[0]; raw[off + 1] = color[1]; raw[off + 2] = color[2]; raw[off + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(outPath, png);
  console.log("wrote", outPath, png.length, "bytes");
}

const dir = path.join(__dirname, "..", "icons");
fs.mkdirSync(dir, { recursive: true });
makeIcon(192, path.join(dir, "icon-192.png"));
makeIcon(512, path.join(dir, "icon-512.png"));
