const fs = require('fs');
const path = require('path');

const MAX = 512;

const pkgDir = (name) => path.dirname(require.resolve(`${name}/package.json`));

const isJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
const isPng = (b) => b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

const toArrayBuffer = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

let pngMod = null;
let jpegMod = null;
let webpMod = null;

const initPng = async () => {
  if (pngMod) return pngMod;
  const m = await import('@jsquash/png/decode.js');
  await m.init(fs.readFileSync(path.join(pkgDir('@jsquash/png'), 'codec', 'pkg', 'squoosh_png_bg.wasm')));
  pngMod = m;
  return m;
};

const initJpeg = async () => {
  if (jpegMod) return jpegMod;
  const m = await import('@jsquash/jpeg/decode.js');
  const bytes = fs.readFileSync(path.join(pkgDir('@jsquash/jpeg'), 'codec', 'dec', 'mozjpeg_dec.wasm'));
  await m.init(new WebAssembly.Module(bytes));
  jpegMod = m;
  return m;
};

const initWebp = async () => {
  if (webpMod) return webpMod;
  const m = await import('@jsquash/webp/encode.js');
  const { simd } = await import('wasm-feature-detect');
  const useSimd = await simd();
  const wasmFile = useSimd ? 'webp_enc_simd.wasm' : 'webp_enc.wasm';
  const bytes = fs.readFileSync(path.join(pkgDir('@jsquash/webp'), 'codec', 'enc', wasmFile));
  await m.init(new WebAssembly.Module(bytes));
  webpMod = m;
  return m;
};

const contain512 = (img) => {
  const w = img.width;
  const h = img.height;
  const scale = Math.min(MAX / w, MAX / h);
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const out = new Uint8ClampedArray(MAX * MAX * 4);
  const ox = Math.floor((MAX - tw) / 2);
  const oy = Math.floor((MAX - th) / 2);
  for (let y = 0; y < th; y++) {
    const sy = Math.min(h - 1, Math.floor(((y + 0.5) * h) / th));
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(w - 1, Math.floor(((x + 0.5) * w) / tw));
      const si = (sy * w + sx) * 4;
      const di = ((y + oy) * MAX + (x + ox)) * 4;
      out[di] = img.data[si];
      out[di + 1] = img.data[si + 1];
      out[di + 2] = img.data[si + 2];
      out[di + 3] = img.data[si + 3];
    }
  }
  return { data: out, width: MAX, height: MAX };
};

const imageToSticker = async (buffer) => {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  let image;
  if (isJpeg(buffer)) {
    const m = await initJpeg();
    image = contain512(await m.default(toArrayBuffer(buffer)));
  } else if (isPng(buffer)) {
    const m = await initPng();
    image = contain512(await m.decode(toArrayBuffer(buffer)));
  } else {
    throw new Error('Formato no soportado (solo JPEG o PNG)');
  }
  const webp = await initWebp();
  let out;
  try {
    out = Buffer.from(await webp.default(image, { quality: 75 }));
  } catch (e) {
    out = Buffer.from(await webp.default(image));
  }
  if (out.length > 1024 * 1024) {
    out = Buffer.from(await webp.default(image, { quality: 40 }));
  }
  return out;
};

module.exports = { imageToSticker };
