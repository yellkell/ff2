// Scene dressing shared by the capture scripts: painted looks, head life,
// the venue with a crowd on the floor.
import { enter, idleHands } from './lib.mjs';

/** Random painted look + gear from the real paint module (byte-honest wire). */
export const LOOKGEN = `
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
export async function headSway(page, on = true, amp = 1) {
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
export const swayOff = (page) => page.evaluate(() => window.__swayStop?.());

/** Enter the arena and cross to the club floor (a room of one). */
export async function venue(page) {
  await enter(page, '/?floorPatience=1500');
  await page.waitForTimeout(7000);
  await page.evaluate(LOOKGEN);
  await page.evaluate(() => window.__town.enterVenue());
  await page.waitForFunction(() => window.__town && !window.__town.busy, { timeout: 60000 });
  await page.waitForTimeout(3500);
  await idleHands(page);
}

/** Fourteen painted punters on the floor, talking with their hands. */
export async function crowd(page) {
  return page.evaluate(async () => {
    const s = await import('/src/rave/net/session.ts');
    const P = await import('/src/rave/net/poses.ts');
    s.net.solo = true;
    const names = ['GOOBER', 'SKIBIDI', 'RIZZLER', 'OHIO', 'GYATT', 'SIGMA', 'NPC_47', 'BUSSIN', 'MOGGER', 'LEBRON', 'FANUM', 'DELULU', 'GRIDDY', 'AURA'];
    const members = [{ name: 'YELLKELL', idx: s.net.myIdx ?? 0 }];
    const spots = [];
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
      const yaw = Math.atan2(x - 0, z - -4.2) + Math.PI + (Math.random() - 0.5) * 0.8;
      spots.push({ idx: 10 + i, x, z, yaw, seed: i });
    }
    s.net.members = members;
    window.__crowdSpots = spots;
    const t0 = performance.now();
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      for (const sp of spots) {
        const bob = Math.sin(t * 2.2 + sp.seed) * 0.025;
        const sway = Math.sin(t * 0.8 + sp.seed * 2) * 0.05;
        const yaw = sp.yaw + Math.sin(t * 0.6 + sp.seed) * 0.3;
        const rx = Math.cos(yaw), rz = -Math.sin(yaw);
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
