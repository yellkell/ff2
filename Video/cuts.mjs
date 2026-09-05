// Scene-change times inside a clip (big jumps in mean colour between frames).
//   node Video/cuts.mjs boss0_intro boss1_intro ...
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
for (const name of process.argv.slice(2)) {
  const dir = join(here, 'cap', name);
  const stamps = JSON.parse(readFileSync(join(dir, 'stamps.json'), 'utf8')).stamps;
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', join(dir, 'f%05d.jpg'), '-vf', 'scale=8:8', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  const n = raw.length / 192;
  const out = [];
  for (let i = 1; i < n; i++) {
    let d = 0;
    for (let p = 0; p < 192; p++) d += Math.abs(raw[i * 192 + p] - raw[(i - 1) * 192 + p]);
    d /= 192;
    if (d > 18) out.push(`${stamps[i].toFixed(2)}s (f${i}, Δ${d.toFixed(0)})`);
  }
  console.log(`${name}: ${n} frames / ${stamps.at(-1).toFixed(1)} s — jumps at: ${out.join(', ') || 'none'}`);
}
