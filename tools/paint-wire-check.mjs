#!/usr/bin/env node
/**
 * THE PAINT P3, headless — the room sees you.
 *
 *   npm run dev          # terminal 1
 *   npm run server:pub   # terminal 2
 *   node tools/paint-wire-check.mjs
 *
 * Two stages:
 *
 *   1. THE WIRE (arena page, __ff2.paint): pack/unpack roundtrip is exact
 *      and idempotent under quantization; malformed / tampered / oversized
 *      wire strings fail soft to the bare base tone, never to an error.
 *
 *   2. THE ROOM (two isolated browser contexts on pub.html against the
 *      local pub relay): a painted punter's packed look rides the hello,
 *      arrives in the other client's roster, and is BAKED onto their rig
 *      on join; a mid-visit repaint (the LOOK event) reaches the room; the
 *      server folds it in so the state is queryable afterwards.
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const pubWs = process.env.PUB_WS ?? 'ws://localhost:8788';
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
const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

/* ── stage 1: the wire ──────────────────────────────────────────────────── */

console.log('=== the wire: pack / unpack ===');
{
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => page.goto(base));
  await page.evaluate(() => localStorage.setItem('ff-tutorial-done', '1'));
  await page.waitForTimeout(800);
  await page.click('#enter-vr');
  await page.waitForFunction(() => document.body.classList.contains('app-entered'), { timeout: 20000 });
  await page.waitForFunction(() => !!window.__ff2?.paint, { timeout: 10000 });

  const wire = await page.evaluate(() => {
    const p = window.__ff2.paint;
    p.demo();
    const packed = p.pack();
    const back = p.unpack(packed);
    const again = (() => {
      // pack(unpack(pack)) must be byte-identical: quantization is stable.
      p.set(back);
      return p.pack();
    })();
    const junk = p.unpack('not base64 at all!!').paint.length;
    const empty = p.unpack('').paint.length;
    const long = p.unpack('A'.repeat(5000)).paint.length;
    const numeric = p.unpack(12345).paint.length;
    // Tamper: flip one unit's colour byte to 255 (no such colour) — that
    // unit drops, the rest survive.
    const bin = atob(packed).split('');
    bin[1 + 1] = String.fromCharCode(255); // unit 0, byte 1 = colour
    const tampered = p.unpack(btoa(bin.join(''))).paint.length;
    const res = {
      packedLen: packed.length,
      count: back.paint.length,
      idempotent: again === packed,
      junk, empty, long, numeric, tampered,
      first: back.paint[0],
    };
    p.clear();
    return res;
  });

  check('demo look packs (15 units ≈ 162 b64 chars)', wire.packedLen === Math.ceil((1 + 15 * 8) / 3) * 4, String(wire.packedLen));
  check('roundtrip keeps all 15 units', wire.count === 15, String(wire.count));
  check('pack∘unpack is byte-identical (stable quantization)', wire.idempotent);
  check('junk / empty / numeric wire → bare base tone', wire.junk === 0 && wire.empty === 0 && wire.numeric === 0);
  check('oversized wire string is refused', wire.long === 0);
  check('tampered colour byte drops that unit only', wire.tampered === 14, String(wire.tampered));
  // The new geometry + the gear surface survive the wire as themselves.
  const shapes = await page.evaluate(() => {
    const p = window.__ff2.paint;
    p.demo();
    const back = p.unpack(p.pack()).paint;
    p.clear();
    return back.map((u) => `${u.kind}@${u.part}`).slice(-3);
  });
  check('a dot, a square and a gear-surface unit roundtrip as themselves', shapes.join(',') === 'dot@body,square@body,dot@gearHead', shapes.join(','));
  check('fields survive quantization (body stripe at u≈0.72)', wire.first.kind === 'stripe' && wire.first.part === 'body' && Math.abs(wire.first.u - 0.72) < 0.01, JSON.stringify(wire.first));

  // THE MERGE: chest and pelvis became one body surface, so a look packed
  // before it (wire format 1) must still land on the right half of the
  // fighter rather than vanishing.
  const legacy = await page.evaluate(() => {
    const P = window.__ff2.paint;
    // Hand-build a format-1 look: one chest unit and one pelvis unit, both
    // at v = 0.5 — the chest's belongs above the waist, the pelvis's below.
    const unit = (partIdx, v) => [ (partIdx << 1), 9, 0, 191, Math.round(v * 255), 0, 150, 40 ];
    const bytes = [1, ...unit(1, 0.5), ...unit(2, 0.5)];
    const wire = btoa(String.fromCharCode(...bytes));
    return P.unpack(wire).paint;
  });
  const [oldChest, oldPelvis] = legacy;
  check('a pre-merge look still unpacks (2 units)', legacy.length === 2, JSON.stringify(legacy));
  check('its chest unit lands on the body ABOVE the waist', !!oldChest && oldChest.part === 'body' && oldChest.v > 0.5, JSON.stringify(oldChest));
  check('its pelvis unit lands on the body BELOW the waist', !!oldPelvis && oldPelvis.part === 'body' && oldPelvis.v < 0.4, JSON.stringify(oldPelvis));
  // …and a FORMAT-2 look (the merged body, before gear was paintable):
  // kind in bit 0, part in bits 1+, over head/body.
  const v2 = await page.evaluate(() => {
    const P = window.__ff2.paint;
    const unit = (partIdx, kindBit, v) => [(partIdx << 1) | kindBit, 11, 3, 191, Math.round(v * 255), 0, 120, 60];
    const bytes = [2, ...unit(1, 1, 0.3), ...unit(0, 0, 0.6)];
    return P.unpack(btoa(String.fromCharCode(...bytes))).paint.map((u) => `${u.kind}@${u.part}`);
  });
  check('a format-2 look still reads (splotch on the body, stripe on the head)', v2.join(',') === 'splotch@body,stripe@head', v2.join(','));

  // THE RECORD (P4): the look as words + as the profile-card banner.
  console.log('\n=== the record: colour words + the banner ===');
  const record = await page.evaluate(() => {
    const p = window.__ff2.paint;
    p.demo();
    const packed = p.pack();
    const names = p.names(packed);
    const bannerWhite = p.banner(packed, 'blank');
    const bannerOnyx = p.banner(packed, 'onyx');
    const bare = p.banner('', 'blank');
    p.clear();
    return { names, bannerWhite, bannerOnyx, bare };
  });
  check('the demo look speaks its colours', record.names.length === 3, record.names.join(' · '));
  check('a painted look yields a banner (both tones)', record.bannerWhite.startsWith('data:image/png') && record.bannerOnyx.startsWith('data:image/png'));
  check('an unpainted look yields NO banner (clean card)', record.bare === '');
  for (const [name, url] of [['banner-white', record.bannerWhite], ['banner-onyx', record.bannerOnyx]]) {
    if (url) writeFileSync(join(here, `paint-${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }

  check('no page errors (stage 1)', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ── stage 2: the room ──────────────────────────────────────────────────── */

console.log('\n=== the room: hello → roster → bake-on-join ===');
{
  // Isolated contexts: separate localStorage, so PICASSO carries a painted
  // look and RUBE walks in factory-blank.
  const ctxA = await browser.newContext({ viewport: { width: 700, height: 500 } });
  const ctxB = await browser.newContext({ viewport: { width: 700, height: 500 } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const errors = [];
  pageA.on('pageerror', (e) => errors.push(`A: ${e.message}`));
  pageB.on('pageerror', (e) => errors.push(`B: ${e.message}`));

  // Seed PICASSO's look BEFORE the page loads (pubConnect fires on boot).
  await ctxA.addInitScript(() => {
    const s = (part, u, v, angle, len, wid, colour) => ({ kind: 'stripe', part, u, v, angle, len, wid, colour, variant: 0 });
    localStorage.setItem('ff2-look', JSON.stringify({ paint: [s('chest', 0.75, 0.5, 0.25, 0.6, 0.15, 9), s('head', 0.75, 0.55, 0, 0.4, 0.12, 11)] }));
    // …and PICASSO's gear (avatar/gear.ts): owned + worn, so it rides the hello.
    localStorage.setItem('ff-owned-gear', JSON.stringify(['horns', 'belt']));
    localStorage.setItem('ff-gear', 'horns,belt');
  });

  const pubUrl = (name) => `${base}/pub.html?name=${name}&server=${encodeURIComponent(pubWs)}`;
  await pageA.goto(pubUrl('PICASSO'), { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await pageB.goto(pubUrl('RUBE'), { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});

  const online = async (page) =>
    page.waitForFunction(() => window.__ff2?.club?.online(), { timeout: 15000 }).then(() => true, () => false);
  check('PICASSO reaches the room', await online(pageA));
  check('RUBE reaches the room', await online(pageB));

  // RUBE should see PICASSO with a non-empty look, baked onto the rig.
  const seesPainted = await pageB
    .waitForFunction(() => {
      const row = window.__ff2?.club?.punters().find((p) => p.name === 'PICASSO');
      return !!row && row.lk.length > 0 && row.baked;
    }, { timeout: 15000 })
    .then(() => true, () => false);
  const rosterB = await pageB.evaluate(() => window.__ff2.club.punters());
  check('RUBE sees PICASSO painted + baked on join', seesPainted, JSON.stringify(rosterB));
  const picasso = rosterB.find((p) => p.name === 'PICASSO');
  check("RUBE sees PICASSO's GEAR on the hello (horns + belt)", !!picasso && picasso.gr === 'horns,belt', picasso?.gr ?? '(no row)');

  // …and PICASSO sees RUBE bare but still baked (base tone fill).
  const seesBare = await pageA
    .waitForFunction(() => {
      const row = window.__ff2?.club?.punters().find((p) => p.name === 'RUBE');
      return !!row && row.lk.length === 0 && row.baked;
    }, { timeout: 15000 })
    .then(() => true, () => false);
  check('PICASSO sees RUBE bare (baked base tone)', seesBare);

  // Mid-visit repaint: PICASSO's LOOK event reaches RUBE and rebakes.
  // (Needs PICASSO's frame loop ticking — enter the scene first.)
  const before = rosterB.find((p) => p.name === 'PICASSO')?.lk ?? '';
  await pageA.click('#enter-vr').catch(() => {});
  await pageA.waitForTimeout(1500);
  await pageA.evaluate(() => window.__ff2.club.repaint());
  const repaintSeen = await pageB
    .waitForFunction(
      (prev) => {
        const row = window.__ff2?.club?.punters().find((p) => p.name === 'PICASSO');
        return !!row && row.lk.length > 0 && row.lk !== prev && row.baked;
      },
      before,
      { timeout: 20000 },
    )
    .then(() => true, () => false);
  check('a mid-visit repaint reaches the room (LOOK event)', repaintSeen);

  // Restore PICASSO's stored look for whoever runs this next (probe hygiene).
  await pageA.evaluate(() => window.__ff2.club.bare()).catch(() => {});
  const fatal = errors.filter((e) => !/getUserMedia|AudioContext|NotAllowedError/i.test(e));
  check('no page errors (stage 2)', fatal.length === 0, fatal.join(' | '));
  await ctxA.close();
  await ctxB.close();
}

const bad = results.filter((r) => !r).length;
console.log(`\n${bad === 0 ? 'ALL PASS' : `${bad} FAILURE(S)`}`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
