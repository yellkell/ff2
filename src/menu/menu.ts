/**
 * The lobby: three smoked-steel plates on a shallow arc in front of the
 * player — industrial robot-wars styling, translucent so your room stays
 * visible through them. Centre = AIM TRAINING (the headline mode), left =
 * 1V1 (quick match + vs bot), right = stats & connection info. A fourth
 * plate hangs BEHIND the player: the Firebase leaderboard (1V1 score / aim
 * training tabs) — lobby only, gone the moment a bout or run starts. Each
 * panel is a canvas texture on a plane; MenuSystem raycasts the controllers
 * for hover + click and maps the hit UV to an action zone.
 */

import {
  CanvasTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene,
} from 'three';
import { app, saveBallArc, saveBallAttach, saveCurveStrength, saveShowBody } from './appState.js';
import { coins } from './wallet.js';
import { ATTACH, GAME_TITLE, type ArcadeMode } from '../config.js';
import { gazette, type GazetteArticle } from '../net/gazette.js';
import { PUB_MAX_PLAYERS } from '../pub/protocol.js';
import { PUB_REGIONS } from '../pub/config.js';
import { UI, buttonPlate, hazardStrip, plate, stencilFont } from '../ui/industrial.js';

export type PanelId =
  | 'train'
  | 'duel'
  | 'info'
  /** THE PAINT BAY (a kit panel modal — src/menu/paintbay.ts). */
  | 'paintbay'
  /** THE PROFILE pop-out above the YOU wing: the chip, and the card it drops. */
  | 'profile'
  | 'profilecard'
  | 'custom'
  | 'loadout'
  | 'balls'
  /** The platform shop (a sub-modal of customisation). */
  | 'shop'
  /** The ARCADE campaign line-up — the titan gauntlet (modal over the lobby). */
  | 'campaign'
  /** The shared arcade LOBBY (room browser / squad room) for 2v2 / ffa / raid
   *  — modal over the lobby. */
  | 'lobby';

export type MenuAction =
  | 'start-tutorial'
  | 'start-training'
  | 'arcade-2v2'
  | 'arcade-ffa'
  /** Open / close the campaign line-up; start a stage / a timed run. */
  | 'open-campaign'
  | 'campaign-close'
  | 'campaign-speedrun'
  | 'campaign-hardcore'
  /** The pick-your-damage launch pop-up the run buttons open. */
  | 'campaign-launch-start'
  | 'campaign-launch-cancel'
  /** The sealed entry beneath the line-up: GOOPLIATH's own fight. */
  | 'campaign-goopliath'
  | `campaign-${number}`
  /** Run difficulty picker — campaign (local) and raid (host, mirrored). */
  | `diff-${string}`
  | `raiddiff-${string}`
  /** Open the shared arcade lobby modal for a networked mode (2v2 / ffa / raid). */
  | 'open-raid'
  /** The arcade lobby: browse rooms, make one, join one, drop onto bots, host
   *  controls (raid hardcore, ffa short-handed start). */
  | 'lobby-close'
  | 'lobby-host'
  | 'lobby-vsbots'
  | 'lobby-hardcore'
  /** RAID host breaker: swap the titan run for the GOOPLIATH fight. */
  | 'lobby-goopliath'
  | 'lobby-start'
  | 'lobby-leave'
  | `lobby-join-${string}`
  /** Take a WATCHER seat in a listed lobby — travel with the squad and
   *  stand on the audience ground (DESIGN §3.2). */
  | `lobby-watch-${string}`
  | 'toggle-shootback'
  | 'toggle-onlybots'
  | 'toggle-voice'
  /** HIDE PAINT — render every other player's body bare (docs/paint.md §6). */
  | 'toggle-hide-paint'
  | 'ranked-match'
  /** RANKED server browser: host your own room, go back to the mode list, or
   *  cancel a host/join and return to the browser. Joining a listed room is
   *  `ranked-join-${docId}`. */
  | 'ranked-host'
  | 'ranked-back'
  | 'ranked-cancel'
  | `ranked-join-${string}`
  | 'quick-match'
  | 'cancel-queue'
  | 'private-open'
  | 'private-create'
  | 'private-enter'
  | 'private-back'
  /** Private-match FORMAT, picked before the code is reserved. */
  | 'private-mode-1v1'
  | 'private-mode-2v2'
  | 'private-mode-ffa'
  | 'kp-del'
  | 'kp-join'
  | `kp-${number}`
  /** Arena-backdrop picker (LOCKER » ARENA tab): bare AR / desert / salt flats. */
  | 'env-desert'
  | 'env-saltflats'
  | 'env-factory'
  | 'tab-arena'
  /** Leaderboard top tab: BATTLE fronts the 1v1 / 2v2 / ffa boards. */
  | 'lb-battle'
  | 'lb-ranked'
  | 'lb-xp'
  | 'lb-arcade'
  | 'lb-training'
  | 'lb-duo'
  | 'lb-ffa'
  /** ARCADE PvE run-time sub-boards. */
  | 'lb-gauntlet'
  | 'lb-raid'
  | 'lb-goopliath'
  | `lb-row-${number}`
  /** THE PROFILE pop-out (MENUS 2): the chip toggles the card; CLOSE folds it. */
  | 'profile-toggle'
  | 'profile-close'
  | 'edit-note'
  | 'profile-back'
  | 'rename'
  /** Hover-only: a profile trophy chip / clear badge — shows its tooltip. */
  | `badge-${string}`
  | 'open-pub'
  | 'pub-back'
  /** ARCADE → RAVE RAID (the rave page, src/rave/). */
  | 'open-rave'
  | `pub-go-${string}`
  | 'open-custom'
  | 'custom-close'
  /** Dragging the armour-colour hue bar (continuous — MenuSystem reads the UV). */
  | 'av-color'
  /** Dragging the armour lightness/darkness bar. */
  | 'av-light'
  /** Reset the armour colour to the skin's default palette. */
  | 'av-uncolor'
  /** Dragging the avatar-accent (neon) hue bar in the locker's COLOUR tab. */
  | 'accent-color'
  /** Dragging the avatar-accent (neon) lightness bar. */
  | 'accent-light'
  /** Reset the avatar-accent (neon) hue to the house ember default. */
  | 'accent-default'
  /** The body's ONE choice: start all white, or all black. */
  | 'base-white'
  | 'base-black'
  /** Open / close THE PAINT BAY (the stripe-and-splotch modal). */
  | 'open-paintbay'
  | 'paintbay-close'
  /** The header tab pair: STORE (all items) ⇄ LOCKER (your inventory). */
  | 'open-shop'
  | 'open-locker'
  /** Switch the shop / locker tab. */
  | 'tab-avatars'
  | 'tab-platforms'
  | 'tab-gear'
  | 'tab-colour'
  /** Tap an avatar tile (equip) or a platform tile (buy if unowned, else equip). */
  | `shop-av-${number}`
  | `shop-pf-${number}`
  /** Tap a GEAR tile (wear / take off if owned; try on in the STORE). */
  | `shop-gr-${number}`
  /** The BUY button on a previewed (tried-on) STORE tile. */
  | `shop-buy-av-${number}`
  | `shop-buy-pf-${number}`
  | `shop-buy-gr-${number}`
  /** Open / close the Gasket Gazette. */
  | 'open-gazette'
  | 'gazette-close'
  /** Open / close the SETTINGS modal (the gear disc left of the paper). */
  | 'open-settings'
  | 'settings-close'
  | 'settings-report'
  | 'settings-credits'
  | 'credits-back'
  /** Toggle the lobby/battle music mute (now inside the SETTINGS modal). */
  | 'toggle-mute'
  /** Dragging the SFX / music volume sliders (continuous — MenuSystem reads UV). */
  | 'sfx-vol'
  | 'music-vol';

const PW = 512;
const PH = 400;
// The ARCADE panel holds TUTORIAL / CAMPAIGN / RAID / AIM TRAINING plus its
// three breaker toggles (shoot-back, only-play-bots, voice-chat) — the
// 2V2 / FFA brawls live on the BATTLE panel.
const TRAIN_H = PH + 80;
// The 1V1 panel grows a little downward so the "searching for an opponent…"
// line sits inside the frame instead of hanging off the bottom edge.
const DUEL_H = PH + 48;
// The leaderboard plate is taller than the lobby panels so the whole top 10
// fits at once — its own canvas (same width, more height) and a physical size
// scaled to match, so the text keeps the lobby's pixel density (no stretch).
const PROFILE_KEYBOARD_HINT_MS = 4500;

let profileKeyboardHintUntil = 0;

export function flashProfileKeyboardHint(): void {
  profileKeyboardHintUntil = performance.now() + PROFILE_KEYBOARD_HINT_MS;
}

export function clearProfileKeyboardHint(): void {
  profileKeyboardHintUntil = 0;
}

/** Whether the "turn around to the keyboard" hint is still on screen — the
 *  freshness tick watches this so its expiry triggers the clearing repaint. */
export function profileHintActive(): boolean {
  return performance.now() < profileKeyboardHintUntil;
}

export interface MenuPanel {
  id: PanelId;
  mesh: Mesh;
  redraw: (hoverAction: MenuAction | null) => void;
  /** Map a hit UV (u right, v up) to an action, or null. */
  hitTest: (u: number, v: number) => MenuAction | null;
  /**
   * Continuous control (e.g. a slider): called every frame the trigger is
   * held over the panel. Returns true if the hit landed on the control (the
   * caller then redraws and suppresses the click action).
   */
  drag?: (u: number, v: number) => boolean;
  /**
   * Self-contained click on trigger-down (mutates + persists its own state).
   * Returns true if it handled the hit, so the caller redraws + clicks the
   * relay sound instead of running a global MenuAction.
   */
  click?: (u: number, v: number) => boolean;
}

export interface Menu {
  group: Group;
  panels: MenuPanel[];
  setVisible: (v: boolean) => void;
  redrawAll: (hoverId: PanelId | null, hoverAction: MenuAction | null) => void;
}

/** The shared panel skeleton: smoked plate, hazard chip, stencil title. The
 *  taller leaderboard plate passes its own width/height. */
function panelBg(
  ctx: CanvasRenderingContext2D,
  hover: boolean,
  accent: string,
  title: string,
  w = PW,
  h = PH,
): void {
  ctx.clearRect(0, 0, w, h);
  plate(ctx, 8, 8, w - 16, h - 16, {
    cut: 26,
    fill: hover ? 'rgba(14,15,20,0.6)' : UI.ink,
    stroke: hover ? accent : UI.steel,
  });
  hazardStrip(ctx, 36, 34, 52, 16, UI.amber);
  ctx.textAlign = 'left';
  // Pin the baseline: the canvas ctx is REUSED across repaints, and hover
  // paths leave different textBaseline behind — an inherited baseline made
  // the title hop up and down as the pointer moved.
  ctx.textBaseline = 'middle';
  ctx.font = stencilFont(40);
  ctx.fillStyle = accent;
  ctx.fillText(title, 104, 44);
  ctx.strokeStyle = hover ? accent : UI.steelDim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(36, 72);
  ctx.lineTo(w - 36, 72);
  ctx.stroke();
  ctx.textAlign = 'center';
}

interface PanelOpts {
  cw?: number;
  ch?: number;
  drag?: MenuPanel['drag'];
  click?: MenuPanel['click'];
}

function makePanel(
  id: PanelId,
  wMeters: number,
  hMeters: number,
  draw: (ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null) => void,
  hitTest: MenuPanel['hitTest'],
  opts: PanelOpts = {},
): MenuPanel {
  const { cw = PW, ch = PH, drag, click } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  const mesh = new Mesh(
    new PlaneGeometry(wMeters, hMeters),
    new MeshBasicMaterial({ map: texture, transparent: true }),
  );
  mesh.name = `menu-panel:${id}`;
  const redraw = (hoverAction: MenuAction | null): void => {
    draw(ctx, hoverAction);
    texture.needsUpdate = true;
  };
  return { id, mesh, redraw, hitTest, drag, click };
}

/** Centre — ARCADE: the guided TUTORIAL, the single-player titan CAMPAIGN and
 *  AIM TRAINING, plus the three breaker toggles. (2V2 / FFA now live on the
 *  BATTLE panel with the rest of the fights.) */
function drawTrain(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  panelBg(ctx, false, UI.emberBright, 'ARCADE', PW, TRAIN_H);
  // Until the tutorial has been RUN once, everything but the tutorial itself
  // is sealed (MenuSystem's pre-tutorial gate) — draw it that way.
  const locked = !app.tutorialDone;

  // TUTORIAL sits at the top — the very first thing a new boxer should tap.
  // Until it's been completed it breathes ember (MenuSystem repaints this
  // panel every frame while locked) so there's no hunting for the next step.
  const pulse = locked ? 0.5 + 0.5 * Math.sin(performance.now() / 320) : 0;
  buttonPlate(ctx, 70, 80, PW - 140, 54, 'TUTORIAL', UI.emberBright, hoverAction === 'start-tutorial', false, pulse);
  // The single-player CAMPAIGN — the titan gauntlet — right below it.
  buttonPlate(ctx, 70, 140, PW - 140, 54, 'CAMPAIGN', UI.danger, !locked && hoverAction === 'open-campaign', locked);
  // The RAID — up to five raiders, five titans, one lobby.
  buttonPlate(ctx, 70, 200, PW - 140, 54, 'RAID', '#b26bff', !locked && hoverAction === 'open-raid', locked);
  // Live "N OPEN" badge on the RAID plate — squads forming right now, so you
  // can see there's a raid to join without opening the browser (RANKED's pill).
  if (!locked && app.raidsOpen > 0) {
    const label = `${app.raidsOpen} OPEN`;
    ctx.font = '800 16px system-ui, sans-serif';
    const pillW = ctx.measureText(label).width + 34, pillH = 24;
    const px = PW - 70 - pillW, py = 215;
    plate(ctx, px, py, pillW, pillH, { cut: 8, fill: 'rgba(178,107,255,0.22)', stroke: '#b26bff', rivets: false });
    ctx.fillStyle = '#d3a5ff';
    ctx.beginPath();
    ctx.arc(px + 14, py + pillH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillText(label, px + 24, py + pillH / 2 + 1);
    ctx.textAlign = 'center';
  }
  buttonPlate(ctx, 70, 260, PW - 140, 54, 'AIM TRAINING', UI.ember, !locked && hoverAction === 'start-training', locked);
  if (locked) {
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,192,77,0.78)';
    ctx.fillText('you must complete the tutorial to advance', PW / 2, 334);
  }

  // Two industrial breaker switches: targets-shoot-back, then only-play-bots.
  const breaker = (text: string, on: boolean, hot: boolean, py: number, onFill: string, onStroke: string): void => {
    ctx.font = '700 21px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = hot ? UI.emberBright : UI.textDim;
    ctx.fillText(text, 64, py + 23);
    const pw = 96, ph = 34, px = PW - 64 - pw;
    plate(ctx, px, py, pw, ph, {
      cut: 10,
      fill: on ? onFill : hot ? 'rgba(255,176,0,0.16)' : 'rgba(150,150,170,0.12)',
      stroke: hot ? UI.emberBright : on ? onStroke : UI.steelDim,
      rivets: false,
    });
    ctx.fillStyle = on ? onStroke : UI.steelDim;
    const kw = pw / 2 - 10;
    ctx.fillRect(on ? px + pw - kw - 6 : px + 6, py + 6, kw, ph - 12);
  };
  breaker('targets shoot back', app.shootBack, hoverAction === 'toggle-shootback', 348, 'rgba(79,183,255,0.25)', UI.cool);
  breaker('only play bots', app.onlyBots, hoverAction === 'toggle-onlybots', 398, 'rgba(255,176,0,0.25)', UI.amber);
}

function hitTrain(_u: number, v: number): MenuAction | null {
  // v: 0 bottom → 1 top (canvas y = (1-v)*TRAIN_H).
  const y = (1 - v) * TRAIN_H;
  if (y >= 80 && y <= 134) return 'start-tutorial';
  if (y >= 140 && y <= 194) return 'open-campaign';
  if (y >= 200 && y <= 254) return 'open-raid';
  if (y >= 260 && y <= 314) return 'start-training';
  if (y >= 346 && y <= 384) return 'toggle-shootback';
  if (y >= 396 && y <= 434) return 'toggle-onlybots';
  return null;
}

/** Left — BATTLE. Every live fight: the 1v1 modes (Ranked / Quick / Private)
 *  and the 2V2 / FFA brawls — or the private-match sub-flow. */
function drawDuel(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  panelBg(ctx, false, UI.cool, 'BATTLE', PW, DUEL_H);
  switch (app.duelView) {
    case 'private':
      return drawPrivateMenu(ctx, hoverAction);
    case 'hosting':
      return drawHosting(ctx, hoverAction);
    case 'keypad':
      return drawKeypad(ctx, hoverAction);
    case 'browser':
      return drawBrowser(ctx, hoverAction);
    default:
      return drawDuelRoot(ctx, hoverAction);
  }
}

function hitDuel(u: number, v: number): MenuAction | null {
  switch (app.duelView) {
    case 'private':
      return hitPrivateMenu(u, v);
    case 'hosting':
      return hitHosting(v);
    case 'keypad':
      return hitKeypad(u, v);
    case 'browser':
      return hitBrowser(v);
    default:
      return hitDuelRoot(v);
  }
}

function drawDuelRoot(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  const queueing = app.state === 'queueing';
  const rankedAction = queueing ? 'cancel-queue' : 'ranked-match';
  // Every live fight is sealed until the tutorial has been run once.
  const locked = !app.tutorialDone;
  // RANKED is disabled while ONLY PLAY BOTS is on (no online queue allowed).
  const rankedOff = (app.onlyBots && !queueing) || locked;

  // RANKED — opens the server browser (host your own room, or join a listed
  // one). Greyed + dead while ONLY PLAY BOTS is on.
  buttonPlate(
    ctx, 70, 74, PW - 140, 58,
    queueing ? 'CANCEL' : 'RANKED',
    queueing ? UI.amber : UI.cool,
    !rankedOff && hoverAction === rankedAction,
    rankedOff,
  );

  // Live "N open" badge on the RANKED plate — how many servers are up to join.
  if (!queueing && !rankedOff && app.rankedRooms.length > 0) {
    const label = `${app.rankedRooms.length} OPEN`;
    ctx.font = '800 16px system-ui, sans-serif';
    const pillW = ctx.measureText(label).width + 34, pillH = 24;
    const px = PW - 70 - pillW, py = 82;
    plate(ctx, px, py, pillW, pillH, { cut: 8, fill: 'rgba(79,183,255,0.22)', stroke: UI.cool, rivets: false });
    ctx.fillStyle = UI.coolBright;
    ctx.beginPath();
    ctx.arc(px + 14, py + pillH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = UI.coolBright;
    ctx.fillText(label, px + 24, py + pillH / 2 + 1);
    ctx.textAlign = 'center';
  }

  // QUICK MATCH — drops you straight onto a bot, but keeps hunting; a human who
  // turns up pulls you into the live bout.
  buttonPlate(ctx, 70, 138, PW - 140, 58, 'QUICK MATCH', UI.ember, !locked && hoverAction === 'quick-match', locked);
  // PRIVATE — share a 5-digit code with a friend.
  buttonPlate(ctx, 70, 202, PW - 140, 54, 'PRIVATE', UI.coolBright, !locked && hoverAction === 'private-open', locked);

  // The BRAWLS — 2V2 and FFA — sit below a faint divider: same live-fight hub,
  // one section for duels, one for the free-for-alls.
  ctx.strokeStyle = UI.steelDim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(70, 268);
  ctx.lineTo(PW - 70, 268);
  ctx.stroke();
  buttonPlate(ctx, 70, 280, PW - 140, 50, '2V2', UI.cool, !locked && hoverAction === 'arcade-2v2', locked);
  buttonPlate(ctx, 70, 336, PW - 140, 50, 'FFA', UI.amber, !locked && hoverAction === 'arcade-ffa', locked);

  if (queueing) {
    ctx.textAlign = 'center';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(159,226,255,0.85)';
    ctx.fillText('searching for an opponent…', PW / 2, 404);
  } else if (locked) {
    // The same seal note the ARCADE panel carries — greyed plates alone
    // never said WHY everything was dead.
    ctx.textAlign = 'center';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,192,77,0.78)';
    ctx.fillText('you must complete the tutorial to advance', PW / 2, 404);
  }
}

function hitDuelRoot(v: number): MenuAction | null {
  const y = (1 - v) * DUEL_H;
  if (y >= 70 && y <= 136) {
    if (app.state === 'queueing') return 'cancel-queue';
    return app.onlyBots ? null : 'ranked-match'; // ranked disabled in only-bots mode
  }
  if (y >= 138 && y <= 198) return 'quick-match';
  if (y >= 202 && y <= 258) return 'private-open';
  if (y >= 280 && y <= 332) return 'arcade-2v2';
  if (y >= 336 && y <= 388) return 'arcade-ffa';
  return null;
}

/** The private-match format row: pick 1V1 / 2V2 / FFA, then reserve a code. */
const PRIV_MODES: { mode: ArcadeMode; label: string; action: MenuAction; seats: string }[] = [
  { mode: '1v1', label: '1V1', action: 'private-mode-1v1', seats: '2' },
  { mode: '2v2', label: '2V2', action: 'private-mode-2v2', seats: '4' },
  { mode: 'ffa', label: 'FFA', action: 'private-mode-ffa', seats: '4' },
];
const PRIV_CHIP_Y = 100;
const PRIV_CHIP_H = 52;

function drawPrivateMenu(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillStyle = UI.textDim;
  // Kept short deliberately: at 19px anything much past ~42 characters runs off
  // both edges of a 512-wide panel.
  ctx.fillText('pick a format, then create or enter a code', PW / 2, 84);

  // FORMAT chips. The host chooses before any code exists, because the code is
  // reserved against a room of that shape; a joiner needs none of this, since
  // the code carries its own mode.
  const gap = 10;
  const chipW = (PW - 128 - gap * 2) / 3;
  PRIV_MODES.forEach(({ mode, label, action, seats }, i) => {
    const cx = 64 + i * (chipW + gap);
    const on = app.privateMode === mode;
    const hot = hoverAction === action;
    plate(ctx, cx, PRIV_CHIP_Y, chipW, PRIV_CHIP_H, {
      cut: 8,
      fill: on ? hexToRgba(UI.coolBright, 0.28) : 'rgba(150,150,170,0.10)',
      stroke: on || hot ? UI.coolBright : UI.steelDim,
      rivets: false,
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillStyle = on ? UI.coolBright : UI.text;
    ctx.fillText(label, cx + chipW / 2, PRIV_CHIP_Y + PRIV_CHIP_H / 2 - 8);
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = on ? 'rgba(159,226,255,0.85)' : UI.textDim;
    ctx.fillText(`${seats} players`, cx + chipW / 2, PRIV_CHIP_Y + PRIV_CHIP_H / 2 + 13);
    ctx.textBaseline = 'alphabetic';
  });

  buttonPlate(ctx, 64, 170, PW - 128, 72, 'CREATE MATCH', UI.cool, hoverAction === 'private-create');
  buttonPlate(ctx, 64, 252, PW - 128, 62, 'ENTER CODE', UI.amber, hoverAction === 'private-enter');
  buttonPlate(ctx, 150, 324, PW - 300, 52, 'BACK', UI.steel, hoverAction === 'private-back');
}

function hitPrivateMenu(u: number, v: number): MenuAction | null {
  const y = (1 - v) * DUEL_H;
  if (y >= PRIV_CHIP_Y - 4 && y <= PRIV_CHIP_Y + PRIV_CHIP_H + 4) {
    const x = u * PW;
    const gap = 10;
    const chipW = (PW - 128 - gap * 2) / 3;
    for (let i = 0; i < PRIV_MODES.length; i++) {
      const cx = 64 + i * (chipW + gap);
      if (x >= cx && x <= cx + chipW) return PRIV_MODES[i].action;
    }
    return null;
  }
  // Bands kept strictly disjoint (chips end 156, create 164–248, enter 250–318,
  // back 322–380) so no row can shadow the next one's top edge.
  if (y >= 164 && y <= 248) return 'private-create';
  if (y >= 250 && y <= 318) return 'private-enter';
  if (y >= 322 && y <= 380) return 'private-back';
  return null;
}

function drawHosting(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillStyle = UI.textDim;
  ctx.fillText('YOUR MATCH CODE', PW / 2, 116);
  const code = app.privateCode || '·····';
  ctx.font = stencilFont(72);
  ctx.fillStyle = UI.coolBright;
  ctx.fillText(code.split('').join(' '), PW / 2, 188);
  ctx.font = '600 21px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(159,226,255,0.85)';
  ctx.fillText(app.privateCode ? 'share it · waiting for them…' : 'allocating…', PW / 2, 250);
  buttonPlate(ctx, 110, 296, PW - 220, 70, 'CANCEL', UI.amber, hoverAction === 'cancel-queue');
}

function hitHosting(v: number): MenuAction | null {
  const y = (1 - v) * DUEL_H;
  return y >= 290 && y <= 372 ? 'cancel-queue' : null;
}

// RANKED server browser — a GO button (host your own room) over a list of the
// active rooms, each with a "1/2" seat pill you can click to join.
const BROWSER_ROWS = 3; // visible rows (rare to have more than a couple)
const BROWSER_ROW_Y0 = 182;
const BROWSER_ROW_H = 40;
const BROWSER_ROW_STEP = 46;

function drawBrowser(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  // Once you've pressed GO (or clicked a room) you're waiting on a match — the
  // top button becomes CANCEL and the list rows go unclickable, but you stay on
  // the list so you can see your own room sitting in it.
  const waiting = app.state === 'queueing' && app.fromRanked;

  buttonPlate(
    ctx, 64, 82, PW - 128, 60,
    waiting ? 'CANCEL' : 'GO',
    waiting ? UI.amber : UI.ember,
    hoverAction === (waiting ? 'ranked-cancel' : 'ranked-host'),
  );

  if (waiting) {
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(159,226,255,0.9)';
    ctx.fillText(app.rankedHost ? 'waiting for an opponent…' : 'joining…', PW / 2, 164);
  } else {
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = UI.textDim;
    ctx.fillText('ACTIVE SERVERS', 66, 166);
    ctx.textAlign = 'center';
  }

  const rooms = app.rankedRooms;
  if (rooms.length === 0) {
    if (!waiting) {
      ctx.font = '600 19px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(159,226,255,0.7)';
      ctx.fillText('no open servers yet — press GO to host one', PW / 2, 244);
    }
  } else {
    const shown = Math.min(rooms.length, BROWSER_ROWS);
    for (let i = 0; i < shown; i++) {
      const room = rooms[i];
      const mine = room.id === app.rankedRoomId; // our own room — not clickable
      const y = BROWSER_ROW_Y0 + i * BROWSER_ROW_STEP;
      const hot = !waiting && hoverAction === `ranked-join-${room.id}`;
      plate(ctx, 64, y, PW - 128, BROWSER_ROW_H, {
        cut: 10,
        fill: mine ? 'rgba(79,183,255,0.16)' : hot ? 'rgba(255,176,0,0.16)' : 'rgba(150,150,170,0.10)',
        stroke: mine ? UI.cool : hot ? UI.amber : UI.steelDim,
        rivets: false,
      });
      ctx.font = '800 21px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = mine ? UI.coolBright : hot ? UI.amber : UI.text;
      const name = room.host.toUpperCase().slice(0, 14) + (mine ? ' · YOU' : '');
      ctx.fillText(name, 82, y + BROWSER_ROW_H / 2 + 1);

      // "1/2" occupancy pill — a listed room always has its host waiting in it.
      const label = '1/2';
      ctx.font = '800 17px system-ui, sans-serif';
      const pillW = ctx.measureText(label).width + 28;
      const pillH = 24;
      const px = PW - 82 - pillW;
      const py = y + BROWSER_ROW_H / 2 - pillH / 2;
      plate(ctx, px, py, pillW, pillH, { cut: 8, fill: 'rgba(79,183,255,0.20)', stroke: UI.cool, rivets: false });
      ctx.fillStyle = UI.coolBright;
      ctx.textAlign = 'center';
      ctx.fillText(label, px + pillW / 2, py + pillH / 2 + 1);
    }
    if (rooms.length > shown) {
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillStyle = UI.textDim;
      ctx.fillText(`+${rooms.length - shown} more…`, PW / 2, BROWSER_ROW_Y0 + shown * BROWSER_ROW_STEP + 6);
    }
  }

  // BACK to the mode menu — only when you haven't committed to a room yet.
  if (!waiting) {
    buttonPlate(ctx, 150, 326, PW - 300, 48, 'BACK', UI.steel, hoverAction === 'ranked-back');
  }
}

function hitBrowser(v: number): MenuAction | null {
  const waiting = app.state === 'queueing' && app.fromRanked;
  const y = (1 - v) * DUEL_H;
  if (y >= 78 && y <= 146) return waiting ? 'ranked-cancel' : 'ranked-host';
  if (waiting) return null; // rows + BACK are inert while you wait in a room
  const rooms = app.rankedRooms;
  const shown = Math.min(rooms.length, BROWSER_ROWS);
  for (let i = 0; i < shown; i++) {
    const ry = BROWSER_ROW_Y0 + i * BROWSER_ROW_STEP;
    if (y >= ry - 3 && y <= ry + BROWSER_ROW_H + 3) return `ranked-join-${rooms[i].id}` as MenuAction;
  }
  if (y >= 322 && y <= 380) return 'ranked-back';
  return null;
}

// Keypad geometry, shared by draw + hit-test.
const KP = { x: 56, y: 150, gap: 9, cols: 3, rows: 4, w: PW - 112, h: 218 };
const KP_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['DEL', '0', 'JOIN'],
];

function kpCell(r: number, c: number): { x: number; y: number; w: number; h: number } {
  const cw = (KP.w - KP.gap * (KP.cols - 1)) / KP.cols;
  const ch = (KP.h - KP.gap * (KP.rows - 1)) / KP.rows;
  return { x: KP.x + c * (cw + KP.gap), y: KP.y + r * (ch + KP.gap), w: cw, h: ch };
}

function drawKeypad(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  if (app.state === 'queueing') {
    buttonPlate(ctx, 70, 150, PW - 140, 92, 'CANCEL', UI.amber, hoverAction === 'cancel-queue');
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(159,226,255,0.85)';
    ctx.fillText(`joining ${app.codeEntry}…`, PW / 2, 300);
    return;
  }

  buttonPlate(ctx, 36, 84, 96, 34, 'BACK', UI.steel, hoverAction === 'private-back');

  const bad = app.netStatus.includes('not found') || app.netStatus.includes('expired') || app.netStatus.includes('already');
  const slots = Array.from({ length: 5 }, (_, i) => app.codeEntry[i] ?? '·').join(' ');
  ctx.font = stencilFont(40);
  ctx.fillStyle = bad ? UI.danger : UI.coolBright;
  ctx.fillText(slots, PW / 2 + 28, 104);

  const ready = app.codeEntry.length === 5;
  for (let r = 0; r < KP.rows; r++) {
    for (let c = 0; c < KP.cols; c++) {
      const key = KP_KEYS[r][c];
      const cell = kpCell(r, c);
      const accent = key === 'JOIN' ? (ready ? UI.cool : UI.steelDim) : key === 'DEL' ? UI.amber : UI.text;
      buttonPlate(ctx, cell.x, cell.y, cell.w, cell.h, key, accent, false);
    }
  }
}

function hitKeypad(u: number, v: number): MenuAction | null {
  const x = u * PW;
  const y = (1 - v) * DUEL_H;
  if (app.state === 'queueing') return y >= 140 && y <= 250 ? 'cancel-queue' : null;
  if (y >= 80 && y <= 122 && x <= 140) return 'private-back';
  for (let r = 0; r < KP.rows; r++) {
    for (let c = 0; c < KP.cols; c++) {
      const cell = kpCell(r, c);
      if (x >= cell.x && x <= cell.x + cell.w && y >= cell.y && y <= cell.y + cell.h) {
        const key = KP_KEYS[r][c];
        if (key === 'DEL') return 'kp-del';
        if (key === 'JOIN') return 'kp-join';
        return `kp-${Number(key)}` as MenuAction;
      }
    }
  }
  return null;
}

/** Right — doors out of the lobby: the PUB social area + customisation. */
function drawInfo(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  if (app.infoView === 'pubpick') return drawPubPicker(ctx, hoverAction);
  return drawInfoRoot(ctx, hoverAction);
}

function hitInfo(_u: number, v: number): MenuAction | null {
  if (app.infoView === 'pubpick') return hitPubPicker(v);
  return hitInfoRoot(v);
}

function drawInfoRoot(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  panelBg(ctx, false, UI.text, GAME_TITLE);

  buttonPlate(ctx, 70, 104, PW - 140, 96, 'IRON BALLS CLUB', UI.cool, hoverAction === 'open-pub');

  // Live headcount riding the top-right of the PUB plate — the mirror of the
  // 1V1 panel's searcher badge, but the total occupancy across pub regions.
  if (app.pubCount > 0) {
    const label = `${app.pubCount}/${PUB_MAX_PLAYERS * PUB_REGIONS.length}`;
    ctx.font = '800 18px system-ui, sans-serif';
    const pillW = ctx.measureText(label).width + 38;
    const pillH = 28;
    const px = PW - 70 - pillW;
    const py = 92;
    plate(ctx, px, py, pillW, pillH, {
      cut: 8,
      fill: 'rgba(79,183,255,0.22)',
      stroke: UI.cool,
      rivets: false,
    });
    ctx.fillStyle = UI.coolBright; // a "live" dot
    ctx.beginPath();
    ctx.arc(px + 16, py + pillH / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = UI.coolBright;
    ctx.fillText(label, px + 28, py + pillH / 2 + 1);
    ctx.textAlign = 'center';
  }

  buttonPlate(ctx, 70, 226, PW - 140, 96, 'LOCKER', UI.ember, hoverAction === 'open-custom');

  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillStyle = UI.textDim;
  ctx.fillText('Check out the leaderboard behind you', PW / 2, 366);
}

function hitInfoRoot(v: number): MenuAction | null {
  const y = (1 - v) * PH;
  if (y >= 96 && y <= 208) return 'open-pub';
  if (y >= 218 && y <= 330) return 'open-custom';
  return null;
}

/** The pub-region picker — pick EU or USA, each with its live `X/12` headcount,
 *  shown when you tap IRON BALLS CLUB. One plate per region, then BACK. */
function drawPubPicker(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  panelBg(ctx, false, UI.text, 'PICK A CLUB');

  const accents = [UI.cool, UI.ember, UI.amber, UI.coolBright];
  const top = 96;
  const gap = 12;
  const h = Math.min(96, (260 - gap * (PUB_REGIONS.length - 1)) / PUB_REGIONS.length);
  PUB_REGIONS.forEach((region, i) => {
    const y = top + i * (h + gap);
    const action = `pub-go-${region.id}` as MenuAction;
    buttonPlate(ctx, 70, y, PW - 140, h, region.label, accents[i % accents.length], hoverAction === action);

    // Live `X/12` headcount pill on the right of each region plate.
    const count = app.pubRegionCounts[region.id];
    if (typeof count === 'number' && count >= 0) {
      const label = `${count}/${PUB_MAX_PLAYERS}`;
      ctx.font = '800 18px system-ui, sans-serif';
      const pillW = ctx.measureText(label).width + 38;
      const pillH = 28;
      const px = PW - 86 - pillW;
      const py = y + h / 2 - pillH / 2 - 14;
      plate(ctx, px, py, pillW, pillH, {
        cut: 8,
        fill: 'rgba(79,183,255,0.22)',
        stroke: UI.cool,
        rivets: false,
      });
      ctx.fillStyle = UI.coolBright;
      ctx.beginPath();
      ctx.arc(px + 16, py + pillH / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = UI.coolBright;
      ctx.fillText(label, px + 28, py + pillH / 2 + 1);
      ctx.textAlign = 'center';
    }
  });

  buttonPlate(ctx, 150, 320, PW - 300, 50, 'BACK', UI.steel, hoverAction === 'pub-back');
}

function hitPubPicker(v: number): MenuAction | null {
  const y = (1 - v) * PH;
  const top = 96;
  const gap = 12;
  const h = Math.min(96, (260 - gap * (PUB_REGIONS.length - 1)) / PUB_REGIONS.length);
  for (let i = 0; i < PUB_REGIONS.length; i++) {
    const ry = top + i * (h + gap);
    if (y >= ry - 8 && y <= ry + h + 4) return `pub-go-${PUB_REGIONS[i].id}` as MenuAction;
  }
  if (y >= 312 && y <= 378) return 'pub-back';
  return null;
}


// --- the A-button action panel -----------------------------------------------

export interface ActionButton {
  id: string;
  label: string;
  accent: string;
  /** Two consecutive 'l','r' buttons share one row at half width — the
   *  forfeit confirm's ✕ / ✓ pair. Omit for an ordinary full-width row. */
  half?: 'l' | 'r';
}

export interface ActionPanel {
  mesh: Mesh;
  /** Redraw with the given content; the layout is remembered for hitTest.
   *  `loadout` appends the BALL LOADOUT section (equip attachments between
   *  rounds — the tutorial's console taught the panel, this is its home). */
  redraw: (
    title: string,
    buttons: ActionButton[],
    hint: string,
    hoverId: string | null,
    status?: string,
    loadout?: boolean,
  ) => void;
  /** Map a hit UV to the id of the button under it, or null. */
  hitTest: (u: number, v: number) => string | null;
  /** Map a hit UV into the loadout section's own (u,v), or null if outside
   *  it / not shown — feed the result to clickBalls(). */
  ballsHit: (u: number, v: number) => { u: number; v: number } | null;
}

// Canvas matches the BALL LOADOUT's width so the loadout section maps 1:1;
// tall enough for header + two buttons + the loadout. Content shorter than
// the canvas just leaves transparent pixels below the plate.
const FW = 560;
const FH = 760;

/**
 * The waist-height panel summoned with the A button: FORFEIT/CONCEDE where
 * resigning is allowed, REMATCH / RETURN at the end of a bout, and the BALL
 * LOADOUT during round breaks (and any time in training / campaign). Starts
 * hidden; MenuSystem owns placement, toggling and what the buttons do.
 */
export function createActionPanel(scene: Scene): ActionPanel {
  const canvas = document.createElement('canvas');
  canvas.width = FW;
  canvas.height = FH;
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  const mesh = new Mesh(
    new PlaneGeometry(0.5, (0.5 * FH) / FW),
    new MeshBasicMaterial({ map: texture, transparent: true }),
  );
  mesh.name = 'action-panel';
  mesh.visible = false;
  scene.add(mesh);

  let zones: Array<{ id: string; y0: number; y1: number; x0?: number; x1?: number }> = [];
  let ballsY: number | null = null; // top of the loadout section (canvas px)

  return {
    mesh,
    redraw: (title, buttons, hint, hoverId, status = '', loadout = false) => {
      // Height-to-content: plate wraps exactly what's drawn, the rest of the
      // canvas stays transparent. The loadout sits ABOVE the buttons — gear
      // first, resign/return below where it can't be fat-fingered.
      // An l+r half pair shares one row, so count ROWS, not buttons.
      const buttonRows = buttons.reduce(
        (n, b, i) => n + (b.half === 'r' && buttons[i - 1]?.half === 'l' ? 0 : 1),
        0,
      );
      const buttonsH = buttonRows * 102;
      const statusH = status ? 30 : 0;
      ballsY = loadout ? 84 : null;
      const buttonsY = loadout ? 84 + BALL_H + 14 : 84;
      const contentH = buttonsY + buttonsH + statusH + 52;

      ctx.clearRect(0, 0, FW, FH);
      plate(ctx, 8, 8, FW - 16, contentH - 16, {
        cut: 22,
        fill: UI.ink,
        stroke: hoverId ? UI.amberSoft : UI.steel,
      });
      hazardStrip(ctx, 36, 30, 48, 14, UI.amber);
      ctx.textAlign = 'left';
      ctx.font = stencilFont(30);
      ctx.fillStyle = UI.amberSoft;
      ctx.fillText(title, 98, 38);
      ctx.strokeStyle = UI.steelDim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(36, 64);
      ctx.lineTo(FW - 36, 64);
      ctx.stroke();

      if (loadout && ballsY !== null) {
        // The lobby's BALL LOADOUT face, hosted FRAMELESS (no nested plate or
        // clear) so the section sits on this panel's one shared plate.
        ctx.save();
        ctx.translate(0, ballsY);
        drawBalls(ctx, null, false);
        ctx.restore();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Divider under the section, echoing the one under the title.
        ctx.strokeStyle = UI.steelDim;
        ctx.beginPath();
        ctx.moveTo(36, buttonsY - 8);
        ctx.lineTo(FW - 36, buttonsY - 8);
        ctx.stroke();
      }

      zones = [];
      let y = buttonsY;
      for (let i = 0; i < buttons.length; i++) {
        const b = buttons[i];
        const rb = buttons[i + 1];
        if (b.half === 'l' && rb?.half === 'r') {
          // The ✕ / ✓ confirm pair: two half-width plates on one row.
          const bw = (FW - 128 - 16) / 2;
          buttonPlate(ctx, 64, y, bw, 84, b.label, b.accent, hoverId === b.id);
          buttonPlate(ctx, 64 + bw + 16, y, bw, 84, rb.label, rb.accent, hoverId === rb.id);
          zones.push({ id: b.id, y0: y - 6, y1: y + 90, x0: 64, x1: 64 + bw });
          zones.push({ id: rb.id, y0: y - 6, y1: y + 90, x0: 64 + bw + 16, x1: FW - 64 });
          y += 102;
          i++;
          continue;
        }
        buttonPlate(ctx, 64, y, FW - 128, 84, b.label, b.accent, hoverId === b.id);
        zones.push({ id: b.id, y0: y - 6, y1: y + 90 });
        y += 102;
      }

      ctx.textAlign = 'center';
      ctx.font = '600 24px system-ui, sans-serif';
      if (status) {
        ctx.fillStyle = UI.coolBright;
        ctx.fillText(status, FW / 2, y + 12);
      }
      ctx.fillStyle = UI.textDim;
      ctx.fillText(hint, FW / 2, contentH - 34);
      texture.needsUpdate = true;
    },
    hitTest: (u, v) => {
      const x = u * FW;
      const y = (1 - v) * FH;
      for (const z of zones) {
        if (y < z.y0 || y > z.y1) continue;
        if (z.x0 !== undefined && (x < z.x0 || x > (z.x1 ?? FW))) continue;
        return z.id;
      }
      return null;
    },
    ballsHit: (u, v) => {
      if (ballsY === null) return null;
      const y = (1 - v) * FH - ballsY;
      if (y < 0 || y > BALL_H) return null;
      return { u, v: 1 - y / BALL_H };
    },
  };
}


// --- BALL LOADOUT: pick an attachment for each fist's ball -----------------

interface AttachInfo {
  name: string;
  color: string;
  desc: string;
}
const ATTACHMENTS: AttachInfo[] = [
  { name: 'SPLIT', color: UI.cool, desc: 'Splits on return.' },
  { name: 'GROW', color: UI.emberBright, desc: 'Gets bigger on return with less damage.' },
  { name: 'SHRINK', color: UI.amber, desc: 'Gets smaller on return for more damage.' },
];
const TYPES = [ATTACH.split, ATTACH.grow, ATTACH.shrink];

// Exported: TutorialSystem re-hosts this exact panel on its in-arena console.
export const BALL_W = 560;
export const BALL_H = 480;
const BMX = 36; // side margin
const BGAP = 18; // gap between tiles
const TILE_W = (BALL_W - 2 * BMX - 2 * BGAP) / 3;
const TILE_H = 92;
const ROW_L_Y = 120; // left-fist tile row top
const ROW_R_Y = 262; // right-fist tile row top (clear of the left row's ARC box)
const DESC_Y = 366;
const tileX = (i: number): number => BMX + i * (TILE_W + BGAP);

// --- the ADVANCED sub-face (gear cog, top-right) ---------------------------
// One CURVE tick for both fists (the old per-fist boxes cluttered the rows),
// a CURVE STRENGTH slider, and the SHOW MY BODY toggle.
const GEAR = { x: BALL_W - 42, y: 46, r: 17, hit: 26 };
const ADV_BS = 26; // checkbox size on the advanced face
const ADV_CURVE_Y = 104; // curve checkbox top
const ADV_SLIDER_Y = 228; // slider bar top
const ADV_SLIDER_H = 16;
const ADV_SLIDER_W = BALL_W - 2 * BMX - 88; // % readout rides to the right
const ADV_BODY_Y = 312; // body checkbox top
/** Is the loadout panel showing its ADVANCED face? */
let ballAdvOpen = false;

/** Last attachment whose description is shown in the box (−1 = none yet). */
let ballDescIdx = -1;

/** A small arrowhead triangle at (x,y) pointing along `ang`. */
function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.6, size * 0.6);
  ctx.lineTo(-size * 0.6, -size * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Draw the icon for an attachment type (ATTACH.*) centred at (cx,cy). */
function drawAttachIcon(ctx: CanvasRenderingContext2D, type: number, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  if (type === ATTACH.split) {
    for (let k = 0; k < 3; k++) {
      const ang = -Math.PI / 2 + (k * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * r * 0.55, cy + Math.sin(ang) * r * 0.55, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  const grow = type === ATTACH.grow;
  // Outer ring for reference.
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Just four arrows — outward = grows, inward = shrinks. No centre ball: a
  // ball sized to the BEFORE state read backwards (small grow / big shrink).
  for (let k = 0; k < 4; k++) {
    const ang = Math.PI / 4 + (k * Math.PI) / 2;
    const rad = grow ? r * 0.42 : r * 0.78;
    arrowHead(ctx, cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, grow ? ang : ang + Math.PI, r * 0.26);
  }
}

/** Word-wrap `text` into `maxW`, returning the count of lines drawn.
 *  Exported: the tutorial's caption plate wraps with the same algorithm. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): void {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = w;
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

/** A square steel checkbox with an amber tick when on. */
function drawCheckbox(ctx: CanvasRenderingContext2D, x: number, y: number, on: boolean): void {
  plate(ctx, x, y, ADV_BS, ADV_BS, {
    cut: 6,
    fill: on ? 'rgba(255,176,0,0.22)' : 'rgba(18,19,24,0.7)',
    stroke: on ? UI.amber : UI.steelDim,
    rivets: false,
  });
  if (on) {
    ctx.strokeStyle = UI.amber;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 13);
    ctx.lineTo(x + 11, y + 19);
    ctx.lineTo(x + 20, y + 7);
    ctx.stroke();
  }
}

/** The gear cog opening/closing the ADVANCED face — amber while open. */
function drawGear(ctx: CanvasRenderingContext2D): void {
  const { x, y, r } = GEAR;
  const color = ballAdvOpen ? UI.amber : UI.steel;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 4);
    ctx.fillRect(-3.2, -r - 3, 6.4, 6);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBallRow(ctx: CanvasRenderingContext2D, side: 0 | 1, label: string, rowY: number): void {
  const equipped = app.ballAttach[side] ?? 0;
  ctx.textAlign = 'left';
  ctx.font = '700 23px system-ui, sans-serif';
  ctx.fillStyle = UI.text;
  const eqName = equipped ? ATTACHMENTS[equipped - 1].name.toLowerCase() : 'none';
  ctx.fillText(`${label}  ·  ${eqName}`, BMX, rowY - 16);

  for (let i = 0; i < 3; i++) {
    const type = TYPES[i];
    const info = ATTACHMENTS[i];
    const selected = equipped === type;
    const x = tileX(i);
    plate(ctx, x, rowY, TILE_W, TILE_H, {
      cut: 10,
      fill: selected ? 'rgba(255,255,255,0.10)' : 'rgba(18,19,24,0.6)',
      stroke: selected ? info.color : UI.steelDim,
      rivets: false,
    });
    drawAttachIcon(ctx, type, x + TILE_W / 2, rowY + 34, 24, selected ? info.color : UI.steel);
    ctx.textAlign = 'center';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillStyle = selected ? info.color : UI.textDim;
    ctx.fillText(info.name, x + TILE_W / 2, rowY + TILE_H - 16);
  }
}

/** BALL LOADOUT: per-fist attachment picker with click-to-read descriptions,
 *  plus the gear-cog ADVANCED face (curve, curve strength, body visibility).
 *  Exported: the tutorial's console draws the same panel in-arena, and the
 *  A-button action panel hosts it with `framed=false` — no clear, no nested
 *  plate, just a section heading — so host + loadout read as ONE panel. */
export function drawBalls(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null, framed = true): void {
  const hover = hoverAction !== null;
  if (framed) {
    panelBg(ctx, hover, UI.emberBright, ballAdvOpen ? 'ADVANCED' : 'BALL LOADOUT', BALL_W, BALL_H);
  } else {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = stencilFont(26);
    ctx.fillStyle = UI.amberSoft;
    ctx.fillText(ballAdvOpen ? 'ADVANCED' : 'BALL LOADOUT', BMX, 44);
  }
  drawGear(ctx);
  // Small pointer at the cog so the sub-face is discoverable ('BACK' once in).
  ctx.textAlign = 'right';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillStyle = UI.textDim;
  ctx.fillText(ballAdvOpen ? 'BACK' : 'ADVANCED', GEAR.x - GEAR.r - 16, GEAR.y + 6);
  arrowHead(ctx, GEAR.x - GEAR.r - 9, GEAR.y, 0, 5);

  if (ballAdvOpen) {
    drawBallsAdvanced(ctx);
    return;
  }

  drawBallRow(ctx, 0, 'LEFT FIST', ROW_L_Y);
  drawBallRow(ctx, 1, 'RIGHT FIST', ROW_R_Y);

  // Description box for the last-tapped attachment.
  plate(ctx, BMX, DESC_Y, BALL_W - 2 * BMX, 104, {
    cut: 10,
    fill: 'rgba(10,11,14,0.55)',
    stroke: UI.steelDim,
    rivets: false,
  });
  ctx.textAlign = 'left';
  if (ballDescIdx < 0) {
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillStyle = UI.textDim;
    ctx.fillText('tap an attachment to read what it does', BMX + 20, DESC_Y + 52);
  } else {
    const info = ATTACHMENTS[ballDescIdx];
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillStyle = info.color;
    ctx.fillText(info.name, BMX + 20, DESC_Y + 28);
    ctx.font = '500 20px system-ui, sans-serif';
    ctx.fillStyle = UI.text;
    wrapText(ctx, info.desc, BMX + 20, DESC_Y + 58, BALL_W - 2 * BMX - 40, 26);
  }
}

/** The ADVANCED face: one CURVE tick for both fists, its strength dial, and
 *  the SHOW MY BODY toggle. The gear (top-right) flips back. */
function drawBallsAdvanced(ctx: CanvasRenderingContext2D): void {
  const curveOn = app.ballArc[0] || app.ballArc[1];

  // CURVE toggle.
  drawCheckbox(ctx, BMX, ADV_CURVE_Y, curveOn);
  ctx.textAlign = 'left';
  ctx.font = '700 23px system-ui, sans-serif';
  ctx.fillStyle = curveOn ? UI.emberBright : UI.text;
  ctx.fillText('CURVE', BMX + ADV_BS + 16, ADV_CURVE_Y + 20);
  ctx.font = '500 19px system-ui, sans-serif';
  ctx.fillStyle = UI.textDim;
  ctx.fillText('curve follows the arc of your punch', BMX, ADV_CURVE_Y + 52);

  // CURVE STRENGTH slider (dimmed until curve is on).
  ctx.globalAlpha = curveOn ? 1 : 0.38;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillStyle = UI.text;
  ctx.fillText('CURVE STRENGTH', BMX, ADV_SLIDER_Y - 12);
  plate(ctx, BMX, ADV_SLIDER_Y, ADV_SLIDER_W, ADV_SLIDER_H, {
    cut: 5,
    fill: 'rgba(18,19,24,0.7)',
    stroke: UI.steelDim,
    rivets: false,
  });
  const k = (app.curveStrength - 0.1) / 0.9;
  if (k > 0.01) {
    plate(ctx, BMX, ADV_SLIDER_Y, Math.max(10, ADV_SLIDER_W * k), ADV_SLIDER_H, {
      cut: 5,
      fill: 'rgba(255,176,0,0.45)',
      stroke: UI.amber,
      rivets: false,
    });
  }
  ctx.textAlign = 'right';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillStyle = curveOn ? UI.amber : UI.textDim;
  ctx.fillText(`${Math.round(app.curveStrength * 100)}%`, BALL_W - BMX, ADV_SLIDER_Y + 15);
  ctx.globalAlpha = 1;

  // SHOW MY BODY toggle.
  drawCheckbox(ctx, BMX, ADV_BODY_Y, app.showBody);
  ctx.textAlign = 'left';
  ctx.font = '700 23px system-ui, sans-serif';
  ctx.fillStyle = UI.text;
  ctx.fillText('SHOW MY BODY', BMX + ADV_BS + 16, ADV_BODY_Y + 20);
  ctx.font = '500 19px system-ui, sans-serif';
  ctx.fillStyle = UI.textDim;
  ctx.fillText('untick to hide your body, rivals still see you', BMX, ADV_BODY_Y + 52);
}

/** Tap a tile → equip/clear that attachment and show its description; the
 *  gear cog flips to the ADVANCED face and back.
 *  Exported: the tutorial's console shares this hit-test. */
export function clickBalls(u: number, v: number): boolean {
  const x = u * BALL_W;
  const y = (1 - v) * BALL_H;

  // The gear cog lives on BOTH faces.
  if (Math.abs(x - GEAR.x) <= GEAR.hit && Math.abs(y - GEAR.y) <= GEAR.hit) {
    ballAdvOpen = !ballAdvOpen;
    return true;
  }

  if (ballAdvOpen) {
    // CURVE tick — one switch, both fists (storage stays per-fist for the pub).
    if (x >= BMX && x <= BMX + ADV_BS + 160 && y >= ADV_CURVE_Y - 4 && y <= ADV_CURVE_Y + ADV_BS + 4) {
      const on = !(app.ballArc[0] || app.ballArc[1]);
      app.ballArc[0] = on;
      app.ballArc[1] = on;
      saveBallArc();
      return true;
    }
    // STRENGTH slider — click sets the level (10%..100%) from the tap point.
    if (x >= BMX - 6 && x <= BMX + ADV_SLIDER_W + 6 && y >= ADV_SLIDER_Y - 18 && y <= ADV_SLIDER_Y + ADV_SLIDER_H + 14) {
      const k = Math.max(0, Math.min(1, (x - BMX) / ADV_SLIDER_W));
      app.curveStrength = Math.round((0.1 + 0.9 * k) * 20) / 20; // 5% steps
      saveCurveStrength();
      return true;
    }
    // SHOW MY BODY tick.
    if (x >= BMX && x <= BMX + ADV_BS + 260 && y >= ADV_BODY_Y - 4 && y <= ADV_BODY_Y + ADV_BS + 4) {
      app.showBody = !app.showBody;
      saveShowBody();
      return true;
    }
    return false;
  }

  for (const [side, rowY] of [[0, ROW_L_Y], [1, ROW_R_Y]] as const) {
    if (y < rowY || y > rowY + TILE_H) continue;
    const i = Math.floor((x - BMX) / (TILE_W + BGAP));
    if (i < 0 || i > 2) return false;
    const tx = tileX(i);
    if (x < tx || x > tx + TILE_W) return false;
    const type = TYPES[i];
    ballDescIdx = i;
    app.ballAttach[side] = app.ballAttach[side] === type ? 0 : type;
    saveBallAttach();
    return true;
  }
  return false;
}

// --- THE GASKET GAZETTE -----------------------------------------------------
// The paper itself — an aged-newsprint front page (serif type on cream, a
// deliberate break from the smoked-steel lobby). MENUS 2: it renders on its
// own portrait canvas here and the TOWN wing's NEWS tab blits it (wrap.ts);
// the paper button and the modal are gone.

/** The page canvas — portrait, like a real front page. */
export const NW = 720;
export const NH = 900;
const NEWS_INK = '#241c12'; // sepia newsprint ink
const NEWS_SERIF = 'Georgia, "Times New Roman", serif';
/** The article viewport's bottom edge (the page's lower margin). */
const NEWS_VIEW_BOTTOM = NH - 48;

function newsRule(ctx: CanvasRenderingContext2D, y: number, h = 3): void {
  ctx.fillStyle = NEWS_INK;
  ctx.fillRect(48, y, NW - 96, h);
}

/** Flow one paragraph, wrapped to `maxW`; returns the y past the last line.
 *  Pass `draw = false` to measure height only (for scroll clamping). */
function flowParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  draw = true,
): number {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  let line = '';
  let cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      if (draw) ctx.fillText(line, x, cy);
      line = w;
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) {
    if (draw) ctx.fillText(line, x, cy);
    cy += lineH;
  }
  return cy;
}

// Body scroll (pixels): the news body scrolls under the fixed masthead/headline
// when an edition runs long, driven by the thumbstick like the leaderboard.
// drawNews sets the max each redraw; scrollNews clamps against it.
let newsScroll = 0;
let newsMaxScroll = 0;

/** Scroll the news body by `deltaPx`, clamped. Returns true if it moved. */
export function scrollNews(deltaPx: number): boolean {
  const before = newsScroll;
  newsScroll = Math.max(0, Math.min(newsMaxScroll, newsScroll + deltaPx));
  return newsScroll !== before;
}

/** Back to the top — called when the paper is opened. */
export function resetNewsScroll(): void {
  newsScroll = 0;
}

/** A tin sheriff's star, drawn as a bold newsprint engraving (sepia ink): a
 *  double ring and a solid five-point ball-tipped star. */
function drawSheriffBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.strokeStyle = NEWS_INK;
  ctx.fillStyle = NEWS_INK;
  ctx.lineJoin = 'round';

  // Double ring — a struck-tin rim.
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
  ctx.stroke();

  // Solid five-point star.
  const tips = 5;
  const outer = r * 0.72;
  const inner = r * 0.3;
  ctx.beginPath();
  for (let i = 0; i < tips * 2; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / tips;
    const rad = i % 2 === 0 ? outer : inner;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // A small ball at each of the five points.
  const ballR = r * 0.1;
  for (let i = 0; i < tips; i++) {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / tips;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer, ballR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Where the scrolling article column begins (just below the dateline rule). */
const NEWS_CONTENT_TOP = 272;

/** Lay out the whole article — headline, subhead, rule, body, byline — from
 *  `top` downward, returning the y past the last line. `draw = false` measures
 *  only (for scroll clamping); the y arithmetic is identical either way so the
 *  measured height matches what's drawn. */
function layoutArticle(ctx: CanvasRenderingContext2D, art: GazetteArticle, top: number, draw: boolean): number {
  ctx.textAlign = 'center';
  ctx.fillStyle = NEWS_INK;
  ctx.font = `900 46px ${NEWS_SERIF}`;
  let y = flowParagraph(ctx, art.headline.toUpperCase(), NW / 2, top, NW - 110, 50, draw);
  if (art.subhead) {
    ctx.font = `italic 24px ${NEWS_SERIF}`;
    y = flowParagraph(ctx, art.subhead, NW / 2, y + 18, NW - 150, 30, draw) + 6;
  }
  if (draw) newsRule(ctx, y + 6, 2);
  y += 34;

  ctx.textAlign = 'left';
  ctx.fillStyle = NEWS_INK;
  ctx.font = `22px ${NEWS_SERIF}`;
  for (const para of art.body.split(/\n\s*\n/)) y = flowParagraph(ctx, para, 50, y, NW - 100, 30, draw) + 12;

  ctx.textAlign = 'right';
  ctx.font = `italic bold 22px ${NEWS_SERIF}`;
  if (draw) ctx.fillText(`— ${art.byline}, Gasket Township`, NW - 50, y + 8);
  y += 40;

  // THE VOICE's sections (docs/gazette-voice.md §5), under the byline:
  // the WANTED poster, the Sheriff's NOTICE, and the weather. Each is
  // measured the same way it's drawn, so the scroll clamp stays honest.
  if (art.wanted) {
    const w = art.wanted;
    const bx = 70;
    const bw = NW - 140;
    const top = y + 6;
    ctx.textAlign = 'center';
    ctx.font = `900 40px ${NEWS_SERIF}`;
    let yy = top + 52;
    if (draw) ctx.fillText('WANTED', NW / 2, yy);
    yy += 12;
    if (draw) {
      // The poster's own rule, inside its frame — not the page's.
      ctx.strokeStyle = NEWS_INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx + 26, yy);
      ctx.lineTo(bx + bw - 26, yy);
      ctx.stroke();
    }
    yy += 30;
    ctx.font = `bold 30px ${NEWS_SERIF}`;
    if (draw) ctx.fillText(w.name.toUpperCase(), NW / 2, yy);
    yy += 22;
    ctx.font = `italic 20px ${NEWS_SERIF}`;
    yy = flowParagraph(ctx, w.crime, NW / 2, yy, bw - 60, 26, draw) + 2;
    if (w.reward) {
      ctx.font = `bold 18px ${NEWS_SERIF}`;
      if (draw) ctx.fillText(`REWARD · ${w.reward.toUpperCase()}`, NW / 2, yy + 14);
      yy += 30;
    }
    const bh = yy - top + 14;
    if (draw) {
      // A poster tacked to the page: a heavy frame with a thin inner rule.
      ctx.strokeStyle = NEWS_INK;
      ctx.lineWidth = 3;
      ctx.strokeRect(bx, top, bw, bh);
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 6, top + 6, bw - 12, bh - 12);
    }
    y = top + bh + 18;
  }
  if (art.notice) {
    ctx.textAlign = 'left';
    ctx.font = `bold 17px ${NEWS_SERIF}`;
    if (draw) ctx.fillText('NOTICE FROM THE SHERIFF\'S OFFICE', 50, y + 10);
    y += 22;
    ctx.font = `italic 21px ${NEWS_SERIF}`;
    y = flowParagraph(ctx, art.notice, 50, y + 14, NW - 100, 28, draw) + 10;
  }
  if (art.weather) {
    if (draw) newsRule(ctx, y + 2, 1);
    ctx.textAlign = 'left';
    ctx.font = `bold 16px ${NEWS_SERIF}`;
    if (draw) ctx.fillText('WEATHER', 50, y + 30);
    ctx.font = `italic 19px ${NEWS_SERIF}`;
    y = flowParagraph(ctx, art.weather, 140, y + 30, NW - 190, 26, draw) + 8;
  }
  return y;
}

/** The Gasket Gazette front page. */
function drawNews(ctx: CanvasRenderingContext2D): void {
  // Aged paper, lightly vignetted at the edges.
  ctx.clearRect(0, 0, NW, NH);
  ctx.fillStyle = '#e9e2cf';
  ctx.fillRect(0, 0, NW, NH);
  const vg = ctx.createRadialGradient(NW / 2, NH / 2, NH * 0.18, NW / 2, NH / 2, NH * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(74,52,18,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, NW, NH);
  ctx.strokeStyle = NEWS_INK;
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, NW - 28, NH - 28);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(22, 22, NW - 44, NH - 44);

  const art = gazette.article;

  // Masthead — a tin sheriff's star crests the page.
  ctx.fillStyle = NEWS_INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  drawSheriffBadge(ctx, NW / 2, 64, 30);
  newsRule(ctx, 102);
  ctx.fillStyle = NEWS_INK;
  ctx.font = `900 58px ${NEWS_SERIF}`;
  ctx.fillText('The Gasket Gazette', NW / 2, 152);
  ctx.font = `italic 17px ${NEWS_SERIF}`;
  ctx.fillText('GASKET TERRITORY · EST. 2226 · PRICE ONE CENT', NW / 2, 178);
  newsRule(ctx, 192, 2);

  // Dateline strip — edition number left, the date centred. Strip any
  // "GASKET TERRITORY —" prefix (older editions stored it) so the date stays
  // short and never collides.
  ctx.font = `bold 16px ${NEWS_SERIF}`;
  ctx.textAlign = 'left';
  ctx.fillText(art ? `No. ${art.edition}` : 'No. —', 50, 216);
  let dateText = (art?.dateline || '').replace(/^\s*GASKET TERRITORY\s*[—–-]\s*/i, '').trim();
  if (!dateText) dateText = 'GASKET TERRITORY';
  ctx.textAlign = 'center';
  ctx.fillText(dateText, NW / 2, 216);
  newsRule(ctx, 228, 2);

  ctx.textAlign = 'center';
  if (!art) {
    ctx.font = `italic 26px ${NEWS_SERIF}`;
    ctx.fillStyle = NEWS_INK;
    ctx.fillText(gazette.status || 'the presses are quiet', NW / 2, NH / 2 - 40);
    ctx.font = `18px ${NEWS_SERIF}`;
    ctx.fillText('Check back after the next edition is filed.', NW / 2, NH / 2);
  } else {
    // The WHOLE article — headline, subhead, body, byline — scrolls together
    // as one column under the fixed masthead (thumbstick, like the leaderboard).
    const viewBottom = NEWS_VIEW_BOTTOM;
    const clipTop = 238; // just under the dateline rule, above the headline tops

    // Measure the full article height (no draw) to clamp the scroll.
    const contentBottom = layoutArticle(ctx, art, NEWS_CONTENT_TOP, false);
    newsMaxScroll = Math.max(0, contentBottom - viewBottom);
    if (newsScroll > newsMaxScroll) newsScroll = newsMaxScroll;

    // Draw the article in a scrolling viewport.
    ctx.save();
    ctx.beginPath();
    ctx.rect(28, clipTop, NW - 56, viewBottom - clipTop);
    ctx.clip();
    ctx.translate(0, -newsScroll);
    layoutArticle(ctx, art, NEWS_CONTENT_TOP, true);
    ctx.restore();

    // More-to-read chevrons in the right margin.
    const chevron = (yc: number, down: boolean): void => {
      ctx.fillStyle = 'rgba(36,28,18,0.6)';
      const xc = NW - 40;
      const s = 7;
      ctx.beginPath();
      if (down) {
        ctx.moveTo(xc - s, yc - s);
        ctx.lineTo(xc + s, yc - s);
        ctx.lineTo(xc, yc + s);
      } else {
        ctx.moveTo(xc - s, yc + s);
        ctx.lineTo(xc + s, yc + s);
        ctx.lineTo(xc, yc - s);
      }
      ctx.closePath();
      ctx.fill();
    };
    if (newsScroll > 0.5) chevron(clipTop + 8, false);
    if (newsScroll < newsMaxScroll - 0.5) chevron(viewBottom - 6, true);
  }

  ctx.textBaseline = 'middle';
}

/** The page's own canvas — rendered fresh on each call (the wing's redraw
 *  is the freshness clock) and handed back to be blitted. */
let newsCanvas: HTMLCanvasElement | null = null;
export function renderNewsPage(): HTMLCanvasElement {
  if (!newsCanvas) {
    newsCanvas = document.createElement('canvas');
    newsCanvas.width = NW;
    newsCanvas.height = NH;
  }
  const ctx = newsCanvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawNews(ctx);
  return newsCanvas;
}

// --- THE COIN WALLET + PLATFORM STORE ---------------------------------------
// A small readout sits beside the paper button: the bolt-dollar symbol and your
// balance. Spend it in the STORE (the LOCKER's header tab) on new platforms —
// three launch pads are free, a couple of recolours cost 100, the gold pad 1000.

// The number shown on the lobby readout ROLLS UP to the real balance rather
// than snapping — so coins banked during a bout count up satisfyingly the
// moment you're back at the menu. `coinShown` is the live (fractional) display
// value; MenuSystem ticks it each lobby frame via tickCoinRollup.
let coinShown = coins.balance;

/**
 * Ease the displayed coin count toward the real balance. Returns true while
 * it's still rolling (so the caller keeps redrawing the readout), false once
 * it's landed. A min step makes small gains still visibly tick over.
 */
export function tickCoinRollup(dt: number): boolean {
  const target = coins.balance;
  const diff = target - coinShown;
  if (Math.abs(diff) < 0.5) {
    const landed = coinShown !== target;
    coinShown = target;
    return landed; // one last redraw to show the final integer
  }
  const step = diff * (1 - Math.exp(-7 * dt));
  // Guarantee forward progress so the digits keep moving on big jumps.
  coinShown += Math.abs(step) < 0.4 ? Math.sign(diff) * 0.4 : step;
  return true;
}

/** The current readout value (rounded) — also lets the shop/header agree. */
export function coinDisplayValue(): number {
  return Math.round(coinShown);
}

// The shop sells both cosmetics: AVATARS (the paid unlocks, plus a COMING SOON
// tile) on top, PLATFORMS (the paid pads) below. Two tidy grids of chips with
// the CLOSE button clear beneath them.

// ─────────────────────────── THE ARCADE LOBBY ───────────────────────────────
// One shared modal serving every networked arcade mode (2v2 / ffa / raid),
// switched by app.lobbyMode. Two faces: the BROWSER (open rooms you can join,
// plus MAKE LOBBY / VS BOTS) and a joined LOBBY (the room's seats, host
// controls, and the launch status). 2v2 and raid auto-launch when the room
// fills; a short-handed FFA host can START early. Matchmaking works like
// RANKED's server browser: hosting makes a VISIBLE room others can find.

// only what you own, to equip — plus a COLOUR tab carrying the armour + accent
// hue sliders. Each tile shows a PICTURE of the skin: an animal silhouette (a
// shield for the knight) for avatars, a little coloured pad for platforms.

const PAN_W = 560;
// COLOUR-tab tracks (locker only): armour repaints the suit, accent the neon,
// each with a hue track and a lightness track beneath it.
const ARMOUR_BAR = { x: 40, y: 168, w: PAN_W - 210, h: 38 };
const ARMOUR_LIGHT_BAR = { x: 40, y: 250, w: PAN_W - 80, h: 38 };
const ACCENT_BAR = { x: 40, y: 348, w: PAN_W - 210, h: 38 };
const ACCENT_LIGHT_BAR = { x: 40, y: 430, w: PAN_W - 80, h: 38 };

/** A CSS hex colour ('#rrggbb') at the given alpha — breaker fill washes. */
function hexToRgba(css: string, a: number): string {
  const n = parseInt(css.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** u (0..1 across the panel) → hue (0..1) for the armour track. */
export function colorBarHue(u: number): number {
  return Math.max(0, Math.min(1, (u * PAN_W - ARMOUR_BAR.x) / ARMOUR_BAR.w));
}
/** u → hue for the accent track. */
export function accentBarHue(u: number): number {
  return Math.max(0, Math.min(1, (u * PAN_W - ACCENT_BAR.x) / ACCENT_BAR.w));
}
/** u → lightness (0..1) for the armour lightness track. */
export function colorBarLight(u: number): number {
  return Math.max(0, Math.min(1, (u * PAN_W - ARMOUR_LIGHT_BAR.x) / ARMOUR_LIGHT_BAR.w));
}
/** u → lightness (0..1) for the accent lightness track. */
export function accentBarLight(u: number): number {
  return Math.max(0, Math.min(1, (u * PAN_W - ACCENT_LIGHT_BAR.x) / ACCENT_LIGHT_BAR.w));
}

export function createMenu(scene: Scene): Menu {
  const group = new Group();
  group.name = 'lobby-menu';

  const train = makePanel('train', 0.86, 0.86 * (TRAIN_H / PW), drawTrain, hitTrain, { ch: TRAIN_H });
  const duel = makePanel('duel', 0.78, 0.62 * (DUEL_H / PH), drawDuel, hitDuel, { ch: DUEL_H });
  const info = makePanel('info', 0.78, 0.62, drawInfo, hitInfo);

  // Shallow arc in front of the player, tilted inward toward the centre.
  const y = 1.45;
  // Grow the taller ARCADE panel DOWNWARD: drop its centre by half the extra
  // height so its top stays level with the 1V1 panel.
  train.mesh.position.set(0, y - 0.86 * ((TRAIN_H - PH) / PW) / 2, -1.25);
  // Shift the centre down by half the extra height so the panel grows DOWNWARD
  // (its top edge stays put) — the new room lands under the searching line.
  duel.mesh.position.set(-0.84, y - 0.02 - 0.62 * ((DUEL_H - PH) / PH) / 2, -1.02);
  duel.mesh.rotation.y = 0.48;
  info.mesh.position.set(0.84, y - 0.02, -1.02);
  info.mesh.rotation.y = -0.48;

  // The MODALS (locker, store, campaign line-up, arcade lobby, ball
  // loadout) are kit panels now — MenuSystem builds and places them
  // (MENUS 3). This function owns the arc and nothing else.
  const panels = [train, duel, info];
  for (const p of panels) {
    p.redraw(null);
    group.add(p.mesh);
  }
  scene.add(group);

  return {
    group,
    panels,
    setVisible: (v) => {
      group.visible = v;
    },
    redrawAll: (hoverId, hoverAction) => {
      // Skip panels that aren't on screen — re-rendering a hidden canvas and
      // re-uploading its texture (the news page is 720×900) is pure waste. They
      // get a redraw the moment they're shown (applyState calls this again).
      for (const p of panels) {
        if (!p.mesh.visible) continue;
        p.redraw(p.id === hoverId ? hoverAction : null);
      }
    },
  };
}
