#!/usr/bin/env node
/**
 * THE WRAP, headless.
 *
 *   npm run dev              # terminal 1
 *   node tools/wrap-check.mjs [--shots]
 *
 * Boots the game in headless Chromium (the IWSDK dev plugin's IWER
 * emulator provides WebXR), enters the arena, and asks the wrap's dev hook
 * (window.__ff2.wrap) what each panel is offering — then walks the BATTLE
 * wing's faces (private → keypad → back) through the same dispatcher the
 * trigger uses. --shots also saves each panel's canvas as a PNG beside
 * this script, for eyeballing the design without a headset.
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const shots = process.argv.includes('--shots');
const here = dirname(fileURLToPath(import.meta.url));

async function launch() {
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--ignore-certificate-errors'];
  try {
    return await chromium.launch({ args });
  } catch {
    return chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args });
  }
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log(`[pageerror] ${e.message}`);
});

await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => page.goto(base));
await page.waitForTimeout(1200);
await page.click('#enter-vr');
await page.waitForFunction(() => document.body.classList.contains('app-entered'), { timeout: 20000 });
await page.waitForTimeout(2200);

const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const hook = await page.evaluate(() => !!window.__ff2?.wrap);
check('the wrap dev hook is up', hook);
if (!hook) {
  await browser.close();
  process.exit(1);
}

const wrap = (expr) => page.evaluate(`window.__ff2.wrap.${expr}`);

console.log('\n=== the three panels, fresh ===');
const train = await wrap(`buttons('train')`);
check('ARCADE offers the arcade', train.includes('start-tutorial') && train.includes('open-campaign') && train.includes('open-raid') && train.includes('start-training'), train.join(','));
const duel = await wrap(`buttons('duel')`);
check('BATTLE offers the fights', duel.includes('ranked-match') && duel.includes('private-open') && duel.includes('arcade-2v2') && duel.includes('arcade-ffa'), duel.join(','));
const info = await wrap(`buttons('info')`);
check('the house offers club + locker + shop', info.includes('open-pub') && info.includes('open-custom') && info.includes('open-shop'), info.join(','));

console.log('\n=== pre-tutorial seal ===');
const liveTrain = await wrap(`live('train')`);
const tutorialDone = await page.evaluate(() => localStorage.getItem('ff-tutorial-done') === '1');
if (!tutorialDone) {
  check('only the tutorial answers on a fresh save', liveTrain.length === 1 && liveTrain[0] === 'start-tutorial', liveTrain.join(','));
} else {
  check('a finished save unseals the arcade', liveTrain.length > 1, liveTrain.join(','));
}

console.log('\n=== walking the BATTLE faces ===');
await wrap(`act('private-open')`);
await page.waitForTimeout(300);
let face = await wrap(`buttons('duel')`);
check('PRIVATE face: format chips + create + enter', face.includes('private-mode-1v1') && face.includes('private-create') && face.includes('private-enter'), face.join(','));
await wrap(`act('private-enter')`);
await page.waitForTimeout(300);
face = await wrap(`buttons('duel')`);
check('keypad face: digits + join', face.includes('kp-5') && face.includes('kp-join') && face.includes('kp-del'), face.join(','));
await wrap(`act('private-back')`);
await page.waitForTimeout(300);
face = await wrap(`buttons('duel')`);
check('BACK lands on the mode list', face.includes('quick-match') || face.includes('cancel-queue'), face.join(','));

if (shots) {
  console.log('\n=== saving canvases ===');
  for (const id of ['train', 'duel', 'info']) {
    const data = await wrap(`snap('${id}')`);
    const file = join(here, `wrap-${id}.png`);
    writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`  wrote ${file}`);
  }
}

check('no page errors along the way', errors.length === 0, errors.join(' | '));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad === 0 ? 'ALL PASS' : `${bad} FAILURE(S)`}`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
