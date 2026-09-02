/**
 * MATCH UI, in the industrial robot-wars language — the fight cards.
 *
 * Every fighter in the bout gets a CARD: smoked glass with a lit team
 * notch, their callsign in stencil, a big numeric health readout, a health
 * bar with a DAMAGE TRAIL (the ember ghost of what they just lost, easing
 * away behind the live level), the round pips, and the two states a glance
 * has to catch — LOW (a hazard chevron strip breathing under the bar) and
 * OUT (the card dims; no stamp, no word — the dim is the word). A hit
 * flashes the card's rim. Nothing is a box: your real room shows through
 * everything.
 *
 * WHERE THE CARDS HANG depends on the format:
 *
 *   1V1   the classic pair — YOURS left, THEIRS right — over the rival's
 *         pad, with the CLOCK between.
 *   2V2   your column (you, your ally above) and theirs, each column with
 *         its TEAM total under the lower card. A stacked bout RE-HANGS the
 *         whole board: the cards shrink and sit a little lower so the two
 *         in a column never cross, and the verdict lifts clear of the top
 *         card instead of landing across it.
 *   FFA   the north rival keeps the right-hand card, but the fighters on
 *         the east and west pads wear their cards OVER THEIR OWN PADS,
 *         turned to face you — so the fighter you are looking at is the
 *         one whose health you read — and a STANDINGS strip over the
 *         plaque ranks all four by rounds taken, then by health.
 *
 * The short metallic verdict (KO, YOU WIN…) floats above everything.
 *
 * Every board is a canvas texture and a canvas redraw + upload is the most
 * expensive UI op we have, so each board fingerprints what it drew and
 * skips when nothing it shows has changed; the trails and flashes are
 * quantised so an animation costs a handful of redraws, not one per frame.
 *
 * In Aim Training the left card becomes your score/streak readout and the
 * right card shows the dodge bar + time.
 */

import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene,
} from 'three';
import { ARENA_GAP, winTargetFor } from '../config.js';
import { localLayout } from '../combat/layout.js';
import type { MatchState } from '../combat/matchState.js';
import { app, training } from '../menu/appState.js';
import { UI, chamferPath, fitStencilText, futuristicFont, hazardStrip, metalText, solidBar, stencilFont } from './industrial.js';
import { countdownArt } from './countdownArt.js';
import { drawContentPlate as drawPlateArt } from './plateArt.js';
import { verdictArt } from './verdictArt.js';

const W = 880;
const H = 420;

// Visible cap height (canvas px) for the art plates, measured from the opaque
// WORD/digit so they read at a consistent size regardless of each PNG's
// transparent padding. Words (FIGHT / KNOCKOUT / WIN) share one height; the
// countdown digits share a slightly smaller one so FIGHT still lands biggest.
// Clamped by PLATE_MARGIN so the whole glyph always stays on the board.
const WORD_PLATE_H = 357;
const NUMBER_PLATE_H = 300;
const PLATE_MARGIN = 26;

/** Below this fraction a fighter is LOW: the bar goes red and the hazard
 *  strip breathes under it. */
const LOW_HP = 0.25;
/** The damage trail holds for this long after a hit, then eases away. */
const TRAIL_HOLD = 0.28;
const TRAIL_RATE = 0.9; // fraction per second
/** The rim flash on a hit. */
const FLASH_SECONDS = 0.36;
/** The clock turns hazard amber, then red and pulsing, this close to zero. */
const CLOCK_WARN = 20;
const CLOCK_HOT = 10;

interface Board {
  mesh: Mesh;
  ctx: CanvasRenderingContext2D;
  tex: CanvasTexture;
  w: number;
  h: number;
  /**
   * Content fingerprint of the last draw. Boards are asked to refresh every
   * frame but a canvas redraw + GPU texture upload is the single most
   * expensive UI op we have — so each draw skips when nothing changed.
   */
  key?: string;
}

/** One fighter's HUD readout. */
export interface FighterHud {
  /** LOCAL slot (0 = you) — the card's identity across frames. */
  slot: number;
  name: string;
  /** CSS colour for the bar/name (team tint). */
  neon: string;
  /** current / max health, 0..1. */
  hpFrac: number;
  /** current health, in points, for the readout. */
  hp: number;
  /** round wins to light as pips. */
  pips: number;
  /** Team id (0 = your team) — your team stacks left, the rest stack right. */
  team: number;
  /** Still standing this round. */
  alive: boolean;
}

export interface Scoreboard {
  /**
   * Redraw the match boards. `fighters[0]` is always you; your team stacks up
   * the left column, every other fighter stacks up the right — so 1v1 reads as
   * the classic two boards and 2v2 adds bars on top. FFA hangs the east and
   * west fighters' cards over their own pads.
   */
  updateMatch(state: MatchState, fighters: FighterHud[]): void;
  /** Redraw boards in Aim Training mode. */
  updateTraining(hp: number, hpMax: number): void;
  setVisible(v: boolean): void;
}

/** Per-fighter animation memory: the trail, the last level, the flash. */
interface CardMotion {
  hp: number;
  trail: number;
  hitAt: number;
  seen: number;
}

function makeBoard(wMeters: number, hMeters: number, cw = W, ch = H): Board {
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'middle';
  const tex = new CanvasTexture(canvas);
  tex.minFilter = LinearFilter;
  const mesh = new Mesh(
    new PlaneGeometry(wMeters, hMeters),
    new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  return { mesh, ctx, tex, w: cw, h: ch };
}

/** Draw an art plate centred on the centre board, sized so its VISIBLE glyph
 *  (not the padded frame) is `targetH` tall — but never larger than the board's
 *  safe area, so the whole glyph always stays on screen (nothing chopped). */
function drawContentPlate(ctx: CanvasRenderingContext2D, img: HTMLImageElement, targetH: number): void {
  drawPlateArt(ctx, img, W, H, targetH, PLATE_MARGIN);
}

function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function verdictAccent(message: string): string {
  if (message.includes('LOSE') || message === 'LOSS' || message === "KO'D") return UI.coolBright;
  // Match the neon plate art: the countdown digits 3 & 2 glow blue, 1 glows red
  // (like FIGHT); the verdict plates (KO / WIN / TIME) are all blue neon, so
  // their auras glow blue to sit under them cleanly.
  if (message === '3' || message === '2') return UI.cool;
  if (message === '1') return UI.danger;
  if (message === 'FIGHT') return UI.danger;
  if (message === 'KO' || message === 'WIN' || message === 'YOU WIN' || message === 'TIME' || message === 'DRAW')
    return UI.cool;
  return UI.emberBright;
}

/** Soft additive aura that sits behind the verdict and pulses with it. A
 *  radial-gradient sprite — animated purely by transform/opacity/colour, so it
 *  never costs a canvas redraw. */
function makeVerdictGlow(): Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.32)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new CanvasTexture(canvas);
  tex.minFilter = LinearFilter;
  const mesh = new Mesh(
    new PlaneGeometry(3.0, 1.7),
    new MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      opacity: 0,
    }),
  );
  mesh.visible = false;
  return mesh;
}

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/* ── the card ─────────────────────────────────────────────────────────── */

/** The card's glass and its lit rim: a chamfered smoked plate, the team's
 *  neon traced round it (soft halo under a crisp line), a keying notch. */
function cardGlass(ctx: CanvasRenderingContext2D, neon: string, flash: number, dim: boolean): void {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (dim) ctx.globalAlpha = 0.55;
  chamferPath(ctx, 18, 18, W - 36, H - 36, 26);
  ctx.fillStyle = UI.ink;
  ctx.fill();
  // The rim: halo, then line. A hit whites the rim out and it fades back.
  const rim = flash > 0 ? `rgba(255,${Math.round(200 - 120 * flash)},${Math.round(160 - 140 * flash)},1)` : neon;
  chamferPath(ctx, 18, 18, W - 36, H - 36, 26);
  ctx.lineWidth = 3 + 6 * flash;
  ctx.strokeStyle = rim;
  ctx.shadowColor = rim;
  ctx.shadowBlur = 14 + 22 * flash;
  ctx.globalAlpha = (dim ? 0.55 : 1) * (0.55 + 0.45 * flash);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = dim ? 0.55 : 1;
  // Keying notch — the team's lit tab, and a rivet in each corner.
  ctx.fillStyle = neon;
  ctx.shadowColor = neon;
  ctx.shadowBlur = 16;
  ctx.fillRect(34, 46, 9, 58);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(200,210,224,0.45)';
  for (const [x, y] of [
    [40, 40],
    [W - 40, 40],
    [40, H - 40],
    [W - 40, H - 40],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Round-win pips: chamfered studs, lit per round taken. */
function scorePips(ctx: CanvasRenderingContext2D, x: number, y: number, won: number, target: number, color: string): void {
  for (let i = 0; i < target; i++) {
    const px = x + i * 52;
    ctx.save();
    ctx.translate(px, y);
    ctx.rotate(Math.PI / 4);
    if (i < won) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillRect(-12, -12, 24, 24);
      ctx.shadowBlur = 0;
    } else {
      ctx.lineWidth = 3;
      ctx.strokeStyle = UI.steelDim;
      ctx.strokeRect(-12, -12, 24, 24);
    }
    ctx.restore();
  }
}

/**
 * THE HEALTH READOUT: a dark track, the damage trail (ember, easing away),
 * the live level (team neon; red once LOW), quarter ticks, and a bright
 * leading edge. `low` breathes the hazard strip under the track.
 */
function healthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  trail: number,
  neon: string,
  lowPhase: number,
): void {
  const low = frac < LOW_HP && frac > 0;
  // Track.
  chamferPath(ctx, x, y, w, h, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  ctx.save();
  chamferPath(ctx, x, y, w, h, 10);
  ctx.clip();
  // The trail: what was just lost, in ember, fading as it eases in.
  if (trail > frac + 0.002) {
    ctx.fillStyle = 'rgba(255,122,24,0.55)';
    ctx.shadowColor = UI.ember;
    ctx.shadowBlur = 12;
    ctx.fillRect(x, y, w * trail, h);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  // The live level.
  const colour = low ? UI.danger : neon;
  if (frac > 0) solidBar(ctx, x + 4, y + 5, w - 8, h - 10, frac, colour);
  // Quarter ticks over everything.
  ctx.fillStyle = 'rgba(5,6,9,0.7)';
  for (let q = 1; q < 4; q++) ctx.fillRect(x + (w * q) / 4 - 1, y, 3, h);
  // The frame line.
  chamferPath(ctx, x, y, w, h, 10);
  ctx.lineWidth = 2;
  ctx.strokeStyle = low ? 'rgba(232,53,42,0.8)' : 'rgba(172,182,198,0.35)';
  ctx.stroke();
  // LOW: hazard chevrons breathing under the track.
  if (low) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.45 * lowPhase;
    hazardStrip(ctx, x, y + h + 8, w, 12, UI.danger);
    ctx.restore();
  }
}

/* ── the board ────────────────────────────────────────────────────────── */

export function createScoreboard(scene: Scene): Scoreboard {
  const group = new Group();
  group.name = 'scoreboards';

  // The classic pair hangs side by side behind/above the rival's pad,
  // barely angled inward — read your card and theirs without turning.
  const BOARD_Y = 2.18; // lifted clear of the far platform's sight line
  const BOARD_Z = -ARENA_GAP - 1.1;
  const CARD_W = 1.5;
  const CARD_H = 0.72;
  const left = makeBoard(CARD_W, CARD_H); // YOU — ember
  left.mesh.position.set(-1.0, BOARD_Y, BOARD_Z);
  left.mesh.rotation.y = 0.18;
  const right = makeBoard(CARD_W, CARD_H); // primary opponent — blue
  right.mesh.position.set(1.0, BOARD_Y, BOARD_Z);
  right.mesh.rotation.y = -0.18;

  // The columns: a teammate above your card, extra opponents above theirs.
  // A card's readout runs the FULL height of its plate — name and health at
  // the top, bar and pips below — so the step has to clear the whole card,
  // not just its margin. (It used to be 0.56 against a 0.72 card: the upper
  // card's rim cut straight through the lower one's name and number.)
  const extraLeft = makeBoard(CARD_W, CARD_H);
  extraLeft.mesh.rotation.y = 0.18;
  const extraRightA = makeBoard(CARD_W, CARD_H);
  extraRightA.mesh.rotation.y = -0.18;
  const extraRightB = makeBoard(CARD_W, CARD_H);
  extraRightB.mesh.rotation.y = -0.18;

  // FFA: PAD CARDS for the fighters on the flanking pads, hung over their
  // own platforms and turned to face you (placed per bout from the layout).
  const padCards = [makeBoard(1.2, 0.58), makeBoard(1.2, 0.58)];
  const extras = [extraLeft, extraRightA, extraRightB, ...padCards];
  for (const e of extras) e.mesh.visible = false;

  // THE ROUND PLAQUE — round, first-to, and the clock, floating in the slot
  // between the two cards.
  const plaque = makeBoard(0.62, 0.36, 352, 204);
  plaque.mesh.position.set(0, BOARD_Y + 0.14, BOARD_Z);

  // FFA STANDINGS — a strip over the plaque ranking the four (hidden while
  // a verdict is up: the verdict owns that air).
  const standings = makeBoard(1.56, 0.53, 704, 240);
  standings.mesh.position.set(0, BOARD_Y + 0.66, BOARD_Z);
  standings.mesh.visible = false;

  // Headline strip (KO, YOU WIN...) floating just above the boards.
  // Sized to the canvas aspect so the stencil type renders undistorted.
  const centre = makeBoard(2.2, 1.05);
  const CENTRE_Y = 3.06;
  const CENTRE_Z = -ARENA_GAP - 1.15;
  centre.mesh.position.set(0, CENTRE_Y, CENTRE_Z);
  centre.mesh.renderOrder = 12;

  // The accent aura behind the verdict.
  const glow = makeVerdictGlow();
  glow.position.set(0, CENTRE_Y, CENTRE_Z - 0.04);
  glow.renderOrder = 11;
  const glowColor = new Color();

  /**
   * THE HANG — where everything sits, in one of two shapes.
   *
   * CLASSIC (1v1, FFA) is the pair at full size with the verdict just over
   * them. STACKED (2v2, or any bout that puts two cards in a column) shrinks
   * the cards, drops the row a little and steps the column by a clear card
   * height, then lifts the verdict above the top card — so nothing in the
   * bout is read through anything else.
   */
  interface Hang {
    /** The lower row's height. */
    y: number;
    /** Rise from one card in a column to the next. */
    step: number;
    cardScale: number;
    centreY: number;
    centreScale: number;
  }
  const HANG: Record<'classic' | 'stacked', Hang> = {
    classic: { y: BOARD_Y, step: 0.62, cardScale: 1, centreY: CENTRE_Y, centreScale: 1 },
    stacked: { y: 2.04, step: 0.63, cardScale: 0.8, centreY: 3.5, centreScale: 0.8 },
  };
  let hang: Hang = HANG.classic;
  let hangKey = '';
  /** Re-hang the boards (a no-op unless the shape actually changed). */
  const setHang = (stacked: boolean): void => {
    const key = stacked ? 'stacked' : 'classic';
    if (key === hangKey) return;
    hangKey = key;
    hang = stacked ? HANG.stacked : HANG.classic;
    const { y, step, cardScale } = hang;
    for (const [b, sign, row] of [
      [left, -1, 0],
      [right, 1, 0],
      [extraLeft, -1, 1],
      [extraRightA, 1, 1],
      [extraRightB, 1, 2],
    ] as const) {
      b.mesh.position.set(sign * 1.0, y + row * step, BOARD_Z);
      b.mesh.scale.setScalar(cardScale);
    }
    plaque.mesh.position.set(0, y + 0.14, BOARD_Z);
    standings.mesh.position.set(0, y + 0.66, BOARD_Z);
    centre.mesh.position.y = hang.centreY;
    glow.position.y = hang.centreY;
  };
  setHang(false);

  group.add(
    left.mesh,
    right.mesh,
    extraLeft.mesh,
    extraRightA.mesh,
    extraRightB.mesh,
    padCards[0].mesh,
    padCards[1].mesh,
    plaque.mesh,
    standings.mesh,
    glow,
    centre.mesh,
  );
  scene.add(group);

  const motion = new Map<number, CardMotion>();
  let lastReset = -1;

  /** Advance a fighter's trail and flash, and return them quantised. */
  const advance = (f: FighterHud, now: number): { trail: number; flash: number } => {
    let m = motion.get(f.slot);
    if (!m) {
      m = { hp: f.hpFrac, trail: f.hpFrac, hitAt: -10, seen: now };
      motion.set(f.slot, m);
    }
    const dt = Math.min(0.1, Math.max(0, (now - m.seen) / 1000));
    m.seen = now;
    if (f.hpFrac < m.hp - 0.001) {
      m.hitAt = now;
      // The trail waits at the old level; a second hit inside the hold keeps
      // the higher of the two so the whole loss stays on show.
      m.trail = Math.max(m.trail, m.hp);
    } else if (f.hpFrac > m.hp + 0.001) {
      m.trail = f.hpFrac; // healed / refilled: nothing to mourn
    }
    m.hp = f.hpFrac;
    if (m.trail > f.hpFrac && now - m.hitAt > TRAIL_HOLD * 1000) {
      m.trail = Math.max(f.hpFrac, m.trail - TRAIL_RATE * dt);
    }
    const flashRaw = Math.max(0, 1 - (now - m.hitAt) / (FLASH_SECONDS * 1000));
    return { trail: Math.round(m.trail * 100) / 100, flash: Math.round(flashRaw * 4) / 4 };
  };

  // --- verdict animation (transform/opacity only — no canvas redraws) -------
  let verdictMsg = '';
  let verdictStart = 0;
  const glowMat = glow.material as MeshBasicMaterial;

  const animateVerdict = (message: string): void => {
    const now = performance.now();
    if (message !== verdictMsg) {
      verdictMsg = message;
      verdictStart = now;
    }
    if (!message) {
      centre.mesh.scale.setScalar(hang.centreScale);
      centre.mesh.position.y = hang.centreY;
      glow.visible = false;
      return;
    }
    const t = (now - verdictStart) / 1000;
    // Slam in: a quick overshoot that springs to rest, then a slow breathe.
    const spring = 1 + 0.6 * Math.exp(-t * 8) * Math.cos(t * 17);
    const breathe = 1 + 0.02 * Math.sin(now * 0.0042);
    centre.mesh.scale.setScalar(Math.max(0.25, spring * breathe * hang.centreScale));
    centre.mesh.position.y = hang.centreY + 0.012 * Math.sin(now * 0.0032);

    // Aura: a bright impact flash on arrival decaying into a steady pulse.
    glow.visible = true;
    glowColor.set(verdictAccent(message));
    glowMat.color.copy(glowColor);
    const intro = easeOutCubic(Math.min(1, t / 0.25));
    const flash = 0.55 * Math.exp(-t * 5);
    const pulse = 0.26 + 0.12 * Math.sin(now * 0.005);
    glowMat.opacity = Math.min(0.95, intro * pulse + flash);
    glow.scale.setScalar(spring * (1 + 0.18 * Math.exp(-t * 6) + 0.05 * Math.sin(now * 0.005)));
  };

  /** THE ROUND PLAQUE. */
  const drawPlaque = (state: MatchState, now: number): void => {
    const secs = Math.max(0, Math.ceil(state.roundTimer));
    const live = state.phase === 'playing';
    const hot = live && secs <= CLOCK_HOT;
    const warn = live && secs <= CLOCK_WARN;
    const text = state.phase === 'countdown' ? 'READY' : fmtTime(state.roundTimer);
    const key = `p|${text}|${hot ? 'h' : warn ? 'w' : ''}`;
    // The hot clock's pulse rides the mesh, not the canvas.
    plaque.mesh.scale.setScalar(hot ? 1 + 0.05 * Math.sin(now * 0.012) : 1);
    if (plaque.key === key) return;
    plaque.key = key;
    const { ctx, tex, w, h } = plaque;
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // The clock, and only the clock: bare steel-white digits wrapped in
    // neon — amber, then red and hot as the round runs out. (The round
    // number and the format used to sit above it; the pips already say
    // both, and the plaque reads better as one thing.)
    const neon = hot ? UI.danger : warn ? UI.amber : 'rgba(255,176,0,0.9)';
    ctx.font = stencilFont(100);
    ctx.shadowColor = neon;
    ctx.shadowBlur = hot ? 34 : 24;
    ctx.fillStyle = hot ? '#ffd9d4' : UI.text;
    ctx.fillText(text, w / 2, 118);
    ctx.shadowBlur = 10;
    ctx.fillText(text, w / 2, 118); // second pass: crisp core, denser halo
    ctx.shadowBlur = 0;
    // A thin rule under it, lit in the same neon.
    const rule = ctx.createLinearGradient(40, 0, w - 40, 0);
    rule.addColorStop(0, 'rgba(0,0,0,0)');
    rule.addColorStop(0.5, neon);
    rule.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rule;
    ctx.fillRect(40, 176, w - 80, 3);
    tex.needsUpdate = true;
  };

  /** THE CARD — one fighter. */
  const drawCard = (board: Board, f: FighterHud, target: number, now: number, teamTotal?: string): void => {
    const { trail, flash } = advance(f, now);
    const low = f.alive && f.hpFrac < LOW_HP && f.hpFrac > 0;
    // The LOW strip breathes at ~1 Hz, quantised to four steps a beat.
    const lowPhase = low ? Math.round((0.5 + 0.5 * Math.sin(now * 0.0063)) * 3) / 3 : 0;
    const hpQ = Math.round(f.hpFrac * 200) / 200;
    const key = `c|${f.name}|${f.neon}|${hpQ}|${f.hp}|${trail}|${flash}|${f.pips}|${target}|${f.alive ? 1 : 0}|${lowPhase}|${teamTotal ?? ''}`;
    if (board.key === key) return;
    board.key = key;
    const { ctx, tex } = board;
    const dim = !f.alive;
    cardGlass(ctx, f.neon, flash, dim);
    ctx.save();
    if (dim) ctx.globalAlpha = 0.55;
    // The callsign, stencil steel-white with a soft team halo.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const px = fitStencilText(ctx, f.name, W - 340, 56, 26);
    ctx.font = stencilFont(px);
    ctx.shadowColor = f.neon;
    ctx.shadowBlur = 16;
    ctx.fillStyle = UI.text;
    ctx.fillText(f.name, 64, 76);
    ctx.shadowBlur = 0;
    // The numeric readout, right — big, futuristic, in the team neon.
    ctx.textAlign = 'right';
    ctx.font = futuristicFont(74, 700);
    ctx.fillStyle = low ? UI.danger : f.neon;
    ctx.shadowColor = low ? UI.danger : f.neon;
    ctx.shadowBlur = 18;
    ctx.fillText(String(Math.max(0, Math.round(f.hp))), W - 56, 78);
    ctx.shadowBlur = 0;
    // The health readout.
    healthBar(ctx, 48, 132, W - 96, 84, f.hpFrac, trail, f.neon, lowPhase);
    // The pips, and the team total (2v2) on the right.
    scorePips(ctx, 78, 306, f.pips, target, f.neon);
    if (teamTotal) {
      ctx.textAlign = 'right';
      ctx.font = futuristicFont(28, 700);
      ctx.letterSpacing = '3px';
      ctx.fillStyle = UI.textDim;
      ctx.fillText(teamTotal, W - 56, 306);
      ctx.letterSpacing = '0px';
    } else if (low) {
      ctx.textAlign = 'right';
      ctx.font = stencilFont(30);
      ctx.fillStyle = UI.danger;
      ctx.shadowColor = UI.danger;
      ctx.shadowBlur = 12 + 10 * lowPhase;
      ctx.fillText('LOW', W - 56, 306);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    tex.needsUpdate = true;
  };

  /** THE STANDINGS strip (FFA): everyone, ranked. */
  const drawStandings = (fighters: FighterHud[], target: number): void => {
    const ranked = fighters
      .slice()
      .sort((a, b) => b.pips - a.pips || Number(b.alive) - Number(a.alive) || b.hpFrac - a.hpFrac);
    const key = `st|${ranked.map((f) => `${f.name}:${f.pips}:${f.alive ? 1 : 0}:${Math.round(f.hpFrac * 20)}`).join(',')}|${target}`;
    if (standings.key === key) return;
    standings.key = key;
    const { ctx, tex, w, h } = standings;
    ctx.clearRect(0, 0, w, h);
    chamferPath(ctx, 10, 10, w - 20, h - 20, 18);
    ctx.fillStyle = UI.ink;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = UI.steelDim;
    ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = futuristicFont(20, 700);
    ctx.letterSpacing = '4px';
    ctx.fillStyle = UI.textDim;
    ctx.fillText('STANDINGS', 34, 36);
    ctx.letterSpacing = '0px';
    const rowH = (h - 70) / Math.max(1, ranked.length);
    ranked.forEach((f, i) => {
      const y = 62 + rowH * i + rowH / 2;
      // Rank, notch, name, pips, and a slim health sliver.
      ctx.textAlign = 'left';
      ctx.font = stencilFont(26);
      ctx.fillStyle = f.alive ? UI.text : 'rgba(232,236,242,0.35)';
      ctx.fillText(String(i + 1), 34, y);
      ctx.fillStyle = f.neon;
      ctx.globalAlpha = f.alive ? 1 : 0.35;
      ctx.fillRect(66, y - 12, 6, 24);
      ctx.globalAlpha = 1;
      const px = fitStencilText(ctx, f.name, 300, 26, 18);
      ctx.font = stencilFont(px);
      ctx.fillStyle = f.alive ? UI.text : 'rgba(232,236,242,0.35)';
      ctx.fillText(f.name, 84, y);
      if (!f.alive) {
        ctx.font = futuristicFont(18, 700);
        ctx.fillStyle = UI.danger;
        ctx.fillText('OUT', 84 + ctx.measureText(f.name).width + 18, y);
      }
      for (let p = 0; p < target; p++) {
        ctx.beginPath();
        ctx.arc(420 + p * 26, y, 7, 0, Math.PI * 2);
        if (p < f.pips) {
          ctx.fillStyle = f.neon;
          ctx.shadowColor = f.neon;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.lineWidth = 2;
          ctx.strokeStyle = UI.steelDim;
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(510, y - 5, 160, 10);
      ctx.fillStyle = f.hpFrac < LOW_HP ? UI.danger : f.neon;
      ctx.fillRect(510, y - 5, 160 * Math.max(0, f.hpFrac), 10);
    });
    tex.needsUpdate = true;
  };

  const drawCentre = (message: string, sub: string): void => {
    // Two flavours of art: the countdown plates (3/2/1/FIGHT) and the verdict
    // plates (KO/KO'D/WIN). Everything else is stencilled. "Is the art decoded
    // yet" folds into the key so the first frame after a cold load swaps the
    // text fallback out for the image.
    const cd = countdownArt(message);
    const vd = cd ? null : verdictArt(message);
    const key = `c|${message}|${sub}|${cd ? 'cd' : vd ? 'vd' : 'txt'}`;
    if (centre.key === key) return;
    centre.key = key;
    const { ctx, tex } = centre;
    ctx.clearRect(0, 0, W, H);
    if (cd && message !== 'FIGHT') {
      // Countdown digit (3/2/1): sized by its VISIBLE glyph to a consistent
      // height so the count reads evenly, whatever padding each PNG carries.
      drawContentPlate(ctx, cd, NUMBER_PLATE_H);
    } else if (cd || vd) {
      // Word plates — FIGHT (countdown) and KNOCKOUT / WIN (verdict) — sized by
      // the VISIBLE word to a shared cap height so all three read consistently.
      drawContentPlate(ctx, (cd ?? vd) as HTMLImageElement, WORD_PLATE_H);
    } else if (message) {
      // No backing plate: just the short chromed verdict floating over the gap.
      ctx.textAlign = 'center';
      const accent = verdictAccent(message);
      const isCountdown = /^[123]$/.test(message);
      const px = fitStencilText(ctx, message, W - 120, isCountdown ? 210 : message.includes('YOU') ? 124 : 152, 44);
      const midY = sub ? 188 : 216;
      metalText(ctx, message, W / 2, midY, px, accent);
      if (sub) {
        ctx.font = stencilFont(40);
        ctx.lineWidth = 7;
        ctx.strokeStyle = 'rgba(2,3,7,0.9)';
        ctx.strokeText(sub, W / 2, 304);
        ctx.fillStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 10;
        ctx.fillText(sub, W / 2, 304);
        ctx.shadowBlur = 0;
      }
    }
    tex.needsUpdate = true;
  };

  /** Draw a fighter onto a board (or hide it when there's no fighter). */
  const setCard = (board: Board, f: FighterHud | undefined, target: number, now: number, teamTotal?: string): void => {
    if (!f) {
      board.mesh.visible = false;
      return;
    }
    board.mesh.visible = true;
    drawCard(board, f, target, now, teamTotal);
  };

  /** Hang a pad card over a fighter's own platform, facing me. */
  const placePadCard = (board: Board, slot: number): void => {
    const p = localLayout()[slot]?.pos;
    if (!p) return;
    board.mesh.position.set(p[0], 2.05, p[2]);
    // A plane's face is +Z; turn it to look back at the origin.
    board.mesh.rotation.y = Math.atan2(-p[0], -p[2]);
  };

  return {
    updateMatch(state, fighters) {
      const now = performance.now();
      const target = winTargetFor(app.arcade, app.quickDuel);
      // A fresh round: trails and flashes start clean.
      if (state.resetCount !== lastReset) {
        lastReset = state.resetCount;
        motion.clear();
      }
      drawPlaque(state, now);
      const you = fighters[0];
      const allies = fighters.filter((f, i) => i > 0 && f.team === 0);
      const enemies = fighters.filter((f) => f.team !== 0);
      const ffa = app.arcade === 'ffa';
      const total = (team: number): string | undefined => {
        if (app.arcade !== '2v2') return undefined;
        const mine = fighters.filter((f) => f.team === team);
        return `TEAM ${Math.max(0, Math.round(mine.reduce((s, f) => s + f.hp, 0)))}`;
      };

      // A column of two is what crowds the board: 2v2, or anything that
      // stacks. FFA never stacks — its flankers wear their own pad cards.
      setHang(!ffa && (!!allies[0] || !!enemies[1]));

      if (ffa) {
        // The north pad's fighter (across the gap, straight ahead) keeps the
        // right-hand card; the flanking pads wear their own.
        const layout = localLayout();
        const ahead = (f: FighterHud): boolean => Math.abs(layout[f.slot]?.pos[0] ?? 0) < 0.5;
        const north = enemies.find(ahead);
        const flank = enemies.filter((f) => f !== north);
        setCard(left, you, target, now);
        setCard(right, north, target, now);
        setCard(extraLeft, undefined, target, now);
        setCard(extraRightA, undefined, target, now);
        setCard(extraRightB, undefined, target, now);
        flank.slice(0, 2).forEach((f, i) => {
          placePadCard(padCards[i], f.slot);
          setCard(padCards[i], f, target, now);
        });
        for (let i = flank.length; i < 2; i++) padCards[i].mesh.visible = false;
      } else {
        // Your team (the ally in 2v2) stacks above your card; everyone else
        // (the opponents) stacks up the right column.
        setCard(left, you, target, now, total(0));
        setCard(extraLeft, allies[0], target, now);
        setCard(right, enemies[0], target, now, enemies[0] ? total(enemies[0].team) : undefined);
        setCard(extraRightA, enemies[1], target, now);
        setCard(extraRightB, enemies[2], target, now);
        for (const c of padCards) c.mesh.visible = false;
      }

      // The loser gets no verdict popup — a plain LOSS / YOU LOSE shows nothing,
      // and a knockout loss (KO'D) is suppressed the same way: only the winner
      // ever sees a verdict plate (WIN, or the dramatic KNOCKOUT). The KO'D token
      // still rides the wire so a guest who lands the KO flips it back to KO.
      // The 3-2-1-FIGHT ritual is NOT a HUD verdict any more: it plays out
      // in-world between the platforms (CountdownSystem, with this same
      // slam + glow) — showing it in both places read as clutter.
      const suppressed =
        state.message === 'LOSS' ||
        state.message === 'YOU LOSE' ||
        state.message === "KO'D" ||
        state.message === '3' ||
        state.message === '2' ||
        state.message === '1' ||
        state.message === 'FIGHT';
      const verdict = suppressed ? '' : state.message;
      drawCentre(verdict, '');
      animateVerdict(verdict);
      // FFA standings own the air over the plaque whenever the verdict doesn't.
      standings.mesh.visible = ffa && !verdict;
      if (standings.mesh.visible) drawStandings(fighters, target);
    },

    updateTraining(hp, hpMax) {
      // Aim Training uses just the two classic boards — at full size, on
      // the classic hang, whatever format the last bout left behind.
      setHang(false);
      const now = performance.now();
      left.mesh.visible = true;
      right.mesh.visible = true;
      for (const e of extras) e.mesh.visible = false;
      standings.mesh.visible = false;
      plaque.mesh.scale.setScalar(1);
      const clockKey = `t|${fmtTime(training.timeLeft)}`;
      if (plaque.key !== clockKey) {
        plaque.key = clockKey;
        const { ctx, tex, w, h } = plaque;
        ctx.clearRect(0, 0, w, h);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = stencilFont(100);
        ctx.shadowColor = 'rgba(255,176,0,0.9)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = UI.text;
        ctx.fillText(fmtTime(training.timeLeft), w / 2, 108);
        ctx.shadowBlur = 0;
        tex.needsUpdate = true;
      }
      // Left card: score + streak.
      const best = Math.max(app.stats.trainingBest, training.score);
      const key = `t|${training.score}|${training.streak}|${best}`;
      if (left.key !== key) {
        left.key = key;
        const { ctx, tex } = left;
        cardGlass(ctx, UI.emberBright, 0, false);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = stencilFont(44);
        ctx.shadowColor = UI.emberBright;
        ctx.shadowBlur = 16;
        ctx.fillStyle = UI.text;
        ctx.fillText('AIM TRAINING', 64, 76);
        ctx.shadowBlur = 0;
        ctx.font = futuristicFont(110, 700);
        ctx.fillStyle = UI.emberBright;
        ctx.shadowColor = UI.emberBright;
        ctx.shadowBlur = 18;
        ctx.fillText(String(training.score), 64, 200);
        ctx.shadowBlur = 0;
        ctx.font = futuristicFont(30, 700);
        ctx.letterSpacing = '3px';
        ctx.fillStyle = UI.amberSoft;
        ctx.fillText(`STREAK ×${training.streak}`, 64, 320);
        ctx.textAlign = 'right';
        ctx.fillStyle = UI.textDim;
        ctx.fillText(`BEST ${best}`, W - 56, 320);
        ctx.letterSpacing = '0px';
        tex.needsUpdate = true;
      }
      // Right card: dodge readout (health only matters with shoot-back on).
      const frac = app.shootBack ? hp / hpMax : 1;
      drawCard(right, { slot: 1, name: 'DODGE', neon: UI.cool, hpFrac: frac, hp: app.shootBack ? hp : hpMax, pips: 0, team: 1, alive: true }, 0, now);
      drawCentre('', '');
      animateVerdict('');
    },

    setVisible(v) {
      group.visible = v;
    },
  };
}
