#!/usr/bin/env node
/**
 * THE MOVE GRAMMAR, headless — RAVE RAID's vocabulary in a titan bout.
 *
 *   npm run dev              # terminal 1
 *   node tools/grammar-check.mjs [--shots]
 *
 * Two stages:
 *
 *   1. THE GRAMMAR (pure, via __ff2.grammar): seeded determinism, deck
 *      bounds, the shapes' own laws (routine corners never repeat, every
 *      wave turns, the trap's jaws oppose, twins alternate), the verb law
 *      (never the same move twice), THE FLOOR MANAGER's evict test, and
 *      the judge (gaps safe, rims deadly, corners must be committed).
 *
 *   2. THE BOUT (live, via __ff2.titan): launch RUSTHOOK — the scrapyard
 *      titan that learned the gate — and FORCE each grammar move through
 *      the real buildAttack path, asserting the zones that land and
 *      (--shots) saving a screenshot of each telegraph on the deck.
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

const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// Tutorial done — stage I (RUSTHOOK) is open from a fresh save.
await page.addInitScript(() => {
  localStorage.setItem('ff-tutorial-done', '1');
});
await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => page.goto(base));
await page.waitForTimeout(1000);
await page.click('#enter-vr');
await page.waitForFunction(() => document.body.classList.contains('app-entered'), { timeout: 20000 });
await page.waitForFunction(() => !!window.__ff2?.grammar, { timeout: 10000 });

console.log('=== the grammar: seeded, lawful, judged ===');
const g = await page.evaluate(() => {
  const G = window.__ff2.grammar;
  const out = { fails: [] };
  const fail = (m) => out.fails.push(m);

  // Determinism: the same seed builds the identical move, byte for byte.
  for (const kind of G.kinds) {
    if (JSON.stringify(G.build(kind, 42)) !== JSON.stringify(G.build(kind, 42))) fail(`${kind}: not deterministic`);
  }
  // Deck bounds, thirty seeds a kind, at the hardest act.
  for (const kind of G.kinds) {
    for (let s = 1; s <= 30; s++) {
      const landings = G.build(kind, s, { act: 4, expert: true, sweptRoutine: true });
      if (!landings.length) fail(`${kind}#${s}: empty move`);
      for (const l of landings) if (!G.onDeck(l.zone)) fail(`${kind}#${s}: zone off deck ${JSON.stringify(l.zone)}`);
    }
  }
  // THE ROUTINE never repeats a corner, and act 4 asks for four.
  {
    const landings = G.build('routine', 7, { act: 4 });
    const quads = landings.filter((l) => l.zone.kind === 'quad');
    const corners = quads.map((l) => l.zone.corner);
    if (new Set(corners).size !== corners.length) fail('routine repeats a corner');
    if (corners.length !== 4) fail(`act-4 routine wants 4 corners, got ${corners.length}`);
  }
  // EVERY wave turns: at least six strikes, marching in time.
  {
    const landings = G.build('wave', 3, { act: 3 });
    if (landings.length < 6) fail(`wave doesn't turn (${landings.length} strikes)`);
    for (let i = 1; i < landings.length; i++) {
      if (landings[i].delay <= landings[i - 1].delay) fail('wave march out of order');
    }
  }
  // THE TRAP's jaws land together on opposite sides; hunt a seed that rolls it.
  {
    let found = false;
    for (let s = 1; s <= 60 && !found; s++) {
      const rails = G.build('cross', s, { act: 3 }).filter((l) => l.zone.kind === 'rail');
      if (rails.length === 2 && rails[0].delay === rails[1].delay && rails[0].zone.z * rails[1].zone.z < 0) found = true;
    }
    if (!found) fail('no trap in 60 seeds at act 3');
  }
  // The twin BOUNCE alternates sides, a fixed gap apart (act 3 = a promise).
  {
    let checked = false;
    for (let s = 1; s <= 80 && !checked; s++) {
      const lanes = G.build('lanes', s, { act: 3 }).filter((l) => l.zone.kind === 'lane' && !l.zone.yaw);
      const delays = [...new Set(lanes.map((l) => l.delay))].sort((a, b) => a - b);
      if (lanes.length === 6 && delays.length === 3) {
        checked = true;
        const sideAt = (d) => Math.sign(lanes.find((l) => l.delay === d).zone.x);
        if (sideAt(delays[0]) === sideAt(delays[1]) || sideAt(delays[1]) === sideAt(delays[2])) fail('twin bounce fails to alternate');
        if (Math.abs(delays[1] - delays[0] - 2.0) > 1e-6) fail(`twin return gap ${delays[1] - delays[0]} ≠ 2.0s at beat 0.5`);
      }
    }
    if (!checked) fail('no 3-volley twin rally in 80 seeds at act 3');
  }
  // The donut's one-two: the ring closes AFTER the opening laser.
  {
    let found = false;
    for (let s = 1; s <= 40 && !found; s++) {
      const landings = G.build('donut', s, { act: 2 });
      const lane = landings.find((l) => l.zone.kind === 'lane');
      const ring = landings.find((l) => l.zone.kind === 'ring');
      if (lane && ring) {
        found = true;
        if (ring.delay <= lane.delay) fail('donut ring lands before its opening laser');
      }
    }
    if (!found) fail('no opened donut in 40 seeds');
  }
  // The VERB law: three hundred sequential picks, never the same move twice.
  {
    const entries = G.kinds.map((k) => [k, 2]);
    let last = null;
    for (let i = 0; i < 300; i++) {
      const k = G.pick(1000 + i, entries, last);
      if (k === last) fail(`pick repeated ${k} at ${i}`);
      last = k;
    }
  }
  // THE FLOOR MANAGER: a gate whose gap sits ON the park asks for nothing.
  {
    const gate = [{ delay: 0, zone: { kind: 'gate', at: 0.4, half: 0.3, axis: 0 } }];
    if (G.evicts(gate, { x: 0.4, z: 0 })) fail('gate over the park should not evict');
    if (!G.evicts(gate, { x: -0.4, z: 0 })) fail('gate away from the park must evict');
  }
  // The judge: gaps live, rims kill, corners demand commitment.
  {
    const gate = { kind: 'gate', at: 0.4, half: 0.3, axis: 0 };
    if (G.hit(gate, 0.4, 0)) fail('judge: standing in the gate gap must be safe');
    if (!G.hit(gate, -0.5, 0)) fail('judge: outside the gate gap must burn');
    const ring = { kind: 'ring', innerR: 0.42 };
    if (G.hit(ring, 0, 0)) fail('judge: donut centre must be safe');
    if (!G.hit(ring, 0.7, 0)) fail('judge: donut rim must burn');
    const quad = { kind: 'quad', corner: 3, step: 0, routine: [3] };
    if (G.hit(quad, 0.4, 0.4)) fail('judge: the taught corner must be safe');
    if (!G.hit(quad, 0, 0, 0)) fail('judge: loitering at centre must burn');
    const armX = { kind: 'lane', x: 0, halfW: 0.14, yaw: Math.PI / 4 };
    const armY = { kind: 'lane', x: 0, halfW: 0.14, yaw: -Math.PI / 4 };
    if (G.hit(armX, 0.55, 0, 0.1) && G.hit(armY, 0.55, 0, 0.1)) fail('judge: the X pocket must clear one arm');
    if (!G.hit(armX, 0, 0)) fail('judge: the X knot must burn');
    // The park chain: the donut hauls you to centre, the routine to a corner.
    const donutPark = G.park('donut', [{ delay: 0, zone: ring }], { x: 0.5, z: 0.3 });
    if (donutPark.x !== 0 || donutPark.z !== 0) fail('donut must park at centre');
  }
  return out;
});
check('the grammar obeys its laws', g.fails.length === 0, g.fails.slice(0, 4).join(' | '));

console.log('\n=== the bout: RUSTHOOK, forced through the vocabulary ===');
const act = (id) => page.evaluate((a) => window.__ff2.wrap.act(a), id);
await act('campaign-0');
// The titan hook installs at bout start (the wrap owns __ff2 in the lobby).
const fighting = await page
  .waitForFunction(() => window.__ff2.titan?.phase() === 'fight', { timeout: 40000 })
  .then(() => true, () => false);
const bossName = await page.evaluate(() => window.__ff2.titan.boss());
check('stage I launches into a fight', fighting, `phase wait; boss=${bossName}`);
check('RUSTHOOK takes the pit, grammar learned', bossName === 'RUSTHOOK', bossName);
const learned = await page.evaluate(() => window.__ff2.titan.moves());
check('the scrapyard knows the gate', learned.includes('gate') && learned.includes('lanes'), learned.join(','));

const EXPECT = {
  gate: ['gate'],
  lanes: ['lane'],
  donut: ['ring'],
  cross: ['rail'],
  wave: ['lane', 'rail'],
  routine: ['quad'],
  duckdonut: ['sweep', 'ring'],
};
for (const [kind, wants] of Object.entries(EXPECT)) {
  await page.evaluate(() => window.__ff2.titan.heal());
  const forced = await page.evaluate((k) => window.__ff2.titan.force(k, 11), kind);
  const zones = await page.evaluate(() => window.__ff2.titan.zones());
  const ok = forced && zones.length > 0 && wants.some((w) => zones.includes(w));
  check(`${kind}: builds and marks the deck`, ok, zones.join(','));
  if (shots) {
    await page.waitForTimeout(1100); // mid-charge — the telegraph is lit
    const file = join(here, `grammar-${kind}.png`);
    writeFileSync(file, await page.screenshot());
    console.log(`  wrote ${file}`);
  }
  await page.waitForTimeout(shots ? 400 : 250);
}

check('no page errors along the way', errors.length === 0, errors.join(' | '));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad === 0 ? 'ALL PASS' : `${bad} FAILURE(S)`}`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
