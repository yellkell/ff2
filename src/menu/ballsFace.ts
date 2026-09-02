/**
 * THE BALL LOADOUT (MENUS 3) — what each fist throws, on the panel kit.
 *
 * Two rows, one per fist, three attachments each: SPLIT (into three),
 * GROW, SHRINK.
 * Tap one to arm that fist with it; tap it again to go back to a plain
 * ball. Below them, a line saying what the last one you touched does —
 * the panel teaches as you poke it.
 *
 * Behind the ADVANCED tab: the curve switch, how hard a curve bends, and
 * whether you can see your own body. All three are settings about YOUR
 * hands rather than about a bout, which is why they live here and not in
 * the wing's SETTINGS.
 *
 * Every click is self-contained — it mutates and persists app state and
 * nothing else — so the ids are local (`ball:*`) and `ballsClick` answers
 * them, the same contract the paint bay uses.
 */

import { KIT, Panel, type PanelButton } from '../ui/kit/panel.js';
import { font } from '../ui/kit/fonts.js';
import { app, saveBallArc, saveBallAttach, saveCurveStrength, saveShowBody } from './appState.js';
import { ATTACH } from '../config.js';

export const BALLS_W = 768;
export const BALLS_H = 768;

const M = 56;
const INNER = BALLS_W - M * 2;
const GAP = 16;
const TILE_W = (INNER - GAP * 2) / 3;
const TILE_H = 132;
const ROW_L = 190;
const ROW_R = 378;
const DESC_Y = 546;

const TYPES = [ATTACH.split, ATTACH.grow, ATTACH.shrink];
const ATTACHMENTS = [
  { name: 'SPLIT', color: KIT.info, desc: 'Splits into three on return — each a third the damage.' },
  { name: 'GROW', color: '#ff7a18', desc: 'Gets bigger on return with less damage.' },
  { name: 'SHRINK', color: KIT.accent, desc: 'Gets smaller on return for more damage.' },
];

/** Which face is up, and which attachment the description line is reading. */
const state = { advanced: false, reading: -1, version: 1 };

/** A repaint key — MenuSystem redraws the panel when this changes. */
export function ballsFaceKey(): string {
  return `${state.advanced}|${state.reading}|${app.ballAttach.join(',')}|${app.ballArc.join(',')}|${app.curveStrength}|${app.showBody}`;
}

export interface BallsFace {
  title: string;
  body: (g: CanvasRenderingContext2D, hover: string | null) => void;
  buttons: PanelButton[];
}

/** Route one `ball:*` id. Returns false for anything that isn't ours. */
export function ballsClick(id: string): boolean {
  if (!id.startsWith('ball:')) return false;
  const what = id.slice(5);
  if (what === 'advanced' || what === 'loadout') {
    state.advanced = what === 'advanced';
  } else if (what === 'curve') {
    const on = !(app.ballArc[0] || app.ballArc[1]);
    app.ballArc[0] = on;
    app.ballArc[1] = on;
    saveBallArc();
  } else if (what === 'body') {
    app.showBody = !app.showBody;
    saveShowBody();
  } else if (what === 'bend-' || what === 'bend+') {
    const step = what === 'bend+' ? 0.05 : -0.05;
    app.curveStrength = Math.round(Math.max(0.1, Math.min(1, app.curveStrength + step)) * 20) / 20;
    saveCurveStrength();
  } else {
    // ball:<side>-<slot> — arm that fist, or take the attachment off.
    const [side, slot] = what.split('-').map(Number);
    if (!Number.isFinite(side) || !Number.isFinite(slot)) return true;
    const type = TYPES[slot];
    state.reading = slot;
    app.ballAttach[side] = app.ballAttach[side] === type ? 0 : type;
    saveBallAttach();
  }
  state.version++;
  return true;
}

export function ballsFace(): BallsFace {
  // The tab grammar, here too: which face is up is a strip, not a button
  // parked on top of the panel's own name.
  const buttons: PanelButton[] = [
    { id: 'ball:loadout', label: 'FISTS', tab: true, x: 300, y: 30, w: 180, h: 70, selected: !state.advanced },
    { id: 'ball:advanced', label: 'ADVANCED', tab: true, x: 490, y: 30, w: 230, h: 70, selected: state.advanced },
  ];

  if (state.advanced) {
    const curve = app.ballArc[0] || app.ballArc[1];
    buttons.push(
      {
        id: 'ball:curve',
        label: 'CURVE',
        sub: 'a flicked wrist bends the throw',
        x: M, y: 170, w: INNER, h: 96,
        small: true,
        selected: curve,
      },
      { id: 'ball:bend-', label: '−', x: M, y: 316, w: 110, h: 96, px: 44, disabled: app.curveStrength <= 0.1 },
      {
        id: 'ball:bend',
        label: `${Math.round(app.curveStrength * 100)}%`,
        sub: 'how hard it bends',
        x: M + 126, y: 316, w: INNER - 252, h: 96,
        display: true,
        tone: KIT.accent,
      },
      { id: 'ball:bend+', label: '+', x: BALLS_W - M - 110, y: 316, w: 110, h: 96, px: 44, disabled: app.curveStrength >= 1 },
      {
        id: 'ball:body',
        label: 'SHOW MY BODY',
        sub: 'look down and see your own machine',
        x: M, y: 462, w: INNER, h: 96,
        small: true,
        selected: app.showBody,
      },
    );
    return {
      title: 'THE BALL',
      buttons,
      body: (g) => {
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = font(500, 22);
        g.fillStyle = KIT.faint;
        g.fillText('your hands, not the bout — these follow you everywhere', BALLS_W / 2, BALLS_H - 92);
      },
    };
  }

  for (const [side, rowY] of [[0, ROW_L], [1, ROW_R]] as const) {
    for (let i = 0; i < 3; i++) {
      buttons.push({
        id: `ball:${side}-${i}`,
        label: '',
        ghost: true,
        x: M + i * (TILE_W + GAP),
        y: rowY,
        w: TILE_W,
        h: TILE_H,
      });
    }
  }

  return {
    title: 'THE BALL',
    buttons,
    body: (g, hover) => {
      g.textBaseline = 'middle';
      for (const [side, rowY, label] of [
        [0, ROW_L, 'LEFT FIST'],
        [1, ROW_R, 'RIGHT FIST'],
      ] as const) {
        g.textAlign = 'left';
        g.font = font(700, 20);
        g.letterSpacing = '3px';
        g.fillStyle = KIT.faint;
        g.fillText(label, M, rowY - 24);
        g.letterSpacing = '0px';
        for (let i = 0; i < 3; i++) {
          const armed = app.ballAttach[side] === TYPES[i];
          const hot = hover === `ball:${side}-${i}`;
          const info = ATTACHMENTS[i];
          const x = M + i * (TILE_W + GAP);
          g.beginPath();
          g.roundRect(x, rowY, TILE_W, TILE_H, 16);
          g.fillStyle = armed ? KIT.accentFaint : hot ? KIT.plateHover : KIT.plate;
          g.fill();
          g.lineWidth = 2;
          g.strokeStyle = armed ? info.color : hot ? KIT.lineHover : KIT.line;
          g.stroke();
          drawAttachIcon(g, i, x + TILE_W / 2, rowY + 52, 26, info.color);
          g.textAlign = 'center';
          g.font = font(700, 24);
          g.fillStyle = armed ? info.color : KIT.text;
          g.fillText(info.name, x + TILE_W / 2, rowY + TILE_H - 26);
        }
      }

      // What the last one you touched actually does.
      g.beginPath();
      g.roundRect(M, DESC_Y, INNER, 130, 18);
      g.fillStyle = KIT.well;
      g.fill();
      g.textAlign = 'left';
      if (state.reading < 0) {
        g.font = font(500, 24);
        g.fillStyle = KIT.faint;
        g.fillText('tap an attachment to read what it does', M + 28, DESC_Y + 66);
      } else {
        const info = ATTACHMENTS[state.reading];
        g.font = font(700, 28);
        g.fillStyle = info.color;
        g.fillText(info.name, M + 28, DESC_Y + 42);
        g.font = font(500, 23);
        g.fillStyle = KIT.text;
        g.fillText(info.desc, M + 28, DESC_Y + 86, INNER - 56);
      }
    },
  };
}

/** The three attachment glyphs: a fork, a swelling ring, a shrinking one. */
function drawAttachIcon(g: CanvasRenderingContext2D, type: number, cx: number, cy: number, r: number, color: string): void {
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 3;
  if (type === 0) {
    // SPLIT: one ball forking into THREE — the count the attachment
    // actually throws (ATTACH.splitCount), so the glyph can't lie about it.
    g.beginPath();
    g.moveTo(cx - r, cy);
    g.lineTo(cx - r * 0.15, cy);
    g.stroke();
    for (const s of [-1, 0, 1]) {
      g.beginPath();
      g.moveTo(cx - r * 0.15, cy);
      g.lineTo(cx + r * 0.66, cy + s * r * 0.66);
      g.stroke();
      g.beginPath();
      g.arc(cx + r * 0.74, cy + s * r * 0.72, 5.5, 0, Math.PI * 2);
      g.fill();
    }
    return;
  }
  // GROW / SHRINK: a small ball and a big one, with the arrow between them
  // pointing the way the ball travels.
  const small = r * 0.3;
  const big = r * 0.62;
  const grow = type === 1;
  g.beginPath();
  g.arc(cx - r * 0.6, cy, grow ? small : big, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(cx + r * 0.62, cy, grow ? big : small, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(cx - r * 0.06, cy);
  g.lineTo(cx + r * 0.12, cy);
  g.stroke();
}

/* ── the panel, off screen ────────────────────────────────────────────── */

/**
 * THE SAME PANEL, ANYWHERE. The tutorial re-hosts the loadout on its own
 * in-arena console, and there must be exactly one of these: a second
 * hand-drawn copy is a copy that drifts. So the face is painted into an
 * off-screen kit panel and handed over as a canvas to blit — the trick the
 * TOWN wing's NEWS tab uses for the newspaper.
 */
let offscreen: Panel | null = null;
function panel(): Panel {
  if (!offscreen) offscreen = new Panel(1, 1, BALLS_W, BALLS_H);
  return offscreen;
}

/** Paint the loadout at its current state and hand back the canvas. */
export function renderBallsPanel(hover: string | null): HTMLCanvasElement {
  const p = panel();
  const f = ballsFace();
  p.paint(f.title, f.body, f.buttons, hover);
  return p.ctx().canvas as HTMLCanvasElement;
}

/** UV on that canvas → the button under it (for a host doing its own rays). */
export function ballsHit(u: number, v: number): string | null {
  return panel().buttonAt(u, v);
}
