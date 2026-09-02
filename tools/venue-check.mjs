#!/usr/bin/env node
/**
 * THE TOWN, headless: one page, three places, a curtain between them.
 *
 *   npm run dev                 # terminal 1
 *   node tools/venue-check.mjs [--shots]
 *
 * Boots index.html in headless Chromium (IWER provides WebXR), enters the
 * arena, and walks through the doors: CLUB onto the venue's floor (the room
 * of one when no relay answers), THE STEP into the course and back, the
 * rave's FIRE FIGHT door home, then ARCADE → RAVE RAID's foyer and home
 * again — asserting at every stop that the XR session was never ended, the
 * outgoing place is hidden and paused, the incoming one is up, and no page
 * errors fell out. --shots saves each place beside this script.
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
await page.addInitScript(() => {
  localStorage.setItem('ff-tutorial-done', '1');
  localStorage.setItem('ff-player-name', 'PROBE-ONE');
  // No relay on this machine: the floor must open as a room of one, fast.
  localStorage.setItem('gdr-server', 'ws://127.0.0.1:1');
});

await page.goto(base, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => page.goto(base));
await page.waitForTimeout(1200);
await page.click('#enter-vr');
await page.waitForFunction(() => document.body.classList.contains('app-entered'), { timeout: 30000 });
await page.waitForTimeout(2500);

const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const shot = async (name) => {
  if (!shots) return;
  const file = join(here, `venue-${name}.png`);
  await page.screenshot({ path: file });
  console.log(`  wrote ${file}`);
};
const town = () => page.evaluate(() => ({ place: window.__town?.place, busy: window.__town?.busy }));
const settle = () => page.waitForFunction(() => window.__town && !window.__town.busy, { timeout: 30000 });
const inSession = () => page.evaluate(() => document.body.classList.contains('app-entered'));
const sceneRead = () =>
  page.evaluate(() => {
    const scene = window.__gdr?.scene?.();
    const byName = (n) => {
      const o = scene?.getObjectByName(n);
      if (!o) return null;
      let vis = true;
      for (let p = o; p; p = p.parent) if (!p.visible) vis = false;
      return vis;
    };
    return {
      club: byName('the-club'),
      arena: byName('arena-root') ?? byName('desert') ?? byName('arena'),
      curtain: byName('town-curtain'),
      course: byName('the-course'),
    };
  });

const hook = await page.evaluate(() => !!window.__ff2?.wrap && !!window.__town);
check('the arena and the town are up', hook, JSON.stringify(await town()));
if (!hook) {
  await browser.close();
  process.exit(1);
}
console.log('\n=== CLUB: the venue\'s floor, in-session ===');
const t0first = Date.now();
await page.evaluate(() => window.__town.enterVenue());
await settle();
const firstMs = Date.now() - t0first;
let t = await town();
check('the curtain lifts on the VENUE', t.place === 'venue' && !t.busy, `${JSON.stringify(t)} in ${firstMs} ms (first visit builds the rave)`);
check('the XR session never ended', await inSession(), 'app-entered still set');
const raveHook = await page.evaluate(() => !!window.__gdr);
check('the rave dev hook is installed by the mount', raveHook);
// The floor: a room of one, since no relay answers here.
const floor = await page.waitForFunction(
  () => window.__gdr?.net?.state && (window.__gdr.net.state.solo || window.__gdr.net.state.phase === 'joined' || window.__gdr.net.state.phase === 'hosting'),
  { timeout: 8000 },
).then(() => true).catch(() => false);
const netState = await page.evaluate(() => ({ solo: window.__gdr.net.state.solo, phase: window.__gdr.net.state.phase, screen: window.__gdr.match.screen, myIdx: window.__gdr.net.state.myIdx }));
check('the floor opens as a ROOM OF ONE when no relay answers', floor && netState.solo && netState.screen === 'lobby' && netState.myIdx === 0, JSON.stringify(netState));
await page.waitForTimeout(800);
let read = await sceneRead();
check('the club is standing and the curtain is clear', read.club === true && read.curtain === false, JSON.stringify(read));
const arenaHidden = await page.evaluate(() => {
  const scene = window.__gdr.scene();
  // Anything the arena built (its wrap panels are the easiest tell) must be hidden.
  const wrap = scene.getObjectByName('title-banner') ?? null;
  const podium = scene.getObjectByName('podium-root') ?? null;
  const vis = (o) => {
    if (!o) return null;
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  return { wrap: vis(wrap), podium: vis(podium) };
});
check("the arena's furniture is put away (the sign, the podium)", arenaHidden.wrap === false && arenaHidden.podium === false, JSON.stringify(arenaHidden));
await page.evaluate(() => window.__gdr.rig(0, 0.5, 0));
await page.waitForTimeout(400);
await shot('club');

console.log('\n=== the dumbwaiter serves without a relay ===');
const served = await page
  .waitForFunction(() => window.__gdr.props?.glasses?.().some((g) => g.mode === 'pedestal'), { timeout: 6000 })
  .then(() => true)
  .catch(() => false);
const glasses = await page.evaluate(() => window.__gdr.props?.glasses?.().map((g) => g.mode) ?? []);
check('a coupe rises on the plate', served, glasses.join(','));

console.log('\n=== THE STEP: into the course and back, still in-session ===');
await page.evaluate(() => window.__gdr.course.enter());
const riding = await page.waitForFunction(() => window.__gdr.course.state().active, { timeout: 8000 }).then(() => true).catch(() => false);
await page.waitForTimeout(1200);
let cs = await page.evaluate(() => window.__gdr.course.state());
check('the ride starts on the home pad', riding && cs.active && cs.tracked === 'home', JSON.stringify({ active: cs.active, tracked: cs.tracked, phase: cs.phase }));
read = await sceneRead();
check('the hall packs away behind the void', read.course === true && read.club === false, JSON.stringify(read));
await shot('course');
await page.evaluate(() => window.__gdr.course.leave());
await page.waitForTimeout(900);
cs = await page.evaluate(() => window.__gdr.course.state());
read = await sceneRead();
check('and the hall comes back', !cs.active && read.club === true && read.course === false, JSON.stringify({ active: cs.active, club: read.club }));

console.log('\n=== the rave\'s FIRE FIGHT door: home under the curtain ===');
await page.evaluate(() => window.__gdr.menu.press?.('tab-ff') ?? window.__town.leave());
await settle();
t = await town();
check('back in the ARENA', t.place === 'arena' && !t.busy, JSON.stringify(t));
check('the XR session still never ended', await inSession());
read = await sceneRead();
check('the club is put away, the curtain clear', read.club === false && read.curtain === false, JSON.stringify(read));
const arenaBack = await page.evaluate(() => {
  const scene = window.__gdr.scene();
  const wrap = scene.getObjectByName('title-banner') ?? null;
  const vis = (o) => {
    if (!o) return null;
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  return { wrap: vis(wrap), rig: [window.__gdr ? 1 : 0] };
});
check("the arena's furniture is handed back", arenaBack.wrap === true, JSON.stringify(arenaBack));
const wrapLive = await page.evaluate(() => window.__ff2.wrap.buttons('train').length > 0);
check('the wrap answers again', wrapLive);
await shot('arena-back');

console.log('\n=== ARCADE → RAVE RAID\'s foyer, and home ===');
await page.evaluate(() => window.__town.enterRave());
await settle();
t = await town();
const foyer = await page.evaluate(() => ({ screen: window.__gdr.match.screen, phase: window.__gdr.net.state.phase, solo: window.__gdr.net.state.solo }));
check('the curtain lifts on the RAVE foyer', t.place === 'rave' && foyer.screen === 'tour' && !foyer.solo, JSON.stringify({ ...t, ...foyer }));
const rail = await page.evaluate(() => window.__gdr.menu.boardButtons?.() ?? []);
check('the board offers FIRE FIGHT (the way back)', rail.includes('tab-ff'), rail.filter((b) => b.startsWith('tab-')).join(','));
await shot('rave-foyer');
await page.evaluate(() => window.__town.leave());
await settle();
t = await town();
check('and home again, in-session', t.place === 'arena' && (await inSession()), JSON.stringify(t));

console.log('\n=== a second visit is instant (mounted once, kept) ===');
const t0 = Date.now();
await page.evaluate(() => window.__town.enterVenue());
await settle();
const dt = Date.now() - t0;
t = await town();
// Headless Chromium renders this scene slowly and the fade waits on real
// frames, so the bar is relative: a kept mount must beat the first visit.
check('the venue comes back under the same curtain, faster than it was built', t.place === 'venue' && dt < firstMs, `${dt} ms vs ${firstMs} ms first`);
await page.evaluate(() => window.__town.leave());
await settle();

check('no page errors along the way', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
