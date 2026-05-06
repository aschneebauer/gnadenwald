/**
 * Optimiert alle Bilder in ./images rekursiv:
 * - Skaliert auf max. 1920 px Breite (Aspect Ratio bleibt erhalten, kein Aufblasen)
 * - Korrigiert EXIF-Orientation (Smartphone-Fotos!)
 * - JPEG (mozjpeg, progressiv, q=82) bzw. PNG (compressionLevel 9, q=85)
 * - Endungen bleiben unverändert (HTML-Pfade brechen sonst)
 * - Schreibt Ergebnis nur, wenn kleiner als das Original
 *
 * Originale liegen als Backup in ./images_original.
 */
const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(__dirname, 'images');
const MAX_WIDTH = 1920;
const JPEG_QUALITY = 82;
const PNG_QUALITY = 85;

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const isImage = (f) => /\.(jpe?g|png|jfif)$/i.test(f);
const isPng = (f) => /\.png$/i.test(f);

async function optimize(file) {
  const orig = await fs.readFile(file);
  const img = sharp(orig, { failOn: 'none' });
  const meta = await img.metadata();

  let pipeline = img.rotate();
  if (meta.width && meta.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }

  const outBuf = isPng(file)
    ? await pipeline.png({ quality: PNG_QUALITY, compressionLevel: 9 }).toBuffer()
    : await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true }).toBuffer();

  if (outBuf.length < orig.length) {
    await fs.writeFile(file, outBuf);
    return { origSize: orig.length, optSize: outBuf.length, written: true };
  }
  return { origSize: orig.length, optSize: orig.length, written: false };
}

(async () => {
  const files = [];
  for await (const f of walk(ROOT)) if (isImage(f)) files.push(f);

  console.log(`Gefundene Bilder: ${files.length}\n`);

  let totalOrig = 0;
  let totalOpt = 0;
  let written = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const rel = path.relative(ROOT, f);
    try {
      const r = await optimize(f);
      totalOrig += r.origSize;
      totalOpt += r.optSize;
      if (r.written) written++;
      const pct = ((1 - r.optSize / r.origSize) * 100).toFixed(0);
      const o = (r.origSize / 1024 / 1024).toFixed(2);
      const n = (r.optSize / 1024 / 1024).toFixed(2);
      const tag = r.written ? `-${pct}%` : 'skipped';
      console.log(`[${i + 1}/${files.length}] ${rel}  ${o}MB → ${n}MB  (${tag})`);
    } catch (e) {
      console.error(`[${i + 1}/${files.length}] FAIL ${rel}: ${e.message}`);
    }
  }

  const totalPct = ((1 - totalOpt / totalOrig) * 100).toFixed(0);
  console.log(`\n──────────────────────────────`);
  console.log(`Optimiert: ${written}/${files.length}`);
  console.log(`Gesamt: ${(totalOrig / 1024 / 1024).toFixed(1)} MB → ${(totalOpt / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Ersparnis: ${totalPct}%`);
})();
