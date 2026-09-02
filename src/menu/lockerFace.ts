/**
 * CUSTOMIZATION — THE LOCKER and THE STORE (MENUS 3): one plate, two faces,
 * on the panel kit. What you own and wear; what you don't and could.
 *
 * The panel is named for what you came to do, not for what the body is
 * called under the hood. "THE BLANK" is the mannequin's engineering name
 * (avatar/mannequin.ts) and it stays there; nothing in the menus asks a
 * player to learn it.
 *
 * The tab grammar the wrap wears (MENUS 2) comes to the modals: LOCKER ·
 * STORE across the top, and under it the row of sub-boards each face
 * offers — PLATFORMS · GEAR · COLOUR in the locker, PLATFORMS · GEAR in
 * the store (there is nothing to buy about your own base tone).
 *
 * The TILES are ghost buttons the body paints: the kit owns the plate, the
 * hover ease and the hit-test, while the artwork stays the bespoke icon
 * painters this game already had (menu/skinIcons.ts — a deck's grain, a
 * gear piece's silhouette). A tile in the store that is being TRIED ON
 * grows a real BUY button; the rest of its chrome is drawn.
 *
 * The COLOUR face is the BASE TONE and nothing else: all white or all
 * black. The hands' neon hue and lightness tracks that used to live under
 * it are gone — the glove accent is the house ember for everyone, and
 * everything past the base tone is PAINT (the bay, on the YOU wing).
 */

import { KIT, type PanelButton } from '../ui/kit/panel.js';
import { font } from '../ui/kit/fonts.js';
import { customization, platformOwned, gearOwned } from './customization.js';
import { canAfford, coins } from './wallet.js';
import { PLATFORM_SKINS, type PlatformSkin } from '../avatar/skins.js';
import { GEAR as GEAR_CATALOGUE, type GearDef } from '../avatar/gear.js';
import { drawGearIcon, drawPlatformIcon } from './skinIcons.js';

export const LOCKER_W = 1024;
export const LOCKER_H = 1024;

const M = 56;
const INNER = LOCKER_W - M * 2;
const TAB_Y = 36;
const TAB_H = 76;
const SUB_Y = 140;
const SUB_H = 64;
const GRID_TOP = 240;
/** The GEAR board carries a shelf row under the board chips, so its grid
 *  starts lower — and holds at most six pieces, two rows at full size. */
const SHELF_Y = 216;
const SHELF_H = 52;
const GEAR_GRID_TOP = SHELF_Y + SHELF_H + 24;
const COLS = 3;
const GAP = 20;
const TILE_W = (INNER - (COLS - 1) * GAP) / COLS;
const FOOT_Y = LOCKER_H - 140;

/** THE BASE: the one pair of buttons this board carries. */
const BASE_Y = 268;
const BASE_H = 108;

/** The brand mark in the tab strip. The TABS say which face is up, so the
 *  mark says what the plate is FOR — repeating "LOCKER" beside the lit
 *  LOCKER tab told you nothing twice. */
const TITLE = 'CUSTOMIZATION';

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

export interface LockerFace {
  title: string;
  body: (g: CanvasRenderingContext2D, hover: string | null) => void;
  buttons: PanelButton[];
}

/* ── which board is showing ───────────────────────────────────────────── */

type Board = 'platforms' | 'gear' | 'colour';

/** COLOUR is the locker's alone; the store falls back to pads. */
function board(locker: boolean): Board {
  const t = customization.tab;
  if (!locker && t === 'colour') return 'platforms';
  if (t === 'gear' || t === 'colour') return t;
  return 'platforms';
}

interface Tile {
  id: string;
  kind: 'platform' | 'gear';
  def: PlatformSkin | GearDef;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The tiles this face is showing, laid out three across. The LOCKER lists
 *  what you own (tap to wear), the STORE what you don't (tap to try on). */
function tiles(locker: boolean): Tile[] {
  const b = board(locker);
  const picked: Array<{ kind: 'platform' | 'gear'; def: PlatformSkin | GearDef; index: number }> = [];
  if (b === 'gear') {
    GEAR_CATALOGUE.forEach((g, i) => {
      if (g.slot === customization.gearSlot && gearOwned(g.id) === locker) picked.push({ kind: 'gear', def: g, index: i });
    });
  } else if (b === 'platforms') {
    PLATFORM_SKINS.forEach((s, i) => {
      if (platformOwned(s.id) === locker) picked.push({ kind: 'platform', def: s, index: i });
    });
  }
  const top = b === 'gear' ? GEAR_GRID_TOP : GRID_TOP;
  const rows = Math.max(1, Math.ceil(picked.length / COLS));
  // Three rows fit at full height; a deeper catalogue shares the same span.
  const span = FOOT_Y - 24 - top;
  const step = rows <= 3 ? 250 : Math.floor(span / rows);
  const h = Math.min(230, step - 20);
  return picked.map((p, i) => ({
    id: `shop-${p.kind === 'gear' ? 'gr' : 'pf'}-${p.index}`,
    ...p,
    x: M + (i % COLS) * (TILE_W + GAP),
    y: top + Math.floor(i / COLS) * step,
    w: TILE_W,
    h,
  }));
}

/** Is this the thing the STORE is currently trying on? */
function previewed(t: Tile): boolean {
  return customization.preview?.kind === t.kind && customization.preview.id === t.def.id;
}

const buyRect = (t: Tile): { x: number; y: number; w: number; h: number } => ({
  x: t.x + 14,
  y: t.y + t.h - 62,
  w: t.w - 28,
  h: 48,
});

/* ── the faces ────────────────────────────────────────────────────────── */

export function lockerFace(locker: boolean): LockerFace {
  const b = board(locker);
  const buttons: PanelButton[] = [
    { id: 'open-locker', label: 'LOCKER', tab: true, x: 400, y: TAB_Y, w: 200, h: TAB_H, selected: locker },
    { id: 'open-shop', label: 'STORE', tab: true, x: 620, y: TAB_Y, w: 200, h: TAB_H, selected: !locker },
  ];

  // The sub-board chips: what this face has to show.
  const boards: Array<[Board, string, string]> = locker
    ? [
        ['platforms', 'PLATFORMS', 'tab-platforms'],
        ['gear', 'GEAR', 'tab-gear'],
        ['colour', 'COLOUR', 'tab-colour'],
      ]
    : [
        ['platforms', 'PLATFORMS', 'tab-platforms'],
        ['gear', 'GEAR', 'tab-gear'],
      ];
  const cw = (INNER - (boards.length - 1) * 16) / boards.length;
  boards.forEach(([key, label, id], i) => {
    buttons.push({ id, label, x: M + i * (cw + 16), y: SUB_Y, w: cw, h: SUB_H, small: true, selected: b === key });
  });
  // THE SHELVES: the gear board shows one slot at a time — six pieces at
  // most, two rows at full size, every price on its tile.
  if (b === 'gear') {
    const shelves: Array<['head' | 'body' | 'hands', string]> = [
      ['head', 'HEAD'],
      ['body', 'BODY'],
      ['hands', 'HANDS'],
    ];
    const sw = (INNER - 2 * 16) / 3;
    shelves.forEach(([slot, label], i) => {
      buttons.push({
        id: `gear-${slot}`,
        label,
        x: M + i * (sw + 16), y: SHELF_Y, w: sw, h: SHELF_H,
        small: true,
        px: 22,
        selected: customization.gearSlot === slot,
      });
    });
  }

  buttons.push({ id: 'custom-close', label: 'CLOSE', x: LOCKER_W - M - 240, y: FOOT_Y + 24, w: 240, h: 84, small: true });
  if (!locker) {
    buttons.push({
      id: 'store-wallet',
      label: `$ ${coins.balance}`,
      sub: 'iron-dollars',
      x: M, y: FOOT_Y + 24, w: 280, h: 84,
      display: true,
      small: true,
      tone: KIT.accent,
    });
  }

  if (b === 'colour') return { title: TITLE, buttons: [...buttons, ...colourButtons()], body: colourBody };

  const shown = tiles(locker);
  for (const t of shown) {
    buttons.push({ id: t.id, label: '', ghost: true, x: t.x, y: t.y, w: t.w, h: t.h });
    // A tile being tried on grows a real BUY — unless it is EARNED, which
    // no amount of money answers.
    if (!locker && previewed(t) && !(t.kind === 'platform' && (t.def as PlatformSkin).earnedBy)) {
      const price = (t.def as { price?: number }).price ?? 0;
      const r = buyRect(t);
      buttons.push({
        id: `shop-buy-${t.kind === 'gear' ? 'gr' : 'pf'}-${t.index}`,
        label: `BUY  $ ${price}`,
        x: r.x, y: r.y, w: r.w, h: r.h,
        small: true,
        primary: canAfford(price),
        disabled: !canAfford(price),
      });
    }
  }
  return {
    title: TITLE,
    buttons,
    body: (g, hover) => {
      for (const t of shown) drawTile(g, t, locker, hover);
      if (shown.length === 0) {
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = font(500, 26);
        g.fillStyle = KIT.faint;
        g.fillText(
          locker ? 'nothing here yet — the STORE has the rest' : "you own every one of these",
          LOCKER_W / 2,
          (b === 'gear' ? GEAR_GRID_TOP : GRID_TOP) + 160,
        );
      }
    },
  };
}

/** One cosmetic tile: the icon, the name, and what it costs or says. */
function drawTile(g: CanvasRenderingContext2D, t: Tile, locker: boolean, hover: string | null): void {
  const gear = t.kind === 'gear';
  const accent = gear ? 0xc9a86a : (t.def as PlatformSkin).neon;
  const tint = css(accent);
  const worn = gear ? customization.gear.includes(t.def.id) : customization.platform === t.def.id;
  const owned = gear ? gearOwned(t.def.id) : platformOwned(t.def.id);
  const tryOn = !locker && previewed(t);
  const hot = hover === t.id;

  g.beginPath();
  g.roundRect(t.x, t.y, t.w, t.h, 18);
  g.fillStyle = worn || tryOn ? KIT.accentFaint : hot ? KIT.plateHover : KIT.plate;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = worn || tryOn ? tint : hot ? KIT.lineHover : KIT.line;
  g.stroke();
  // The edge tick the kit's own buttons wear, in the piece's own colour.
  if (worn || tryOn) {
    g.fillStyle = tint;
    g.beginPath();
    g.roundRect(t.x + 8, t.y + 14, 5, t.h - 28, 2.5);
    g.fill();
  }

  const cx = t.x + t.w / 2;
  const iconR = t.h * 0.24;
  const iconY = t.y + t.h * (tryOn ? 0.3 : 0.34);
  if (gear) drawGearIcon(g, t.def as GearDef, cx, iconY, iconR, tint);
  else drawPlatformIcon(g, t.def as PlatformSkin, cx, iconY, iconR);

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = font(700, 26);
  g.fillStyle = worn || tryOn || hot ? KIT.textHi : KIT.text;
  g.fillText(t.def.name, cx, t.y + t.h * (tryOn ? 0.58 : 0.68), t.w - 28);

  // The footer line: worn, owned, earned, or priced.
  if (tryOn) return; // the BUY button owns the strip
  g.font = font(600, 20);
  if (worn) {
    g.fillStyle = KIT.accent;
    g.fillText(gear ? 'WORN' : 'EQUIPPED', cx, t.y + t.h - 26);
  } else if (owned) {
    g.fillStyle = KIT.faint;
    g.fillText(gear ? 'tap to wear' : 'tap to stand on', cx, t.y + t.h - 26);
  } else if (!gear && (t.def as PlatformSkin).earnedBy) {
    g.fillStyle = KIT.info;
    g.fillText((t.def as PlatformSkin).earnedBy ?? 'EARNED', cx, t.y + t.h - 26, t.w - 24);
  } else {
    const price = (t.def as { price?: number }).price ?? 0;
    g.fillStyle = canAfford(price) ? KIT.accent : KIT.disabled;
    g.fillText(`$ ${price}`, cx, t.y + t.h - 26);
  }
}

/* ── COLOUR: the base tone ────────────────────────────────────────────── */

function colourButtons(): PanelButton[] {
  const onyx = customization.avatar === 'onyx';
  const half = (INNER - 24) / 2;
  return [
    { id: 'base-white', label: 'ALL WHITE', sub: onyx ? 'you, bare' : 'worn', x: M, y: BASE_Y, w: half, h: BASE_H, selected: !onyx },
    { id: 'base-black', label: 'ALL BLACK', sub: onyx ? 'worn' : 'you, in onyx', x: M + half + 24, y: BASE_Y, w: half, h: BASE_H, selected: onyx },
  ];
}

function colourBody(g: CanvasRenderingContext2D): void {
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.font = font(700, 22);
  g.letterSpacing = '3px';
  g.fillStyle = KIT.faint;
  g.fillText('THE BASE', M, BASE_Y - 26);
  g.letterSpacing = '0px';
  g.font = font(500, 22);
  g.fillStyle = KIT.dim;
  g.fillText('everything past the base tone is PAINT — the bay is on the YOU wing', M, BASE_Y + BASE_H + 26);
}
