// THE SHORT — a 9:16, ~34 s recut for Shorts / TikTok / Reels.
//
// It starts the music at 20.04 s, which is both a downbeat on the master's
// grid (B(32)) and the point where the track steps up into its loudest
// stretch. So local time 0 is a downbeat, the first frame lands on a kick,
// and the beat grid here is simply V(n) = n · BEAT.
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
const I = (t0, t1, src, opts = {}) => overlays.push({ type: 'image', t0, t1, src, ...opts });
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
// Captions live in the top and bottom sixths, clear of the subject in a
// cover crop and clear of the band in a banded shot. BOT stays above the
// bottom fifth, which is where TikTok and Reels paint their own furniture.
const TOP = 0.175, BOT = 0.79, BAND_TOP = 0.2, BAND_EMOJI = [0.84, 0.285];

/* ── 0:00 the hook: GOLIATH, and the thing no other VR game can say ────── */
cut(V(0), 'boss4_fight', 3.5, { fit: 'cover', zoom: [1.16, 1.02], focus: [0.5, 0.42] }, { punch: 0.45, click: false });
F(V(0), '#fff', 0.9, 0.3); K(V(0), 45); A(V(0), 'boom', 1.0);
T(V(0), V(4), 'NO DOWNLOAD', { size: 132, y: TOP, glow: 'rgba(255,60,20,0.9)', wobble: true });
T(V(2), V(4), 'it opens in your browser', { ...comic, size: 42, y: BOT, color: '#ffe3c2' });

/* ── 0:01.9 fireballs, and one to the face ─────────────────────────────── */
cut(V(4), 'bout', 8.4, { fit: 'cover', zoom: [1.08, 1.28], focus: [0.5, 0.55] }, { punch: 0.3 });
T(V(4), V(8), 'THROW FIREBALLS', { size: 100, y: TOP, glow: 'rgba(255,120,20,0.9)' });
E(V(4), V(8), '🔥', { size: 150, from: [0.14, 0.29], to: [0.14, 0.27], pulse: true });
E(V(4), V(8), '🔥', { size: 150, from: [0.86, 0.29], to: [0.86, 0.27], pulse: true });
// the bot's ball lands on us a beat and a bit into the shot
F(2.98, '#ff1a00', 0.6, 0.22); K(2.98, 55); A(2.98, 'hit', 0.95); P(2.98, 0.3, 12);
T(2.98, V(8), 'OW', { size: 150, y: 0.63, color: '#ff3b1f', shakeText: true });
E(2.98, V(8), '💀', { size: 170, from: [0.74, 0.72], to: [0.78, 0.64], spin: 5 });

/* ── 0:03.8 paint him ──────────────────────────────────────────────────── */
cut(V(8), 'paint_build', 3.4, { fit: 'cover', zoom: [1.2, 1.35], focus: [0.44, 0.55] }, { punch: 0.32 });
A(V(8), 'cash', 0.9);
T(V(8), V(12), 'PAINT YOUR GUY', { size: 104, y: TOP });
E(V(8), V(12), '🎨', { size: 140, from: [0.83, 0.29], to: [0.83, 0.27], spin: 1.2 });
for (let n = 9; n <= 11; n++) { P(V(n), 0.12, 12); A(V(n), 'click', 0.3); }
cut(V(12), 'paint_orbit', 1.4, { fit: 'cover', zoom: [1.15, 1.3], focus: [0.5, 0.55] }, { punch: 0.3 });
A(V(12), 'ding', 0.8);
T(V(12), V(16), "HE'S BEAUTIFUL", { size: 100, y: TOP });
E(V(12), V(16), '😭', { size: 160, from: [0.8, 0.76], to: [0.8, 0.73], bounce: true });

/* ── 0:07.6 twenty-four people in one room ─────────────────────────────── */
cut(V(16), 'rave_countin', 3.0, { fit: 'band', zoom: [1.0, 1.08] }, { punch: 0.5 });
boosts.push([V(16), V(17)]);
F(V(16), '#fff', 1, 0.25); A(V(16), 'boom', 1.0); K(V(16), 45);
ranges.strobe.push([V(16), V(28), 2.1]);
T(V(16), V(20), '24 PLAYER\nRAVE', { size: 130, y: BAND_TOP, glow: 'rgba(255,60,220,0.9)' });
E(V(16), V(20), '🪩', { size: 155, from: BAND_EMOJI, to: [BAND_EMOJI[0], BAND_EMOJI[1] - 0.015], spin: 3 });
cut(V(20), 'rave_sky', 2.0, { fit: 'band', zoom: [1.0, 1.1] }, { punch: 0.3 });
T(V(20), V(24), 'a whole rhythm game, inside', { ...comic, size: 42, y: 0.72, color: '#ffe3c2' });
cut(V(24), 'rave_top', 1.0, { fit: 'cover', zoom: [1.0, 1.15] }, { punch: 0.45 });
T(V(24), V(28), 'TWENTY FOUR', { size: 122, y: TOP });
A(V(22), 'riser', 0.7);

/* ── 0:13.3 the titans ─────────────────────────────────────────────────── */
cut(V(28), 'boss4_intro', 3.4, { fit: 'cover', zoom: [1.0, 1.25], focus: [0.5, 0.42] }, { punch: 0.5 });
boosts.push([V(28), V(29)]);
F(V(28), '#ff1a00', 0.9, 0.35); A(V(28), 'boom', 1.0); K(V(28), 55);
ranges.glitch.push([V(28), V(28) + 0.25, 1]);
T(V(28), V(32), '5 TITANS', { size: 140, y: TOP, glow: 'rgba(255,40,20,0.9)', shakeText: true });
T(V(30), V(32), 'big and scary', { ...comic, size: 44, y: BOT, color: '#ffe3c2' });
cut(V(32), 'boss4_fight', 6.0, { fit: 'cover', zoom: [1.0, 1.14], focus: [0.5, 0.42] }, { punch: 0.3 });
cut(V(34), 'boss2_intro', 3.2, { fit: 'cover', zoom: [1.05, 1.2], focus: [0.5, 0.42] }, { punch: 0.3 });
cut(V(36), 'boss0_intro', 3.5, { fit: 'cover', zoom: [1.05, 1.2], focus: [0.5, 0.42] }, { punch: 0.3 });
T(V(36), V(40), 'GATES. LASERS.', { size: 96, y: TOP });
cut(V(38), 'boss3_intro', 3.3, { fit: 'cover', zoom: [1.05, 1.2], focus: [0.5, 0.42] }, { punch: 0.3 });
ranges.chroma.push([V(36), V(40), 0.8]);
A(V(38), 'riser', 0.7);

/* ── 0:19.0 five players, one GOLIATH ──────────────────────────────────── */
cut(V(40), 'raid_top', 1.0, { fit: 'band', zoom: [1.0, 1.18] }, { punch: 0.5 });
boosts.push([V(40), V(41)]);
F(V(40), '#ff1a00', 0.9, 0.3); A(V(40), 'boom', 1.0); K(V(40), 50);
T(V(40), V(44), '5 PLAYER\nRAIDS', { size: 132, y: BAND_TOP, glow: 'rgba(255,60,20,0.9)' });
E(V(40), V(44), '🗿', { size: 155, from: BAND_EMOJI, to: [BAND_EMOJI[0], BAND_EMOJI[1] - 0.015], pulse: true });
cut(V(44), 'raid_sky', 5.0, { fit: 'cover', zoom: [1.0, 1.16], focus: [0.5, 0.45] }, { punch: 0.3 });
T(V(44), V(48), 'he is so big', { ...comic, size: 46, y: BOT, color: '#ffe3c2' });

/* ── 0:22.9 and a club to launch it all from ───────────────────────────── */
cut(V(48), 'club_face0', 0.6, { fit: 'cover', zoom: [1.05, 1.25], focus: [0.5, 0.45] }, { punch: 0.35 });
A(V(48), 'boom', 0.8);
T(V(48), V(52), 'AND A CLUB', { size: 126, y: TOP, glow: 'rgba(80,200,255,0.9)' });
E(V(48), V(52), '🍸', { size: 140, from: [0.83, 0.29], to: [0.83, 0.27], spin: 0.8 });
cut(V(50), 'club_low', 1.0, { fit: 'band', zoom: [1.0, 1.1] }, { punch: 0.3 });

/* ── 0:24.8 the overload, half a beat each ─────────────────────────────── */
const half = [['rave_close', 2.0], ['bout', 19.3], ['boss4_fight', 8.4], ['rave_top', 3.0],
  ['raid_sky', 2.0], ['paint_face', 2.0], ['club_cctv', 1.0], ['raid_fp', 5.0]];
half.forEach(([c, s], i) => cut(V(52) + i * BEAT / 2, c, s, { fit: 'cover', zoom: [1.05, 1.22] }, { punch: 0.22 }));
ranges.chroma.push([V(52), V(56), 0.8]);
ranges.grain.push([V(52), V(56), 0.14]);
A(V(52), 'riser', 0.8);

/* ── 0:26.7 BRUH ───────────────────────────────────────────────────────── */
S(V(56), 'boss4_intro', 0, { freeze: 4.5, fit: 'cover', zoom: [1.3, 1.7], focus: [0.5, 0.38] });
ranges.fry.push([V(56), V(58), 1.0]);
ranges.glitch.push([V(56) + 0.3, V(58), 0.9]);
P(V(56), 0.5); A(V(56), 'scratch', 0.9); A(V(57), 'glitch', 0.6);
T(V(56), V(58), 'BRUH', { size: 210, y: 0.5, shakeText: true });

/* ── 0:27.6 the drop, then the sign ────────────────────────────────────── */
S(V(58), null, 0, { type: 'black' });
F(V(58), '#fff', 1, 0.15); A(V(58), 'drop', 1.0); A(V(58), 'boom', 1.0);
S(V(59), null, 0, { type: 'logo', fadeIn: 1.2, fadeOutAt: 32.6, logoY: 0.44 });
A(V(59) + 0.3, 'ignite', 0.5);
T(29.6, 33.6, 'ff2.web.app', { font: 'Segoe UI', weight: '600', size: 64, y: 0.60, stroke: false, fadeIn: 0.7, fadeOut: 1.0, spacing: '0.16em', color: '#ffffff' });
T(30.6, 33.6, 'free  ·  no download  ·  quest browser', { font: 'Segoe UI', weight: '400', size: 30, y: 0.655, stroke: false, fadeIn: 0.7, fadeOut: 1.0, spacing: '0.1em', color: '#9aa0a8' });
fades.push({ t0: 32.9, t1: 33.6, to: 'black' });

export const TL = {
  DUR: 33.6,
  // 20.04 s in: a downbeat, and where the track gets loud.
  musicOffset: 20.04,
  musicGain: 0.9,
  musicFade: [31.2, 2.4],
  shots, overlays, punches, shakes, flashes, audio, boosts, fades, ranges,
};
