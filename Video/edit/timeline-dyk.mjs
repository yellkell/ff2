// DID YOU KNOW — three things about FIRE FIGHT 2, cut like it's 2019.
//
//   1. the club hosts everything: press Ⓐ on the floor and the desk comes
//      up; the RAVE tab picks a song, the FIGHT tab a fight or a TITAN
//      RAID with its tier and HARDCORE; HOST drops a DISCO BALL, your
//      homies touch it, START deals everyone across together.
//   2. people can WATCH: the terrace, the WATCH chip, fighters hear the
//      roar and never the words.
//   3. raids: five seats, a code + QR + Discord, giant titans, the floor
//      on your own deck, the boss scaled to the squad, GOLIATH's second life.
//
// The cut is jumpy on purpose: a punch on every beat, a cut every two, a
// SLAM (zoom + shake + tilt + one inverted frame + a boom) on every fact,
// half-beat bursts, emoji spam, and the frame jittering under the slams.
// 16:9. Music from 20.04 s (the loud downbeat), grid V(n) = n · BEAT.
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
/** THE SLAM: zoom, shake, a tilt that rings down, one inverted frame, a boom. */
const slam = (t, { deg = 4, s = 0.5, flash = '#fff', fa = 1, sfx = 'boom', vol = 1, inv = true, jit = 0 } = {}) => {
  P(t, s, 10); K(t, 45); tilts.push({ t, deg, k: 8 });
  if (flash) F(t, flash, fa, 0.22);
  if (inv) ranges.invert.push([t, t + 0.05]);
  if (sfx) A(t, sfx, vol);
  if (jit) ranges.jitter.push([t, t + jit, 0.035]);
};
/** A punch on every beat inside a shot, big-small-big-small. */
const pulse = (n0, n1, s = 0.14) => { for (let n = n0 + 1; n < n1; n++) P(V(n), n % 2 ? s : s * 0.6, 12); };
/** Emoji spam: `n` of one glyph, thrown about the frame, spinning. */
const hashf = (k) => { const x = Math.sin(k * 12.9898) * 43758.5453; return x - Math.floor(x); };
const spam = (t0, t1, ch, n = 6, seed = 1) => {
  for (let i = 0; i < n; i++) {
    const h = (k) => hashf(seed * 31 + i * 7 + k);
    const a = t0 + (t1 - t0) * h(1) * 0.55;
    E(a, Math.min(t1, a + 0.9), ch, { size: 90 + h(2) * 90, from: [0.08 + h(3) * 0.84, 0.15 + h(4) * 0.7], to: [0.08 + h(3) * 0.84, 0.1 + h(4) * 0.7], spin: (h(5) - 0.5) * 14, fadeOut: 0.3 });
  }
};
const comic = { font: 'Comic Sans MS', weight: 'bold', strokeW: 0.09 };
const DYK = (t0, t1) => T(t0, t1, 'DID YOU KNOW', { size: 40, x: 0.16, y: 0.09, color: '#ffc07a', glow: 'rgba(255,122,24,0.8)', spacing: '0.06em' });

/* ── 0:00 cold open ────────────────────────────────────────────────────── */
cut(V(0), 'crowd_sky', 3.0, { zoom: [1.3, 1.1] }, { punch: 0, click: false });
slam(V(0), { deg: 6, s: 0.6, jit: 0.4 });
cut(V(2), 'raid_sky', 5.0, { zoom: [1.2, 1.05], focus: [0.5, 0.45] }, { punch: 0.4 });
K(V(2), 30); tilts.push({ t: V(2), deg: -4, k: 8 });
T(V(0), V(4), 'DID YOU KNOW', { size: 150, y: 0.5, glow: 'rgba(255,122,24,0.9)', wobble: true, shakeText: true });
E(V(0), V(4), '🤔', { size: 150, from: [0.85, 0.24], to: [0.85, 0.22], bounce: true });
spam(V(1), V(4), '❓', 5, 3);
A(V(2), 'riser', 0.6);

/* ── 0:01.9 FACT 1 — the club hosts everything ─────────────────────────── */
cut(V(4), 'desk_a', 1.0, { zoom: [1.0, 1.1], focus: [0.5, 0.55] }, { punch: 0 });
slam(V(4), { deg: -5, flash: '#ff1a00', fa: 0.7 });
DYK(V(4), V(56));
T(V(4), V(10), 'PRESS 🅰 IN THE CLUB', { size: 92, y: 0.2, glow: 'rgba(255,60,220,0.9)' });
pulse(4, 10, 0.12);
// the press itself
P(V(5) + 0.3, 0.35, 12); K(V(5) + 0.3, 25); A(V(5) + 0.3, 'boing', 0.9); ranges.jitter.push([V(5) + 0.3, V(5) + 0.55, 0.03]);
T(V(7), V(10), 'bro pressed A 💀', { ...comic, size: 48, y: 0.86, color: '#ffe3c2' });
// RAVE
cut(V(10), 'desk_rave', 1.4, { zoom: [1.0, 1.14], focus: [0.45, 0.55] }, { punch: 0.4 });
T(V(10), V(16), 'HOST A RAVE', { size: 110, y: 0.2, glow: 'rgba(255,60,220,0.9)' });
E(V(10), V(16), '🎶', { size: 140, from: [0.86, 0.3], to: [0.86, 0.27], bounce: true });
pulse(10, 13, 0.12);
cut(V(13), 'desk_rave', 2.9, { zoom: [1.25, 1.4], focus: [0.4, 0.5] }, { punch: 0.35 });
A(V(13), 'quack', 0.9);
T(V(13), V(16), 'pick a song (any song)', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
pulse(13, 16, 0.12);
cut(V(16), 'desk_rave', 5.4, { zoom: [1.2, 1.4], focus: [0.5, 0.55] }, { punch: 0.4 });
A(V(16), 'cash', 0.8); tilts.push({ t: V(16), deg: 3, k: 9 });
T(V(16), V(19), 'DISCO BALL it is 🗿', { ...comic, size: 50, y: 0.86, color: '#ffe3c2' });
pulse(16, 19, 0.12);
// HOST
cut(V(19), 'desk_rave_host', 0.85, { zoom: [1.0, 1.1] }, { punch: 0 });
slam(V(19), { deg: 7, s: 0.7, jit: 0.5 }); boosts.push([V(19), V(20)]);
T(V(19), V(21), 'HOST', { size: 170, y: 0.5, glow: 'rgba(255,60,220,0.9)', shakeText: true });
cut(V(21), 'desk_rave_host', 2.4, { zoom: [1.05, 1.25], focus: [0.18, 0.4] }, { punch: 0.35 });
T(V(21), V(24), 'the song rides the ball', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
spam(V(21), V(24), '🪩', 6, 5);
pulse(21, 24, 0.12);
// the homies
cut(V(24), 'ball_join', 1.2, { zoom: [1.05, 1.2], focus: [0.5, 0.75] }, { punch: 0.4 });
T(V(24), V(29), 'YOUR HOMIES TOUCH IT', { size: 84, y: 0.21 });
pulse(24, 27, 0.12);
cut(V(27), 'ball_join', 3.2, { zoom: [1.3, 1.45], focus: [0.5, 0.78] }, { punch: 0.35 });
A(V(27), 'boing', 0.8);
T(V(27), V(29), '"im in" 🔥', { ...comic, size: 52, y: 0.86, color: '#ffe3c2' });
for (let n = 25; n <= 28; n++) A(V(n), 'click', 0.3);
// OR A FIGHT
cut(V(29), 'desk_close', 0.8, { zoom: [1.05, 1.25], focus: [0.5, 0.55] }, { punch: 0.45 });
tilts.push({ t: V(29), deg: -4, k: 8 }); A(V(29), 'hit', 0.7);
T(V(29), V(32), 'OR A FIGHT', { size: 110, y: 0.2 });
E(V(29), V(32), '🥊', { size: 140, from: [0.84, 0.3], to: [0.84, 0.27], bounce: true });
pulse(29, 32, 0.12);
// OR A TITAN RAID: tier, BLAZING, HARDCORE
cut(V(32), 'desk_raid', 1.5, { zoom: [1.05, 1.22], focus: [0.47, 0.55] }, { punch: 0.45 });
slam(V(32), { deg: 4, s: 0.5, flash: '#ff1a00', fa: 0.6, sfx: 'boom', vol: 0.8 });
T(V(32), V(36), 'OR A TITAN RAID', { size: 100, y: 0.2, glow: 'rgba(255,40,20,0.9)' });
E(V(32), V(36), '🗿', { size: 140, from: [0.86, 0.3], to: [0.86, 0.27], bounce: true });
pulse(32, 36, 0.12);
cut(V(36), 'desk_raid', 3.55, { zoom: [1.3, 1.45], focus: [0.45, 0.55] }, { punch: 0 });
slam(V(36), { deg: -6, s: 0.55, flash: '#ff7a18', fa: 0.8, sfx: 'ignite', vol: 0.9, jit: 0.3 });
T(V(36), V(39), 'BLAZING', { size: 130, y: 0.5, color: '#ff7a18', glow: 'rgba(255,122,24,0.95)', shakeText: true });
E(V(36), V(39), '🥵', { size: 150, from: [0.84, 0.72], to: [0.84, 0.68], bounce: true });
pulse(36, 39, 0.14);
cut(V(39), 'desk_raid', 4.95, { zoom: [1.3, 1.5], focus: [0.58, 0.56] }, { punch: 0 });
slam(V(39), { deg: 8, s: 0.7, flash: '#ff1a00', fa: 0.9, jit: 0.6 }); boosts.push([V(39), V(40)]);
ranges.glitch.push([V(39), V(39) + 0.2, 1]);
T(V(39), V(42), 'HARDCORE', { size: 140, y: 0.5, color: '#ff3b1f', glow: 'rgba(255,40,20,0.95)', shakeText: true });
T(V(40), V(42), 'L + no healing between titans', { ...comic, size: 44, y: 0.86, color: '#ffe3c2' });
spam(V(39), V(42), '💀', 7, 8);
A(V(41), 'fart', 0.6);
pulse(39, 42, 0.14);
// HOST, hardcore
cut(V(42), 'desk_raid_host', 0.85, { zoom: [1.0, 1.1] }, { punch: 0 });
slam(V(42), { deg: -7, s: 0.7, jit: 0.5 }); boosts.push([V(42), V(43)]);
T(V(42), V(44), 'HOST', { size: 170, y: 0.5, glow: 'rgba(255,60,220,0.9)', shakeText: true });
cut(V(44), 'desk_raid_host', 2.4, { zoom: [1.05, 1.25], focus: [0.18, 0.4] }, { punch: 0.35 });
T(V(44), V(47), 'hardcore. blazing. on the ball.', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
pulse(44, 47, 0.12);
cut(V(47), 'desk_raid_plate', 0.8, { zoom: [1.0, 1.15], focus: [0.4, 0.5] }, { punch: 0.4 });
A(V(47), 'boing', 0.8);
T(V(47), V(50), 'HIT START (do it)', { size: 104, y: 0.22, glow: 'rgba(255,60,220,0.9)' });
pulse(47, 50, 0.12);
// START → the pit
cut(V(50), 'desk_raid_deal', 2.6, { zoom: [1.0, 1.1] }, { punch: 0 });
slam(V(50), { deg: 5, s: 0.5, sfx: 'drop', vol: 0.9, jit: 0.4 });
T(V(52), V(56), 'AND EVERYONE\nGOES TOGETHER', { size: 92, y: 0.5, shakeText: true });
E(V(52), V(56), '🚀', { size: 150, from: [0.85, 0.78], to: [0.85, 0.7], bounce: true });
A(V(52), 'whistle', 0.7);
pulse(52, 56, 0.16);

/* ── 0:26.7 FACT 2 — the crowd ─────────────────────────────────────────── */
cut(V(56), 'ball_deal', 10.3, { zoom: [1.0, 1.15], focus: [0.5, 0.4] }, { punch: 0 });
slam(V(56), { deg: 6, s: 0.6, flash: '#ff1a00', fa: 0.8, sfx: 'fight', jit: 0.3 }); A(V(56), 'airhorn', 0.8); boosts.push([V(56), V(57)]);
cut(V(58), 'crowd_fp', 1.0, { zoom: [1.0, 1.12] }, { punch: 0.4 });
DYK(V(58), V(82));
T(V(58), V(62), 'PEOPLE CAN WATCH', { size: 104, y: 0.22, glow: 'rgba(255,122,24,0.9)' });
E(V(58), V(62), '👀', { size: 140, from: [0.86, 0.3], to: [0.86, 0.27], bounce: true });
pulse(58, 62, 0.12);
cut(V(62), 'crowd_look', 1.6, { zoom: [1.0, 1.18], focus: [0.75, 0.5] }, { punch: 0.4 });
tilts.push({ t: V(62), deg: -4, k: 8 });
T(V(62), V(66), 'the terrace is real 🗿', { ...comic, size: 48, y: 0.86, color: '#ffe3c2' });
pulse(62, 66, 0.12);
cut(V(66), 'crowd_rail', 1.5, { zoom: [1.0, 1.1] }, { punch: 0.4 });
T(V(66), V(70), 'FIGHTERS HEAR NOTHING', { size: 84, y: 0.2 });
E(V(66), V(70), '🔇', { size: 140, from: [0.85, 0.72], to: [0.85, 0.68], bounce: true });
A(V(66), 'quack', 0.6);
pulse(66, 70, 0.12);
cut(V(70), 'crowd_bank', 1.5, { zoom: [1.0, 1.12], focus: [0.4, 0.55] }, { punch: 0.4 });
T(V(70), V(74), 'HANDS UP = THE CROWD ROARS', { size: 74, y: 0.21, glow: 'rgba(255,200,60,0.9)' });
E(V(70), V(74), '🙌', { size: 150, from: [0.5, 0.82], to: [0.5, 0.76], bounce: true });
pulse(70, 74, 0.12);
// the whole club came: half-beat burst
[['crowd_sky', 1.0], ['crowd_rail', 3.0], ['crowd_sky', 3.5], ['crowd_bank', 3.0], ['crowd_sky', 5.5], ['crowd_look', 3.2], ['crowd_sky', 7.0], ['crowd_rail', 5.0]]
  .forEach(([c, s], i) => cut(V(74) + i * BEAT / 2, c, s, { zoom: [1.05, 1.2] }, { punch: 0.24 }));
slam(V(74), { deg: 5, s: 0.5, vol: 0.9 });
ranges.chroma.push([V(74), V(78), 0.8]);
T(V(74), V(78), 'the whole club came', { ...comic, size: 50, y: 0.86, color: '#ffe3c2' });
spam(V(74), V(78), '💀', 8, 11);
cut(V(78), 'lobby_watchchip', 1.0, { zoom: [1.05, 1.25], focus: [0.52, 0.42] }, { punch: 0.4 });
T(V(78), V(82), 'OR JUST HIT WATCH\n(free entertainment)', { size: 80, y: 0.78 });
E(V(78), V(82), '📺', { size: 140, from: [0.86, 0.24], to: [0.86, 0.21], bounce: true });
pulse(78, 82, 0.12);
A(V(80), 'riser', 0.7);

/* ── 0:39.1 FACT 3 — raids ─────────────────────────────────────────────── */
cut(V(82), 'raid_low', 1.5, { zoom: [1.12, 1.0], focus: [0.5, 0.42] }, { punch: 0 });
slam(V(82), { deg: -8, s: 0.8, flash: '#ff1a00', fa: 0.9, jit: 0.5 }); boosts.push([V(82), V(83)]);
ranges.glitch.push([V(82), V(82) + 0.25, 1]);
DYK(V(82), V(120));
T(V(82), V(86), 'RAIDS ARE\n5 PLAYERS', { size: 110, y: 0.3, glow: 'rgba(255,40,20,0.9)', shakeText: true });
spam(V(82), V(86), '🗿', 5, 13);
pulse(82, 86, 0.14);
cut(V(86), 'lobby_browser', 2.4, { zoom: [1.05, 1.2], focus: [0.5, 0.45] }, { punch: 0.4 });
T(V(86), V(90), 'HOST ONE, OR JOIN ONE', { size: 84, y: 0.21 });
T(V(88), V(90), '(ez)', { ...comic, size: 50, y: 0.86, color: '#ffe3c2' });
pulse(86, 90, 0.12);
cut(V(90), 'lobby_code', 1.5, { zoom: [1.1, 1.3], focus: [0.42, 0.55] }, { punch: 0.4 });
tilts.push({ t: V(90), deg: 4, k: 8 });
T(V(90), V(94), 'A CODE. A QR.\nSHARE ON DISCORD.', { size: 76, y: 0.2 });
E(V(90), V(94), '📱', { size: 130, from: [0.86, 0.75], to: [0.86, 0.7], bounce: true });
pulse(90, 94, 0.12);
cut(V(94), 'lobby_fill', 1.6, { zoom: [1.05, 1.18], focus: [0.5, 0.42] }, { punch: 0.4 });
T(V(94), V(98), 'squad fills up 📈', { ...comic, size: 48, y: 0.86, color: '#ffe3c2' });
for (let n = 95; n <= 97; n++) { P(V(n), 0.16, 12); A(V(n), 'ding', 0.45); }
cut(V(98), 'lobby_launch', 1.2, { zoom: [1.1, 1.3], focus: [0.5, 0.65] }, { punch: 0 });
slam(V(98), { deg: 5, s: 0.5, flash: '#ffb02e', fa: 0.7, sfx: 'airhorn', vol: 0.8 });
T(V(98), V(101), 'ROOM FULL', { size: 120, y: 0.2, color: '#ffb02e', shakeText: true });
T(V(99), V(101), '(sheeesh)', { ...comic, size: 50, y: 0.86, color: '#ffe3c2' });
pulse(98, 101, 0.14);
A(V(100), 'riser', 0.8);
cut(V(101), 'raid_sky', 2.0, { zoom: [1.0, 1.12] }, { punch: 0 });
slam(V(101), { deg: -6, s: 0.7, jit: 0.4 }); boosts.push([V(101), V(102)]);
T(V(101), V(106), 'RAID TITANS ARE GIANTS', { size: 84, y: 0.21, glow: 'rgba(255,60,20,0.9)' });
T(V(103), V(106), 'goliath-sized. all of them. 🗿', { ...comic, size: 44, y: 0.88, color: '#ffe3c2' });
pulse(101, 106, 0.12);
cut(V(106), 'boss4_fight', 6.0, { zoom: [1.0, 1.15], focus: [0.5, 0.65] }, { punch: 0.4 });
T(V(106), V(110), 'WATCH THE FLOOR TO\nSENSE INCOMING ATTACKS', { size: 72, y: 0.22 });
E(V(106), V(110), '👀', { size: 130, from: [0.85, 0.74], to: [0.85, 0.7], bounce: true });
pulse(106, 110, 0.12);
cut(V(110), 'raid_top', 1.0, { zoom: [1.0, 1.15] }, { punch: 0.4 });
tilts.push({ t: V(110), deg: 4, k: 8 });
T(V(110), V(114), 'BOSS HP SCALES\nWITH THE SQUAD', { size: 80, y: 0.22 });
T(V(112), V(114), 'no free carries 💀', { ...comic, size: 46, y: 0.88, color: '#ffe3c2' });
pulse(110, 114, 0.12);
// the overload: half-beat burst into the freeze
[['raid_fp', 5.0], ['raid_sky', 6.0], ['boss4_fight', 8.4], ['raid_top', 3.0], ['raid_fp', 7.0], ['raid_wide', 2.0]]
  .forEach(([c, s], i) => cut(V(114) + i * BEAT / 2, c, s, { zoom: [1.05, 1.25], focus: [0.5, 0.45] }, { punch: 0.26 }));
ranges.chroma.push([V(114), V(120), 0.8]);
ranges.grain.push([V(114), V(117), 0.14]);
T(V(114), V(117), 'AND GOLIATH', { size: 104, y: 0.2, glow: 'rgba(255,40,20,0.9)' });
S(V(117), 'boss4_intro', 0, { freeze: 4.5, zoom: [1.3, 1.7], focus: [0.5, 0.38] });
ranges.fry.push([V(117), V(120), 1.0]);
ranges.glitch.push([V(117) + 0.3, V(120), 0.9]);
ranges.jitter.push([V(117), V(120), 0.02]);
slam(V(117), { deg: 6, s: 0.6, sfx: 'scratch', vol: 0.9, inv: false }); A(V(118), 'glitch', 0.6);
T(V(117), V(120), 'GETS BACK UP', { size: 130, y: 0.5, shakeText: true });
T(V(118), V(120), 'why is he running', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
spam(V(117), V(120), '💀', 8, 17);

/* ── 0:57.2 out ────────────────────────────────────────────────────────── */
S(V(120), null, 0, { type: 'black' });
F(V(120), '#fff', 1, 0.15); A(V(120), 'drop', 1.0); A(V(120), 'boom', 1.0);
S(V(121), null, 0, { type: 'logo', fadeIn: 1.2, fadeOutAt: 62.6 });
A(V(121) + 0.3, 'ignite', 0.5);
T(58.9, 63.6, 'now you know', { ...comic, size: 42, y: 0.755, stroke: false, fadeIn: 0.6, fadeOut: 1.0, color: '#ffe3c2' });
T(59.5, 63.6, 'ff2.web.app', { font: 'Segoe UI', weight: '600', size: 46, y: 0.84, stroke: false, fadeIn: 0.7, fadeOut: 1.0, spacing: '0.16em', color: '#ffffff' });
T(60.1, 63.6, "in your headset's browser to play instantly - no download", { font: 'Segoe UI', weight: '400', size: 28, y: 0.905, stroke: false, fadeIn: 0.6, fadeOut: 1.0, spacing: '0.08em', color: '#9aa0a8' });
fades.push({ t0: 62.9, t1: 63.6, to: 'black' });

export const TL = {
  DUR: 63.6,
  musicOffset: 20.04,
  musicGain: 0.9,
  musicFade: [61.2, 2.4],
  shots, overlays, punches, shakes, flashes, audio, boosts, fades, tilts, ranges,
};
