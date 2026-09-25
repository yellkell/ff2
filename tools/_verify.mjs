import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
await page.addInitScript(() => { try { localStorage.setItem('ff-tutorial-done', '1'); localStorage.setItem('ff-coins', '500'); } catch {} });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForFunction(() => true, undefined, { timeout: 60000 });
await page.waitForTimeout(1200); await page.click('#enter-vr', { timeout: 60000 });
await page.waitForFunction(() => document.body.classList.contains('app-entered'), { timeout: 60000 });
await page.waitForTimeout(2500);
for (const slot of ['head', 'body', 'hands']) {
  for (const a of ['open-shop', 'tab-gear', `gear-${slot}`]) await page.evaluate((x) => window.__ff2.wrap.act(x), a);
  await page.waitForTimeout(400);
  const d = await page.evaluate(() => window.__ff2.modals.snap('shop'));
  writeFileSync(`${out}/shelf-${slot}.png`, Buffer.from(d.split(',')[1], 'base64'));
}
await page.evaluate(() => window.__ff2.wrap.act('custom-close'));
let bad = 0;
for (const [gear, part] of [['vcrest', 'gearHead'], ['earfins', 'gearHead'], ['wristblades', 'gearHands']]) {
  await page.evaluate((g) => window.__ff2.gear.equip(g), gear);
  await page.evaluate(() => window.__ff2.wrap.act('open-paintbay'));
  await page.waitForTimeout(600);
  const off = await page.evaluate((p) => window.__ff2.bayAim?.(p, 1.0) ?? null, part);
  const dead = await page.evaluate((p) => window.__ff2.bayAim?.(p, 0) ?? null, part);
  const ok = (off ?? '').startsWith(part) && (dead ?? '').startsWith(part);
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  magnet ${gear}: off → ${off}, dead on → ${dead}`);
  await page.evaluate(() => window.__ff2.wrap.act('paintbay-close'));
  await page.waitForTimeout(300);
}
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors', bad ? `${bad} FAIL` : 'magnet ALL PASS');
await browser.close();
