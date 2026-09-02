#!/usr/bin/env node
/**
 * RAVE RAID inside FIRE FIGHT 2, headless.
 *
 *   npm run dev              # terminal 1
 *   node tools/rave-check.mjs [--shots]
 *
 * Boots rave.html in headless Chromium (IWER provides WebXR), enters, and
 * drives the rave through its dev hook (window.__gdr): the shared identity
 * (the arena's callsign and accent are the dancer's), a solo set on the
 * ring with the blank dancers and the giant blank MC, the podium paying
 * bolt-dollars into the ONE wallet, and the rail's FIRE FIGHT door hopping
 * back to the arena page. --shots saves the ring beside this script.
 */

import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const shots = process.argv.includes('--shots');
const here = dirname(fileURLToPath(import.meta.url));

async function launch() {
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--ignore-certificate-errors', '--autoplay-policy=no-user-gesture-required'];
  try {
    return await chromium.launch({ args });
  } catch {
    return chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args });
  }
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
const errors = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log(`[pageerror] ${e.message}`);
});
// The arena's identity, planted before the page loads: the rave must dance as it.
await page.addInitScript(() => {
  localStorage.setItem('ff-player-name', 'PROBE-ONE');
  localStorage.setItem('ff-accent', '0.5');
  localStorage.setItem('ff-coins', '120');
  localStorage.removeItem('gdr-name');
  localStorage.removeItem('gdr-hue');
});

await page.goto(`${base}/rave.html`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => page.goto(`${base}/rave.html`));
await page.waitForTimeout(1500);
await page.click('#enter-vr');
await page.waitForFunction(() => document.body.classList.contains('app-entered'), { timeout: 30000 });
await page.waitForTimeout(2500);

const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const hook = await page.evaluate(() => !!window.__gdr);
check('the rave dev hook is up', hook);
if (!hook) {
  await browser.close();
  process.exit(1);
}

console.log('\n=== one town: the identity is the arena\'s ===');
const who = await page.evaluate(() => ({ name: window.__gdr.net.state.members, screen: window.__gdr.match.screen }));
const name = await page.evaluate(() => localStorage.getItem('ff-player-name'));
const hue = await page.evaluate(() => window.__gdr.match.players[0]?.hue ?? null);
check('the rave opens on its tour map', who.screen === 'tour', who.screen);
check("the dancer's name is the arena's callsign", name === 'PROBE-ONE', String(name));
const railHasFF = await page.evaluate(() => window.__gdr.menu.boardButtons?.().includes('tab-ff'));
check('the rail offers FIRE FIGHT (the way back)', railHasFF === true, String(railHasFF));

console.log('\n=== a solo set: blank dancers, a blank MC, the one wallet ===');
const coinsBefore = await page.evaluate(() => Number(localStorage.getItem('ff-coins')));
await page.evaluate(() => window.__gdr.startRaid({ seats: 8 }));
const live = await page
  .waitForFunction(() => window.__gdr.match.screen === 'raid', { timeout: 40000 })
  .then(() => true)
  .catch(() => false);
const screen = await page.evaluate(() => window.__gdr.match.screen);
check('the set goes live (count-in → raid)', live, screen);
await page.waitForTimeout(900); // early in the record — before the first landing's flash
const ring = await page.evaluate(() => {
  const scene = window.__gdr.scene();
  let dancers = 0;
  let heads = 0;
  scene?.traverse((o) => {
    if (o.name === 'blank-dancer') dancers++;
    if (o.name === 'opponent-head') heads++;
  });
  const mc = scene?.getObjectByName('the-mc');
  return { dancers, heads, mc: !!mc, mcBlank: !!mc?.getObjectByName('opponent-head'), players: window.__gdr.match.players.length, mine: window.__gdr.match.players[0]?.hue };
});
// Seven groupies wear the blank-dancer root; the MC's root is renamed
// 'the-mc' and counts by his blank head instead.
check('the ring wears the blank: seven groupies + the MC, all mannequins', ring.dancers === 7 && ring.heads >= 8 && ring.mc && ring.mcBlank, JSON.stringify(ring));
check("your own colour is the arena's accent", Math.abs((hue ?? -1) - 0.5) < 0.01 || Math.abs((ring.mine ?? -1) - 0.5) < 0.01, String(ring.mine));
if (shots) {
  const file = join(here, 'rave-ring.png');
  await page.screenshot({ path: file });
  console.log(`  wrote ${file}`);
}
await page.evaluate(() => window.__gdr.endSet());
await page.waitForTimeout(600);
const after = await page.evaluate(() => ({
  screen: window.__gdr.match.screen,
  paid: window.__gdr.match.coinsPaid,
  coins: Number(localStorage.getItem('ff-coins')),
}));
check('the podium pays bolt-dollars into the one wallet', after.screen === 'podium' && after.paid >= 10 && after.coins === coinsBefore + after.paid, JSON.stringify({ coinsBefore, ...after }));
if (shots) {
  const file = join(here, 'rave-podium.png');
  await page.screenshot({ path: file });
  console.log(`  wrote ${file}`);
}

console.log('\n=== the door back ===');
await page.evaluate(() => window.__gdr.toLobby());
await page.waitForTimeout(300);
await page.evaluate(() => window.__gdr.menu.act('tab-ff'));
const backHome = await page
  .waitForFunction(() => /index\.html$|\/$/.test(location.pathname), { timeout: 15000 })
  .then(() => true)
  .catch(() => false);
check('FIRE FIGHT on the rail lands on the arena page', backHome, page.url());

check('no page errors along the way', errors.length === 0, errors.join(' | '));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad === 0 ? 'ALL PASS' : `${bad} FAILURE(S)`}`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
