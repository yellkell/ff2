// DID YOU KNOW — three things about FIRE FIGHT 2, in the trailer's voice.
//
//   1. you host games from the club: pick a fight on the desk, press HOST,
//      a DISCO BALL drops, your friends touch it, START deals everyone
//      into the arena together.
//   2. people can WATCH: whoever touches in after the seats are full lands
//      on the terrace; any open room has a WATCH chip; fighters never hear
//      the crowd's words, only its roar.
//   3. raids: five seats, a code + QR + Discord, giant titans, the floor
//      patterns on your own deck, the boss scaled to the squad, GOLIATH's
//      second life.
//
// 16:9 like the master. Music from 20.04 s (the loud downbeat), so the
// grid is V(n) = n · BEAT.
export const BEAT = 0.47625;
export const V = (n) => +(n * BEAT).toFixed(4);

const shots = [];
const overlays = [];
const punches = [];
const shakes = [];
const flashes = [];
const audio = [];
const boosts = [];
const fades = [];
const ranges = { fry: [], chroma: [], strobe: [], invert: [], glitch: [], grain: [] };

const S = (t, clip, start = 0, opts = {}) => { shots.push({ t, clip, start, ...opts }); return shots.at(-1); };
const T = (t0, t1, text, opts = {}) => overlays.push({ type: 'text', t0, t1, text, ...opts });
const E = (t0, t1, ch, opts = {}) => overlays.push({ type: 'emoji', t0, t1, ch, ...opts });
const P = (t, s = 0.3, k = 9) => punches.push({ t, s, k });
const K = (t, s = 30, k = 7) => shakes.push({ t, s, k });
const F = (t, color = '#fff', s = 1, d = 0.2) => flashes.push({ t, color, s, d });
const A = (t, sfx, vol = 1, extra = {}) => audio.push({ t, sfx, vol, ...extra });
const cut = (t, clip, start, opts = {}, { punch = 0.22, click = true } = {}) => {
  S(t, clip, start, opts);
  if (punch) P(t, punch);
  if (click) A(t, 'click', 0.35);
};
const comic = { font: 'Comic Sans MS', weight: 'bold', strokeW: 0.09 };
/** A DID YOU KNOW card: the stamp top-left, small, over whatever plays. */
const DYK = (t0, t1) => T(t0, t1, 'DID YOU KNOW', { size: 40, x: 0.16, y: 0.09, color: '#ffc07a', glow: 'rgba(255,122,24,0.8)', spacing: '0.06em' });

/* ── 0:00 cold open ────────────────────────────────────────────────────── */
cut(V(0), 'crowd_sky', 3.0, { zoom: [1.25, 1.05] }, { punch: 0.5, click: false });
F(V(0), '#fff', 0.9, 0.3); K(V(0), 45); A(V(0), 'boom', 1.0);
T(V(0), V(4), 'DID YOU KNOW', { size: 150, y: 0.5, glow: 'rgba(255,122,24,0.9)', wobble: true });
E(V(0), V(4), '🤔', { size: 150, from: [0.85, 0.24], to: [0.85, 0.22], bounce: true });
A(V(2), 'riser', 0.6);

/* ── 0:01.9 FACT 1 — the disco ball ────────────────────────────────────── */
cut(V(4), 'desk_fight', 0.6, { zoom: [1.0, 1.12], focus: [0.5, 0.6] }, { punch: 0.4 });
F(V(4), '#ff1a00', 0.7, 0.25); A(V(4), 'boom', 1.0);
DYK(V(4), V(36));
T(V(4), V(8), 'YOU HOST GAMES\nFROM THE CLUB', { size: 92, y: 0.28 });
cut(V(8), 'desk_close', 0.8, { zoom: [1.05, 1.22], focus: [0.5, 0.55] }, { punch: 0.3 });
T(V(8), V(12), 'pick a fight', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
E(V(8), V(12), '👇', { size: 130, from: [0.82, 0.46], to: [0.82, 0.5], bounce: true });
cut(V(12), 'desk_close', 2.6, { zoom: [1.25, 1.45], focus: [0.5, 0.56] }, { punch: 0.3 });
T(V(12), V(16), 'PRESS HOST', { size: 110, y: 0.22, glow: 'rgba(255,60,220,0.9)' });
A(V(14), 'ding', 0.7);
// the ball
cut(V(16), 'ball_drop', 0.7, { zoom: [1.0, 1.1] }, { punch: 0.5 });
boosts.push([V(16), V(17)]);
F(V(16), '#fff', 1, 0.25); A(V(16), 'boom', 1.0); K(V(16), 45);
T(V(16), V(22), 'A DISCO BALL\nDROPS', { size: 104, y: 0.26, glow: 'rgba(120,200,255,0.9)' });
E(V(16), V(22), '🪩', { size: 160, from: [0.14, 0.7], to: [0.14, 0.66], spin: 3 });
cut(V(22), 'ball_join', 1.2, { zoom: [1.05, 1.2], focus: [0.5, 0.75] }, { punch: 0.3 });
T(V(22), V(28), 'YOUR FRIENDS TOUCH IT', { size: 84, y: 0.21 });
T(V(24), V(28), 'their names go up on the ball', { ...comic, size: 44, y: 0.9, color: '#ffe3c2' });
for (let n = 23; n <= 27; n += 2) { P(V(n), 0.12, 12); A(V(n), 'click', 0.3); }
cut(V(28), 'ball_plate', 0.5, { zoom: [1.0, 1.15], focus: [0.5, 0.55] }, { punch: 0.3 });
T(V(28), V(31), 'HIT START', { size: 120, y: 0.22, glow: 'rgba(255,60,220,0.9)' });
// START → the deal: the crossing lands about 3 s after the press
cut(V(31), 'ball_deal', 3.3, { zoom: [1.0, 1.08] }, { punch: 0.45 });
F(V(31), '#fff', 1, 0.2); A(V(31), 'drop', 0.9);
T(V(32), V(36), 'AND EVERYONE\nGOES TOGETHER', { size: 92, y: 0.5, shakeText: true });
E(V(32), V(36), '🚀', { size: 150, from: [0.85, 0.78], to: [0.85, 0.7], bounce: true });

/* ── 0:17.1 FACT 2 — the crowd ─────────────────────────────────────────── */
// the deal's own countdown lands the "Fight" neon: ride it
cut(V(36), 'ball_deal', 10.3, { zoom: [1.0, 1.15], focus: [0.5, 0.4] }, { punch: 0.45 });
boosts.push([V(36), V(37)]);
F(V(36), '#ff1a00', 0.8, 0.3); A(V(36), 'fight', 1.0); A(V(36), 'airhorn', 0.8); K(V(36), 40);
cut(V(38), 'crowd_fp', 1.0, { zoom: [1.0, 1.12] }, { punch: 0.35 });
DYK(V(38), V(62));
T(V(38), V(42), 'PEOPLE CAN WATCH', { size: 104, y: 0.22, glow: 'rgba(255,122,24,0.9)' });
cut(V(42), 'crowd_look', 1.6, { zoom: [1.0, 1.18], focus: [0.75, 0.5] }, { punch: 0.3 });
T(V(42), V(46), 'the terrace is real', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
E(V(42), V(46), '👀', { size: 140, from: [0.15, 0.28], to: [0.15, 0.25], bounce: true });
cut(V(46), 'crowd_rail', 1.5, { zoom: [1.0, 1.1] }, { punch: 0.3 });
T(V(46), V(50), "FIGHTERS CAN'T HEAR YOU", { size: 84, y: 0.2 });
E(V(46), V(50), '🤫', { size: 140, from: [0.85, 0.72], to: [0.85, 0.68], bounce: true });
cut(V(50), 'crowd_pov', 3.5, { zoom: [1.35, 1.6], focus: [0.5, 0.52] }, { punch: 0.3 });
cut(V(52), 'crowd_bank', 1.5, { zoom: [1.0, 1.12], focus: [0.4, 0.55] }, { punch: 0.3 });
T(V(50), V(54), 'HANDS UP = THE CROWD ROARS', { size: 74, y: 0.21, glow: 'rgba(255,200,60,0.9)' });
E(V(50), V(54), '🙌', { size: 150, from: [0.5, 0.82], to: [0.5, 0.76], bounce: true });
cut(V(54), 'crowd_sky', 1.0, { zoom: [1.0, 1.15] }, { punch: 0.4 });
A(V(54), 'boom', 0.8);
T(V(54), V(58), 'A 2V2 WITH AN AUDIENCE', { size: 80, y: 0.21 });
T(V(56), V(58), 'the whole club came', { ...comic, size: 46, y: 0.88, color: '#ffe3c2' });
cut(V(58), 'lobby_watchchip', 1.0, { zoom: [1.05, 1.25], focus: [0.52, 0.42] }, { punch: 0.35 });
T(V(58), V(62), 'OR JUST HIT WATCH\nON ANY ROOM', { size: 84, y: 0.78 });
E(V(58), V(62), '📺', { size: 140, from: [0.86, 0.24], to: [0.86, 0.21], bounce: true });
A(V(60), 'riser', 0.7);

/* ── 0:29.5 FACT 3 — raids ─────────────────────────────────────────────── */
cut(V(62), 'raid_low', 1.5, { zoom: [1.12, 1.0], focus: [0.5, 0.42] }, { punch: 0.5 });
boosts.push([V(62), V(63)]);
F(V(62), '#ff1a00', 0.9, 0.35); A(V(62), 'boom', 1.0); K(V(62), 55);
ranges.glitch.push([V(62), V(62) + 0.25, 1]);
DYK(V(62), V(100));
T(V(62), V(66), 'RAIDS ARE\n5 PLAYERS', { size: 110, y: 0.3, glow: 'rgba(255,40,20,0.9)', shakeText: true });
cut(V(66), 'lobby_browser', 2.4, { zoom: [1.05, 1.2], focus: [0.5, 0.45] }, { punch: 0.3 });
T(V(66), V(70), 'HOST ONE, OR JOIN ONE', { size: 84, y: 0.21 });
cut(V(70), 'lobby_code', 1.5, { zoom: [1.1, 1.3], focus: [0.42, 0.55] }, { punch: 0.3 });
T(V(70), V(74), 'A CODE. A QR.\nSHARE ON DISCORD.', { size: 76, y: 0.2 });
E(V(70), V(74), '📱', { size: 130, from: [0.86, 0.75], to: [0.86, 0.7], bounce: true });
cut(V(74), 'lobby_fill', 1.6, { zoom: [1.05, 1.18], focus: [0.5, 0.42] }, { punch: 0.3 });
T(V(74), V(78), 'squad fills up', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
for (let n = 75; n <= 77; n++) { P(V(n), 0.12, 12); A(V(n), 'ding', 0.45); }
cut(V(78), 'lobby_launch', 1.2, { zoom: [1.1, 1.3], focus: [0.5, 0.65] }, { punch: 0.3 });
T(V(78), V(81), 'ROOM FULL', { size: 120, y: 0.2, color: '#ffb02e', shakeText: true });
A(V(80), 'riser', 0.8);
// into the pit
cut(V(81), 'raid_sky', 2.0, { zoom: [1.0, 1.12] }, { punch: 0.5 });
boosts.push([V(81), V(82)]);
F(V(81), '#fff', 1, 0.25); A(V(81), 'boom', 1.0); K(V(81), 50);
T(V(81), V(86), 'RAID TITANS ARE GIANTS', { size: 84, y: 0.21, glow: 'rgba(255,60,20,0.9)' });
T(V(83), V(86), 'goliath-sized. all of them.', { ...comic, size: 44, y: 0.88, color: '#ffe3c2' });
cut(V(86), 'boss4_fight', 6.0, { zoom: [1.0, 1.15], focus: [0.5, 0.65] }, { punch: 0.3 });
T(V(86), V(90), 'WATCH THE FLOOR TO\nSENSE INCOMING ATTACKS', { size: 72, y: 0.22 });
E(V(86), V(90), '👀', { size: 130, from: [0.85, 0.74], to: [0.85, 0.7], bounce: true });
cut(V(90), 'raid_top', 1.0, { zoom: [1.0, 1.15] }, { punch: 0.3 });
T(V(90), V(94), 'BOSS HP SCALES\nWITH THE SQUAD', { size: 80, y: 0.22 });
T(V(92), V(94), 'no free carries', { ...comic, size: 44, y: 0.88, color: '#ffe3c2' });
cut(V(94), 'raid_fp', 5.0, { zoom: [1.0, 1.15], focus: [0.5, 0.42] }, { punch: 0.3 });
ranges.chroma.push([V(94), V(100), 0.8]);
T(V(94), V(97), 'AND GOLIATH', { size: 104, y: 0.2, glow: 'rgba(255,40,20,0.9)' });
S(V(97), 'boss4_intro', 0, { freeze: 4.5, zoom: [1.3, 1.6], focus: [0.5, 0.38] });
ranges.fry.push([V(97), V(100), 1.0]);
ranges.glitch.push([V(97) + 0.3, V(100), 0.9]);
P(V(97), 0.5); A(V(97), 'scratch', 0.9); A(V(98), 'glitch', 0.6);
T(V(97), V(100), 'GETS BACK UP', { size: 130, y: 0.5, shakeText: true });
E(V(97), V(100), '💀', { size: 170, from: [0.82, 0.74], to: [0.86, 0.66], spin: 5 });

/* ── 0:47.6 out ────────────────────────────────────────────────────────── */
S(V(100), null, 0, { type: 'black' });
F(V(100), '#fff', 1, 0.15); A(V(100), 'drop', 1.0); A(V(100), 'boom', 1.0);
S(V(101), null, 0, { type: 'logo', fadeIn: 1.2, fadeOutAt: 52.0 });
A(V(101) + 0.3, 'ignite', 0.5);
T(49.3, 53.0, 'now you know', { ...comic, size: 42, y: 0.755, stroke: false, fadeIn: 0.6, fadeOut: 1.0, color: '#ffe3c2' });
T(49.9, 53.0, 'ff2.web.app', { font: 'Segoe UI', weight: '600', size: 46, y: 0.84, stroke: false, fadeIn: 0.7, fadeOut: 1.0, spacing: '0.16em', color: '#ffffff' });
T(50.5, 53.0, "in your headset's browser to play instantly - no download", { font: 'Segoe UI', weight: '400', size: 28, y: 0.905, stroke: false, fadeIn: 0.6, fadeOut: 1.0, spacing: '0.08em', color: '#9aa0a8' });
fades.push({ t0: 52.3, t1: 53.0, to: 'black' });

export const TL = {
  DUR: 53.0,
  musicOffset: 20.04,
  musicGain: 0.9,
  musicFade: [50.6, 2.4],
  shots, overlays, punches, shakes, flashes, audio, boosts, fades, ranges,
};
