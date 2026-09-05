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

/* ── 0:00 cold open ────────────────────────────────────────────────────── */
cut(V(0), 'crowd_sky', 3.0, { fit: 'band', zoom: [1.2, 1.05] }, { punch: 0.5, click: false });
F(V(0), '#fff', 0.9, 0.3); K(V(0), 45); A(V(0), 'boom', 1.0);
T(V(0), V(4), 'DID YOU\nKNOW', { size: 150, y: 0.5, glow: 'rgba(255,122,24,0.9)', wobble: true });
E(V(0), V(4), '🤔', { size: 160, from: [0.5, 0.78], to: [0.5, 0.76], bounce: true });
A(V(2), 'riser', 0.6);

/* ── 0:01.9 FACT 1 — the disco ball ────────────────────────────────────── */
cut(V(4), 'desk_close', 0.8, { fit: 'cover', zoom: [1.0, 1.12], focus: [0.5, 0.55] }, { punch: 0.4 });
F(V(4), '#ff1a00', 0.7, 0.25); A(V(4), 'boom', 1.0);
DYK(V(4), V(30));
T(V(4), V(8), 'YOU HOST GAMES\nFROM THE CLUB', { size: 92, y: TOP });
T(V(6), V(8), 'pick a fight', { ...comic, size: 46, y: BOT, color: '#ffe3c2' });
cut(V(8), 'desk_close', 2.6, { fit: 'cover', zoom: [1.15, 1.35], focus: [0.5, 0.56] }, { punch: 0.3 });
T(V(8), V(12), 'PRESS HOST', { size: 124, y: TOP, glow: 'rgba(255,60,220,0.9)' });
E(V(8), V(12), '👇', { size: 140, from: [0.5, 0.36], to: [0.5, 0.4], bounce: true });
A(V(10), 'ding', 0.7);
cut(V(12), 'ball_drop', 2.4, { fit: 'cover', zoom: [1.0, 1.1], focus: [0.5, 0.5] }, { punch: 0.5 });
boosts.push([V(12), V(13)]);
F(V(12), '#fff', 1, 0.25); A(V(12), 'boom', 1.0); K(V(12), 45);
T(V(12), V(18), 'A DISCO BALL\nDROPS', { size: 110, y: TOP, glow: 'rgba(120,200,255,0.9)' });
E(V(12), V(18), '🪩', { size: 150, from: [0.85, 0.3], to: [0.85, 0.285], spin: 3 });
cut(V(18), 'ball_join', 1.2, { fit: 'cover', zoom: [1.05, 1.2], focus: [0.5, 0.72] }, { punch: 0.3 });
T(V(18), V(23), 'YOUR FRIENDS\nTOUCH IT', { size: 100, y: TOP });
T(V(20), V(23), 'their names go up on the ball', { ...comic, size: 42, y: BOT, color: '#ffe3c2' });
for (let n = 19; n <= 22; n++) { P(V(n), 0.12, 12); A(V(n), 'click', 0.3); }
cut(V(23), 'ball_plate', 0.5, { fit: 'cover', zoom: [1.0, 1.15], focus: [0.5, 0.55] }, { punch: 0.3 });
T(V(23), V(26), 'HIT START', { size: 124, y: TOP, glow: 'rgba(255,60,220,0.9)' });
cut(V(26), 'ball_deal', 3.3, { fit: 'cover', zoom: [1.0, 1.08] }, { punch: 0.45 });
F(V(26), '#fff', 1, 0.2); A(V(26), 'drop', 0.9);
T(V(27), V(30), 'AND EVERYONE\nGOES TOGETHER', { size: 96, y: 0.5, shakeText: true });
E(V(27), V(30), '🚀', { size: 160, from: [0.5, 0.8], to: [0.5, 0.74], bounce: true });

/* ── 0:14.3 FACT 2 — the crowd ─────────────────────────────────────────── */
cut(V(30), 'ball_deal', 10.3, { fit: 'cover', pan: [-0.25, 0], zoom: [1.0, 1.15], focus: [0.5, 0.4] }, { punch: 0.45 });
boosts.push([V(30), V(31)]);
F(V(30), '#ff1a00', 0.8, 0.3); A(V(30), 'fight', 1.0); A(V(30), 'airhorn', 0.8); K(V(30), 40);
cut(V(32), 'crowd_fp', 1.0, { fit: 'cover', zoom: [1.0, 1.12] }, { punch: 0.35 });
DYK(V(32), V(52));
T(V(32), V(36), 'PEOPLE CAN\nWATCH', { size: 116, y: TOP, glow: 'rgba(255,122,24,0.9)' });
cut(V(36), 'crowd_look', 1.6, { fit: 'band', zoom: [1.0, 1.15] }, { punch: 0.3 });
T(V(36), V(40), 'the terrace is real', { ...comic, size: 46, y: BAND_BOT, color: '#ffe3c2' });
E(V(36), V(40), '👀', { size: 150, from: [0.5, BAND_TOP + 0.02], to: [0.5, BAND_TOP], bounce: true });
cut(V(40), 'crowd_rail', 1.5, { fit: 'band', zoom: [1.0, 1.1] }, { punch: 0.3 });
T(V(40), V(44), "FIGHTERS CAN'T\nHEAR YOU", { size: 92, y: BAND_TOP });
E(V(40), V(44), '🤫', { size: 150, from: [0.5, BAND_BOT], to: [0.5, BAND_BOT - 0.02], bounce: true });
cut(V(44), 'crowd_bank', 1.5, { fit: 'band', zoom: [1.0, 1.12], focus: [0.4, 0.55] }, { punch: 0.3 });
T(V(44), V(48), 'HANDS UP =\nTHE CROWD ROARS', { size: 88, y: BAND_TOP, glow: 'rgba(255,200,60,0.9)' });
E(V(44), V(48), '🙌', { size: 160, from: [0.5, BAND_BOT + 0.02], to: [0.5, BAND_BOT - 0.03], bounce: true });
cut(V(48), 'lobby_watchchip', 1.0, { fit: 'band', zoom: [1.05, 1.2] }, { punch: 0.35 });
T(V(48), V(52), 'OR JUST HIT WATCH\nON ANY ROOM', { size: 84, y: BAND_TOP });
E(V(48), V(52), '📺', { size: 150, from: [0.5, BAND_BOT], to: [0.5, BAND_BOT - 0.02], bounce: true });
A(V(50), 'riser', 0.7);

/* ── 0:24.8 FACT 3 — raids ─────────────────────────────────────────────── */
cut(V(52), 'raid_sky', 5.0, { fit: 'cover', zoom: [1.0, 1.16], focus: [0.5, 0.45] }, { punch: 0.5 });
boosts.push([V(52), V(53)]);
F(V(52), '#ff1a00', 0.9, 0.35); A(V(52), 'boom', 1.0); K(V(52), 55);
ranges.glitch.push([V(52), V(52) + 0.25, 1]);
DYK(V(52), V(80));
T(V(52), V(56), 'RAIDS ARE\n5 PLAYERS', { size: 118, y: TOP, glow: 'rgba(255,40,20,0.9)', shakeText: true });
cut(V(56), 'lobby_browser', 2.6, { fit: 'cover', zoom: [1.0, 1.12], focus: [0.5, 0.45] }, { punch: 0.3 });
T(V(56), V(60), 'HOST ONE,\nOR JOIN ONE', { size: 100, y: TOP });
cut(V(60), 'lobby_code', 1.5, { fit: 'cover', pan: [0.06, 0], zoom: [1.05, 1.2], focus: [0.45, 0.55] }, { punch: 0.3 });
T(V(60), V(64), 'A CODE. A QR.\nSHARE ON DISCORD.', { size: 80, y: TOP });
E(V(60), V(64), '📱', { size: 140, from: [0.5, 0.8], to: [0.5, 0.77], bounce: true });
cut(V(64), 'lobby_fill', 1.6, { fit: 'cover', zoom: [1.0, 1.12], focus: [0.5, 0.42] }, { punch: 0.3 });
T(V(64), V(67), 'squad fills up', { ...comic, size: 46, y: BOT, color: '#ffe3c2' });
for (let n = 65; n <= 66; n++) { P(V(n), 0.12, 12); A(V(n), 'ding', 0.45); }
cut(V(67), 'lobby_launch', 1.2, { fit: 'cover', zoom: [1.05, 1.25], focus: [0.5, 0.6] }, { punch: 0.3 });
T(V(67), V(70), 'ROOM FULL', { size: 124, y: TOP, color: '#ffb02e', shakeText: true });
A(V(69), 'riser', 0.8);
cut(V(70), 'boss4_fight', 6.0, { fit: 'cover', zoom: [1.0, 1.15], focus: [0.5, 0.6] }, { punch: 0.5 });
boosts.push([V(70), V(71)]);
F(V(70), '#fff', 1, 0.25); A(V(70), 'boom', 1.0); K(V(70), 50);
T(V(70), V(74), 'WATCH THE FLOOR\nTO SENSE\nINCOMING ATTACKS', { size: 76, y: TOP });
E(V(70), V(74), '👀', { size: 150, from: [0.5, 0.8], to: [0.5, 0.77], bounce: true });
cut(V(74), 'raid_top', 1.0, { fit: 'band', zoom: [1.0, 1.15] }, { punch: 0.3 });
T(V(74), V(78), 'BOSS HP SCALES\nWITH THE SQUAD', { size: 88, y: BAND_TOP });
T(V(76), V(78), 'no free carries', { ...comic, size: 44, y: BAND_BOT, color: '#ffe3c2' });
S(V(78), 'boss4_intro', 0, { freeze: 4.5, fit: 'cover', zoom: [1.3, 1.6], focus: [0.5, 0.38] });
ranges.fry.push([V(78), V(80), 1.0]);
ranges.glitch.push([V(78) + 0.3, V(80), 0.9]);
P(V(78), 0.5); A(V(78), 'scratch', 0.9); A(V(79), 'glitch', 0.6);
T(V(78), V(80), 'GOLIATH\nGETS BACK UP', { size: 120, y: 0.5, shakeText: true });
E(V(78), V(80), '💀', { size: 170, from: [0.5, 0.78], to: [0.5, 0.72], spin: 5 });

/* ── 0:38.1 out ────────────────────────────────────────────────────────── */
S(V(80), null, 0, { type: 'black' });
F(V(80), '#fff', 1, 0.15); A(V(80), 'drop', 1.0); A(V(80), 'boom', 1.0);
S(V(81), null, 0, { type: 'logo', fadeIn: 1.2, fadeOutAt: 43.0, logoY: 0.44 });
A(V(81) + 0.3, 'ignite', 0.5);
T(39.9, 44.0, 'now you know', { ...comic, size: 46, y: 0.575, stroke: false, fadeIn: 0.6, fadeOut: 1.0, color: '#ffe3c2' });
T(40.5, 44.0, 'ff2.web.app', { font: 'Segoe UI', weight: '600', size: 64, y: 0.64, stroke: false, fadeIn: 0.7, fadeOut: 1.0, spacing: '0.16em', color: '#ffffff' });
T(41.1, 44.0, "in your headset's browser\nto play instantly - no download", { font: 'Segoe UI', weight: '400', size: 32, y: 0.705, stroke: false, fadeIn: 0.7, fadeOut: 1.0, spacing: '0.06em', color: '#9aa0a8' });
fades.push({ t0: 43.3, t1: 44.0, to: 'black' });

export const TL = {
  DUR: 44.0,
  musicOffset: 20.04,
  musicGain: 0.9,
  musicFade: [41.6, 2.4],
  shots, overlays, punches, shakes, flashes, audio, boosts, fades, ranges,
};
