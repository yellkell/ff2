// Find hit flashes (red washes) and bright events in a clip by mean colour per frame.
//   node Video/flashes.mjs bout raid_fp
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
for (const name of process.argv.slice(2)) {
  const dir = join(here, 'cap', name);
  const stamps = JSON.parse(readFileSync(join(dir, 'stamps.json'), 'utf8')).stamps;
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', join(dir, 'f%05d.jpg'), '-vf', 'scale=4:4', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  const n = raw.length / 48;
  const rows = [];
  for (let i = 0; i < n; i++) {
    let r = 0, g = 0, b = 0;
    for (let p = 0; p < 16; p++) { r += raw[i * 48 + p * 3]; g += raw[i * 48 + p * 3 + 1]; b += raw[i * 48 + p * 3 + 2]; }
    rows.push({ i, t: stamps[i] ?? 0, r: r / 16, g: g / 16, b: b / 16, lum: (r + g + b) / 48 });
  }
  const base = rows.map((x) => x.r - (x.g + x.b) / 2).sort((a, b) => a - b)[Math.floor(n / 2)];
  const out = [];
  let last = -10;
  for (const x of rows) {
    const red = x.r - (x.g + x.b) / 2;
    if (red > base + 45 && x.t - last > 0.6) { out.push(`RED ${x.t.toFixed(2)} (+${(red - base).toFixed(0)})`); last = x.t; }
  }
  const lumBase = rows.map((x) => x.lum).sort((a, b) => a - b)[Math.floor(n / 2)];
  let lastB = -10;
  for (const x of rows) {
    if (x.lum > lumBase + 60 && x.t - lastB > 0.6) { out.push(`BRIGHT ${x.t.toFixed(2)} (+${(x.lum - lumBase).toFixed(0)})`); lastB = x.t; }
  }
  console.log(name, `${n} frames, ${stamps.at(-1).toFixed(1)} s, redBase ${base.toFixed(0)} lumBase ${lumBase.toFixed(0)}`);
  console.log('  ' + out.join('\n  '));
}
