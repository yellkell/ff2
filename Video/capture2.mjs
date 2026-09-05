// Footage for the DID YOU KNOW video.
//   node Video/capture2.mjs disco raidlobby [--probe]
//
//   disco     — the club desk, HOST a 2V2, the disco ball drops, friends
//               touch in, the deal crosses to the arena, and a crowd fills
//               the terrace while the 2v2 runs.
//   raidlobby — ARCADE → TITAN RAID browser (WATCH chips), a squad room
//               with the code + QR, seats filling, the launch.
//
// --probe takes stills at each beat instead of recording (framing checks).
import { launch, newPage, enter, cam, flyCam, camHome, act, recorder, throwBall, tap, idleHands, here, sleep } from './lib.mjs';
import { LOOKGEN, headSway, swayOff, venue, crowd } from './scenes.mjs';
import { join } from 'node:path';

const want = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const probe = process.argv.includes('--probe');
const has = (k) => want.length === 0 || want.includes(k);
const log = (...a) => console.log('[cap2]', ...a);
const UNLOCKED = JSON.stringify({ cleared: [true, true, true, true, true], hardcoreUnlocked: true, raidCleared: true, goopliathCleared: true, hardUnlocked: true, blazingUnlocked: true });

const browser = await launch();

/** Record a clip, or (probe) shoot a still after `holdMs`. */
async function clip(rec, page, name, ms, during) {
  if (!probe) await rec.start(name);
  const p = during?.();
  if (probe) {
    await page.waitForTimeout(Math.min(ms, 1400));
    await page.screenshot({ path: join(here, `p2-${name}.png`) });
    await page.waitForTimeout(Math.max(0, ms - 1400));
  } else {
    await page.waitForTimeout(ms);
  }
  await p;
  if (!probe) await rec.stop();
}

/* ── THE DISCO BALL: host a 2v2 from the club floor, then the crowd ─────── */
if (has('disco')) {
  const page = await newPage(browser, { 'ff-onlybots': '1', 'gdr-server': 'ws://127.0.0.1:1' });
  const rec = await recorder(page);
  await venue(page);
  const spots = await crowd(page);
  await page.waitForTimeout(2000);
  const desk = (id) => page.evaluate((id) => window.__gdr.menu.press(id), id);
  // the desk comes up in front of you; step back half a pace to frame it
  await headSway(page, true, 0.5);
  await page.evaluate(() => window.__gdr.menu.show(true));
  await page.waitForTimeout(600);
  log('desk shown:', await page.evaluate(() => window.__gdr.menu.shown?.()));
  await desk('tab-fight');
  await page.waitForTimeout(300);
  await swayOff(page);
  await clip(rec, page, 'desk_fight', 4000, async () => {
    await flyCam(page, { from: [0, 1.6, 0.6], to: [0, 1.55, 0.45], look: [0, 1.0, -0.6], seconds: 4, ease: 'linear' });
    await sleep(1600);
    await desk('fight-2v2');
  });
  await clip(rec, page, 'desk_close', 3500, async () => {
    await flyCam(page, { from: [0.06, 1.42, 0.12], to: [0.02, 1.38, 0.0], look: [0, 1.0, -0.6], seconds: 3.5, ease: 'linear' });
    await sleep(1200);
    await desk('fight-1v1');
    await sleep(700);
    await desk('fight-2v2');
  });
  // the raid row opens THE TIER LIST — easy to blazing, from the floor
  await desk('fight-raid');
  await page.waitForTimeout(250);
  await desk('raiddiff');
  await clip(rec, page, 'desk_tiers', 3400, () => flyCam(page, { from: [-0.05, 1.55, 0.5], to: [-0.15, 1.5, 0.3], look: [-0.3, 1.25, -0.6], seconds: 3.4, ease: 'linear' }));
  await desk('raiddiff');
  await desk('fight-2v2');
  await page.waitForTimeout(300);

  // HOST — the ball is winched down out of the ceiling in front of you
  await cam(page, [0, 1.6, 0.5], [0, 1.4, -1.5]);
  await clip(rec, page, 'ball_drop', 6500, async () => {
    await sleep(900);
    await page.evaluate(() => {
      const orig = window.setTimeout;
      window.__origSetTimeout = orig;
      window.setTimeout = function (fn, ms, ...rest) { return orig.call(window, fn, ms === 15000 ? 600000 : ms, ...rest); };
    });
    await desk('call');
    await page.evaluate(() => { window.setTimeout = window.__origSetTimeout; });
    await sleep(120);
    const p = await page.evaluate(async () => (await import('/src/rave/net/session.ts')).net.ball?.pos ?? null);
    if (p) await flyCam(page, { from: [0, 1.6, 0.5], to: [p[0] * 0.3, 1.55, 0.4], look: [0, 1.4, -1.5], lookTo: [p[0], 2.2, p[2]], seconds: 2.2 });
  });
  const ball = await page.evaluate(async () => {
    const s = await import('/src/rave/net/session.ts');
    return s.net.ball ? { pos: s.net.ball.pos, mode: s.net.ball.mode, fires: s.net.ball.firesAt - performance.now() } : null;
  });
  log('ball', JSON.stringify(ball));
  const bp = ball?.pos ?? [0, 1.6, -2];
  // friends touch in: one orbiting pip per punter, in their colour
  await page.evaluate(async () => {
    const s = await import('/src/rave/net/session.ts');
    // hold the clock so the plate does not hit zero mid-shot
    s.net.ball.firesAt = performance.now() + 60_000;
    s.net.dirty++;
  });
  await clip(rec, page, 'ball_join', 6500, async () => {
    for (const idx of [10, 11, 13, 12, 14]) {
      await sleep(900);
      await page.evaluate(async (idx) => {
        const s = await import('/src/rave/net/session.ts');
        s.net.ball?.joins.add(idx);
        s.net.dirty++;
      }, idx);
    }
  });
  // orbit the hanging ball with the plate facing us
  await clip(rec, page, 'ball_orbit', 7000, () =>
    flyCam(page, { orbit: { center: [bp[0], bp[1] - 0.2, bp[2]], r0: 2.6, r1: 2.1, y0: 1.5, y1: 1.9, a0: 0.5, a1: -0.9 }, seconds: 7, ease: 'linear' }),
  );
  // the plate counting down, close
  await clip(rec, page, 'ball_plate', 4000, () =>
    flyCam(page, { orbit: { center: [bp[0], bp[1] - 0.1, bp[2]], r0: 1.6, r1: 1.2, y0: 1.55, a0: 0.15, a1: -0.15 }, seconds: 4, ease: 'linear' }),
  );
  await page.evaluate(async () => {
    const s = await import('/src/rave/net/session.ts');
    s.net.ball.firesAt = performance.now() + 4000;
    s.net.dirty++;
  });
  // START: the deal — the curtain, and you are in the arena
  await camHome(page);
  await headSway(page, true, 0.6);
  await clip(rec, page, 'ball_deal', 14000, async () => {
    await sleep(2500);
    await page.evaluate(() => window.__gdr.club.go());
  });
  const state = await page.evaluate(async () => {
    const { app } = await import('/src/menu/appState.ts');
    const { match } = await import('/src/combat/matchState.ts');
    return { place: window.__town?.place, state: app.state, arcade: app.arcade, mode: app.mode, phase: match.phase };
  });
  log('after deal', JSON.stringify(state));
  await page.waitForFunction(async () => (await import('/src/combat/matchState.ts')).match.phase === 'playing', { timeout: 40000 }).catch(() => log('bout wait timed out'));

  /* the crowd: eight watchers on the flats' terraces */
  const stands = await page.evaluate(async () => {
    const A = await import('/src/arena/desert/audience.ts');
    const { mesh } = await import('/src/net/mesh.ts');
    const st = A.audienceStands();
    mesh.capacity = 4;
    const t0 = performance.now();
    const picks = st.slice(0, 8);
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      picks.forEach((s, i) => {
        const yaw = s.yaw + Math.sin(t * 0.5 + i) * 0.2;
        const bob = Math.sin(t * 2.0 + i * 1.1) * 0.03;
        const hype = 0.5 + 0.5 * Math.sin(t * 0.9 + i);
        mesh.watchers.set(4 + i, {
          x: s.x + Math.sin(t * 0.6 + i) * 0.05, y: s.y + 1.6 + bob + hype * 0.04, z: s.z + Math.cos(t * 0.4 + i) * 0.05,
          qx: 0, qy: Math.sin(yaw / 2), qz: 0, qw: Math.cos(yaw / 2), roar: hype, at: performance.now(),
        });
      });
      requestAnimationFrame(step);
    };
    step();
    return st;
  });
  log('stands', stands.length, JSON.stringify(stands.slice(0, 3)));
  await page.waitForTimeout(800);
  const bodies = await page.evaluate(() => { let n = 0; window.FRAMEWORK_MCP_RUNTIME.world.scene.traverse((o) => { if (o.name === 'terrace-watcher') n++; }); return n; });
  log('terrace bodies', bodies);
  // keep the fight lively: my own throws in the background
  let throwing = true;
  const throwLoop = (async () => {
    let hand = 'right';
    while (throwing) {
      await throwBall(page, hand, { dir: [hand === 'right' ? -0.05 : 0.05, 0.14, -1], power: 0.12 }).catch(() => {});
      await sleep(900);
      await tap(page, hand).catch(() => {});
      await sleep(1100);
      hand = hand === 'right' ? 'left' : 'right';
    }
  })();
  // first-person: the 2v2 in front of me, then a look to the flank
  await clip(rec, page, 'crowd_fp', 6000);
  await swayOff(page);
  const flank = stands[0] ?? { x: 6, y: 0, z: -3 };
  const other = stands.find((s) => Math.sign(s.x) !== Math.sign(flank.x)) ?? { x: -6, y: 0, z: -3 };
  await clip(rec, page, 'crowd_look', 5000, () =>
    flyCam(page, { from: [0, 1.6, 0], to: [0, 1.6, 0], look: [0, 1.4, -3.4], lookTo: [flank.x, flank.y + 1.5, flank.z], seconds: 4.5 }),
  );
  // from the terrace: a watcher's view of the four platforms
  const mid = stands[Math.min(3, stands.length - 1)] ?? flank;
  await clip(rec, page, 'crowd_pov', 7000, () =>
    flyCam(page, { from: [mid.x, mid.y + 1.65, mid.z], to: [mid.x * 0.45, mid.y + 1.3, mid.z * 0.45 - 0.9], look: [0, 1.2, -1.7], seconds: 7, ease: 'linear' }),
  );
  // along the rail, past the watchers' shoulders
  await clip(rec, page, 'crowd_rail', 7000, () =>
    flyCam(page, { from: [flank.x * 1.12, flank.y + 1.7, flank.z + 2.6], to: [flank.x * 1.12, flank.y + 1.5, flank.z - 2.6], look: [0, 1.3, -1.7], seconds: 7, ease: 'linear' }),
  );
  // the whole show from the sky: platforms, both terraces
  await clip(rec, page, 'crowd_sky', 9000, () =>
    flyCam(page, { orbit: { center: [0, 1, -1.7], r0: 11, r1: 9, y0: 7, y1: 9, a0: 0.4, a1: 1.6 }, seconds: 9, ease: 'linear' }),
  );
  // the other bank, low and wide
  await clip(rec, page, 'crowd_bank', 6000, () =>
    flyCam(page, { from: [other.x * 0.5, other.y + 1.2, other.z + 4], to: [other.x * 0.7, other.y + 1.4, other.z - 1], look: [other.x, other.y + 1.4, other.z], seconds: 6, ease: 'linear' }),
  );
  throwing = false;
  await throwLoop;
  await page.close();
}

/* ── THE RAID LOBBY: browser, squad room, launch ───────────────────────── */
if (has('raidlobby')) {
  const page = await newPage(browser, { 'ff-onlybots': '1', 'ff-campaign': UNLOCKED });
  const rec = await recorder(page);
  await enter(page);
  await page.waitForTimeout(7000);
  await idleHands(page);
  await page.evaluate(LOOKGEN);
  const redrawLobby = () => page.evaluate(() => {
    const menu = [...window.FRAMEWORK_MCP_RUNTIME.world.systems].find((s) => s.constructor.name === 'MenuSystem');
    menu.menu.panels.find((p) => p.id === 'lobby')?.redraw(null);
  });
  // ARCADE tab, RAID badge
  await headSway(page, true, 0.5);
  await act(page, 'wrap:tab-arcade');
  await clip(rec, page, 'lobby_arcade', 3500, () => flyCam(page, { from: [0, 1.6, 0.25], to: [0, 1.6, -0.1], look: [0, 1.45, -1.26], seconds: 3.5, ease: 'linear' }));
  // the browser: two open raids, each with a WATCH chip
  await page.evaluate(async () => {
    const { app } = await import('/src/menu/appState.ts');
    app.lobbyRooms = [
      { id: 'r1', host: 'GOOBER', count: 3, cap: 5, hardcore: false, goopliath: false },
      { id: 'r2', host: 'SIGMA', count: 4, cap: 5, hardcore: true, goopliath: false },
      { id: 'r3', host: 'LEBRON', count: 2, cap: 5, hardcore: false, goopliath: true },
    ];
  });
  await act(page, 'open-raid');
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    const { app } = await import('/src/menu/appState.ts');
    const rooms = [
      { id: 'r1', host: 'GOOBER', count: 3, cap: 5, hardcore: false, goopliath: false },
      { id: 'r2', host: 'SIGMA', count: 4, cap: 5, hardcore: true, goopliath: false },
      { id: 'r3', host: 'LEBRON', count: 2, cap: 5, hardcore: false, goopliath: true },
    ];
    const menu = [...window.FRAMEWORK_MCP_RUNTIME.world.systems].find((s) => s.constructor.name === 'MenuSystem');
    const lobby = menu.menu.panels.find((p) => p.id === 'lobby');
    window.__roomsHold = setInterval(() => {
      if (app.lobbyRooms.length !== rooms.length) { app.lobbyRooms = rooms; lobby?.redraw(null); }
    }, 120);
  });
  await page.waitForTimeout(400);
  await clip(rec, page, 'lobby_browser', 5500, () => flyCam(page, { from: [0, 1.6, 0.2], to: [0, 1.55, -0.45], look: [0, 1.5, -1.18], seconds: 5.5, ease: 'linear' }));
  // the WATCH chip, close
  await clip(rec, page, 'lobby_watchchip', 3500, () => flyCam(page, { from: [0.2, 1.62, -0.45], to: [0.28, 1.6, -0.62], look: [0.34, 1.66, -1.18], seconds: 3.5, ease: 'linear' }));
  await page.evaluate(() => clearInterval(window.__roomsHold));
  // HOST A RAID → a squad room of mine, with a code
  await page.evaluate(async () => {
    const { app } = await import('/src/menu/appState.ts');
    const { mesh } = await import('/src/net/mesh.ts');
    mesh.joined = true; mesh.mySeat = 0; mesh.capacity = 5; mesh.started = false;
    mesh.occupants = ['me', '', '', '', ''];
    mesh.names = ['YELLKELL', '', '', '', ''];
    mesh.raidDifficulty = 'hard';
    app.privateCode = '48213';
    app.lobbyView = 'lobby';
  });
  await redrawLobby();
  await clip(rec, page, 'lobby_squad', 4500, () => flyCam(page, { from: [0, 1.6, 0.1], to: [0, 1.55, -0.35], look: [0, 1.5, -1.18], seconds: 4.5, ease: 'linear' }));
  // the invite band: the code, the QR, SHARE ON DISCORD
  await clip(rec, page, 'lobby_code', 4500, () => flyCam(page, { from: [-0.1, 1.45, -0.3], to: [-0.05, 1.35, -0.55], look: [-0.05, 1.22, -1.18], seconds: 4.5, ease: 'linear' }));
  // the squad turns up, one seat at a time
  const squad = ['GOOBER', 'SKIBIDI', 'RIZZLER', 'OHIO'];
  await clip(rec, page, 'lobby_fill', 7000, async () => {
    await flyCam(page, { from: [0, 1.6, -0.25], to: [0, 1.58, -0.45], look: [0, 1.55, -1.18], seconds: 7, ease: 'linear' });
    for (let i = 0; i < squad.length; i++) {
      await sleep(1100);
      await page.evaluate(async ({ i, name }) => {
        const { mesh } = await import('/src/net/mesh.ts');
        mesh.occupants[i + 1] = `p${i}`;
        mesh.names[i + 1] = name;
        const l = window.__mkLook(i + 30);
        mesh.cosmetics[i + 1] = { av: l.tn === 'onyx' ? 'onyx' : 'blank', lk: l.lk, gr: l.gr, avc: l.hue, avl: 0.5 };
      }, { i, name: squad[i] });
      await redrawLobby();
    }
  });
  // full room → launch into the raid (GOLIATH, the squad on the arc)
  await clip(rec, page, 'lobby_launch', 16000, async () => {
    await sleep(1800);
    await page.evaluate(async () => {
      const { app } = await import('/src/menu/appState.ts');
      const { mesh } = await import('/src/net/mesh.ts');
      mesh.started = true; mesh.full = true;
      app.lobbyMode = null; app.lobbyView = 'browser';
      app.arcade = 'raid'; app.spectating = false; app.mySlot = 0; app.mode = 'campaign'; app.campaignMode = 'raid';
      app.raidHardcore = false; app.raidGoopliath = false; app.raidSize = 5; app.difficulty = 'hard'; app.campaignStage = 0;
      app.state = 'playing';
      const menu = [...window.FRAMEWORK_MCP_RUNTIME.world.systems].find((s) => s.constructor.name === 'MenuSystem');
      menu.applyState?.();
    });
    await page.waitForFunction(() => window.__ff2.titan?.phase() && window.__ff2.titan.phase() !== 'idle', { timeout: 30000 }).catch(() => {});
    await page.evaluate(async () => {
      const { app } = await import('/src/menu/appState.ts');
      const camp = [...window.FRAMEWORK_MCP_RUNTIME.world.systems].find((s) => s.constructor.name === 'CampaignSystem');
      app.campaignStage = 4;
      camp.stageSetup(true, 'the final titan');
    });
    // the squad on their platforms
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
          const s = roster[i]; const p = opponents[i - 1];
          const yaw = s.yaw, c = Math.cos(yaw), sn = Math.sin(yaw);
          p.headPos.set(s.pos[0] + Math.sin(t * 0.7 + i) * 0.1, 1.58 + Math.sin(t * 2.1 + i) * 0.03, s.pos[2] + Math.cos(t * 0.5 + i) * 0.1);
          p.headQuat.setFromAxisAngle(new V(0, 1, 0), yaw);
          const fx = -sn, fz = -c, rx = c, rz = -sn;
          const punch = Math.max(0, Math.sin(t * 3 + i * 1.3)) * 0.25;
          p.handPos[0].set(p.headPos.x - rx * 0.22 + fx * (0.25 + punch * 0.5), 1.15, p.headPos.z - rz * 0.22 + fz * (0.25 + punch * 0.5));
          p.handPos[1].set(p.headPos.x + rx * 0.22 + fx * (0.5 - punch), 1.15, p.headPos.z + rz * 0.22 + fz * (0.5 - punch));
          p.orbiting[0] = Math.sin(t * 1.1 + i) > 0.2; p.orbiting[1] = Math.cos(t * 0.9 + i) > 0.2;
          p.accentHue = (i * 0.23) % 1; p.accentLight = 0.55;
          if (t > next[i - 1]) {
            next[i - 1] = t + 1.4 + Math.random() * 1.4;
            const hand = Math.random() < 0.5 ? 0 : 1;
            const pos = p.handPos[hand].clone();
            const vel = new V(RAID_BOSS_ANCHOR[0] + (Math.random() - 0.5), 2.2 + Math.random() * 1.5, RAID_BOSS_ANCHOR[2]).sub(pos).normalize().multiplyScalar(7.5);
            ballCommands.push({ type: 'throw', slot: i - 1, hand, pos, vel });
          }
        }
        requestAnimationFrame(step);
      };
      step();
    });
  });
  log('raid phase', await page.evaluate(() => window.__ff2.titan?.phase() + '/' + window.__ff2.titan?.boss()));
  await page.close();
}

await browser.close();
log('done');
