#!/usr/bin/env node
/**
 * THE CHANNEL and THE TAPE, headless.
 *
 *   npm run dev              # terminal 1 (the stats page is served from public/)
 *   node tools/tv-check.mjs
 *
 * Stands THE ROOM SERVER up on a spare port, plays a fake caster into its
 * /tv relay (a duel's frames, then a sign-off), watches it back through a
 * viewer socket and the /guide endpoint, and asks the bot's invite path
 * to refuse what it should. Then it opens public/stats.html in headless
 * Chromium pointed at that relay and checks THE CHANNEL draws the match
 * and falls back to the club when the caster leaves; walks the FIRE FIGHT
 * rail onto SPEEDRUN and its difficulty sub-rail, then onto THE LAB, and
 * feeds it fixture tapes to check the tiles, the heatmaps, the filter and
 * the play-by-play. Finally it round-trips the lobby's QR encoder against
 * the module's own shape rules (finder patterns, a square, an odd size).
 */

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import WebSocket from 'ws';

const base = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const PORT = Number(process.env.TV_PORT || 8799);
const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── the room server on a spare port ─────────────────────────────────── */
const server = spawn(process.execPath, ['server/room.mjs'], { env: { ...process.env, PORT: String(PORT), BALL_MS: '4000' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
for (let i = 0; i < 40; i++) {
  try {
    const r = await fetch(`http://localhost:${PORT}/tv/guide`);
    if (r.ok) break;
  } catch {
    /* not up yet */
  }
  await sleep(250);
}

console.log('=== the relay: a caster, a viewer, the guide ===');
const guide0 = await fetch(`http://localhost:${PORT}/tv/guide`).then((r) => r.json());
check('the guide answers with no channels and a dark club', Array.isArray(guide0.channels) && guide0.channels.length === 0 && guide0.club.people === 0, JSON.stringify(guide0));

const open = (url) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
const inbox = (ws) => {
  const q = [];
  ws.on('message', (raw) => q.push(JSON.parse(raw.toString())));
  return q;
};

const viewer = await open(`ws://localhost:${PORT}/tv`);
const seen = inbox(viewer);
viewer.send(JSON.stringify({ t: 'watch' }));
await sleep(300);
check('a viewer with nothing on is shown the club', seen.some((m) => m.t === 'guide') && seen.some((m) => m.t === 'club'), seen.map((m) => m.t).join(','));

const caster = await open(`ws://localhost:${PORT}/tv`);
const casterIn = inbox(caster);
caster.send(JSON.stringify({ t: 'cast', kind: '1v1', title: 'PROBE vs ROOK', names: ['PROBE', 'ROOK'] }));
const frame = (t) => ({
  ph: 'playing', rd: 1, tm: 60 - t, sc: [0, 0], msg: t < 1 ? 'FIGHT' : '',
  p: [
    { n: 'PROBE', t: 0, hp: 0.8, h: [0.1 * Math.sin(t), 1.55, 0.1], l: [-0.2, 1.1, -0.3], r: [0.25, 1.2, -0.4], yaw: 0, pl: [0, 0, 0] },
    { n: 'ROOK', t: 1, hp: 0.6, h: [0.05, 1.5, -3.0], l: [-0.2, 1.1, -2.7], r: [0.2, 1.1, -2.7], yaw: 3.14, pl: [0, -3, 3.14] },
  ],
  b: [[0, 0.1, 1.3, -1.2 - t * 0.5, 2, 0.09], [1, -0.1, 1.2, -2.6, 1, 0.09]],
});
for (let i = 0; i < 6; i++) {
  caster.send(JSON.stringify({ t: 'f', f: frame(i * 0.2) }));
  await sleep(120);
}
// …and keep casting while the page looks, or the relay rightly expires the
// channel as "signal lost" before headless Chromium has even launched.
let castT = 1.2;
const casting = setInterval(() => {
  castT += 0.2;
  if (caster.readyState === WebSocket.OPEN) caster.send(JSON.stringify({ t: 'f', f: frame(castT) }));
}, 200);
await sleep(300);
check('the caster is told it is on air', casterIn.some((m) => m.t === 'on-air' && m.id), JSON.stringify(casterIn[0]));
const guide1 = await fetch(`http://localhost:${PORT}/tv/guide`).then((r) => r.json());
check('the guide lists the duel as featured', guide1.channels.length === 1 && guide1.channels[0].title === 'PROBE vs ROOK' && guide1.featured === guide1.channels[0].id, JSON.stringify(guide1.channels));
const frames = seen.filter((m) => m.t === 'f');
check('the viewer auto-tunes to it and receives its frames', frames.length >= 4 && frames.at(-1).f.p.length === 2, `${frames.length} frames`);

// An oversized frame: `ws` hangs up on a socket that exceeds maxPayload,
// so this goes on a throwaway caster — the duel must not even flicker.
const bully = await open(`ws://localhost:${PORT}/tv`);
bully.send(JSON.stringify({ t: 'cast', kind: 'solo', title: 'BULLY', names: ['BULLY'] }));
await sleep(150);
bully.send(JSON.stringify({ t: 'f', f: { pad: 'x'.repeat(20000) } }));
await sleep(400);
const guideB = await fetch(`http://localhost:${PORT}/tv/guide`).then((r) => r.json());
check('an oversized frame drops its caster and leaves the duel on air', !seen.some((m) => m.t === 'f' && m.f.pad) && bully.readyState !== WebSocket.OPEN && guideB.channels.some((c) => c.title === 'PROBE vs ROOK'), `${guideB.channels.map((c) => c.title).join(',')}`);

const invite = await fetch(`http://localhost:${PORT}/tv/invite`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: '12345', mode: '2v2', name: 'PROBE', open: 2 }) }).then((r) => r.json());
check('an invite with no bot token is refused as "bot off"', invite.posted === false && invite.reason === 'bot off', JSON.stringify(invite));
const invite2 = await fetch(`http://localhost:${PORT}/tv/invite`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: '12', mode: '2v2', name: 'PROBE' }) }).then((r) => r.json());
check('a malformed code is refused', invite2.posted === false && invite2.reason === 'bad code', JSON.stringify(invite2));

/* ── the page ────────────────────────────────────────────────────────── */
console.log('\n=== stats.html: THE CHANNEL ===');
const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/stats.html?tv=ws://localhost:${PORT}/tv#tv`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(1500);
const tvOpen = await page.evaluate(() => !document.getElementById('face-tv').classList.contains('hidden'));
check('#tv opens FFTV', tvOpen);
const fftv = await page.evaluate(() => ({ tab: document.getElementById('tab-tv').textContent.trim(), mark: document.getElementById('wordmark').textContent.replace(/\s+/g, '') }));
check('the face is called FFTV', fftv.tab === 'FFTV' && fftv.mark === 'FFTV', JSON.stringify(fftv));
const onair = await page.evaluate(() => ({ badge: document.getElementById('tv-onair').textContent, title: document.getElementById('tv-title').textContent, guide: document.getElementById('tv-guide').textContent }));
check('the TV shows the duel on air', /LIVE/.test(onair.badge) && /PROBE vs ROOK/.test(onair.title), JSON.stringify(onair));
check('the guide strip lists the channel', /PROBE vs ROOK/.test(onair.guide), onair.guide.slice(0, 80));
const painted = await page.evaluate(() => {
  const c = document.getElementById('tv-canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 200) lit++;
  return lit;
});
check('the broadcast canvas is painted', painted > 200, `${painted} bright samples`);
const tvState = await page.evaluate(() => window.__ffTv?.state());
check('the page keeps two fighters, two balls and a round clock', tvState && tvState.frame?.p?.length === 2 && tvState.frame?.b?.length === 2 && typeof tvState.frame?.tm === 'number', JSON.stringify(tvState?.frame?.sc));

clearInterval(casting);
caster.send(JSON.stringify({ t: 'end', result: 'PROBE 3–1' }));
await sleep(900);
const after = await page.evaluate(() => ({ badge: document.getElementById('tv-onair').textContent, title: document.getElementById('tv-title').textContent }));
check('when the caster signs off the TV peeps into the club', !/LIVE/.test(after.badge) && /CLUB/i.test(after.title), JSON.stringify(after));

console.log('\n=== stats.html: the FIRE FIGHT rail ===');
// Back to FIRE FIGHT, and onto SPEEDRUN — which is the board that used to
// be called GAUNTLET, and the only one with a difficulty rail under it.
await page.evaluate(() => document.getElementById('tab-ff').click());
await page.waitForTimeout(400);
const railLabels = await page.evaluate(() =>
  [...document.querySelectorAll('#board-rail .rail-tab')].map((b) => b.textContent.trim()),
);
check('the rail names SPEEDRUN, not GAUNTLET', railLabels.includes('Speedrun') && !railLabels.some((l) => /gauntlet/i.test(l)), railLabels.join(', '));
check('THE LAB is a board of the FIRE FIGHT rail', railLabels.includes('The Lab'), railLabels.join(', '));
// The boards lost their descriptions: the title and the column caps say
// what a board is, and a sentence under each said it a second time.
const noNotes = await page.evaluate(() => ({
  gone: !document.getElementById('ff-note'),
  caps: document.getElementById('ff-caps').textContent,
}));
check('no description sits under a board', noNotes.gone, JSON.stringify(noNotes));
check('the board caps say PLAYER, not BOXER', /Player/.test(noNotes.caps) && !/Boxer/i.test(noNotes.caps), noNotes.caps);

const tiers = await page.evaluate(() => {
  const tab = [...document.querySelectorAll('#board-rail .rail-tab')].find((b) => b.textContent.trim() === 'Speedrun');
  tab.click();
  return {
    shown: !document.getElementById('tier-rail').classList.contains('hidden'),
    labels: [...document.querySelectorAll('#tier-rail .rail-tab')].map((b) => b.textContent.trim()),
  };
});
await page.waitForTimeout(500);
check('SPEEDRUN opens a difficulty sub-rail', tiers.shown && tiers.labels.join(',') === 'Normal,Hard,Blazing', tiers.labels.join(','));
const tierSwitch = await page.evaluate(async () => {
  const tab = [...document.querySelectorAll('#tier-rail .rail-tab')].find((b) => b.textContent.trim() === 'Blazing');
  tab.click();
  await new Promise((r) => setTimeout(r, 400));
  return {
    title: document.getElementById('ff-title').textContent,
    selected: [...document.querySelectorAll('#tier-rail .rail-tab')].find((b) => b.getAttribute('aria-selected') === 'true')?.textContent.trim(),
  };
});
check('picking a tier retitles the board', /blazing/i.test(tierSwitch.title) && tierSwitch.selected === 'Blazing', JSON.stringify(tierSwitch));
const otherRail = await page.evaluate(async () => {
  const tab = [...document.querySelectorAll('#board-rail .rail-tab')].find((b) => b.textContent.trim() === 'Ranked');
  tab.click();
  await new Promise((r) => setTimeout(r, 200));
  return document.getElementById('tier-rail').classList.contains('hidden');
});
check('a board with no tiers hides the sub-rail', otherRail === true);

console.log('\n=== stats.html: THE LAB ===');
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('#board-rail .rail-tab')].find((b) => b.textContent.trim() === 'The Lab');
  tab.click();
});
await page.waitForTimeout(400);
const labShown = await page.evaluate(() => ({
  lab: !document.getElementById('lab').classList.contains('hidden'),
  stage: document.getElementById('ff-stage').classList.contains('hidden'),
}));
check('THE LAB replaces the board stage inside FIRE FIGHT', labShown.lab && labShown.stage, JSON.stringify(labShown));
const grid = (fill) => Array.from({ length: 16 * 14 }, (_, i) => fill(i));
const fixture = (n, win, names) => ({
  id: `fx${n}`,
  data: {
    v: 1, kind: '1v1', net: true, quick: false, ranked: false, uid: 'u1', name: names[0], names, win,
    score: win ? [3, 1] : [1, 3], dur: 150 + n, at: new Date(Date.now() - n * 3600e3).toISOString(),
    rounds: [{ n: 1, out: 'win', res: 'ko', hp: [40, 0], dur: 30 }, { n: 2, out: 'loss', res: 'time', hp: [20, 45], dur: 60 }],
    thr: { n: 40, l: 15, r: 25, spd: 6.2 }, hits: { dealt: 14, taken: 11, head: 4, ret: 2, dealtL: 5, dealtR: 9, takenHead: 3 }, par: 3,
    grid: { w: 16, h: 14, stand: grid((i) => (i % 16 > 5 && i % 16 < 10 ? 8 : 1)), thrL: grid((i) => (i % 16 < 6 ? 3 : 0)), thrR: grid((i) => (i % 16 > 9 ? 3 : 0)), land: grid((i) => (i >= 160 ? 2 : 0)), hit: grid((i) => (i < 40 ? 2 : 0)) },
    ev: [[0.5, 0, 1, 0.2, -0.3, 6.1, 0.1, 0.1], [2.1, 1, 0, 0.1, 0.1, 20, 1, 0, 0, -1], [3.0, 2, 1, 25, 0, 0], [4.2, 3, 0], [30, 4, 1, 0, 0, 40, 0], [90, 4, 2, 1, 1, 20, 45]],
    dropped: 0,
  },
});
const labState = await page.evaluate((bouts) => {
  window.__ffLab.inject(bouts);
  return {
    tiles: document.getElementById('lab-tiles').textContent,
    players: [...document.getElementById('lab-player').options].map((o) => o.value),
    count: document.getElementById('lab-count').textContent,
    tape: document.getElementById('lab-tape').textContent,
    // A signature per map: how much is painted, and where it sits. Two maps
    // drawing the same grid would match on all three.
    //
    // ALPHA FIRST. getImageData hands back UNMULTIPLIED channels, so the
    // faint white wash the octagon's floor is filled with — 3% alpha —
    // reads as red 255 and counts as blazing hot if you only look at the
    // colour. It fooled an earlier version of this check into passing four
    // identical maps. A cell the heat actually painted is opaque; the wash
    // never is.
    // THE LAB's own maps — the profile's three sit hidden further down.
    heat: [...document.querySelectorAll('#lab canvas.heat')].map((c) => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let lit = 0, sx = 0, sy = 0;
      for (let p = 0; p < d.length / 4; p++) {
        if (d[p * 4 + 3] < 200 || d[p * 4] <= 120) continue;
        lit++;
        sx += p % c.width;
        sy += Math.floor(p / c.width);
      }
      return { lit, cx: lit ? Math.round(sx / lit) : 0, cy: lit ? Math.round(sy / lit) : 0 };
    }),
  };
}, [fixture(1, true, ['PROBE', 'ROOK']), fixture(2, false, ['PROBE', 'VULT'])]);
check('the LAB tiles read the two tapes', /2/.test(labState.tiles) && /TAPES/i.test(labState.tiles), labState.tiles.replace(/\s+/g, ' ').slice(0, 120));
check('the player picker names whoever kept a tape', labState.players.includes('PROBE'), labState.players.join(','));
check('the count line reads the filter', /2 of 2 tapes/.test(labState.count), labState.count);
check('all five heatmaps are painted', labState.heat.length === 5 && labState.heat.every((h) => h.lit > 50), labState.heat.map((h) => h.lit).join(','));
// The fixture puts the left fist's throws left of centre and the right
// fist's right of it, so those two maps must not share a centre of mass.
const sigs = new Set(labState.heat.map((h) => `${h.lit}:${h.cx}:${h.cy}`));
check('each heatmap draws its own grid, not the same one five times', sigs.size === 5, [...sigs].join(' | '));
check('the landing map sits at the back, where the fixture put it', labState.heat[3].cy > labState.heat[4].cy, `land cy ${labState.heat[3].cy} vs hit cy ${labState.heat[4].cy}`);
check('the left fist throws left of the right fist', labState.heat[1].cx < labState.heat[2].cx, `L cx ${labState.heat[1].cx} vs R cx ${labState.heat[2].cx}`);
check('THE TAPE lists both bouts', /ROOK/.test(labState.tape) && /VULT/.test(labState.tape), labState.tape.slice(0, 100));
const play = await page.evaluate(() => {
  const row = document.querySelector('#lab-tape .tape-row');
  row.click();
  return document.querySelector('#lab-tape .tape-open')?.textContent ?? '';
});
check('a bout opens into its play-by-play and rounds', /KO/.test(play) && /throw|threw/i.test(play), play.replace(/\s+/g, ' ').slice(0, 120));

console.log('\n=== stats.html: THE PROFILE ===');
await page.evaluate(() => document.querySelector('#lab-tape .who-link').click());
await page.waitForFunction(() => /RECORD IS IN|NO PROFILE|UNREACHABLE/.test(document.getElementById('profile-chip-text').textContent), { timeout: 30000 }).catch(() => {});
const prof = await page.evaluate(() => ({
  shown: !document.getElementById('profile').classList.contains('hidden'),
  railHidden: document.getElementById('board-rail').classList.contains('hidden'),
  name: document.getElementById('profile-name').textContent,
  rank: document.getElementById('profile-rank').textContent,
  chip: document.getElementById('profile-chip-text').textContent,
  tapes: document.querySelectorAll('#profile-tape .tape-row').length,
  tiles: document.getElementById('profile-tiles').textContent,
  hash: location.hash,
  heat: [...document.querySelectorAll('#profile canvas.heat')].map((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let p = 0; p < d.length / 4; p++) if (d[p * 4 + 3] >= 200 && d[p * 4] > 120) lit++;
    return lit;
  }),
}));
check('tapping a name opens the profile over the rail', prof.shown && prof.railHidden, JSON.stringify({ shown: prof.shown, railHidden: prof.railHidden }));
check('the profile names the player and a rank', prof.name === 'PROBE' && /BRONZE|SILVER|GOLD/.test(prof.rank), `${prof.name} / ${prof.rank}`);
check('the address deep-links the player', /^#player=u1$/.test(prof.hash), prof.hash);
check("the profile lists the player's tapes", prof.tapes === 2 && /Tapes/.test(prof.tiles), `${prof.tapes} tapes`);
check("the player's three heatmaps are painted", prof.heat.length === 3 && prof.heat.every((n) => n > 50), prof.heat.join(','));
const back = await page.evaluate(() => {
  document.getElementById('profile-back').click();
  return { shown: !document.getElementById('profile').classList.contains('hidden'), rail: !document.getElementById('board-rail').classList.contains('hidden'), hash: location.hash };
});
check('BACK returns to the rail', !back.shown && back.rail, JSON.stringify(back));
const banner = await page.evaluate(() => {
  // A painted look renders; a bare one leaves the canvas clear.
  const c = document.createElement('canvas');
  c.width = 400; c.height = 108;
  // Format 3, one unit: kind stripe (0) | part body (1) << 2 = 4; colour 9 (EMBER), u 0.5, v 0.5, angle 0, len 0.6, wid 0.5.
  const bytes = [3, 4, 9, 0, 128, 128, 0, 153, 128];
  const wire = btoa(String.fromCharCode(...bytes));
  const painted = paintBanner(c, wire, 'white');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let ember = 0;
  for (let p = 0; p < d.length / 4; p++) if (d[p * 4] > 200 && d[p * 4 + 1] < 140 && d[p * 4 + 2] < 80) ember++;
  return { painted, ember, bare: paintBanner(c, '', 'white') };
});
check('the painting bakes from the packed look', banner.painted && banner.ember > 500 && banner.bare === false, JSON.stringify(banner));

// The page must read the NEW project, and read boards the way the rules
// allow — per board, never as a collection group.
const wiring = await page.evaluate(async () => {
  const src = await fetch('/stats.html').then((r) => r.text());
  return {
    project: /flappy-ff9f6/.test(src),
    old: /arfi-b68f9|raveraid-bc866/.test(src),
    boardParent: /parent: `boards\//.test(src),
    speedrun: /ff2-speedrun-/.test(src),
  };
});
check('the page reads the ff2.web.app project', wiring.project && !wiring.old, JSON.stringify(wiring));
check('boards are read per board, not as a collection group', wiring.boardParent && wiring.speedrun, JSON.stringify(wiring));
check('no page errors', errors.length === 0, errors[0]);

/* ── the QR encoder ──────────────────────────────────────────────────── */
console.log('\n=== the lobby QR ===');
const qrOk = await page.evaluate(async () => {
  const mod = await import('/src/ui/qr.ts');
  const q = mod.qrEncode('https://ff2.web.app/?join=12345');
  const finder = (x0, y0) => {
    for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) {
      const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      if (q.modules[y0 + dy][x0 + dx] !== (d !== 2)) return false;
    }
    return true;
  };
  return { size: q.size, square: q.modules.every((r) => r.length === q.size), finders: finder(0, 0) && finder(q.size - 7, 0) && finder(0, q.size - 7), dark: q.modules[q.size - 8][8] };
});
check('the QR is a square with three finder patterns and the dark module', qrOk.square && qrOk.finders && qrOk.dark && qrOk.size % 4 === 1, JSON.stringify(qrOk));

await browser.close();
viewer.close();
caster.close();
server.kill();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
if (passed !== results.length) console.log(serverLog.slice(-1200));
process.exit(passed === results.length ? 0 : 1);
