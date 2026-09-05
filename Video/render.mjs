// Render an edit: drives the compositor page frame by frame and pipes JPEGs
// into ffmpeg, muxing the mixed audio.
//   node Video/render.mjs
//   node Video/render.mjs --tl ./timeline-vertical.mjs --w 1080 --h 1920 \
//        --mix Video/edit/mix-vertical.wav --out Video/out/short.mp4
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.PREVIEW_BASE ?? 'http://localhost:5174';
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const abs = (p) => (isAbsolute(p) ? p : join(process.cwd(), p));
const FPS = Number(arg('fps', 60));
const from = Number(arg('from', 0));
const tl = arg('tl', './timeline.mjs');
const W = Number(arg('w', 1280));
const H = Number(arg('h', 720));
const outDir = join(here, 'out');
mkdirSync(outDir, { recursive: true });
const out = abs(arg('out', join(outDir, 'trailer.mp4')));
const mix = abs(arg('mix', join(here, 'edit', 'mix.wav')));

const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: Math.min(W, 1400), height: Math.min(H, 1000) } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('[page]', m.text()); });
await page.goto(`${base}/Video/edit/compositor.html?tl=${encodeURIComponent(tl)}&w=${W}&h=${H}`, { waitUntil: 'load' });
// The compositor awaits its timeline import before it defines anything, so
// `load` can fire first: wait for the page to actually be up.
await page.waitForFunction(() => typeof window.renderFrame === 'function' && !!window.__ready, { timeout: 30000 });
await page.evaluate(() => window.__ready);
const DUR = await page.evaluate(async (tl) => (await import(tl)).TL.DUR, tl);
const to = Number(arg('to', DUR));
console.log(`rendering ${tl} ${W}x${H}, ${from}s → ${to}s at ${FPS} fps → ${out}`);

const ffArgs = ['-hide_banner', '-loglevel', 'warning', '-y',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
const hasMix = existsSync(mix);
if (!hasMix) console.log(`(no audio at ${mix} — video only)`);
if (hasMix) ffArgs.push('-ss', String(from), '-i', mix);
ffArgs.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS));
if (hasMix) ffArgs.push('-c:a', 'aac', '-b:a', '224k', '-shortest');
ffArgs.push('-movflags', '+faststart', out);
const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
ff.on('error', (e) => console.log('ffmpeg spawn error', e));

const nFrames = Math.round((to - from) * FPS);
const t0 = Date.now();
for (let i = 0; i < nFrames; i++) {
  const t = from + i / FPS;
  const dataUrl = await page.evaluate((t) => window.renderFrame(t), t);
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  if (!ff.stdin.write(buf)) await new Promise((res) => ff.stdin.once('drain', res));
  if (i % 120 === 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`  frame ${i}/${nFrames}  t=${t.toFixed(2)}  ${(i / Math.max(el, 0.01)).toFixed(1)} fps render`);
  }
}
ff.stdin.end();
await new Promise((res) => ff.on('close', res));
await browser.close();
console.log('done →', out);
