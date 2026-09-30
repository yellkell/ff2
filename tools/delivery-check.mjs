#!/usr/bin/env node
/**
 * THE DELIVERY, headless — the titan throws the hit.
 *
 *   npm run dev              # terminal 1
 *   node tools/delivery-check.mjs [--shots]
 *
 * Launches RUSTHOOK, holds its own picks, and FORCES each floor attack
 * through the real buildAttack path, then watches the attack play out:
 *
 *   - a bolt is thrown for every kind that has one, and it LEAVES A FIST
 *     (its launch point is a gauntlet, not the deck);
 *   - every thrown impact point BURNS under its zone's own law — a throw
 *     may confirm the read, never land on safe ground;
 *   - the chassis STEPS IN behind the throw (the lunge), sweeps included;
 *   - the bolts are gone once the attack resolves;
 *   - (--shots) a screenshot mid-flight for each kind.
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

await page.addInitScript(() => {
  localStorage.setItem('ff-tutorial-done', '1');
});
await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => page.goto(base));
await page.waitForTimeout(1000);
await page.click('#enter-vr');
await page.waitForFunction(() => document.body.classList.contains('app-entered'), { timeout: 20000 });
await page.waitForFunction(() => !!window.__ff2?.wrap, { timeout: 10000 });

console.log('=== the bout: RUSTHOOK, every floor attack thrown ===');
await page.evaluate(() => window.__ff2.wrap.act('campaign-0'));
const fighting = await page
  .waitForFunction(() => window.__ff2.titan?.phase() === 'fight', { timeout: 40000 })
  .then(() => true, () => false);
check('stage I launches into a fight', fighting);
if (!fighting) {
  await browser.close();
  process.exit(1);
}
await page.evaluate(() => window.__ff2.titan.hold(true));

// kind → does it throw a bolt? (the sweep's blow is its scythe, not a bolt)
const KINDS = {
  seesaw: true,
  surge: true,
  nova: true,
  lanes: true,
  gate: true,
  donut: true,
  cross: true,
  sweep: false,
};

// A GPU-less runner renders a frame every few seconds, so the titan's clock
// is frozen and stepped from inside the page at a fixed 60 Hz: each kind is
// one deterministic run, watched every frame.
await page.evaluate(() => window.__ff2.titan.freeze(true));

/** Step until `stop` (in-page) or the attack ends; fold stats as we go. */
const run = (stopAtFirstBolt) =>
  page.evaluate((stopAtFirstBolt) => {
    const T = window.__ff2.titan;
    const out = { sawBolt: false, firstFromFist: Infinity, maxLunge: 0, impactsBurn: null, done: false, peakBolts: 0 };
    // The fists as they stood going INTO each frame — a throw samples the
    // gauntlet before that frame's swing moves it.
    let fists = T.delivery().fists;
    for (let f = 0; f < 900; f++) {
      if (!T.kind()) {
        out.done = true;
        break;
      }
      T.step(1 / 60);
      const d = T.delivery();
      if (out.impactsBurn === null && d.impactsBurn.length) out.impactsBurn = d.impactsBurn;
      out.maxLunge = Math.max(out.maxLunge, d.lunge);
      out.peakBolts = Math.max(out.peakBolts, d.bolts.length);
      if (d.origins.length && !out.sawBolt) {
        out.sawBolt = true;
        for (const o of d.origins) {
          for (const fi of fists) {
            out.firstFromFist = Math.min(out.firstFromFist, Math.hypot(o[0] - fi[0], o[1] - fi[1], o[2] - fi[2]));
          }
        }
        if (stopAtFirstBolt) break;
      }
      fists = d.fists;
    }
    return out;
  }, stopAtFirstBolt);

for (const [kind, throws] of Object.entries(KINDS)) {
  await page.evaluate(() => window.__ff2.titan.heal());
  // Clear whatever is still live before forcing the next.
  await page.evaluate(() => {
    for (let f = 0; f < 900 && window.__ff2.titan.kind(); f++) window.__ff2.titan.step(1 / 60);
  });
  const forced = await page.evaluate((k) => window.__ff2.titan.force(k, 7), kind);
  if (!forced) {
    check(`${kind}: forced`, false, 'titan not fighting');
    continue;
  }
  const a = await run(shots);
  if (shots && a.sawBolt) {
    // Let the bolt get a third of the way out, then look.
    await page.evaluate(() => window.__ff2.titan.step(1 / 60, 7));
    await page.waitForTimeout(2500); // one real frame to draw it
    const file = join(here, `delivery-${kind}.png`);
    writeFileSync(file, await page.screenshot());
    console.log(`  wrote ${file}`);
  }
  const b = a.done ? a : await run(false);
  const sawBolt = a.sawBolt || b.sawBolt;
  const firstFromFist = a.sawBolt ? a.firstFromFist : b.firstFromFist;
  const impactsBurn = a.impactsBurn ?? b.impactsBurn;
  const maxLunge = Math.max(a.maxLunge, b.maxLunge);
  const after = await page.evaluate(() => window.__ff2.titan.delivery());
  if (throws) {
    check(`${kind}: a bolt is thrown`, sawBolt, `peak ${Math.max(a.peakBolts, b.peakBolts)} in flight`);
    check(`${kind}: it leaves a fist`, firstFromFist < 0.05, `launched ${firstFromFist.toFixed(3)} m from a gauntlet`);
    check(
      `${kind}: every impact lands in the danger`,
      !!impactsBurn && impactsBurn.length > 0 && impactsBurn.every(Boolean),
      JSON.stringify(impactsBurn),
    );
  } else {
    check(`${kind}: no bolt (the blow is the arm)`, !sawBolt);
  }
  check(`${kind}: the chassis steps in`, maxLunge > 0.3, `peak lunge ${maxLunge.toFixed(2)}`);
  check(`${kind}: the attack resolves, nothing left in flight`, (a.done || b.done) && after.bolts.length === 0, `${after.bolts.length} bolts`);
}

check('no page errors along the way', errors.length === 0, errors.join(' | '));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad === 0 ? 'ALL PASS' : `${bad} FAILURE(S)`}`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
