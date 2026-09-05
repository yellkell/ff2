// Footage capture for the trailer.
//   node Video/capture.mjs intro lobby paint bout boss club rave raid
// Each clip lands in Video/cap/<name>/ as JPEG frames + stamps.json.
import { launch, newPage, enter, cam, flyCam, stopFly, camHome, act, recorder, throwBall, tap, idleHands, sleep } from './lib.mjs';

const want = process.argv.slice(2);
const has = (k) => want.length === 0 || want.includes(k);
const log = (...a) => console.log('[cap]', ...a);

const UNLOCKED = JSON.stringify({ cleared: [true, true, true, true, true], hardcoreUnlocked: true, raidCleared: true, goopliathCleared: true, hardUnlocked: true, blazingUnlocked: true });

// Random painted look + gear from the real paint module (byte-honest wire).
const LOOKGEN = `
  (async () => {
    const P = await import('/src/avatar/paint.ts');
    const C = await import('/src/config.ts');
    const NC = C.PAINT.colourNames.length;
    const gears = ['crest','antennae','horns','halo','mohawk','visorband','pauldrons','chestplate','tail','belt','cuffs','knuckles','gauntlets'];
    window.__mkLook = (seed) => {
      let s = seed * 9301 + 49297;
      const rng = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
      const paint = [];
      const n = 8 + Math.floor(rng() * 9);
      const kinds = ['stripe','stripe','splotch','dot','square','stripe'];
      for (let i = 0; i < n; i++) {
        const kind = kinds[Math.floor(rng() * kinds.length)];
        const part = rng() < 0.7 ? 'body' : 'head';
        paint.push({ kind, part, u: rng(), v: 0.1 + rng() * 0.85, angle: rng(), len: 0.12 + rng() * 0.45, wid: 0.03 + rng() * 0.09, colour: Math.floor(rng() * NC), variant: Math.floor(rng() * 12) });
      }
      const g = [];
      if (rng() < 0.8) g.push(gears[Math.floor(rng() * 6)]);
      if (rng() < 0.7) g.push(gears[6 + Math.floor(rng() * 4)]);
      if (rng() < 0.5) g.push(gears[10 + Math.floor(rng() * 3)]);
      return { lk: P.packLook({ paint }), gr: g.join(','), tn: rng() < 0.5 ? 'onyx' : 'white', hue: rng() };
    };
    return NC;
  })()`;

/** Subtle head life: sway + micro yaw, page-side loop (stops on flyCam). */
async function headSway(page, on = true, amp = 1) {
  await page.evaluate(({ on, amp }) => {
    if (window.__swayStop) window.__swayStop();
    if (!on) return;
    let stop = false;
    window.__swayStop = () => { stop = true; };
    const d = window.IWER_DEVICE;
    const t0 = performance.now();
    const step = () => {
      if (stop) return;
      const t = (performance.now() - t0) / 1000;
      d.position.set(Math.sin(t * 0.7) * 0.04 * amp, 1.6 + Math.sin(t * 1.3) * 0.015 * amp, Math.cos(t * 0.5) * 0.03 * amp);
      const yaw = Math.sin(t * 0.45) * 0.06 * amp;
      const pitch = Math.sin(t * 0.8 + 1) * 0.025 * amp;
      const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
      d.quaternion.set(cy * sp, sy * cp, -sy * sp, cy * cp);
      requestAnimationFrame(step);
    };
    step();
  }, { on, amp });
}
const swayOff = (page) => page.evaluate(() => window.__swayStop?.());

const browser = await launch();

/* ── intro + lobby ─────────────────────────────────────────────────────── */
if (has('intro') || has('lobby')) {
  const page = await newPage(browser, { 'ff-onlybots': '1' });
  const rec = await recorder(page);
  const { base } = await import('./lib.mjs');
  const url = `${base}/`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => page.goto(url));
  await page.waitForTimeout(1000);
  if (has('intro')) await rec.start('intro');
  await page.click('#enter-vr');
  await page.waitForFunction(() => document.body.classList.contains('app-entered'), { timeout: 40000 });
  await page.evaluate(() => { const d = window.IWER_DEVICE; if (d) d.controlMode = 'programmatic'; });
  // hide the emulator's furniture the instant the session is up
  const { hideDevUI } = await import('./lib.mjs');
  await hideDevUI(page);
  await idleHands(page);
  await page.waitForTimeout(6900);
  if (has('intro')) await rec.stop();
  if (has('lobby')) {
    await page.waitForTimeout(400);
    // pan across the three panels
    await rec.start('lobby_pan');
    await flyCam(page, { from: [0, 1.6, 0], to: [0, 1.6, 0], look: [-1.6, 1.45, -1.0], lookTo: [1.6, 1.45, -1.0], seconds: 7 });
    await page.waitForTimeout(7200);
    await rec.stop();
    // slow dolly toward the sign
    await rec.start('lobby_dolly');
    await flyCam(page, { from: [0, 1.6, 0.6], to: [0, 1.7, -0.2], look: [0, 1.8, -3], seconds: 6, ease: 'linear' });
    await page.waitForTimeout(6200);
    await rec.stop();
    // look up at the neon sign
    await rec.start('lobby_sign');
    await flyCam(page, { from: [0, 1.6, 0], to: [0, 1.6, 0], look: [0, 1.5, -1.3], lookTo: [0, 3.2, -3], seconds: 4 });
    await page.waitForTimeout(4300);
    await rec.stop();
    // tabs: arcade + club faces
    await camHome(page);
    await act(page, 'wrap:tab-arcade');
    await rec.start('lobby_arcade');
    await flyCam(page, { from: [0, 1.6, 0.2], to: [0, 1.6, -0.2], look: [0, 1.45, -1.26], seconds: 3, ease: 'linear' });
    await page.waitForTimeout(3200);
    await rec.stop();
  }
  await page.close();
}

/* ── the paint bay ─────────────────────────────────────────────────────── */
if (has('paint')) {
  const page = await newPage(browser, { 'ff-onlybots': '1' });
  const rec = await recorder(page);
  await enter(page);
  await page.waitForTimeout(7000);
  await idleHands(page);
  await act(page, 'open-paintbay');
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__ff2.paint.clear());
  await page.waitForTimeout(300);
  // the blank, in the mirror
  await cam(page, [0.35, 1.5, -0.55], [-0.75, 1.25, -2]);
  await rec.start('paint_blank');
  await flyCam(page, { from: [0.45, 1.5, -0.35], to: [0.1, 1.45, -0.9], look: [-0.75, 1.25, -2], seconds: 4, ease: 'linear' });
  await page.waitForTimeout(4200);
  await rec.stop();
  // stripes go on one by one
  await rec.start('paint_build');
  await flyCam(page, { from: [0.1, 1.45, -0.9], to: [-0.1, 1.4, -1.1], look: [-0.75, 1.25, -2], seconds: 9, ease: 'linear' });
  const n = await page.evaluate(async () => {
    const P = await import('/src/avatar/paint.ts');
    const full = P.demoLook().paint;
    window.__paintFull = full;
    return full.length;
  });
  for (let k = 1; k <= n; k++) {
    await page.evaluate((k) => window.__ff2.paint.set({ paint: window.__paintFull.slice(0, k) }), k);
    await page.waitForTimeout(420);
  }
  await page.waitForTimeout(1200);
  await rec.stop();
  // orbit the painted body
  await rec.start('paint_orbit');
  await flyCam(page, { orbit: { center: [-0.75, 1.15, -2], r0: 1.35, y0: 1.5, y1: 1.35, a0: 0.9, a1: 0.9 + Math.PI * 1.1 }, seconds: 7, ease: 'linear' });
  await page.waitForTimeout(7200);
  await rec.stop();
  // face close-up
  await rec.start('paint_face');
  await flyCam(page, { orbit: { center: [-0.75, 1.5, -2], r0: 0.9, r1: 0.55, y0: 1.55, a0: 0.6, a1: 0.2 }, seconds: 4, ease: 'linear' });
  await page.waitForTimeout(4200);
  await rec.stop();
  await page.close();
}

/* ── a bot bout: throws, hits, the countdown ───────────────────────────── */
if (has('bout')) {
  const page = await newPage(browser, { 'ff-onlybots': '1' });
  const rec = await recorder(page);
  await enter(page);
  await page.waitForTimeout(7000);
  await idleHands(page);
  await headSway(page, true, 1);
  await rec.start('bout');
  await act(page, 'quick-match');
  // wait for the round to go live, then box for ~40 s
  await page.waitForFunction(async () => {
    const m = await import('/src/combat/matchState.ts');
    return m.match.phase === 'playing';
  }, { timeout: 30000 }).catch(() => log('bout: phase wait timed out'));
  const t0 = Date.now();
  let hand = 'right';
  while (Date.now() - t0 < 40000) {
    await throwBall(page, hand, { dir: [hand === 'right' ? -0.08 : 0.08, 0.12 + Math.random() * 0.1, -1], power: 0.11 + Math.random() * 0.05 });
    await sleep(900 + Math.random() * 500);
    await tap(page, hand); // recall
    await sleep(700 + Math.random() * 600);
    hand = hand === 'right' ? 'left' : 'right';
  }
  await rec.stop();
  await swayOff(page);
  await page.close();
}

/* ── the titans, solo ──────────────────────────────────────────────────── */
if (has('boss')) {
  for (let stage = 0; stage < 5; stage++) {
    const page = await newPage(browser, { 'ff-onlybots': '1', 'ff-campaign': UNLOCKED });
    const rec = await recorder(page);
    await enter(page);
    await page.waitForTimeout(7000);
    await idleHands(page);
    await headSway(page, true, 0.8);
    await rec.start(`boss${stage}_intro`);
    await act(page, `campaign-${stage}`);
    const ok = await page.waitForFunction(() => window.__ff2.titan?.phase() === 'fight', { timeout: 45000 }).then(() => true, () => false);
    await page.waitForTimeout(1500);
    await rec.stop();
    const info = await page.evaluate(() => ({ boss: window.__ff2.titan?.boss(), moves: window.__ff2.titan?.moves() }));
    log('boss', stage, ok, JSON.stringify(info));
    // titan root for orbits
    const titanPos = await page.evaluate(() => {
      const w = window.FRAMEWORK_MCP_RUNTIME.world;
      let best = null;
      w.scene.traverse((o) => {
        if (best) return;
        if (/titan|boss|goliath|rusthook|kaiser|vulture|juggernaut/i.test(o.name || '')) {
          const p = o.getWorldPosition(new o.position.constructor());
          best = { name: o.name, p: p.toArray() };
        }
      });
      return best;
    });
    log('titan object', JSON.stringify(titanPos));
    const c = titanPos?.p ?? [0, 0, -6];
    const moves = info.moves?.length ? info.moves : ['gate'];
    // first-person telegraphs
    await rec.start(`boss${stage}_fight`);
    for (let i = 0; i < 3; i++) {
      await page.evaluate((k) => window.__ff2.titan.force(k), moves[i % moves.length]);
      await page.waitForTimeout(3600);
    }
    await rec.stop();
    // orbit the titan
    await swayOff(page);
    await rec.start(`boss${stage}_orbit`);
    await flyCam(page, { orbit: { center: [c[0], 2.2, c[2]], r0: 6, r1: 4.5, y0: 1.2, y1: 3.5, a0: -0.5, a1: 0.9 }, seconds: 7, ease: 'linear' });
    await page.evaluate((k) => window.__ff2.titan.force(k), moves[(3) % moves.length]);
    await page.waitForTimeout(7200);
    await rec.stop();
    // low hero angle from the deck
    await rec.start(`boss${stage}_low`);
    await flyCam(page, { from: [0.6, 0.5, 0.4], to: [-0.4, 0.7, -0.2], look: [c[0], 3.5, c[2]], seconds: 4, ease: 'linear' });
    await page.evaluate((k) => window.__ff2.titan.force(k), moves[(4) % moves.length]);
    await page.waitForTimeout(4200);
    await rec.stop();
    await page.close();
  }
}

/* ── the club, full of painted people ──────────────────────────────────── */
async function venue(page) {
  await enter(page, '/?floorPatience=1500');
  await page.waitForTimeout(7000);
  await page.evaluate(LOOKGEN);
  await page.evaluate(() => window.__town.enterVenue());
  await page.waitForFunction(() => window.__town && !window.__town.busy, { timeout: 60000 });
  await page.waitForTimeout(3500);
  await idleHands(page);
}
async function crowd(page) {
  return page.evaluate(async () => {
    const s = await import('/src/rave/net/session.ts');
    const P = await import('/src/rave/net/poses.ts');
    s.net.solo = true;
    const names = ['GOOBER', 'SKIBIDI', 'RIZZLER', 'OHIO', 'GYATT', 'SIGMA', 'NPC_47', 'BUSSIN', 'MOGGER', 'LEBRON', 'FANUM', 'DELULU', 'GRIDDY', 'AURA'];
    const members = [{ name: 'YELLKELL', idx: s.net.myIdx ?? 0 }];
    const spots = [];
    // clusters: a knot by the floor centre, a pair at the bar, a few by the booths, two by the stage
    const seeds = [
      [-1.0, -3.2], [0.2, -3.6], [1.1, -2.9], [-0.3, -2.4], [1.9, -4.4], [-2.2, -4.6],
      [6.6, -3.5], [6.9, -2.6],
      [-5.5, -1.2], [-6.2, -2.1], [-4.6, -0.6],
      [0.8, -7.4], [-1.4, -7.6], [3.2, -6.2],
    ];
    for (let i = 0; i < names.length; i++) {
      const l = window.__mkLook(i + 100);
      members.push({ name: names[i], idx: 10 + i, lk: l.lk, gr: l.gr, tn: l.tn, hue: l.hue });
      const [x, z] = seeds[i];
      // face roughly toward the floor centre (or toward a neighbour)
      const yaw = Math.atan2(x - 0, z - -4.2) + Math.PI + (Math.random() - 0.5) * 0.8;
      spots.push({ idx: 10 + i, x, z, yaw, seed: i });
    }
    s.net.members = members;
    const t0 = performance.now();
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      for (const sp of spots) {
        const bob = Math.sin(t * 2.2 + sp.seed) * 0.025;
        const sway = Math.sin(t * 0.8 + sp.seed * 2) * 0.05;
        const yaw = sp.yaw + Math.sin(t * 0.6 + sp.seed) * 0.3;
        const rx = Math.cos(yaw), rz = -Math.sin(yaw); // right vector for yaw (0 faces -Z)
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        const talk = Math.max(0, Math.sin(t * 2.6 + sp.seed * 1.7));
        P.clubPoses.set(sp.idx, {
          hx: sp.x + sway, hy: 1.55 + bob + (sp.seed % 3) * 0.04, hz: sp.z,
          hyaw: yaw, hpitch: Math.sin(t * 1.1 + sp.seed) * 0.1, hroll: Math.sin(t * 0.7 + sp.seed) * 0.05,
          lx: sp.x + sway - rx * 0.24 + fx * 0.2, ly: 1.0 + talk * 0.25 * (sp.seed % 2) + Math.sin(t * 2.2 + sp.seed) * 0.05, lz: sp.z - rz * 0.24 + fz * 0.2,
          rx: sp.x + sway + rx * 0.24 + fx * 0.25, ry: 1.0 + talk * 0.35 * ((sp.seed + 1) % 2) + Math.cos(t * 2.0 + sp.seed) * 0.05, rz: sp.z + rz * 0.24 + fz * 0.25,
          t: performance.now(),
        });
      }
      requestAnimationFrame(step);
    };
    step();
    return spots;
  });
}
if (has('club')) {
  const page = await newPage(browser, { 'ff-onlybots': '1', 'gdr-server': 'ws://127.0.0.1:1' });
  const rec = await recorder(page);
  await venue(page);
  const spots = await crowd(page);
  await page.waitForTimeout(2500);
  // first-person look around from the spawn
  await rec.start('club_pan');
  await flyCam(page, { from: [0, 1.6, 0], to: [0, 1.6, 0], look: [-4, 1.4, -4], lookTo: [4, 1.4, -4], seconds: 7 });
  await page.waitForTimeout(7200);
  await rec.stop();
  // walk in toward the floor
  await rec.start('club_walk');
  await flyCam(page, { from: [0, 1.6, 2.5], to: [0.4, 1.6, -1.6], look: [0, 1.4, -9], seconds: 7, ease: 'linear' });
  await page.waitForTimeout(7200);
  await rec.stop();
  // the house camera
  await rec.start('club_cctv');
  await flyCam(page, { from: [4.6, 3.0, -0.6], to: [3.8, 2.8, -1.4], look: [0, 1.3, -5], seconds: 6, ease: 'linear' });
  await page.waitForTimeout(6200);
  await rec.stop();
  // close-ups on painted punters
  for (let i = 0; i < 4; i++) {
    const sp = spots[[0, 2, 6, 11][i]];
    const fx = -Math.sin(sp.yaw), fz = -Math.cos(sp.yaw);
    await rec.start(`club_face${i}`);
    await flyCam(page, { from: [sp.x + fx * 1.6 + 0.3, 1.55, sp.z + fz * 1.6], to: [sp.x + fx * 1.1 - 0.2, 1.5, sp.z + fz * 1.1], look: [sp.x, 1.45, sp.z], seconds: 3.5, ease: 'linear' });
    await page.waitForTimeout(3700);
    await rec.stop();
  }
  // the crowd from low, wide
  await rec.start('club_low');
  await flyCam(page, { from: [-2.5, 0.9, -1.0], to: [2.0, 1.1, -1.4], look: [0, 1.5, -4.5], seconds: 6, ease: 'linear' });
  await page.waitForTimeout(6200);
  await rec.stop();
  await page.close();
}

/* ── the 24-seat rave raid ─────────────────────────────────────────────── */
if (has('rave')) {
  const page = await newPage(browser, { 'ff-onlybots': '1', 'gdr-server': 'ws://127.0.0.1:1' });
  const rec = await recorder(page);
  await venue(page);
  const R = await page.evaluate(async () => {
    const P = await import('/src/rave/net/poses.ts');
    const humans = new Map();
    const names = ['GOOBER', 'SKIBIDI', 'RIZZLER', 'OHIO', 'GYATT', 'SIGMA', 'NPC_47', 'BUSSIN', 'MOGGER', 'LEBRON', 'FANUM', 'GLAZER', 'DELULU', 'RATIO', 'CAPPER', 'GRIDDY', 'MEWING', 'AURA', 'SUS', 'BOZO', 'CHAD', 'KAI', 'DUKE'];
    for (let seat = 1; seat < 24; seat++) {
      if (seat % 4 === 0) continue;
      const l = window.__mkLook(seat + 200);
      humans.set(seat, { name: names[seat - 1], netId: 100 + seat, look: l.lk, gear: l.gr, tone: l.tn });
    }
    window.__gdr.startRaid({ seats: 24, humans, mySeat: 0 });
    const t0 = performance.now();
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      for (const seat of humans.keys()) {
        const ph = seat * 0.7;
        const beat = t * 2.1 * Math.PI;
        P.remotePoses.set(seat, {
          hx: Math.sin(t * 0.9 + ph) * 0.12, hy: 1.5 + Math.abs(Math.sin(beat / 2 + ph)) * 0.08, hz: Math.cos(t * 0.7 + ph) * 0.1,
          hyaw: Math.sin(t * 0.5 + ph) * 0.4, hpitch: Math.sin(t * 1.3 + ph) * 0.15, hroll: 0,
          lx: -0.25 - Math.sin(beat + ph) * 0.1, ly: 1.0 + Math.max(0, Math.sin(beat + ph)) * 0.75, lz: -0.15,
          rx: 0.25 + Math.sin(beat + ph) * 0.1, ry: 1.0 + Math.max(0, Math.sin(beat + ph + Math.PI)) * 0.75, rz: -0.15,
          t: performance.now(),
        });
      }
      requestAnimationFrame(step);
    };
    step();
    const ring = await import('/src/rave/game/ring.ts');
    const V = window.__gdr.scene().position.constructor;
    return -ring.stageLocal(24, new V()).z;
  });
  log('ring radius', R);
  // the count-in
  await rec.start('rave_countin');
  await headSway(page, true, 0.6);
  const live = await page.waitForFunction(() => window.__gdr.match.screen === 'raid', { timeout: 60000 }).then(() => true, () => false);
  await page.waitForTimeout(2500);
  await rec.stop();
  log('rave live', live);
  // first-person on the ring
  await rec.start('rave_fp');
  await page.waitForTimeout(8000);
  await rec.stop();
  await swayOff(page);
  const C = [0, 1.0, -R];
  await rec.start('rave_sky');
  await flyCam(page, { orbit: { center: C, r0: R * 1.25, r1: R * 1.05, y0: 7, y1: 10, a0: 0.2, a1: 1.9 }, seconds: 11, ease: 'linear' });
  await page.waitForTimeout(11200);
  await rec.stop();
  await rec.start('rave_top');
  await flyCam(page, { orbit: { center: [0, 0, -R], r0: 2.5, r1: 2.5, y0: 24, y1: 20, a0: 0, a1: 1.2 }, seconds: 7, ease: 'linear' });
  await page.waitForTimeout(7200);
  await rec.stop();
  // dancers close-up: fly past the far side of the ring at head height
  await rec.start('rave_close');
  await flyCam(page, { orbit: { center: C, r0: R - 2.2, r1: R - 2.2, y0: 1.5, y1: 1.6, a0: Math.PI * 0.75, a1: Math.PI * 1.25 }, seconds: 7, ease: 'linear', look: [0, 1.4, -R], lookTo: [0, 1.4, -R] });
  await page.waitForTimeout(7200);
  await rec.stop();
  // MC + stage from the floor
  await rec.start('rave_stage');
  await flyCam(page, { from: [1.5, 1.4, -R + 4], to: [-1.5, 1.6, -R + 3.2], look: [0, 1.6, -R], seconds: 6, ease: 'linear' });
  await page.waitForTimeout(6200);
  await rec.stop();
  await page.close();
}

/* ── the five-raider GOLIATH raid ──────────────────────────────────────── */
if (has('raid')) {
  const page = await newPage(browser, { 'ff-onlybots': '1', 'ff-campaign': UNLOCKED });
  const rec = await recorder(page);
  await enter(page);
  await page.waitForTimeout(7000);
  await idleHands(page);
  await page.evaluate(LOOKGEN);
  await page.evaluate(async () => {
    const { app } = await import('/src/menu/appState.ts');
    const { mesh } = await import('/src/net/mesh.ts');
    mesh.joined = true; mesh.mySeat = 0; mesh.capacity = 5; mesh.started = true;
    mesh.occupants = ['me', 'a', 'b', 'c', 'd'];
    mesh.names = ['YELLKELL', 'GOOBER', 'SKIBIDI', 'RIZZLER', 'OHIO'];
    mesh.cosmetics = [undefined, ...[1, 2, 3, 4].map((i) => { const l = window.__mkLook(i + 10); return { av: l.tn === 'onyx' ? 'onyx' : 'blank', lk: l.lk, gr: l.gr, avc: l.hue, avl: 0.5 }; })];
    app.arcade = 'raid'; app.spectating = false; app.mySlot = 0; app.mode = 'campaign'; app.campaignMode = 'raid';
    app.raidHardcore = false; app.raidGoopliath = false; app.raidSize = 5; app.difficulty = 'normal'; app.campaignStage = 0;
    app.state = 'playing';
    const menu = [...window.FRAMEWORK_MCP_RUNTIME.world.systems].find((s) => s.constructor.name === 'MenuSystem');
    menu.applyState?.();
  });
  await page.waitForFunction(() => window.__ff2.titan?.phase() && window.__ff2.titan.phase() !== 'idle', { timeout: 30000 });
  await page.evaluate(async () => {
    const { app } = await import('/src/menu/appState.ts');
    const camp = [...window.FRAMEWORK_MCP_RUNTIME.world.systems].find((s) => s.constructor.name === 'CampaignSystem');
    app.campaignStage = 4;
    camp.stageSetup(true, 'the final titan');
  });
  // fake raiders
  await page.evaluate(async () => {
    const { opponents, ballCommands } = await import('/src/combat/opponentBus.ts');
    const { localLayout } = await import('/src/combat/layout.ts');
    const { RAID_BOSS_ANCHOR } = await import('/src/config.ts');
    const V = opponents[0].headPos.constructor;
    const t0 = performance.now();
    const next = [1.5, 2.2, 3.1, 4.0];
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      const roster = localLayout();
      for (let i = 1; i < roster.length && i <= 4; i++) {
        const s = roster[i];
        const p = opponents[i - 1];
        const yaw = s.yaw;
        const c = Math.cos(yaw), sn = Math.sin(yaw);
        const bob = Math.sin(t * 2.1 + i) * 0.03;
        p.headPos.set(s.pos[0] + Math.sin(t * 0.7 + i) * 0.1, 1.58 + bob, s.pos[2] + Math.cos(t * 0.5 + i) * 0.1);
        p.headQuat.setFromAxisAngle(new V(0, 1, 0), yaw);
        const fx = -sn, fz = -c;
        const rx = c, rz = -sn;
        const punch = Math.max(0, Math.sin(t * 3 + i * 1.3)) * 0.25;
        p.handPos[0].set(p.headPos.x - rx * 0.22 + fx * (0.25 + punch * 0.5), 1.15 + Math.sin(t * 3 + i) * 0.05, p.headPos.z - rz * 0.22 + fz * (0.25 + punch * 0.5));
        p.handPos[1].set(p.headPos.x + rx * 0.22 + fx * (0.25 + (0.25 - punch)), 1.15 + Math.cos(t * 2.6 + i) * 0.05, p.headPos.z + rz * 0.22 + fz * (0.25 + (0.25 - punch)));
        p.orbiting[0] = Math.sin(t * 1.1 + i) > 0.2;
        p.orbiting[1] = Math.cos(t * 0.9 + i) > 0.2;
        p.accentHue = (i * 0.23) % 1; p.accentLight = 0.55;
        if (t > next[i - 1]) {
          next[i - 1] = t + 1.4 + Math.random() * 1.4;
          const hand = Math.random() < 0.5 ? 0 : 1;
          const pos = p.handPos[hand].clone();
          const tgt = new V(RAID_BOSS_ANCHOR[0] + (Math.random() - 0.5), 2.2 + Math.random() * 1.5, RAID_BOSS_ANCHOR[2]);
          const vel = tgt.sub(pos).normalize().multiplyScalar(7.5);
          ballCommands.push({ type: 'throw', slot: i - 1, hand, pos, vel });
        }
      }
      requestAnimationFrame(step);
    };
    step();
  });
  await page.waitForFunction(() => window.__ff2.titan?.phase() === 'fight', { timeout: 45000 }).catch(() => log('raid: fight wait timed out'));
  await page.waitForTimeout(1500);
  const A = [0, 0, -6];
  // first-person, throwing with the squad
  await headSway(page, true, 0.8);
  await rec.start('raid_fp');
  const t0 = Date.now();
  let hand = 'right';
  while (Date.now() - t0 < 12000) {
    await throwBall(page, hand, { dir: [hand === 'right' ? -0.06 : 0.06, 0.28, -1], power: 0.13 });
    await sleep(800);
    await tap(page, hand);
    await sleep(900);
    hand = hand === 'right' ? 'left' : 'right';
  }
  await rec.stop();
  await swayOff(page);
  // sky orbit
  await rec.start('raid_sky');
  await flyCam(page, { orbit: { center: [A[0], 2.5, A[2]], r0: 10, r1: 8, y0: 6.5, y1: 8.5, a0: 0.3, a1: 1.7 }, seconds: 12, ease: 'linear' });
  await page.waitForTimeout(12200);
  await rec.stop();
  // top-down
  await rec.start('raid_top');
  await flyCam(page, { orbit: { center: [A[0], 0, A[2] + 1.5], r0: 1.5, r1: 1.5, y0: 15, y1: 12, a0: 0, a1: 1.0 }, seconds: 7, ease: 'linear' });
  await page.waitForTimeout(7200);
  await rec.stop();
  // low hero shot looking up at the titan
  await rec.start('raid_low');
  await flyCam(page, { from: [2.6, 0.5, -1.2], to: [-2.2, 0.8, -1.6], look: [A[0], 4.2, A[2]], seconds: 7, ease: 'linear' });
  await page.waitForTimeout(7200);
  await rec.stop();
  // behind a squadmate
  await rec.start('raid_behind');
  await flyCam(page, { orbit: { center: [A[0], 2.5, A[2]], r0: 8.5, r1: 7, y0: 2.2, y1: 2.6, a0: -0.75, a1: -0.45 }, seconds: 6, ease: 'linear' });
  await page.waitForTimeout(6200);
  await rec.stop();
  // wide sky, high and slow
  await rec.start('raid_wide');
  await flyCam(page, { orbit: { center: [A[0], 1.5, A[2]], r0: 14, r1: 11, y0: 9, y1: 7, a0: 2.6, a1: 3.6 }, seconds: 8, ease: 'linear' });
  await page.waitForTimeout(8200);
  await rec.stop();
  await page.close();
}

await browser.close();
log('done');
