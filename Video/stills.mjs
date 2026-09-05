// Render single frames of an edit for eyeballing.
//   node Video/stills.mjs 2.9 5.0 13.9
//   node Video/stills.mjs --tl ./timeline-vertical.mjs --w 1080 --h 1920 --tag v 1.0 5.0
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.env.PREVIEW_BASE ?? 'http://localhost:5174';
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const tl = arg('tl', './timeline.mjs');
const W = Number(arg('w', 1280));
const H = Number(arg('h', 720));
const tag = arg('tag', '');
const out = join(here, 'stills');
mkdirSync(out, { recursive: true });
const times = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--'))).map(Number).filter((n) => !Number.isNaN(n));

const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: Math.min(W, 1400), height: Math.min(H, 1000) } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() !== 'log') console.log('[page]', m.text()); });
await page.goto(`${base}/Video/edit/compositor.html?tl=${encodeURIComponent(tl)}&w=${W}&h=${H}`, { waitUntil: 'load' });
// The compositor awaits its timeline import before it defines anything, so
// `load` can fire first: wait for the page to actually be up.
await page.waitForFunction(() => typeof window.renderFrame === 'function' && !!window.__ready, { timeout: 30000 });
await page.evaluate(() => window.__ready);
for (const t of times) {
  const d = await page.evaluate((t) => window.renderFrame(t), t);
  const f = join(out, `${tag}t${t.toFixed(2).replace('.', '_')}.jpg`);
  writeFileSync(f, Buffer.from(d.slice(d.indexOf(',') + 1), 'base64'));
  console.log('wrote', f);
}
await browser.close();
