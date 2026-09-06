// DID YOU KNOW — the 9:16 short. The same three facts, tighter, framed for
// a phone: centre-composed shots fill the frame (cover), the wide terrace
// shots sit in a band over a blurred copy of themselves, captions stay
// above the bottom fifth. Music from 20.04 s, grid V(n) = n · BEAT.
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
const TOP = 0.175, BOT = 0.79, BAND_TOP = 0.2, BAND_BOT = 0.72;
const DYK = (t0, t1) => T(t0, t1, 'DID YOU KNOW', { size: 40, x: 0.24, y: 0.085, color: '#ffc07a', glow: 'rgba(255,122,24,0.8)', spacing: '0.06em' });
// the desk: the song and tier lists fly out to its left, so lean the crop
// that way when they are open
const DESK = { fit: 'cover', focus: [0.5, 0.55] };
const DESK_LIST = { fit: 'cover', pan: [0.12, 0], focus: [0.42, 0.55] };

/* ── 0:00 cold open ────────────────────────────────────────────────────── */
cut(V(0), 'crowd_sky', 3.0, { fit: 'band', zoom: [1.2, 1.05] }, { punch: 0.5, click: false });
F(V(0), '#fff', 0.9, 0.3); K(V(0), 45); A(V(0), 'boom', 1.0);
T(V(0), V(4), 'DID YOU\nKNOW', { size: 150, y: 0.5, glow: 'rgba(255,122,24,0.9)', wobble: true });
E(V(0), V(4), '🤔', { size: 160, from: [0.5, 0.78], to: [0.5, 0.76], bounce: true });
A(V(2), 'riser', 0.6);

/* ── 0:01.9 FACT 1 — the club hosts everything ─────────────────────────── */
cut(V(4), 'desk_a', 1.0, { ...DESK, zoom: [1.0, 1.1] }, { punch: 0.4 });
F(V(4), '#ff1a00', 0.7, 0.25); A(V(4), 'boom', 1.0);
DYK(V(4), V(54));
T(V(4), V(10), 'PRESS 🅰\nIN THE CLUB', { size: 100, y: TOP, glow: 'rgba(255,60,220,0.9)' });
A(V(5) + 0.3, 'ding', 0.8); P(V(5) + 0.3, 0.2, 12);
T(V(7), V(10), 'the desk comes up', { ...comic, size: 46, y: BOT, color: '#ffe3c2' });
cut(V(10), 'desk_rave', 1.4, { ...DESK_LIST, zoom: [1.0, 1.1] }, { punch: 0.35 });
T(V(10), V(16), 'HOST A RAVE', { size: 116, y: TOP, glow: 'rgba(255,60,220,0.9)' });
E(V(10), V(16), '🎶', { size: 150, from: [0.85, 0.3], to: [0.85, 0.27], bounce: true });
T(V(12), V(16), 'pick a record', { ...comic, size: 46, y: BOT, color: '#ffe3c2' });
A(V(11) + 0.2, 'click', 0.5);
cut(V(16), 'desk_rave', 5.4, { ...DESK, zoom: [1.1, 1.3] }, { punch: 0.3 });
T(V(16), V(19), 'DISCO BALL it is', { ...comic, size: 48, y: BOT, color: '#ffe3c2' });
A(V(16), 'cash', 0.7);
cut(V(19), 'desk_rave_host', 0.85, { fit: 'cover', zoom: [1.0, 1.1], focus: [0.5, 0.5] }, { punch: 0.5 });
boosts.push([V(19), V(20)]);
F(V(19), '#fff', 1, 0.25); A(V(19), 'boom', 1.0); K(V(19), 45);
T(V(19), V(21), 'HOST', { size: 170, y: 0.5, glow: 'rgba(255,60,220,0.9)', shakeText: true });
T(V(21), V(24), 'the record rides the ball', { ...comic, size: 44, y: BOT, color: '#ffe3c2' });
E(V(21), V(24), '🪩', { size: 150, from: [0.85, 0.3], to: [0.85, 0.285], spin: 3 });
cut(V(24), 'ball_join', 1.2, { fit: 'cover', zoom: [1.05, 1.2], focus: [0.5, 0.72] }, { punch: 0.3 });
T(V(24), V(29), 'YOUR FRIENDS\nTOUCH IT', { size: 100, y: TOP });
T(V(26), V(29), 'their names go up on the ball', { ...comic, size: 42, y: BOT, color: '#ffe3c2' });
for (let n = 25; n <= 28; n++) { P(V(n), 0.12, 12); A(V(n), 'click', 0.3); }
cut(V(29), 'desk_close', 0.8, { ...DESK, zoom: [1.0, 1.12] }, { punch: 0.3 });
T(V(29), V(32), 'OR A FIGHT', { size: 118, y: TOP });
E(V(29), V(32), '🥊', { size: 150, from: [0.85, 0.3], to: [0.85, 0.27], bounce: true });
cut(V(32), 'desk_raid', 1.5, { ...DESK_LIST, zoom: [1.0, 1.15] }, { punch: 0.35 });
T(V(32), V(36), 'OR A\nTITAN RAID', { size: 104, y: TOP, glow: 'rgba(255,40,20,0.9)' });
A(V(33) + 0.2, 'click', 0.5);
T(V(36), V(39), 'BLAZING', { size: 140, y: 0.5, color: '#ff7a18', glow: 'rgba(255,122,24,0.95)', shakeText: true });
A(V(36), 'ignite', 0.8); P(V(36), 0.3, 12);
T(V(39), V(42), 'HARDCORE', { size: 140, y: 0.5, color: '#ff3b1f', glow: 'rgba(255,40,20,0.95)', shakeText: true });
F(V(39), '#ff1a00', 0.8, 0.3); A(V(39), 'boom', 1.0); K(V(39), 45); P(V(39), 0.4, 12);
ranges.glitch.push([V(39), V(39) + 0.2, 1]);
T(V(40), V(42), 'no healing between titans', { ...comic, size: 42, y: BOT, color: '#ffe3c2' });
cut(V(42), 'desk_raid_host', 0.85, { fit: 'cover', zoom: [1.0, 1.1], focus: [0.5, 0.5] }, { punch: 0.5 });
boosts.push([V(42), V(43)]);
F(V(42), '#fff', 1, 0.25); A(V(42), 'boom', 1.0); K(V(42), 45);
T(V(42), V(44), 'HOST', { size: 170, y: 0.5, glow: 'rgba(255,60,220,0.9)', shakeText: true });
T(V(44), V(47), 'hardcore. blazing.\non the ball.', { ...comic, size: 44, y: BOT - 0.02, color: '#ffe3c2' });
cut(V(47), 'desk_raid_plate', 0.8, { fit: 'cover', zoom: [1.0, 1.15], focus: [0.4, 0.5] }, { punch: 0.3 });
T(V(47), V(50), 'HIT START', { size: 124, y: TOP, glow: 'rgba(255,60,220,0.9)' });
cut(V(50), 'desk_raid_deal', 2.6, { fit: 'cover', zoom: [1.0, 1.08] }, { punch: 0.45 });
F(V(50), '#fff', 1, 0.2); A(V(50), 'drop', 0.9);
T(V(52), V(54), 'AND EVERYONE\nGOES TOGETHER', { size: 96, y: 0.5, shakeText: true });
E(V(52), V(54), '🚀', { size: 160, from: [0.5, 0.8], to: [0.5, 0.74], bounce: true });

/* ── 0:25.7 FACT 2 — the crowd ─────────────────────────────────────────── */
cut(V(54), 'ball_deal', 10.3, { fit: 'cover', pan: [-0.25, 0], zoom: [1.0, 1.15], focus: [0.5, 0.4] }, { punch: 0.45 });
boosts.push([V(54), V(55)]);
F(V(54), '#ff1a00', 0.8, 0.3); A(V(54), 'fight', 1.0); A(V(54), 'airhorn', 0.8); K(V(54), 40);
cut(V(56), 'crowd_fp', 1.0, { fit: 'cover', zoom: [1.0, 1.12] }, { punch: 0.35 });
DYK(V(56), V(74));
T(V(56), V(60), 'PEOPLE CAN\nWATCH', { size: 116, y: TOP, glow: 'rgba(255,122,24,0.9)' });
cut(V(60), 'crowd_look', 1.6, { fit: 'band', zoom: [1.0, 1.15] }, { punch: 0.3 });
T(V(60), V(64), 'the terrace is real', { ...comic, size: 46, y: BAND_BOT, color: '#ffe3c2' });
E(V(60), V(64), '👀', { size: 150, from: [0.5, BAND_TOP + 0.02], to: [0.5, BAND_TOP], bounce: true });
cut(V(64), 'crowd_rail', 1.5, { fit: 'band', zoom: [1.0, 1.1] }, { punch: 0.3 });
T(V(64), V(68), "FIGHTERS CAN'T\nHEAR YOU", { size: 92, y: BAND_TOP });
E(V(64), V(68), '🤫', { size: 150, from: [0.5, BAND_BOT], to: [0.5, BAND_BOT - 0.02], bounce: true });
cut(V(68), 'crowd_bank', 1.5, { fit: 'band', zoom: [1.0, 1.12], focus: [0.4, 0.55] }, { punch: 0.3 });
T(V(68), V(71), 'HANDS UP =\nTHE CROWD ROARS', { size: 88, y: BAND_TOP, glow: 'rgba(255,200,60,0.9)' });
E(V(68), V(71), '🙌', { size: 160, from: [0.5, BAND_BOT + 0.02], to: [0.5, BAND_BOT - 0.03], bounce: true });
cut(V(71), 'lobby_watchchip', 1.0, { fit: 'band', zoom: [1.05, 1.2] }, { punch: 0.35 });
T(V(71), V(74), 'OR JUST HIT WATCH\nON ANY ROOM', { size: 84, y: BAND_TOP });
E(V(71), V(74), '📺', { size: 150, from: [0.5, BAND_BOT], to: [0.5, BAND_BOT - 0.02], bounce: true });
A(V(72), 'riser', 0.7);

/* ── 0:35.2 FACT 3 — raids ─────────────────────────────────────────────── */
cut(V(74), 'raid_sky', 5.0, { fit: 'cover', zoom: [1.0, 1.16], focus: [0.5, 0.45] }, { punch: 0.5 });
boosts.push([V(74), V(75)]);
F(V(74), '#ff1a00', 0.9, 0.35); A(V(74), 'boom', 1.0); K(V(74), 55);
ranges.glitch.push([V(74), V(74) + 0.25, 1]);
DYK(V(74), V(100));
T(V(74), V(78), 'RAIDS ARE\n5 PLAYERS', { size: 118, y: TOP, glow: 'rgba(255,40,20,0.9)', shakeText: true });
cut(V(78), 'lobby_code', 1.5, { fit: 'cover', pan: [0.06, 0], zoom: [1.05, 1.2], focus: [0.45, 0.55] }, { punch: 0.3 });
T(V(78), V(82), 'A CODE. A QR.\nSHARE ON DISCORD.', { size: 80, y: TOP });
E(V(78), V(82), '📱', { size: 140, from: [0.5, 0.8], to: [0.5, 0.77], bounce: true });
cut(V(82), 'lobby_fill', 1.6, { fit: 'cover', zoom: [1.0, 1.12], focus: [0.5, 0.42] }, { punch: 0.3 });
T(V(82), V(85), 'squad fills up', { ...comic, size: 46, y: BOT, color: '#ffe3c2' });
for (let n = 83; n <= 84; n++) { P(V(n), 0.12, 12); A(V(n), 'ding', 0.45); }
cut(V(85), 'lobby_launch', 1.2, { fit: 'cover', zoom: [1.05, 1.25], focus: [0.5, 0.6] }, { punch: 0.3 });
T(V(85), V(88), 'ROOM FULL', { size: 124, y: TOP, color: '#ffb02e', shakeText: true });
A(V(87), 'riser', 0.8);
cut(V(88), 'boss4_fight', 6.0, { fit: 'cover', zoom: [1.0, 1.15], focus: [0.5, 0.6] }, { punch: 0.5 });
boosts.push([V(88), V(89)]);
F(V(88), '#fff', 1, 0.25); A(V(88), 'boom', 1.0); K(V(88), 50);
T(V(88), V(92), 'WATCH THE FLOOR\nTO SENSE\nINCOMING ATTACKS', { size: 76, y: TOP });
E(V(88), V(92), '👀', { size: 150, from: [0.5, 0.8], to: [0.5, 0.77], bounce: true });
cut(V(92), 'raid_top', 1.0, { fit: 'band', zoom: [1.0, 1.15] }, { punch: 0.3 });
T(V(92), V(96), 'BOSS HP SCALES\nWITH THE SQUAD', { size: 88, y: BAND_TOP });
T(V(94), V(96), 'no free carries', { ...comic, size: 44, y: BAND_BOT, color: '#ffe3c2' });
S(V(96), 'boss4_intro', 0, { freeze: 4.5, fit: 'cover', zoom: [1.3, 1.6], focus: [0.5, 0.38] });
ranges.fry.push([V(96), V(98), 1.0]);
ranges.glitch.push([V(96) + 0.3, V(98), 0.9]);
P(V(96), 0.5); A(V(96), 'scratch', 0.9); A(V(97), 'glitch', 0.6);
T(V(96), V(98), 'GOLIATH\nGETS BACK UP', { size: 120, y: 0.5, shakeText: true });
E(V(96), V(98), '💀', { size: 170, from: [0.5, 0.78], to: [0.5, 0.72], spin: 5 });

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
  shots, overlays, punches, shakes, flashes, audio, boosts, fades, ranges,
};
