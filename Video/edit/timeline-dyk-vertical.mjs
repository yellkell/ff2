// DID YOU KNOW — the 9:16 short, cut like it's 2019. Same three facts as
// the landscape, framed for a phone: centre-composed shots fill the frame
// (cover), the wide terrace shots sit in a band, captions stay above the
// bottom fifth. A punch on every beat, a slam on every fact, half-beat
// bursts, emoji spam, jitter under the slams. Music from 20.04 s.
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
const tilts = [];
const ranges = { fry: [], chroma: [], strobe: [], invert: [], glitch: [], grain: [], jitter: [] };

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
const slam = (t, { deg = 4, s = 0.5, flash = '#fff', fa = 1, sfx = 'boom', vol = 1, inv = true, jit = 0 } = {}) => {
  P(t, s, 10); K(t, 45); tilts.push({ t, deg, k: 8 });
  if (flash) F(t, flash, fa, 0.22);
  if (inv) ranges.invert.push([t, t + 0.05]);
  if (sfx) A(t, sfx, vol);
  if (jit) ranges.jitter.push([t, t + jit, 0.035]);
};
const pulse = (n0, n1, s = 0.14) => { for (let n = n0 + 1; n < n1; n++) P(V(n), n % 2 ? s : s * 0.6, 12); };
const hashf = (k) => { const x = Math.sin(k * 12.9898) * 43758.5453; return x - Math.floor(x); };
const spam = (t0, t1, ch, n = 6, seed = 1) => {
  for (let i = 0; i < n; i++) {
    const h = (k) => hashf(seed * 31 + i * 7 + k);
    const a = t0 + (t1 - t0) * h(1) * 0.55;
    E(a, Math.min(t1, a + 0.9), ch, { size: 100 + h(2) * 90, from: [0.1 + h(3) * 0.8, 0.25 + h(4) * 0.5], to: [0.1 + h(3) * 0.8, 0.2 + h(4) * 0.5], spin: (h(5) - 0.5) * 14, fadeOut: 0.3 });
  }
};
const comic = { font: 'Comic Sans MS', weight: 'bold', strokeW: 0.09 };
const TOP = 0.175, BOT = 0.79, BAND_TOP = 0.2, BAND_BOT = 0.72;
const DYK = (t0, t1) => T(t0, t1, 'DID YOU KNOW', { size: 40, x: 0.24, y: 0.085, color: '#ffc07a', glow: 'rgba(255,122,24,0.8)', spacing: '0.06em' });
const DESK = { fit: 'cover', focus: [0.5, 0.55] };
const DESK_LIST = { fit: 'cover', pan: [0.12, 0], focus: [0.42, 0.55] };

/* ── 0:00 cold open ────────────────────────────────────────────────────── */
cut(V(0), 'crowd_sky', 3.0, { fit: 'band', zoom: [1.25, 1.1] }, { punch: 0, click: false });
slam(V(0), { deg: 6, s: 0.6, jit: 0.4 });
cut(V(2), 'raid_sky', 5.0, { fit: 'cover', zoom: [1.15, 1.05], focus: [0.5, 0.45] }, { punch: 0.4 });
K(V(2), 30); tilts.push({ t: V(2), deg: -4, k: 8 });
T(V(0), V(4), 'DID YOU\nKNOW', { size: 150, y: 0.5, glow: 'rgba(255,122,24,0.9)', wobble: true, shakeText: true });
E(V(0), V(4), '🤔', { size: 160, from: [0.5, 0.78], to: [0.5, 0.76], bounce: true });
spam(V(1), V(4), '❓', 5, 3);
A(V(2), 'riser', 0.6);

/* ── 0:01.9 FACT 1 — the club hosts everything ─────────────────────────── */
cut(V(4), 'desk_a', 1.0, { ...DESK, zoom: [1.0, 1.1] }, { punch: 0 });
slam(V(4), { deg: -5, flash: '#ff1a00', fa: 0.7 });
DYK(V(4), V(54));
T(V(4), V(10), 'PRESS 🅰\nIN THE CLUB', { size: 100, y: TOP, glow: 'rgba(255,60,220,0.9)' });
pulse(4, 10, 0.12);
P(V(5) + 0.3, 0.35, 12); K(V(5) + 0.3, 25); A(V(5) + 0.3, 'boing', 0.9); ranges.jitter.push([V(5) + 0.3, V(5) + 0.55, 0.03]);
T(V(7), V(10), 'bro pressed A 💀', { ...comic, size: 48, y: BOT, color: '#ffe3c2' });
cut(V(10), 'desk_rave', 1.4, { ...DESK_LIST, zoom: [1.0, 1.12] }, { punch: 0.4 });
T(V(10), V(16), 'HOST A RAVE', { size: 116, y: TOP, glow: 'rgba(255,60,220,0.9)' });
E(V(10), V(16), '🎶', { size: 150, from: [0.85, 0.3], to: [0.85, 0.27], bounce: true });
pulse(10, 13, 0.12);
cut(V(13), 'desk_rave', 2.9, { ...DESK_LIST, zoom: [1.2, 1.35] }, { punch: 0.35 });
A(V(13), 'quack', 0.9);
T(V(13), V(16), 'pick a song\n(any song)', { ...comic, size: 44, y: BOT - 0.015, color: '#ffe3c2' });
pulse(13, 16, 0.12);
cut(V(16), 'desk_rave', 5.4, { ...DESK, zoom: [1.15, 1.35] }, { punch: 0.4 });
A(V(16), 'cash', 0.8); tilts.push({ t: V(16), deg: 3, k: 9 });
T(V(16), V(19), 'DISCO BALL it is 🗿', { ...comic, size: 48, y: BOT, color: '#ffe3c2' });
pulse(16, 19, 0.12);
cut(V(19), 'desk_rave_host', 0.85, { fit: 'cover', zoom: [1.0, 1.1], focus: [0.5, 0.5] }, { punch: 0 });
slam(V(19), { deg: 7, s: 0.7, jit: 0.5 }); boosts.push([V(19), V(20)]);
T(V(19), V(21), 'HOST', { size: 180, y: 0.5, glow: 'rgba(255,60,220,0.9)', shakeText: true });
cut(V(21), 'desk_rave_host', 2.4, { fit: 'cover', pan: [0.2, 0], zoom: [1.05, 1.25], focus: [0.3, 0.45] }, { punch: 0.35 });
T(V(21), V(24), 'the song rides the ball', { ...comic, size: 44, y: BOT, color: '#ffe3c2' });
spam(V(21), V(24), '🪩', 6, 5);
pulse(21, 24, 0.12);
cut(V(24), 'ball_join', 1.2, { fit: 'cover', zoom: [1.05, 1.2], focus: [0.5, 0.72] }, { punch: 0.4 });
T(V(24), V(29), 'YOUR HOMIES\nTOUCH IT', { size: 100, y: TOP });
pulse(24, 27, 0.12);
cut(V(27), 'ball_join', 3.2, { fit: 'cover', zoom: [1.3, 1.45], focus: [0.5, 0.75] }, { punch: 0.35 });
A(V(27), 'boing', 0.8);
T(V(27), V(29), '"im in" 🔥', { ...comic, size: 52, y: BOT, color: '#ffe3c2' });
for (let n = 25; n <= 28; n++) A(V(n), 'click', 0.3);
cut(V(29), 'desk_close', 0.8, { ...DESK, zoom: [1.0, 1.15] }, { punch: 0.45 });
tilts.push({ t: V(29), deg: -4, k: 8 }); A(V(29), 'hit', 0.7);
T(V(29), V(32), 'OR A FIGHT', { size: 118, y: TOP });
E(V(29), V(32), '🥊', { size: 150, from: [0.85, 0.3], to: [0.85, 0.27], bounce: true });
pulse(29, 32, 0.12);
cut(V(32), 'desk_raid', 1.5, { ...DESK_LIST, zoom: [1.0, 1.15] }, { punch: 0.45 });
slam(V(32), { deg: 4, s: 0.5, flash: '#ff1a00', fa: 0.6, sfx: 'boom', vol: 0.8 });
T(V(32), V(36), 'OR A\nTITAN RAID', { size: 104, y: TOP, glow: 'rgba(255,40,20,0.9)' });
E(V(32), V(36), '🗿', { size: 150, from: [0.85, 0.3], to: [0.85, 0.27], bounce: true });
pulse(32, 36, 0.12);
cut(V(36), 'desk_raid', 3.55, { ...DESK, zoom: [1.25, 1.4] }, { punch: 0 });
slam(V(36), { deg: -6, s: 0.55, flash: '#ff7a18', fa: 0.8, sfx: 'ignite', vol: 0.9, jit: 0.3 });
T(V(36), V(39), 'BLAZING', { size: 140, y: 0.5, color: '#ff7a18', glow: 'rgba(255,122,24,0.95)', shakeText: true });
E(V(36), V(39), '🥵', { size: 160, from: [0.5, 0.78], to: [0.5, 0.74], bounce: true });
pulse(36, 39, 0.14);
cut(V(39), 'desk_raid', 4.95, { fit: 'cover', zoom: [1.25, 1.45], focus: [0.56, 0.56] }, { punch: 0 });
slam(V(39), { deg: 8, s: 0.7, flash: '#ff1a00', fa: 0.9, jit: 0.6 }); boosts.push([V(39), V(40)]);
ranges.glitch.push([V(39), V(39) + 0.2, 1]);
T(V(39), V(42), 'HARDCORE', { size: 140, y: 0.5, color: '#ff3b1f', glow: 'rgba(255,40,20,0.95)', shakeText: true });
T(V(40), V(42), 'L + no healing\nbetween titans', { ...comic, size: 42, y: BOT - 0.015, color: '#ffe3c2' });
spam(V(39), V(42), '💀', 7, 8);
A(V(41), 'fart', 0.6);
pulse(39, 42, 0.14);
cut(V(42), 'desk_raid_host', 0.85, { fit: 'cover', zoom: [1.0, 1.1], focus: [0.5, 0.5] }, { punch: 0 });
slam(V(42), { deg: -7, s: 0.7, jit: 0.5 }); boosts.push([V(42), V(43)]);
T(V(42), V(44), 'HOST', { size: 180, y: 0.5, glow: 'rgba(255,60,220,0.9)', shakeText: true });
cut(V(44), 'desk_raid_host', 2.4, { fit: 'cover', pan: [0.2, 0], zoom: [1.05, 1.25], focus: [0.3, 0.45] }, { punch: 0.35 });
T(V(44), V(47), 'hardcore. blazing.\non the ball.', { ...comic, size: 44, y: BOT - 0.015, color: '#ffe3c2' });
pulse(44, 47, 0.12);
cut(V(47), 'desk_raid_plate', 0.8, { fit: 'cover', zoom: [1.0, 1.15], focus: [0.4, 0.5] }, { punch: 0.4 });
A(V(47), 'boing', 0.8);
T(V(47), V(50), 'HIT START\n(do it)', { size: 104, y: TOP, glow: 'rgba(255,60,220,0.9)' });
pulse(47, 50, 0.12);
cut(V(50), 'desk_raid_deal', 2.6, { fit: 'cover', zoom: [1.0, 1.1] }, { punch: 0 });
slam(V(50), { deg: 5, s: 0.5, sfx: 'drop', vol: 0.9, jit: 0.4 });
T(V(52), V(54), 'AND EVERYONE\nGOES TOGETHER', { size: 96, y: 0.5, shakeText: true });
E(V(52), V(54), '🚀', { size: 160, from: [0.5, 0.8], to: [0.5, 0.74], bounce: true });
A(V(52), 'whistle', 0.7);
pulse(52, 54, 0.16);

/* ── 0:25.7 FACT 2 — the crowd ─────────────────────────────────────────── */
cut(V(54), 'ball_deal', 10.3, { fit: 'cover', pan: [-0.25, 0], zoom: [1.0, 1.15], focus: [0.5, 0.4] }, { punch: 0 });
slam(V(54), { deg: 6, s: 0.6, flash: '#ff1a00', fa: 0.8, sfx: 'fight', jit: 0.3 }); A(V(54), 'airhorn', 0.8); boosts.push([V(54), V(55)]);
cut(V(56), 'crowd_fp', 1.0, { fit: 'cover', zoom: [1.0, 1.12] }, { punch: 0.4 });
DYK(V(56), V(74));
T(V(56), V(60), 'PEOPLE CAN\nWATCH', { size: 116, y: TOP, glow: 'rgba(255,122,24,0.9)' });
E(V(56), V(60), '👀', { size: 150, from: [0.5, 0.8], to: [0.5, 0.77], bounce: true });
pulse(56, 60, 0.12);
cut(V(60), 'crowd_look', 1.6, { fit: 'band', zoom: [1.0, 1.15] }, { punch: 0.4 });
tilts.push({ t: V(60), deg: -4, k: 8 });
T(V(60), V(64), 'the terrace is real 🗿', { ...comic, size: 46, y: BAND_BOT, color: '#ffe3c2' });
pulse(60, 64, 0.12);
cut(V(64), 'crowd_rail', 1.5, { fit: 'band', zoom: [1.0, 1.1] }, { punch: 0.4 });
T(V(64), V(68), 'FIGHTERS\nHEAR NOTHING', { size: 92, y: BAND_TOP });
E(V(64), V(68), '🔇', { size: 150, from: [0.5, BAND_BOT], to: [0.5, BAND_BOT - 0.02], bounce: true });
A(V(64), 'quack', 0.6);
pulse(64, 68, 0.12);
cut(V(68), 'crowd_bank', 1.5, { fit: 'band', zoom: [1.0, 1.12], focus: [0.4, 0.55] }, { punch: 0.4 });
T(V(68), V(70), 'HANDS UP =\nTHE CROWD ROARS', { size: 88, y: BAND_TOP, glow: 'rgba(255,200,60,0.9)' });
E(V(68), V(70), '🙌', { size: 160, from: [0.5, BAND_BOT + 0.02], to: [0.5, BAND_BOT - 0.03], bounce: true });
pulse(68, 70, 0.12);
[['crowd_sky', 1.0], ['crowd_rail', 3.0], ['crowd_sky', 3.5], ['crowd_bank', 3.0], ['crowd_sky', 5.5], ['crowd_look', 3.2], ['crowd_sky', 7.0], ['crowd_rail', 5.0]]
  .forEach(([c, s], i) => cut(V(70) + i * BEAT / 2, c, s, { fit: 'band', zoom: [1.05, 1.2] }, { punch: 0.24 }));
slam(V(70), { deg: 5, s: 0.5, vol: 0.9 });
ranges.chroma.push([V(70), V(74), 0.8]);
T(V(70), V(74), 'the whole club came', { ...comic, size: 48, y: BAND_BOT, color: '#ffe3c2' });
spam(V(70), V(74), '💀', 8, 11);
T(V(72), V(74), 'OR JUST HIT WATCH\n(free entertainment)', { size: 80, y: BAND_TOP });

/* ── 0:35.2 FACT 3 — raids ─────────────────────────────────────────────── */
cut(V(74), 'raid_sky', 5.0, { fit: 'cover', zoom: [1.0, 1.16], focus: [0.5, 0.45] }, { punch: 0 });
slam(V(74), { deg: -8, s: 0.8, flash: '#ff1a00', fa: 0.9, jit: 0.5 }); boosts.push([V(74), V(75)]);
ranges.glitch.push([V(74), V(74) + 0.25, 1]);
DYK(V(74), V(100));
T(V(74), V(78), 'RAIDS ARE\n5 PLAYERS', { size: 118, y: TOP, glow: 'rgba(255,40,20,0.9)', shakeText: true });
spam(V(74), V(78), '🗿', 5, 13);
pulse(74, 78, 0.14);
cut(V(78), 'lobby_code', 1.5, { fit: 'cover', pan: [0.06, 0], zoom: [1.05, 1.2], focus: [0.45, 0.55] }, { punch: 0.4 });
tilts.push({ t: V(78), deg: 4, k: 8 });
T(V(78), V(82), 'A CODE. A QR.\nSHARE ON DISCORD.', { size: 80, y: TOP });
E(V(78), V(82), '📱', { size: 140, from: [0.5, 0.8], to: [0.5, 0.77], bounce: true });
T(V(80), V(82), '(ez join)', { ...comic, size: 48, y: BOT - 0.08, color: '#ffe3c2' });
pulse(78, 82, 0.12);
cut(V(82), 'lobby_fill', 1.6, { fit: 'cover', zoom: [1.0, 1.12], focus: [0.5, 0.42] }, { punch: 0.4 });
T(V(82), V(85), 'squad fills up 📈', { ...comic, size: 46, y: BOT, color: '#ffe3c2' });
for (let n = 83; n <= 84; n++) { P(V(n), 0.16, 12); A(V(n), 'ding', 0.45); }
cut(V(85), 'lobby_launch', 1.2, { fit: 'cover', zoom: [1.05, 1.25], focus: [0.5, 0.6] }, { punch: 0 });
slam(V(85), { deg: 5, s: 0.5, flash: '#ffb02e', fa: 0.7, sfx: 'airhorn', vol: 0.8 });
T(V(85), V(88), 'ROOM FULL', { size: 124, y: TOP, color: '#ffb02e', shakeText: true });
T(V(86), V(88), '(sheeesh)', { ...comic, size: 50, y: BOT, color: '#ffe3c2' });
pulse(85, 88, 0.14);
A(V(87), 'riser', 0.8);
cut(V(88), 'boss4_fight', 6.0, { fit: 'cover', zoom: [1.0, 1.15], focus: [0.5, 0.6] }, { punch: 0 });
slam(V(88), { deg: -6, s: 0.7, jit: 0.4 }); boosts.push([V(88), V(89)]);
T(V(88), V(92), 'WATCH THE FLOOR\nTO SENSE\nINCOMING ATTACKS', { size: 76, y: TOP });
E(V(88), V(92), '👀', { size: 150, from: [0.5, 0.8], to: [0.5, 0.77], bounce: true });
pulse(88, 92, 0.12);
cut(V(92), 'raid_top', 1.0, { fit: 'band', zoom: [1.0, 1.15] }, { punch: 0.4 });
tilts.push({ t: V(92), deg: 4, k: 8 });
T(V(92), V(94), 'BOSS HP SCALES\nWITH THE SQUAD', { size: 88, y: BAND_TOP });
T(V(93), V(94), 'no free carries 💀', { ...comic, size: 44, y: BAND_BOT, color: '#ffe3c2' });
pulse(92, 94, 0.12);
[['raid_fp', 5.0], ['raid_sky', 6.0], ['boss4_fight', 8.4], ['raid_top', 3.0]]
  .forEach(([c, s], i) => cut(V(94) + i * BEAT / 2, c, s, { fit: 'cover', zoom: [1.05, 1.25], focus: [0.5, 0.45] }, { punch: 0.26 }));
ranges.chroma.push([V(94), V(98), 0.8]);
S(V(96), 'boss4_intro', 0, { freeze: 4.5, fit: 'cover', zoom: [1.3, 1.6], focus: [0.5, 0.38] });
ranges.fry.push([V(96), V(98), 1.0]);
ranges.glitch.push([V(96) + 0.3, V(98), 0.9]);
ranges.jitter.push([V(96), V(98), 0.02]);
slam(V(96), { deg: 6, s: 0.6, sfx: 'scratch', vol: 0.9, inv: false }); A(V(97), 'glitch', 0.6);
T(V(96), V(98), 'GOLIATH\nGETS BACK UP', { size: 120, y: 0.5, shakeText: true });
T(V(97), V(98), 'why is he running', { ...comic, size: 44, y: BOT, color: '#ffe3c2' });
spam(V(96), V(98), '💀', 8, 17);

/* ── 0:46.7 out ────────────────────────────────────────────────────────── */
S(V(98), null, 0, { type: 'black' });
F(V(98), '#fff', 1, 0.15); A(V(98), 'drop', 1.0); A(V(98), 'boom', 1.0);
S(V(99), null, 0, { type: 'logo', fadeIn: 1.2, fadeOutAt: 51.6, logoY: 0.44 });
A(V(99) + 0.3, 'ignite', 0.5);
T(48.5, 52.6, 'now you know', { ...comic, size: 46, y: 0.575, stroke: false, fadeIn: 0.6, fadeOut: 1.0, color: '#ffe3c2' });
T(49.1, 52.6, 'ff2.web.app', { font: 'Segoe UI', weight: '600', size: 64, y: 0.64, stroke: false, fadeIn: 0.7, fadeOut: 1.0, spacing: '0.16em', color: '#ffffff' });
T(49.7, 52.6, "in your headset's browser\nto play instantly - no download", { font: 'Segoe UI', weight: '400', size: 32, y: 0.705, stroke: false, fadeIn: 0.7, fadeOut: 1.0, spacing: '0.06em', color: '#9aa0a8' });
fades.push({ t0: 51.9, t1: 52.6, to: 'black' });

export const TL = {
  DUR: 52.6,
  musicOffset: 20.04,
  musicGain: 0.9,
  musicFade: [50.2, 2.4],
  shots, overlays, punches, shakes, flashes, audio, boosts, fades, tilts, ranges,
};
