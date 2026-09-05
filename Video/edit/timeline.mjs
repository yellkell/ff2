// THE EDIT — one timeline read by the compositor (browser) and the audio
// mixer (node). Times in seconds; the track is ~126 BPM with the first strong
// downbeat at 4.80 s, so everything hangs off B(n) = beats from that anchor.
export const BEAT = 0.47625;
export const B = (n) => +(4.8 + n * BEAT).toFixed(4);

const shots = [];
const overlays = [];
const punches = [];
const shakes = [];
const flashes = [];
const audio = [];
const boosts = [];
const fades = [];
const ranges = { fry: [], chroma: [], strobe: [], invert: [], glitch: [], grain: [] };

/** A shot starting at t. */
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

/* ── 0:00 yellkell.com presents ────────────────────────────────────────── */
S(0, 'intro', 0.45, { vignette: false });

/* ── 0:02.9 title slam on the kick ─────────────────────────────────────── */
S(B(-4), 'lobby_sign', 1.0, { zoom: [1.18, 1.0] });
F(B(-4), '#fff', 1, 0.3); P(B(-4), 0.45); K(B(-4), 40); A(B(-4), 'boom', 1.0);
T(B(-4), B(0), 'FIRE FIGHT 2', { size: 150, wobble: true, y: 0.5, glow: 'rgba(255,60,20,0.9)' });
E(B(-4), B(0), '🔥', { size: 150, from: [0.13, 0.5], to: [0.1, 0.5], spin: 2.5 });
E(B(-4), B(0), '🔥', { size: 150, from: [0.87, 0.5], to: [0.9, 0.5], spin: -2.5 });
T(B(-2), B(0), 'the trailer', { ...comic, size: 46, y: 0.68, color: '#ffe3c2' });

/* ── 0:04.8 THE BLANK ───────────────────────────────────────────────────── */
cut(B(0), 'paint_blank', 0.3, { zoom: [1.35, 1.5], focus: [0.42, 0.55] }, { punch: 0.35 });
A(B(0), 'boom', 0.9);
T(B(0), B(3), 'THIS IS YOU', { size: 110, y: 0.2 });
E(B(1), B(4), '🗿', { size: 120, from: [0.72, 0.5], to: [0.72, 0.48], pulse: true });
T(B(2), B(4), '(he is blank)', { ...comic, size: 40, y: 0.85, color: '#ffe3c2' });

/* ── 0:06.7 PAINT HIM ───────────────────────────────────────────────────── */
cut(B(4), 'paint_build', 0.2, { zoom: [1.75, 1.95], focus: [0.43, 0.55] }, { punch: 0.3 });
A(B(4), 'cash', 0.9);
T(B(4), B(7), 'PAINT HIM', { size: 120, y: 0.2 });
E(B(4), B(8), '🎨', { size: 110, from: [0.85, 0.25], to: [0.85, 0.22], spin: 1.2 });
for (let n = 5; n <= 11; n++) { P(B(n), 0.12, 12); A(B(n), 'click', 0.3); }
T(B(8), B(10), 'STRIPES.', { size: 90, y: 0.2, x: 0.5 });
T(B(10), B(12), 'SPLOTCHES.', { size: 90, y: 0.2, x: 0.5 });
T(B(9), B(12), 'dots. squares. whatever bro', { ...comic, size: 38, y: 0.86, color: '#ffe3c2' });

/* ── 0:10.5 he's beautiful ─────────────────────────────────────────────── */
cut(B(12), 'paint_orbit', 0.8, { zoom: [1.35, 1.55], focus: [0.5, 0.55] }, { punch: 0.3 });
A(B(12), 'ding', 0.8);
T(B(12), B(14), "HE'S BEAUTIFUL", { size: 100, y: 0.18 });
E(B(12), B(14), '😭', { size: 130, from: [0.85, 0.75], to: [0.85, 0.72], bounce: true });
cut(B(14), 'paint_face', 1.2, { zoom: [1.3, 2.1], focus: [0.5, 0.5] }, { punch: 0.35 });
ranges.fry.push([B(14), B(16), 1.0]);
A(B(14), 'boom', 0.7);
T(B(14), B(16), 'LOOK AT HIM', { size: 120, y: 0.5, shakeText: true, color: '#ff3b1f' });

/* ── 0:12.4 FIREBALLS — the countdown, the throws ──────────────────────── */
cut(B(16), 'bout', 4.0, { zoom: [1.0, 1.05], handheld: true }, { punch: 0.3 });
I(B(16), B(17), '/src/assets/countdown/3.png', { w: 0.28, y: 0.42 }); A(B(16), 'three', 1.0);
I(B(17), B(18), '/src/assets/countdown/2.png', { w: 0.28, y: 0.42 }); A(B(17), 'two', 1.0);
I(B(18), B(19), '/src/assets/countdown/1.png', { w: 0.28, y: 0.42 }); A(B(18), 'one', 1.0);
I(B(19), B(20), '/src/assets/countdown/fight.png', { w: 0.6, y: 0.42, shakeText: true }); A(B(19), 'fight', 1.0); A(B(19), 'airhorn', 0.8);
F(B(19), '#fff', 0.9, 0.2); P(B(19), 0.5); K(B(19), 45);
cut(B(20), 'bout', 8.8, { zoom: [1.05, 1.25], handheld: true }, { punch: 0.3 });
T(B(20), B(23), 'FIREBALLS', { size: 120, y: 0.18, glow: 'rgba(255,120,20,0.9)' });
E(B(20), B(23), '🔥', { size: 110, from: [0.12, 0.2], to: [0.12, 0.18], pulse: true });
E(B(20), B(23), '🔥', { size: 110, from: [0.88, 0.2], to: [0.88, 0.18], pulse: true });
// the incoming ball lands ~15.0
F(15.0, '#ff1a00', 0.75, 0.3); K(15.0, 55); A(15.0, 'hit', 0.9); P(15.0, 0.3, 12);
T(15.0, B(23), 'OW', { size: 130, y: 0.55, color: '#ff3b1f', shakeText: true });
E(15.0, B(23), '💀', { size: 140, from: [0.7, 0.6], to: [0.75, 0.4], spin: 6 });
cut(B(23), 'bout', 11.35, { zoom: [1.0, 1.15], handheld: true }, { punch: 0.3 });
A(B(23), 'whoosh', 0.6);
cut(B(25), 'bout', 16.05, { rate: 0.4, zoom: [1.15, 1.3], focus: [0.5, 0.5] }, { punch: 0.25 });
ranges.chroma.push([B(25), B(27), 1.2, 3]);
A(B(25), 'whoosh', 0.7, { pitch: 0.7 });
T(B(25), B(27), 'slow mo (for the sauce)', { ...comic, size: 42, y: 0.85, color: '#ffe3c2' });
cut(B(27), 'bout', 19.1, { zoom: [1.0, 1.2], handheld: true }, { punch: 0.3 });
F(18.2, '#ff1a00', 0.75, 0.3); K(18.2, 55); A(18.2, 'hit', 0.9);
E(18.2, B(29), '💀', { size: 160, from: [0.5, 0.5], to: [0.5, 0.35], spin: -5 });
cut(B(29), 'bout', 21.65, { zoom: [1.0, 1.2], handheld: true }, { punch: 0.3 });
T(B(29), B(32), 'THROW HANDS', { size: 120, y: 0.2 });
T(B(30), B(32), '(literally)', { ...comic, size: 46, y: 0.34, color: '#ffe3c2' });
A(B(28), 'riser', 0.7);

/* ── 0:20.0 THE BOSSES (the lift) ──────────────────────────────────────── */
cut(B(32), 'boss0_intro', 1.2, { zoom: [1.0, 1.3], focus: [0.5, 0.45] }, { punch: 0.5 });
boosts.push([B(32), B(34)]);
F(B(32), '#ff1a00', 0.9, 0.35); K(B(32), 60); A(B(32), 'boom', 1.0);
ranges.glitch.push([B(32), B(32) + 0.25, 1]);
T(B(32), B(36), 'THE BOSSES', { size: 130, y: 0.18, glow: 'rgba(255,40,20,0.9)', shakeText: true });
cut(B(34), 'boss1_intro', 3.2, { zoom: [1.05, 1.3], focus: [0.5, 0.45] }, { punch: 0.35 });
cut(B(36), 'boss2_intro', 3.2, { zoom: [1.05, 1.3], focus: [0.5, 0.45] }, { punch: 0.35 });
T(B(36), B(40), 'big and scary', { ...comic, size: 44, y: 0.86, color: '#ffe3c2' });
cut(B(38), 'boss3_intro', 3.2, { zoom: [1.05, 1.3], focus: [0.5, 0.45] }, { punch: 0.35 });
cut(B(40), 'boss4_intro', 3.4, { zoom: [1.0, 1.4], focus: [0.5, 0.35] }, { punch: 0.45 });
A(B(40), 'boom', 1.0); K(B(40), 30);
T(B(41), B(44), 'GOLIATH', { size: 130, y: 0.8, glow: 'rgba(255,200,40,0.9)' });
E(B(41), B(44), '👑', { size: 120, from: [0.5, 0.12], to: [0.5, 0.1], pulse: true });
cut(B(44), 'boss4_fight', 6.0, { zoom: [1.0, 1.15], focus: [0.5, 0.4] }, { punch: 0.3 });
T(B(44), B(48), 'EASY TO BLAZING\nDIFFICULTY', { size: 92, y: 0.5 });
E(B(44), B(48), '🥵', { size: 150, from: [0.85, 0.75], to: [0.85, 0.72], pulse: true });
cut(B(46), 'boss3_fight', 4.0, { zoom: [1.0, 1.15] }, { punch: 0.3 });

/* ── 0:27.7 BRO. + the telegraph strobe ────────────────────────────────── */
S(B(48), 'raid_low', 0, { freeze: 3.0, zoom: [1.3, 1.5], focus: [0.5, 0.35] });
ranges.fry.push([B(48), B(49), 0.9]);
P(B(48), 0.6); A(B(48), 'scratch', 0.9);
T(B(48), B(49), 'BRO', { size: 190, y: 0.5, shakeText: true });
E(B(48), B(49), '💀', { size: 150, from: [0.8, 0.5], to: [0.8, 0.5], pop: true });
const strobeCuts = [['boss0_fight', 3.5], ['boss1_orbit', 0.4], ['boss2_fight', 3.5], ['boss3_orbit', 0.4], ['boss4_fight', 3.5], ['boss1_fight', 7.0], ['boss4_fight', 8.4]];
strobeCuts.forEach(([c, s], i) => cut(B(49 + i), c, s, { zoom: [1.0, 1.12] }, { punch: 0.25 }));
ranges.chroma.push([B(53), B(56), 0.8]);
T(B(50), B(54), 'GATES. LASERS. THE DONUT.', { size: 72, y: 0.18 });
T(B(54), B(56), 'move your feet 🦶', { ...comic, size: 44, y: 0.86, color: '#ffe3c2' });
A(B(52), 'riser', 0.7);

/* ── 0:31.5 THE CLUB ───────────────────────────────────────────────────── */
cut(B(56), 'club_walk', 0.8, { zoom: [1.0, 1.08] }, { punch: 0.4 });
boosts.push([B(56), B(57)]);
F(B(56), '#fff', 0.8, 0.25); A(B(56), 'boom', 1.0); K(B(56), 35);
T(B(56), B(60), 'THE CLUB', { size: 140, y: 0.2, glow: 'rgba(80,200,255,0.9)' });
E(B(56), B(60), '🍸', { size: 120, from: [0.85, 0.22], to: [0.85, 0.2], spin: 0.8 });
cut(B(60), 'club_cctv', 1.0, { zoom: [1.0, 1.1] }, { punch: 0.3 });
T(B(60), B(62), "everyone's here", { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
cut(B(62), 'club_pan', 2.5, { zoom: [1.0, 1.08] }, { punch: 0.25 });
cut(B(64), 'club_face0', 0.6, { zoom: [1.1, 1.35], focus: [0.5, 0.45] }, { punch: 0.35 });
T(B(64), B(68), 'WITH THEIR PAINTINGS', { size: 78, y: 0.15 });
E(B(64), B(68), '🎨', { size: 100, from: [0.9, 0.16], to: [0.9, 0.14], spin: 1.5 });
cut(B(66), 'club_face1', 0.6, { zoom: [1.1, 1.35], focus: [0.5, 0.45] }, { punch: 0.35 });
cut(B(68), 'club_face2', 0.6, { zoom: [1.1, 1.3], focus: [0.5, 0.45] }, { punch: 0.35 });
cut(B(69), 'club_face3', 0.8, { zoom: [1.1, 1.3], focus: [0.5, 0.45] }, { punch: 0.35 });
T(B(68), B(72), 'look at these guys', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
cut(B(70), 'club_low', 1.0, { zoom: [1.0, 1.1] }, { punch: 0.3 });
A(B(68), 'riser', 0.7);

/* ── 0:39.1 24 PLAYER RAVE RAID ────────────────────────────────────────── */
cut(B(72), 'rave_countin', 3.0, { zoom: [1.0, 1.15] }, { punch: 0.5 });
boosts.push([B(72), B(73)]);
F(B(72), '#fff', 1, 0.25); A(B(72), 'boom', 1.0); K(B(72), 45);
ranges.strobe.push([B(72), B(88), 2.1]);
T(B(72), B(76), '24 PLAYER\nRAVE RAID', { size: 104, y: 0.5, glow: 'rgba(255,60,220,0.9)' });
E(B(72), B(76), '🪩', { size: 150, from: [0.85, 0.75], to: [0.85, 0.7], spin: 3 });
cut(B(74), 'rave_fp', 1.0, { zoom: [1.0, 1.1], handheld: true }, { punch: 0.3 });
cut(B(76), 'rave_sky', 1.5, { zoom: [1.0, 1.1] }, { punch: 0.35 });
T(B(77), B(80), 'a whole rhythm game. inside.', { ...comic, size: 44, y: 0.86, color: '#ffe3c2' });
cut(B(80), 'rave_top', 1.0, { zoom: [1.0, 1.15] }, { punch: 0.45 });
cut(B(82), 'rave_close', 1.5, { zoom: [1.0, 1.1] }, { punch: 0.3 });
cut(B(84), 'rave_sky', 6.5, { zoom: [1.05, 1.0] }, { punch: 0.3 });
T(B(84), B(87), 'TWENTY. FOUR.', { size: 120, y: 0.5 });
cut(B(87), 'rave_stage', 1.0, { zoom: [1.1, 1.25], focus: [0.5, 0.45] }, { punch: 0.3 });

/* ── 0:46.7 5 PLAYER FINAL BOSS ────────────────────────────────────────── */
cut(B(88), 'raid_top', 1.0, { zoom: [1.0, 1.18] }, { punch: 0.5 });
boosts.push([B(88), B(89)]);
F(B(88), '#ff1a00', 0.9, 0.3); A(B(88), 'boom', 1.0); K(B(88), 50);
T(B(88), B(92), '5 PLAYER\nFINAL BOSS', { size: 104, y: 0.5, glow: 'rgba(255,60,20,0.9)' });
E(B(88), B(92), '🗿', { size: 150, from: [0.85, 0.75], to: [0.85, 0.7], pulse: true });
cut(B(90), 'raid_fp', 0.6, { zoom: [1.0, 1.1], handheld: true }, { punch: 0.3 });
F(48.98, '#ff1a00', 0.8, 0.3); K(48.98, 55); A(48.98, 'hit', 0.9);
T(48.98, B(93), 'OW', { size: 110, y: 0.6, color: '#ff3b1f', shakeText: true });
cut(B(93), 'raid_low', 1.5, { zoom: [1.0, 1.2], focus: [0.5, 0.3] }, { punch: 0.3 });
T(B(93), B(96), 'he is so big', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
cut(B(96), 'raid_sky', 1.0, { zoom: [1.05, 1.0] }, { punch: 0.35 });
A(B(96), 'boom', 0.8);
T(B(96), B(99), 'GOLIATH.', { size: 96, y: 0.82, fadeOut: 0.3 });
cut(B(100), 'raid_wide', 1.0, { zoom: [1.0, 1.1] }, { punch: 0.25 });
cut(B(102), 'raid_behind', 1.0, { zoom: [1.0, 1.12] }, { punch: 0.3 });
T(B(102), B(104), 'bring 4 friends (or 4 enemies)', { ...comic, size: 42, y: 0.86, color: '#ffe3c2' });

/* ── 0:54.3 THE MONTAGE ────────────────────────────────────────────────── */
const montage = [['raid_sky', 7.0], ['bout', 4.85], ['boss3_intro', 3.3], ['rave_close', 4.0], ['club_low', 3.0], ['paint_orbit', 3.0], ['boss4_intro', 6.6], ['raid_top', 4.0]];
montage.forEach(([c, s], i) => cut(B(104 + i), c, s, { zoom: [1.0, 1.18] }, { punch: 0.35 }));
A(B(104), 'boom', 0.9);
E(B(104), B(106), '🔥', { size: 160, from: [-0.1, 0.75], to: [1.1, 0.25], spin: 8, pop: false });
E(B(106), B(108), '💀', { size: 160, from: [1.1, 0.7], to: [-0.1, 0.3], spin: -8, pop: false });
E(B(108), B(110), '🗿', { size: 160, from: [-0.1, 0.3], to: [1.1, 0.7], spin: 8, pop: false });
E(B(110), B(112), '🪩', { size: 160, from: [1.1, 0.3], to: [-0.1, 0.7], spin: -8, pop: false });
T(B(105), B(106), 'FIREBALLS', { size: 90, y: 0.2 });
T(B(106), B(107), 'BOSSES', { size: 90, y: 0.2 });
T(B(107), B(108), 'RAVES', { size: 90, y: 0.2 });
T(B(108), B(109), 'THE CLUB', { size: 90, y: 0.2 });
T(B(109), B(110), 'DRIP', { size: 90, y: 0.2 });
T(B(110), B(112), 'GOLIATH', { size: 90, y: 0.2 });

/* ── 0:58.1 the overload: half-beat cuts, then BRUH ────────────────────── */
const half = [['rave_top', 3.0], ['boss0_orbit', 0.5], ['raid_fp', 5.0], ['club_face1', 1.5], ['bout', 9.15], ['boss3_fight', 5.0], ['rave_sky', 8.0], ['paint_face', 2.0], ['raid_low', 3.0], ['boss1_fight', 4.0], ['club_cctv', 2.0], ['rave_fp', 4.0]];
half.forEach(([c, s], i) => cut(B(112) + i * BEAT / 2, c, s, { zoom: [1.05, 1.2] }, { punch: 0.2, click: true }));
ranges.chroma.push([B(112), B(120), 0.8]);
ranges.grain.push([B(112), B(120), 0.14]);
A(B(116), 'riser', 0.8);
S(B(118), 'boss4_intro', 0, { freeze: 4.5, zoom: [1.3, 1.8], focus: [0.5, 0.3] });
ranges.fry.push([B(118), B(120), 1.0]);
ranges.glitch.push([B(118) + 0.3, B(120), 0.9]);
P(B(118), 0.5); A(B(118), 'scratch', 0.9); A(B(119), 'glitch', 0.6);
T(B(118), B(120), 'BRUH', { size: 200, y: 0.5, shakeText: true });

/* ── 1:01.95 the drop → the sign ───────────────────────────────────────── */
S(B(120), null, 0, { type: 'black' });
F(B(120), '#fff', 1, 0.15); A(B(120), 'drop', 1.0); A(B(120), 'boom', 1.0);
S(B(121), null, 0, { type: 'logo', fadeIn: 1.4, fadeOutAt: 68.8 });
A(B(121) + 0.3, 'ignite', 0.5);
T(64.3, 70.0, 'ff2.web.app', { font: 'Segoe UI', weight: '600', size: 50, y: 0.83, stroke: false, fadeIn: 0.8, fadeOut: 1.2, spacing: '0.18em', color: '#ffffff' });
T(65.8, 70.0, "in your headset's browser", { font: 'Segoe UI', weight: '400', size: 26, y: 0.9, stroke: false, fadeIn: 0.8, fadeOut: 1.2, spacing: '0.12em', color: '#9aa0a8' });
fades.push({ t0: 69.3, t1: 70.0, to: 'black' });

export const TL = {
  DUR: 70.0,
  musicOffset: 0,
  musicGain: 0.9,
  musicFade: [67.6, 2.4],
  shots, overlays, punches, shakes, flashes, audio, boosts, fades, ranges,
};
