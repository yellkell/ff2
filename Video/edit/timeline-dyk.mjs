// DID YOU KNOW — three things about FIRE FIGHT 2, in the trailer's voice.
//
//   1. the club hosts everything: press Ⓐ on the floor and the desk comes
//      up; the RAVE tab picks a record, the FIGHT tab a fight or a TITAN
//      RAID with its tier and HARDCORE; HOST drops a DISCO BALL, your
//      friends touch it, START deals everyone across together.
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
const DYK = (t0, t1) => T(t0, t1, 'DID YOU KNOW', { size: 40, x: 0.16, y: 0.09, color: '#ffc07a', glow: 'rgba(255,122,24,0.8)', spacing: '0.06em' });

/* ── 0:00 cold open ────────────────────────────────────────────────────── */
cut(V(0), 'crowd_sky', 3.0, { zoom: [1.25, 1.05] }, { punch: 0.5, click: false });
F(V(0), '#fff', 0.9, 0.3); K(V(0), 45); A(V(0), 'boom', 1.0);
T(V(0), V(4), 'DID YOU KNOW', { size: 150, y: 0.5, glow: 'rgba(255,122,24,0.9)', wobble: true });
E(V(0), V(4), '🤔', { size: 150, from: [0.85, 0.24], to: [0.85, 0.22], bounce: true });
A(V(2), 'riser', 0.6);

/* ── 0:01.9 FACT 1 — the club hosts everything ─────────────────────────── */
// the floor; right Ⓐ; the desk rises in front of you
cut(V(4), 'desk_a', 1.0, { zoom: [1.0, 1.1], focus: [0.5, 0.55] }, { punch: 0.4 });
F(V(4), '#ff1a00', 0.7, 0.25); A(V(4), 'boom', 1.0);
DYK(V(4), V(56));
T(V(4), V(10), 'PRESS 🅰 IN THE CLUB', { size: 92, y: 0.2, glow: 'rgba(255,60,220,0.9)' });
A(V(5) + 0.3, 'ding', 0.8); P(V(5) + 0.3, 0.2, 12);
T(V(7), V(10), 'the desk comes up', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
// RAVE: the record list, and a record picked
cut(V(10), 'desk_rave', 1.4, { zoom: [1.0, 1.12], focus: [0.45, 0.55] }, { punch: 0.35 });
T(V(10), V(16), 'HOST A RAVE', { size: 110, y: 0.2, glow: 'rgba(255,60,220,0.9)' });
E(V(10), V(16), '🎶', { size: 140, from: [0.86, 0.3], to: [0.86, 0.27], bounce: true });
T(V(12), V(16), 'pick a record', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
A(V(11) + 0.2, 'click', 0.5);
cut(V(16), 'desk_rave', 5.4, { zoom: [1.15, 1.35], focus: [0.5, 0.55] }, { punch: 0.3 });
T(V(16), V(19), 'DISCO BALL it is', { ...comic, size: 48, y: 0.86, color: '#ffe3c2' });
A(V(16), 'cash', 0.7);
// HOST: the ball drops wearing the record
cut(V(19), 'desk_rave_host', 0.85, { zoom: [1.0, 1.1] }, { punch: 0.5 });
boosts.push([V(19), V(20)]);
F(V(19), '#fff', 1, 0.25); A(V(19), 'boom', 1.0); K(V(19), 45);
T(V(19), V(21), 'HOST', { size: 150, y: 0.5, glow: 'rgba(255,60,220,0.9)', shakeText: true });
T(V(21), V(24), 'the record rides the ball', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
E(V(21), V(24), '🪩', { size: 150, from: [0.14, 0.7], to: [0.14, 0.66], spin: 3 });
cut(V(24), 'ball_join', 1.2, { zoom: [1.05, 1.2], focus: [0.5, 0.75] }, { punch: 0.3 });
T(V(24), V(29), 'YOUR FRIENDS TOUCH IT', { size: 84, y: 0.21 });
T(V(26), V(29), 'their names go up on the ball', { ...comic, size: 44, y: 0.9, color: '#ffe3c2' });
for (let n = 25; n <= 28; n++) { P(V(n), 0.12, 12); A(V(n), 'click', 0.3); }
// FIGHT: or a fight
cut(V(29), 'desk_close', 0.8, { zoom: [1.05, 1.2], focus: [0.5, 0.55] }, { punch: 0.3 });
T(V(29), V(32), 'OR A FIGHT', { size: 110, y: 0.2 });
E(V(29), V(32), '🥊', { size: 140, from: [0.84, 0.3], to: [0.84, 0.27], bounce: true });
// TITAN RAID: the tier list, BLAZING, HARDCORE
cut(V(32), 'desk_raid', 1.5, { zoom: [1.05, 1.22], focus: [0.47, 0.55] }, { punch: 0.35 });
T(V(32), V(36), 'OR A TITAN RAID', { size: 100, y: 0.2, glow: 'rgba(255,40,20,0.9)' });
A(V(33) + 0.2, 'click', 0.5);
T(V(36), V(39), 'BLAZING', { size: 130, y: 0.5, color: '#ff7a18', glow: 'rgba(255,122,24,0.95)', shakeText: true });
A(V(36), 'ignite', 0.8); P(V(36), 0.3, 12);
T(V(39), V(42), 'HARDCORE', { size: 140, y: 0.5, color: '#ff3b1f', glow: 'rgba(255,40,20,0.95)', shakeText: true });
F(V(39), '#ff1a00', 0.8, 0.3); A(V(39), 'boom', 1.0); K(V(39), 45); P(V(39), 0.4, 12);
ranges.glitch.push([V(39), V(39) + 0.2, 1]);
T(V(40), V(42), 'no healing between titans', { ...comic, size: 44, y: 0.86, color: '#ffe3c2' });
// HOST: the ball wears the raid, hardcore
cut(V(42), 'desk_raid_host', 0.85, { zoom: [1.0, 1.1] }, { punch: 0.5 });
boosts.push([V(42), V(43)]);
F(V(42), '#fff', 1, 0.25); A(V(42), 'boom', 1.0); K(V(42), 45);
T(V(42), V(44), 'HOST', { size: 150, y: 0.5, glow: 'rgba(255,60,220,0.9)', shakeText: true });
T(V(44), V(47), 'hardcore. blazing. on the ball.', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
cut(V(47), 'desk_raid_plate', 0.8, { zoom: [1.0, 1.15], focus: [0.4, 0.5] }, { punch: 0.3 });
T(V(47), V(50), 'HIT START', { size: 120, y: 0.22, glow: 'rgba(255,60,220,0.9)' });
// START → the pit
cut(V(50), 'desk_raid_deal', 2.6, { zoom: [1.0, 1.08] }, { punch: 0.45 });
F(V(50), '#fff', 1, 0.2); A(V(50), 'drop', 0.9);
T(V(52), V(56), 'AND EVERYONE\nGOES TOGETHER', { size: 92, y: 0.5, shakeText: true });
E(V(52), V(56), '🚀', { size: 150, from: [0.85, 0.78], to: [0.85, 0.7], bounce: true });

/* ── 0:26.7 FACT 2 — the crowd ─────────────────────────────────────────── */
cut(V(56), 'ball_deal', 10.3, { zoom: [1.0, 1.15], focus: [0.5, 0.4] }, { punch: 0.45 });
boosts.push([V(56), V(57)]);
F(V(56), '#ff1a00', 0.8, 0.3); A(V(56), 'fight', 1.0); A(V(56), 'airhorn', 0.8); K(V(56), 40);
cut(V(58), 'crowd_fp', 1.0, { zoom: [1.0, 1.12] }, { punch: 0.35 });
DYK(V(58), V(82));
T(V(58), V(62), 'PEOPLE CAN WATCH', { size: 104, y: 0.22, glow: 'rgba(255,122,24,0.9)' });
cut(V(62), 'crowd_look', 1.6, { zoom: [1.0, 1.18], focus: [0.75, 0.5] }, { punch: 0.3 });
T(V(62), V(66), 'the terrace is real', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
E(V(62), V(66), '👀', { size: 140, from: [0.15, 0.28], to: [0.15, 0.25], bounce: true });
cut(V(66), 'crowd_rail', 1.5, { zoom: [1.0, 1.1] }, { punch: 0.3 });
T(V(66), V(70), "FIGHTERS CAN'T HEAR YOU", { size: 84, y: 0.2 });
E(V(66), V(70), '🤫', { size: 140, from: [0.85, 0.72], to: [0.85, 0.68], bounce: true });
cut(V(70), 'crowd_bank', 1.5, { zoom: [1.0, 1.12], focus: [0.4, 0.55] }, { punch: 0.3 });
T(V(70), V(74), 'HANDS UP = THE CROWD ROARS', { size: 74, y: 0.21, glow: 'rgba(255,200,60,0.9)' });
E(V(70), V(74), '🙌', { size: 150, from: [0.5, 0.82], to: [0.5, 0.76], bounce: true });
cut(V(74), 'crowd_sky', 1.0, { zoom: [1.0, 1.15] }, { punch: 0.4 });
A(V(74), 'boom', 0.8);
T(V(74), V(78), 'A 2V2 WITH AN AUDIENCE', { size: 80, y: 0.21 });
T(V(76), V(78), 'the whole club came', { ...comic, size: 46, y: 0.88, color: '#ffe3c2' });
cut(V(78), 'lobby_watchchip', 1.0, { zoom: [1.05, 1.25], focus: [0.52, 0.42] }, { punch: 0.35 });
T(V(78), V(82), 'OR JUST HIT WATCH\nON ANY ROOM', { size: 84, y: 0.78 });
E(V(78), V(82), '📺', { size: 140, from: [0.86, 0.24], to: [0.86, 0.21], bounce: true });
A(V(80), 'riser', 0.7);

/* ── 0:39.1 FACT 3 — raids ─────────────────────────────────────────────── */
cut(V(82), 'raid_low', 1.5, { zoom: [1.12, 1.0], focus: [0.5, 0.42] }, { punch: 0.5 });
boosts.push([V(82), V(83)]);
F(V(82), '#ff1a00', 0.9, 0.35); A(V(82), 'boom', 1.0); K(V(82), 55);
ranges.glitch.push([V(82), V(82) + 0.25, 1]);
DYK(V(82), V(120));
T(V(82), V(86), 'RAIDS ARE\n5 PLAYERS', { size: 110, y: 0.3, glow: 'rgba(255,40,20,0.9)', shakeText: true });
cut(V(86), 'lobby_browser', 2.4, { zoom: [1.05, 1.2], focus: [0.5, 0.45] }, { punch: 0.3 });
T(V(86), V(90), 'HOST ONE, OR JOIN ONE', { size: 84, y: 0.21 });
cut(V(90), 'lobby_code', 1.5, { zoom: [1.1, 1.3], focus: [0.42, 0.55] }, { punch: 0.3 });
T(V(90), V(94), 'A CODE. A QR.\nSHARE ON DISCORD.', { size: 76, y: 0.2 });
E(V(90), V(94), '📱', { size: 130, from: [0.86, 0.75], to: [0.86, 0.7], bounce: true });
cut(V(94), 'lobby_fill', 1.6, { zoom: [1.05, 1.18], focus: [0.5, 0.42] }, { punch: 0.3 });
T(V(94), V(98), 'squad fills up', { ...comic, size: 46, y: 0.86, color: '#ffe3c2' });
for (let n = 95; n <= 97; n++) { P(V(n), 0.12, 12); A(V(n), 'ding', 0.45); }
cut(V(98), 'lobby_launch', 1.2, { zoom: [1.1, 1.3], focus: [0.5, 0.65] }, { punch: 0.3 });
T(V(98), V(101), 'ROOM FULL', { size: 120, y: 0.2, color: '#ffb02e', shakeText: true });
A(V(100), 'riser', 0.8);
cut(V(101), 'raid_sky', 2.0, { zoom: [1.0, 1.12] }, { punch: 0.5 });
boosts.push([V(101), V(102)]);
F(V(101), '#fff', 1, 0.25); A(V(101), 'boom', 1.0); K(V(101), 50);
T(V(101), V(106), 'RAID TITANS ARE GIANTS', { size: 84, y: 0.21, glow: 'rgba(255,60,20,0.9)' });
T(V(103), V(106), 'goliath-sized. all of them.', { ...comic, size: 44, y: 0.88, color: '#ffe3c2' });
cut(V(106), 'boss4_fight', 6.0, { zoom: [1.0, 1.15], focus: [0.5, 0.65] }, { punch: 0.3 });
T(V(106), V(110), 'WATCH THE FLOOR TO\nSENSE INCOMING ATTACKS', { size: 72, y: 0.22 });
E(V(106), V(110), '👀', { size: 130, from: [0.85, 0.74], to: [0.85, 0.7], bounce: true });
cut(V(110), 'raid_top', 1.0, { zoom: [1.0, 1.15] }, { punch: 0.3 });
T(V(110), V(114), 'BOSS HP SCALES\nWITH THE SQUAD', { size: 80, y: 0.22 });
T(V(112), V(114), 'no free carries', { ...comic, size: 44, y: 0.88, color: '#ffe3c2' });
cut(V(114), 'raid_fp', 5.0, { zoom: [1.0, 1.15], focus: [0.5, 0.42] }, { punch: 0.3 });
ranges.chroma.push([V(114), V(120), 0.8]);
T(V(114), V(117), 'AND GOLIATH', { size: 104, y: 0.2, glow: 'rgba(255,40,20,0.9)' });
S(V(117), 'boss4_intro', 0, { freeze: 4.5, zoom: [1.3, 1.6], focus: [0.5, 0.38] });
ranges.fry.push([V(117), V(120), 1.0]);
ranges.glitch.push([V(117) + 0.3, V(120), 0.9]);
P(V(117), 0.5); A(V(117), 'scratch', 0.9); A(V(118), 'glitch', 0.6);
T(V(117), V(120), 'GETS BACK UP', { size: 130, y: 0.5, shakeText: true });
E(V(117), V(120), '💀', { size: 170, from: [0.82, 0.74], to: [0.86, 0.66], spin: 5 });

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
  shots, overlays, punches, shakes, flashes, audio, boosts, fades, ranges,
};
