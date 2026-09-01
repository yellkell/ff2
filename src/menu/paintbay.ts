/**
 * THE PAINT BAY — where a blank takes its colour (docs/paint.md §2, P2).
 *
 * One kit panel standing beside the locker mirror, opened from the YOU
 * wing. Left half: THE TRAY — your owned, unplaced units, a chip per
 * colour with its count; tap one and it rides your ray as THE HAND.
 * Right half: THE RACK — the same colours for sale (base rack + neon
 * rack; the top shelf arrives later), priced in bolt-dollars.
 *
 * The BODY work happens off-panel: MenuSystem raycasts the mirror's
 * paint surfaces while the bay is open — the held unit ghosts onto the
 * body under the ray, trigger commits it, the thumbstick twists and
 * sizes it (grip switches to width), pointing at placed paint and
 * squeezing lifts it back into the hand, B returns the hand to the tray.
 * All the state ops live in avatar/paint.ts; this module is the face and
 * the local `pb:*` click routing.
 */

import { KIT, type PanelButton } from '../ui/kit/panel.js';
import { font } from '../ui/kit/fonts.js';
import { PAINT } from '../config.js';
import {
  bay,
  grantUnit,
  handReturn,
  handTake,
  invState,
  myLook,
  ownedCount,
  unitPrice,
  type PaintKind,
} from '../avatar/paint.js';
import { canAfford, coins, spendCoins } from './wallet.js';

export const BAY_W = 1088;
export const BAY_H = 1280;
const M = 72;
const HALF = (BAY_W - M * 2 - 48) / 2; // two columns
const RIGHT = M + HALF + 48;

/** Which kind the tray/rack grids are showing. */
export const bayFaceState = { kind: 'stripe' as PaintKind, version: 1 };

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

/** Colour swatch grid geometry: 4 columns of chips per half. */
const CHIP = 4;
const chipRect = (x0: number, i: number): { x: number; y: number; w: number; h: number } => {
  const w = (HALF - (CHIP - 1) * 14) / CHIP;
  return { x: x0 + (i % CHIP) * (w + 14), y: 384 + Math.floor(i / CHIP) * (w + 26), w, h: w };
};

export interface BayFace {
  title: string;
  body: (g: CanvasRenderingContext2D) => void;
  buttons: PanelButton[];
}

export function bayFace(): BayFace {
  const kind = bayFaceState.kind;
  const buttons: PanelButton[] = [
    { id: 'pb:kind-stripe', label: 'STRIPES', x: M, y: 170, w: 150, h: 84, small: true, selected: kind === 'stripe' },
    { id: 'pb:kind-splotch', label: 'SPLOTCHES', x: M + 158, y: 170, w: 150, h: 84, small: true, selected: kind === 'splotch' },
    { id: 'pb:kind-dot', label: 'DOTS', x: M + 316, y: 170, w: 150, h: 84, small: true, selected: kind === 'dot' },
    { id: 'pb:kind-square', label: 'SQUARES', x: M + 474, y: 170, w: 150, h: 84, small: true, selected: kind === 'square' },
    {
      id: 'pb:wallet',
      label: `$ ${coins.balance}`,
      sub: 'bolt-dollars',
      x: BAY_W - M - 260, y: 170, w: 260, h: 84,
      display: true,
      small: true,
      tone: KIT.accent,
    },
  ];
  // Ghost chips: tray (left) takes, rack (right) buys.
  PAINT.colours.forEach((_, i) => {
    if (PAINT.tierOf(i) === 2) return; // the top shelf arrives later
    buttons.push({ id: `pb:take-${i}`, label: '', ghost: true, ...chipRect(M, i) });
    buttons.push({ id: `pb:buy-${i}`, label: '', ghost: true, ...chipRect(RIGHT, i) });
  });
  if (bay.held) {
    buttons.push({
      id: 'pb:return',
      label: 'RETURN TO TRAY',
      sub: `${bay.held.kind.toUpperCase()} in hand — or press B`,
      x: M, y: BAY_H - 236, w: HALF + 100, h: 100,
      tone: KIT.warn,
    });
  }
  buttons.push({ id: 'paintbay-close', label: 'CLOSE', x: BAY_W - M - 300, y: BAY_H - 236, w: 300, h: 100, small: true });

  const body = (g: CanvasRenderingContext2D): void => {
    g.textBaseline = 'middle';
    g.font = font(600, 30);
    g.fillStyle = KIT.dim;
    g.textAlign = 'left';
    g.fillText('THE TRAY — yours, tap to take', M, 330);
    g.fillText('THE RACK — buy with $', RIGHT, 330);
    // The chips themselves (ghost buttons hit-test; we paint).
    PAINT.colours.forEach((hex, i) => {
      if (PAINT.tierOf(i) === 2) return;
      const owned = ownedCount(kind, i);
      const price = unitPrice(kind, i);
      for (const [x0, isTray] of [[M, true], [RIGHT, false]] as Array<[number, boolean]>) {
        const r = chipRect(x0, i);
        g.fillStyle = css(hex);
        g.beginPath();
        g.roundRect(r.x, r.y, r.w, r.h, 14);
        g.fill();
        g.strokeStyle = isTray && owned > 0 ? KIT.accent : 'rgba(255,255,255,0.18)';
        g.lineWidth = 2.5;
        g.stroke();
        g.textAlign = 'center';
        if (isTray) {
          if (owned > 0) {
            // The count badge.
            g.fillStyle = 'rgba(10,8,6,0.85)';
            g.beginPath();
            g.roundRect(r.x + r.w - 46, r.y + 6, 40, 34, 10);
            g.fill();
            g.fillStyle = '#fff';
            g.font = font(700, 24);
            g.fillText(String(owned), r.x + r.w - 26, r.y + 24);
          } else {
            g.fillStyle = 'rgba(10,8,6,0.55)';
            g.beginPath();
            g.roundRect(r.x, r.y, r.w, r.h, 14);
            g.fill();
          }
        } else {
          g.fillStyle = 'rgba(10,8,6,0.8)';
          g.beginPath();
          g.roundRect(r.x + 8, r.y + r.h - 40, r.w - 16, 32, 8);
          g.fill();
          g.fillStyle = canAfford(price) ? '#ffd98f' : 'rgba(255,255,255,0.4)';
          g.font = font(700, 22);
          g.fillText(`$${price}`, r.x + r.w / 2, r.y + r.h - 24);
        }
      }
    });
    // The verbs, written where a first-timer looks.
    g.textAlign = 'center';
    g.font = font(500, 26);
    g.fillStyle = bay.held ? KIT.accent : KIT.faint;
    const hint = bay.held
      ? 'point at your body — trigger places · stick twists & sizes · grip = width'
      : `${myLook().paint.length}/${PAINT.maxUnits} placed · point at painted body + trigger lifts it back into your hand`;
    g.fillText(hint, BAY_W / 2, BAY_H - 90);
  };

  return { title: 'THE PAINT BAY', body, buttons };
}

/** Route a pressed `pb:*` id. True when handled (bay-local). */
export function bayClick(id: string): boolean {
  const done = (): boolean => {
    bayFaceState.version += 1;
    return true;
  };
  if (id === 'pb:kind-stripe') return (bayFaceState.kind = 'stripe'), done();
  if (id === 'pb:kind-splotch') return (bayFaceState.kind = 'splotch'), done();
  if (id === 'pb:kind-dot') return (bayFaceState.kind = 'dot'), done();
  if (id === 'pb:kind-square') return (bayFaceState.kind = 'square'), done();
  if (id === 'pb:return') return handReturn(), done();
  if (id === 'pb:wallet') return true;
  if (id.startsWith('pb:take-')) {
    const colour = Number(id.slice(8));
    if (ownedCount(bayFaceState.kind, colour) > 0) handTake(bayFaceState.kind, colour);
    return done();
  }
  if (id.startsWith('pb:buy-')) {
    const colour = Number(id.slice(7));
    const price = unitPrice(bayFaceState.kind, colour);
    if (canAfford(price) && spendCoins(price)) grantUnit(bayFaceState.kind, colour);
    return done();
  }
  return false;
}

/** Everything the bay face repaints on — MenuSystem's freshness key. */
export function bayFaceKey(): string {
  return [bayFaceState.version, bay.version, invState.version, coins.balance].join('|');
}
