// The desk, properly: how you call it up and what it can host.
//   node Video/capture3.mjs [--probe]
//
//   desk_a          — the floor; right Ⓐ; the desk rises in front of you
//   desk_rave       — RAVE tab, the record list flies out, DISCO BALL picked
//   desk_rave_host  — HOST: the ball drops wearing ♪ DISCO BALL
//   desk_raid       — FIGHT · TITAN RAID, the tier list, BLAZING, HARDCORE
//   desk_raid_host  — HOST: the ball drops wearing ⚔ TITAN RAID · HARDCORE
//   desk_raid_deal  — START: the pit, hardcore, blazing
//
// --probe takes stills at each beat instead of recording.
import { launch, newPage, cam, flyCam, camHome, recorder, tap, here, sleep } from './lib.mjs';
import { headSway, swayOff, venue, crowd } from './scenes.mjs';
import { join } from 'node:path';

const probe = process.argv.includes('--probe');
const log = (...a) => console.log('[cap3]', ...a);
const UNLOCKED = JSON.stringify({ cleared: [true, true, true, true, true], hardcoreUnlocked: true, raidCleared: true, goopliathCleared: true, hardUnlocked: true, blazingUnlocked: true });

async function clip(rec, page, name, ms, during) {
  if (!probe) await rec.start(name);
  const p = during?.();
  if (probe) {
    await page.waitForTimeout(Math.min(ms, 1600));
    await page.screenshot({ path: join(here, `p3-${name}.png`) });
    await page.waitForTimeout(Math.max(0, ms - 1600));
  } else {
    await page.waitForTimeout(ms);
  }
  await p;
  if (!probe) await rec.stop();
}
/** The solo ball arms a 15 s deal timer (seen firing early): stretch it
 *  around a call, so the ball hangs for as long as the shot needs. */
const stretch = (page, on) => page.evaluate((on) => {
  if (on) {
    const o = window.setTimeout;
    window.__origSetTimeout = o;
    window.setTimeout = function (fn, ms, ...rest) { return o.call(window, fn, ms === 15000 ? 600000 : ms, ...rest); };
  } else if (window.__origSetTimeout) window.setTimeout = window.__origSetTimeout;
}, on);

const browser = await launch();
const page = await newPage(browser, { 'ff-onlybots': '1', 'gdr-server': 'ws://127.0.0.1:1', 'ff-campaign': UNLOCKED });
const rec = await recorder(page);
await venue(page);
await crowd(page);
await page.waitForTimeout(2000);
const desk = (id) => page.evaluate((id) => window.__gdr.menu.press(id), id);
const ballPos = () => page.evaluate(async () => (await import('/src/rave/net/session.ts')).net.ball?.pos ?? null);

/* ── Ⓐ: the desk rises ─────────────────────────────────────────────────── */
await headSway(page, true, 0.6);
await clip(rec, page, 'desk_a', 6000, async () => {
  await sleep(1600);
  await tap(page, 'right', 'a-button', 120);
  await sleep(300);
  await swayOff(page);
  // step back to frame the whole desk
  await flyCam(page, { from: [0, 1.6, 0], to: [0, 1.58, 0.5], look: [0, 1.05, -0.6], seconds: 2.4 });
});
log('desk shown:', await page.evaluate(() => window.__gdr.menu.shown?.()));

/* ── RAVE: pick a record ────────────────────────────────────────────────── */
await desk('tab-rave');
await page.waitForTimeout(300);
await clip(rec, page, 'desk_rave', 8000, async () => {
  await flyCam(page, { from: [0, 1.55, 0.5], to: [-0.12, 1.5, 0.42], look: [-0.2, 1.1, -0.6], seconds: 2.0 });
  await sleep(1400);
  await desk('track'); // the record list flies out
  await sleep(2600);
  await desk('song:discoball');
  await sleep(300);
  await flyCam(page, { from: [-0.12, 1.5, 0.42], to: [0.02, 1.42, 0.1], look: [0, 1.05, -0.6], seconds: 2.4 });
});
await clip(rec, page, 'desk_rave_host', 7000, async () => {
  await sleep(900);
  await stretch(page, true);
  await desk('call');
  await stretch(page, false);
  await sleep(150);
  const p = await ballPos();
  if (p) await flyCam(page, { from: [0.02, 1.42, 0.1], to: [p[0] * 0.3, 1.55, 0.5], look: [0, 1.05, -0.6], lookTo: [p[0], 1.9, p[2]], seconds: 2.4 });
});
log('rave ball:', JSON.stringify(await page.evaluate(async () => { const s = await import('/src/rave/net/session.ts'); return s.net.ball && { mode: s.net.ball.mode, track: s.net.ball.track }; })));
await page.evaluate(() => window.__gdr.club.cancel());
await page.waitForTimeout(1200);

/* ── FIGHT · TITAN RAID: the tier, and HARDCORE ─────────────────────────── */
await desk('tab-fight');
await desk('fight-raid');
await page.waitForTimeout(300);
await clip(rec, page, 'desk_raid', 9500, async () => {
  await flyCam(page, { from: [0.02, 1.42, 0.12], to: [-0.06, 1.42, 0.3], look: [-0.12, 1.05, -0.6], seconds: 2.0 });
  await sleep(1200);
  await desk('raiddiff'); // the tier list flies out
  await sleep(2400);
  await desk('tier:blazing');
  await sleep(1400);
  await desk('raidhc'); // HARDCORE, lit
  await sleep(400);
  await flyCam(page, { from: [-0.06, 1.42, 0.3], to: [0.03, 1.4, 0.08], look: [0, 1.02, -0.6], seconds: 2.0 });
});
await clip(rec, page, 'desk_raid_host', 7000, async () => {
  await sleep(900);
  await stretch(page, true);
  await desk('call');
  await stretch(page, false);
  await sleep(150);
  const p = await ballPos();
  if (p) await flyCam(page, { from: [0.03, 1.4, 0.08], to: [p[0] * 0.3, 1.55, 0.5], look: [0, 1.02, -0.6], lookTo: [p[0], 1.9, p[2]], seconds: 2.4 });
});
log('raid ball:', JSON.stringify(await page.evaluate(async () => { const s = await import('/src/rave/net/session.ts'); return s.net.ball && { mode: s.net.ball.mode, hardcore: s.net.ball.hardcore, diff: s.net.ball.diff }; })));
// the plate, close
const bp = (await ballPos()) ?? [1.6, 1.5, -1];
await clip(rec, page, 'desk_raid_plate', 4500, () =>
  flyCam(page, { orbit: { center: [bp[0], bp[1] - 0.1, bp[2]], r0: 1.7, r1: 1.25, y0: 1.55, a0: 0.2, a1: -0.15 }, seconds: 4.5, ease: 'linear' }),
);
/* ── START: the pit ─────────────────────────────────────────────────────── */
await camHome(page);
await headSway(page, true, 0.6);
await clip(rec, page, 'desk_raid_deal', 14000, async () => {
  await sleep(2000);
  await page.evaluate(() => window.__gdr.club.go());
});
log('after deal:', JSON.stringify(await page.evaluate(async () => { const { app } = await import('/src/menu/appState.ts'); return { place: window.__town?.place, mode: app.mode, campaignMode: app.campaignMode, raidHardcore: app.raidHardcore, difficulty: app.difficulty, titan: window.__ff2?.titan?.phase?.() }; })));
await browser.close();
log('done');
