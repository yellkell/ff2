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
import { app, DEFAULT_ACCENT_HUE, saveBallArc, saveBallAttach, saveCurveStrength, saveShowBody, type AppEnvironment } from './appState.js';
import { avatarOwned, customization, platformOwned, gearOwned } from './customization.js';
import { coinImage } from './coinIcon.js';
import { canAfford, coins } from './wallet.js';
import { AVATAR_SKINS, PLATFORM_SKINS, type AvatarSkin, type PlatformSkin } from '../avatar/skins.js';
import { drawAvatarIcon, drawGearIcon, drawPlatformIcon } from './skinIcons.js';
import { GEAR as GEAR_CATALOGUE, type GearDef } from '../avatar/gear.js';
import { BOSSES } from '../campaign/bosses.js';
import { drawBossIcon } from '../campaign/icons.js';
import {
  campaignProgress,
  difficultyUnlocked,
  fmtRunTime,
  gauntletUnlocked,
  goopliathUnlocked,
  stageUnlocked,
} from '../campaign/campaignState.js';
import { ATTACH, DIFFICULTY, DIFFICULTY_ORDER, GAME_TITLE, hueToColor, type ArcadeMode, type Difficulty } from '../config.js';
import { gazette, type GazetteArticle } from '../net/gazette.js';
import { mesh } from '../net/mesh.js';
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

/** Draw the riveted "$" symbol at (x,y) sized w×h — the decoded PNG once it's
 *  loaded, with a stencilled "$" as the fallback before then. */
function drawCoinSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const img = coinImage();
  if (img) {
    ctx.drawImage(img, x, y, w, h);
  } else {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(h * 0.9)}px Georgia, serif`;
    ctx.fillStyle = UI.amber;
    ctx.fillText('$', x + w / 2, y + h / 2);
    ctx.restore();
  }
}

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
// ───────────────────── THE TITAN GAUNTLET (campaign) ────────────────────────
// The ARCADE panel's CAMPAIGN plate opens this modal line-up: the five titans
// left to right (you fight them in order), each card wearing its bespoke icon
// (hook, piston, crosshair, shield, crown) with FELLED / FIGHT / sealed
// states and path chevrons. Below: the timed GAUNTLET RUN and HARDCORE
// plates with their local best-clock boards. Bouts return here, win or lose.

const CAMP_W = 1024;
const CAMP_H = 664;
const CARD_W = 168;
const CARD_H = 250;
const CARD_GAP = 16;
const CARD_Y = 96;
const CARDS_X = (CAMP_W - (CARD_W * 5 + CARD_GAP * 4)) / 2;
// The run difficulty chips sit right above the run buttons they govern.
const DIFF_ROW = { x: 210, y: 360, w: 118, gap: 10, h: 34 } as const;
/** The pick-your-damage pop-up GAUNTLET/HARDCORE open before launching. */
const LAUNCH_MODAL = { x: CAMP_W / 2 - 320, y: 168, w: 640, h: 260 } as const;
/** Which fight the launch pop-up is arming (null = no pop-up). MenuSystem
 *  sets it on the run/goop buttons and clears it on start/cancel/close. */
export const campaignModal = { pending: null as 'gauntlet' | 'hardcore' | 'goopliath' | null };
const RUN_BTN = { x: 48, y: 410, w: 320, h: 54 } as const;
const HARD_BTN = { x: 48, y: 476, w: 320, h: 54 } as const;
/** The sealed sixth emblem BENEATH the line-up — GOOPLIATH's own fight. */
const GOOP_BTN = { x: 48, y: 542, w: 320, h: 54 } as const;
const GOOP_GREEN = '#36e05a';
const CAMP_CLOSE = { x: CAMP_W - 48 - 170, y: 600, w: 170, h: 54 } as const;
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/**
 * A row of the four difficulty chips (EASY / NORMAL / HARD / BLAZING) at
 * (x,y). `current` is the selected tier; locked tiers wear a padlock and
 * never highlight. `interactive` gates the hover glow (raid guests just watch
 * the host's pick). Shared by the campaign gauntlet panel and the raid lobby.
 */
function drawDiffChips(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  chipW: number,
  gap: number,
  h: number,
  current: Difficulty,
  hoverAction: MenuAction | null,
  prefix: string,
  interactive: boolean,
  sealed = false,
): void {
  DIFFICULTY_ORDER.forEach((tier, i) => {
    const cx = x + i * (chipW + gap);
    // A SEALED row (no run to apply it to yet) draws every chip locked —
    // difficulty means nothing until the gauntlet opens.
    const open = !sealed && difficultyUnlocked(tier);
    const on = !sealed && tier === current;
    const accent = hexCss(DIFFICULTY[tier].accent);
    const hot = interactive && open && hoverAction === (`${prefix}${tier}` as MenuAction);
    plate(ctx, cx, y, chipW, h, {
      cut: 8,
      fill: on ? hexToRgba(accent, 0.28) : open ? 'rgba(150,150,170,0.10)' : 'rgba(150,150,170,0.04)',
      stroke: on || hot ? accent : UI.steelDim,
      rivets: false,
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.fillStyle = on ? accent : open ? UI.text : UI.steelDim;
    ctx.fillText(DIFFICULTY[tier].label, cx + chipW / 2, y + h / 2 + (open ? 0 : -3));
    if (!open) padlock(ctx, cx + chipW / 2, y + h - 7, 0.4);
  });
}

/** Hit-test a difficulty chip row; returns the action for an UNLOCKED tier. */
function hitDiffChips(
  px: number,
  py: number,
  x: number,
  y: number,
  chipW: number,
  gap: number,
  h: number,
  prefix: string,
): MenuAction | null {
  if (py < y - 4 || py > y + h + 4) return null;
  for (let i = 0; i < DIFFICULTY_ORDER.length; i++) {
    const cx = x + i * (chipW + gap);
    if (px >= cx && px <= cx + chipW) {
      const tier = DIFFICULTY_ORDER[i];
      return difficultyUnlocked(tier) ? (`${prefix}${tier}` as MenuAction) : null;
    }
  }
  return null;
}

/** A simple stencil padlock for sealed stages. */
function padlock(ctx: CanvasRenderingContext2D, cx: number, cy: number, s = 1): void {
  ctx.strokeStyle = UI.steelDim;
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  ctx.arc(cx, cy - 8 * s, 11 * s, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = UI.steelDim;
  ctx.fillRect(cx - 15 * s, cy - 8 * s, 30 * s, 24 * s);
}

/** One run row: the start plate + its best-clock board beside it. */
function drawRunRow(
  ctx: CanvasRenderingContext2D,
  btn: { x: number; y: number; w: number; h: number },
  label: string,
  sealedLabel: string,
  open: boolean,
  accent: string,
  times: number[],
  lockHint: string,
  hot: boolean,
): void {
  buttonPlate(ctx, btn.x, btn.y, btn.w, btn.h, open ? label : sealedLabel, open ? accent : UI.steelDim, hot && open);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '700 24px system-ui, sans-serif';
  const tx = btn.x + btn.w + 28;
  const ty = btn.y + btn.h / 2 + 1;
  if (!open) {
    ctx.fillStyle = UI.steelDim;
    ctx.fillText(lockHint, tx, ty);
  } else if (times.length === 0) {
    ctx.fillStyle = UI.textDim;
    ctx.fillText('no clocks on the board yet', tx, ty);
  } else {
    ctx.fillStyle = accent;
    ctx.fillText(`★ ${fmtRunTime(times[0])}`, tx, ty);
    ctx.fillStyle = UI.textDim;
    ctx.fillText(times.slice(1, 4).map(fmtRunTime).join('  ·  '), tx + 140, ty);
  }
}

function drawCampaign(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  ctx.clearRect(0, 0, CAMP_W, CAMP_H);
  plate(ctx, 8, 8, CAMP_W - 16, CAMP_H - 16, {
    cut: 30,
    fill: UI.ink,
    stroke: hoverAction ? UI.danger : UI.steel,
  });
  hazardStrip(ctx, 40, 34, 60, 18, UI.amber);
  ctx.textAlign = 'left';
  ctx.font = stencilFont(42);
  ctx.fillStyle = UI.danger;
  ctx.fillText('THE TITAN GAUNTLET', 118, 46);
  ctx.strokeStyle = UI.steelDim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 74);
  ctx.lineTo(CAMP_W - 40, 74);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cleared = campaignProgress.cleared;
  for (let i = 0; i < 5; i++) {
    const x = CARDS_X + i * (CARD_W + CARD_GAP);
    const cx = x + CARD_W / 2;
    const done = cleared[i] === true;
    const open = stageUnlocked(i);
    const boss = BOSSES[i];
    const accent = hexCss(boss.accent);

    plate(ctx, x, CARD_Y, CARD_W, CARD_H, {
      cut: 14,
      fill: done ? 'rgba(255,122,24,0.14)' : open ? 'rgba(255,176,0,0.08)' : 'rgba(150,150,170,0.05)',
      stroke: done ? UI.ember : open ? accent : UI.steelDim,
      rivets: false,
    });

    ctx.font = stencilFont(24);
    ctx.fillStyle = open ? UI.textDim : UI.steelDim;
    ctx.fillText(ROMAN[i], cx, CARD_Y + 26);

    drawBossIcon(ctx, i, cx, CARD_Y + 104, 46, done ? UI.emberBright : open ? accent : UI.steelDim);
    if (!open) padlock(ctx, cx, CARD_Y + 104);

    ctx.font = stencilFont(19);
    ctx.fillStyle = open ? UI.text : UI.steelDim;
    ctx.fillText(open ? boss.name : 'SEALED', cx, CARD_Y + 184);

    ctx.font = '700 20px system-ui, sans-serif';
    if (done) {
      ctx.fillStyle = UI.emberBright;
      ctx.fillText('FELLED ✓', cx, CARD_Y + 222);
    } else if (open) {
      const hot = hoverAction === (`campaign-${i}` as MenuAction);
      ctx.fillStyle = hot ? accent : UI.amber;
      ctx.fillText('FIGHT', cx, CARD_Y + 222);
    } else {
      ctx.fillStyle = UI.steelDim;
      ctx.fillText('fell the last', cx, CARD_Y + 222);
    }

    // Path chevron toward the next card.
    if (i < 4) {
      ctx.fillStyle = cleared[i] ? UI.ember : UI.steelDim;
      const ax = x + CARD_W + CARD_GAP / 2;
      const ay = CARD_Y + 104;
      ctx.beginPath();
      ctx.moveTo(ax - 6, ay - 10);
      ctx.lineTo(ax + 6, ay);
      ctx.lineTo(ax - 6, ay + 10);
      ctx.closePath();
      ctx.fill();
    }
  }

  // The timed runs — unlocked by clearing the gauntlet, then by finishing it.
  // (Difficulty is picked in the LAUNCH pop-up these buttons open — it only
  // governs the runs, so it lives with them, not loose on the screen.)
  drawRunRow(
    ctx, RUN_BTN, 'RUN THE GAUNTLET', 'GAUNTLET SEALED', gauntletUnlocked(), UI.emberBright,
    campaignProgress.runTimesGauntlet, 'fell all five titans to unlock',
    hoverAction === 'campaign-speedrun',
  );
  drawRunRow(
    ctx, HARD_BTN, 'HARDCORE', 'HARDCORE SEALED', campaignProgress.hardcoreUnlocked, UI.danger,
    campaignProgress.runTimesHardcore, 'complete a gauntlet run to unlock',
    hoverAction === 'campaign-hardcore',
  );

  // GOOPLIATH — the something-else beneath the titan line-up. Its emblem is
  // no machine glyph: the gel creature itself, sealed until the gauntlet is
  // cleared, FELLED once he's been put down.
  {
    const open = goopliathUnlocked();
    const felled = campaignProgress.goopliathCleared;
    const hot = hoverAction === 'campaign-goopliath';
    buttonPlate(
      ctx, GOOP_BTN.x, GOOP_BTN.y, GOOP_BTN.w, GOOP_BTN.h,
      open ? 'FIGHT GOOPLIATH' : 'SOMETHING STIRS', open ? GOOP_GREEN : UI.steelDim, hot && open,
    );
    // The emblem beside the plate — the sixth symbol, beneath the five.
    const ix = GOOP_BTN.x + GOOP_BTN.w + 46;
    const iy = GOOP_BTN.y + GOOP_BTN.h / 2;
    drawBossIcon(ctx, 5, ix, iy, 24, felled ? UI.emberBright : open ? GOOP_GREEN : UI.steelDim);
    if (!open) padlock(ctx, ix, iy, 0.6);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '700 24px system-ui, sans-serif';
    const tx = ix + 44;
    const ty = iy + 1;
    if (felled) {
      ctx.fillStyle = UI.emberBright;
      ctx.fillText('FELLED ✓ — fight it again', tx, ty);
    } else if (open) {
      ctx.fillStyle = GOOP_GREEN;
      ctx.fillText('it waits beneath the pit', tx, ty);
    } else {
      ctx.fillStyle = UI.steelDim;
      ctx.fillText('fell all five titans', tx, ty);
    }
  }

  ctx.textAlign = 'center';
  buttonPlate(ctx, CAMP_CLOSE.x, CAMP_CLOSE.y, CAMP_CLOSE.w, CAMP_CLOSE.h, 'CLOSE', UI.amber, hoverAction === 'campaign-close');

  // The LAUNCH pop-up: pressing GAUNTLET, HARDCORE or FIGHT GOOPLIATH doesn't
  // fire straight away any more — pick the damage first, then START. (Raids
  // keep their own host picker in the lobby; single titan bouts run normal.)
  if (campaignModal.pending) {
    ctx.fillStyle = 'rgba(4,5,8,0.62)';
    ctx.fillRect(0, 0, CAMP_W, CAMP_H);
    const m = LAUNCH_MODAL;
    const kind = campaignModal.pending;
    const accent = kind === 'hardcore' ? UI.danger : kind === 'goopliath' ? GOOP_GREEN : UI.emberBright;
    const title = kind === 'hardcore' ? 'HARDCORE RUN' : kind === 'goopliath' ? 'FIGHT GOOPLIATH' : 'RUN THE GAUNTLET';
    const blurb =
      kind === 'hardcore'
        ? 'no healing between titans — pick your damage'
        : kind === 'goopliath'
          ? 'the tide rises from beneath'
          : 'all five titans, on the clock — pick your damage';
    plate(ctx, m.x, m.y, m.w, m.h, { cut: 18, fill: 'rgba(14,15,20,0.97)', stroke: accent });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = stencilFont(34);
    ctx.fillStyle = accent;
    ctx.fillText(title, CAMP_W / 2, m.y + 46);
    ctx.font = '600 19px system-ui, sans-serif';
    ctx.fillStyle = UI.textDim;
    ctx.fillText(blurb, CAMP_W / 2, m.y + 82);
    const chipsW = DIFFICULTY_ORDER.length * (DIFF_ROW.w + DIFF_ROW.gap) - DIFF_ROW.gap;
    drawDiffChips(ctx, CAMP_W / 2 - chipsW / 2, m.y + 108, DIFF_ROW.w, DIFF_ROW.gap, 40, app.difficulty, hoverAction, 'diff-', true);
    buttonPlate(ctx, m.x + 44, m.y + m.h - 74, 170, 52, 'CANCEL', UI.steel, hoverAction === 'campaign-launch-cancel');
    buttonPlate(
      ctx, m.x + m.w - 44 - 210, m.y + m.h - 74, 210, 52,
      'START', accent, hoverAction === 'campaign-launch-start',
    );
  }
}

function hitCampaign(u: number, v: number): MenuAction | null {
  const x = u * CAMP_W;
  const y = (1 - v) * CAMP_H;
  const inBtn = (b: { x: number; y: number; w: number; h: number }): boolean =>
    x >= b.x && x <= b.x + b.w && y >= b.y - 5 && y <= b.y + b.h + 5;
  // While the launch pop-up is open it owns every click: its chips and two
  // buttons hit, anything else is a dismiss.
  if (campaignModal.pending) {
    const m = LAUNCH_MODAL;
    const chipsW = DIFFICULTY_ORDER.length * (DIFF_ROW.w + DIFF_ROW.gap) - DIFF_ROW.gap;
    const diff = hitDiffChips(x, y, CAMP_W / 2 - chipsW / 2, m.y + 108, DIFF_ROW.w, DIFF_ROW.gap, 40, 'diff-');
    if (diff) return diff;
    if (x >= m.x + 44 && x <= m.x + 214 && y >= m.y + m.h - 79 && y <= m.y + m.h - 17) return 'campaign-launch-cancel';
    if (x >= m.x + m.w - 254 && x <= m.x + m.w - 44 && y >= m.y + m.h - 79 && y <= m.y + m.h - 17) return 'campaign-launch-start';
    return 'campaign-launch-cancel';
  }
  if (inBtn(CAMP_CLOSE)) return 'campaign-close';
  if (inBtn(RUN_BTN) && gauntletUnlocked()) return 'campaign-speedrun';
  if (inBtn(HARD_BTN) && campaignProgress.hardcoreUnlocked) return 'campaign-hardcore';
  if (inBtn(GOOP_BTN) && goopliathUnlocked()) return 'campaign-goopliath';
  if (y >= CARD_Y - 6 && y <= CARD_Y + CARD_H + 6) {
    for (let i = 0; i < 5; i++) {
      const sx = CARDS_X + i * (CARD_W + CARD_GAP);
      if (x >= sx && x <= sx + CARD_W) {
        return stageUnlocked(i) ? (`campaign-${i}` as MenuAction) : null;
      }
    }
  }
  return null;
}

// ─────────────────────────── THE ARCADE LOBBY ───────────────────────────────
// One shared modal serving every networked arcade mode (2v2 / ffa / raid),
// switched by app.lobbyMode. Two faces: the BROWSER (open rooms you can join,
// plus MAKE LOBBY / VS BOTS) and a joined LOBBY (the room's seats, host
// controls, and the launch status). 2v2 and raid auto-launch when the room
// fills; a short-handed FFA host can START early. Matchmaking works like
// RANKED's server browser: hosting makes a VISIBLE room others can find.

const RAID_W = 640;
// Tall enough for the difficulty chip row + TWO host breakers (hardcore +
// goopliath) with clear air before the status line — the panel's world height
// scales with this at registration, so the layout just breathes.
const RAID_H = 700;
const RAID_ROW_Y0 = 150;
const RAID_ROW_H = 58;
const RAID_ROW_GAP = 10;
/** The WATCH chip at the right end of a browser row. */
const ROW_WATCH = { w: 104, h: 38 };
// Browser bottom row: MAKE / VS BOTS side by side (raid uses the left half full
// for HOST since it has no bot variant), then a centred CLOSE below.
const LOBBY_MAKE_BTN = { x: 70, y: RAID_H - 152, w: (RAID_W - 140 - 16) / 2, h: 58 };
const LOBBY_BOTS_BTN = { x: 70 + (RAID_W - 140 - 16) / 2 + 16, y: RAID_H - 152, w: (RAID_W - 140 - 16) / 2, h: 58 };
const RAID_HOST_BTN = { x: 70, y: RAID_H - 152, w: RAID_W - 140, h: 58 };
const RAID_CLOSE_BTN = { x: RAID_W / 2 - 90, y: RAID_H - 78, w: 180, h: 48 };
const RAID_SLOT_Y0 = 148;
const RAID_SLOT_H = 52;
const RAID_SLOT_GAP = 10;
// The two host breakers stack below the seats. Each is a bold title over a
// small descriptor with the toggle centred on the right — the descriptor is
// far too long to sit beside the toggle on one line (it used to run straight
// through it). RAID_BREAKER_H is the row height both the draw and the hit
// test share.
// The run-difficulty chips (host-controlled, mirrored to the squad) sit just
// below the seats, above the two breakers.
const RAID_DIFF = { x: 188, y: 394, w: 90, gap: 7, h: 34 } as const;
const RAID_HC_Y = 448;
const RAID_BREAKER_H = 46;
/** The second raid breaker: FIGHT GOOPLIATH — swap the titans for the tide. */
const RAID_GOOP_Y = RAID_HC_Y + RAID_BREAKER_H + 6;
// Status line over the bottom controls. In a joined lobby the FFA host also
// gets a START button (short-handed launch) tucked left of LEAVE. Sits well
// clear of the HARDCORE row above (its text + toggle plate) — the two used to
// crowd into each other by a few pixels in a full raid lobby.
const RAID_STATUS_Y = RAID_H - 98;
const RAID_LEAVE_BTN = { x: RAID_W / 2 - 110, y: RAID_H - 74, w: 220, h: 52 };
const LOBBY_START_BTN = { x: 70, y: RAID_H - 74, w: 200, h: 52 };
const LOBBY_LEAVE_BTN = { x: RAID_W - 70 - 200, y: RAID_H - 74, w: 200, h: 52 };

interface LobbyMeta {
  accent: string;
  rowSoft: string;
  seatSoft: string;
  hostTag: string;
  title: string;
}

/** Per-mode look + copy for the shared lobby modal. */
function lobbyMeta(mode: ArcadeMode): LobbyMeta {
  switch (mode) {
    case '2v2':
      return {
        accent: UI.cool,
        rowSoft: 'rgba(79,183,255,0.16)',
        seatSoft: 'rgba(79,183,255,0.10)',
        hostTag: UI.coolBright,
        title: '2V2',
      };
    case 'ffa':
      return {
        accent: UI.amber,
        rowSoft: 'rgba(255,176,0,0.16)',
        seatSoft: 'rgba(255,176,0,0.10)',
        hostTag: UI.amberSoft,
        title: 'FFA',
      };
    default:
      return {
        accent: '#b26bff',
        rowSoft: 'rgba(178,107,255,0.16)',
        seatSoft: 'rgba(178,107,255,0.10)',
        hostTag: '#d9c2ff',
        title: 'RAID',
      };
  }
}

/** The 2v2 team a canonical seat sits on (seats 0,1 = your team; 2,3 = rivals). */
function seatTeamTag(mode: ArcadeMode, seat: number): string | null {
  if (mode !== '2v2') return null;
  return seat < 2 ? 'TEAM A' : 'TEAM B';
}

function drawRaid(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  const mode = app.lobbyMode ?? '2v2';
  const meta = lobbyMeta(mode);
  panelBg(ctx, false, meta.accent, meta.title, RAID_W, RAID_H);
  ctx.textAlign = 'center';

  if (app.lobbyView === 'lobby') return drawRaidLobby(ctx, hoverAction, mode, meta);

  // — the BROWSER: open rooms, or raise your own —
  const rooms = app.lobbyRooms.slice(0, 4);
  if (!rooms.length) {
    ctx.fillStyle = UI.steelDim;
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText(mode === 'raid' ? 'no open raids — raise your own squad' : 'no open lobbies — make your own', RAID_W / 2, RAID_ROW_Y0 + 70);
  }
  rooms.forEach((room, i) => {
    const ry = RAID_ROW_Y0 + i * (RAID_ROW_H + RAID_ROW_GAP);
    const hot = hoverAction === `lobby-join-${room.id}`;
    plate(ctx, 70, ry, RAID_W - 140, RAID_ROW_H, {
      cut: 12,
      fill: hot ? meta.rowSoft : 'rgba(150,150,170,0.08)',
      stroke: hot ? meta.accent : UI.steelDim,
      rivets: false,
    });
    ctx.textAlign = 'left';
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillStyle = hot ? UI.text : UI.text;
    ctx.fillText(mode === 'raid' ? `${room.host}'S RAID` : `${room.host}'S LOBBY`, 92, ry + RAID_ROW_H / 2 + 2);
    ctx.textAlign = 'right';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillStyle = room.count >= room.cap ? UI.danger : UI.coolBright;
    ctx.fillText(`${room.count}/${room.cap}`, RAID_W - 190, ry + RAID_ROW_H / 2 + 2);
    // WATCH: the terrace is always open, even on a lobby with seats going
    // spare — turning up to see it is a way to be in the room.
    {
      const w = ROW_WATCH;
      const wHot = hoverAction === `lobby-watch-${room.id}`;
      plate(ctx, RAID_W - 70 - w.w, ry + (RAID_ROW_H - w.h) / 2, w.w, w.h, {
        cut: 8,
        fill: wHot ? 'rgba(255,176,0,0.18)' : 'rgba(150,150,170,0.10)',
        stroke: wHot ? UI.amber : UI.steelDim,
        rivets: false,
      });
      ctx.textAlign = 'center';
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.fillStyle = wHot ? UI.amber : UI.textDim;
      ctx.fillText('WATCH', RAID_W - 70 - w.w / 2, ry + RAID_ROW_H / 2 + 2);
    }
    // Stakes tags: one sits on the midline; both stack into two short lines.
    const tags: Array<[string, string]> = [];
    if (room.goopliath) tags.push(['GOOPLIATH', GOOP_GREEN]);
    if (room.hardcore) tags.push(['HARDCORE', UI.danger]);
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    tags.forEach(([tag, colour], t) => {
      ctx.fillStyle = colour;
      const ty = tags.length > 1 ? ry + RAID_ROW_H / 2 - 8 + t * 20 : ry + RAID_ROW_H / 2 + 2;
      ctx.fillText(tag, RAID_W - 250, ty);
    });
    ctx.textAlign = 'center';
  });

  if (mode === 'raid') {
    // Raid is co-op only — no bot variant, so one full-width HOST button.
    buttonPlate(ctx, RAID_HOST_BTN.x, RAID_HOST_BTN.y, RAID_HOST_BTN.w, RAID_HOST_BTN.h, 'HOST A RAID', meta.accent, hoverAction === 'lobby-host');
  } else {
    buttonPlate(ctx, LOBBY_MAKE_BTN.x, LOBBY_MAKE_BTN.y, LOBBY_MAKE_BTN.w, LOBBY_MAKE_BTN.h, 'MAKE LOBBY', meta.accent, hoverAction === 'lobby-host');
    buttonPlate(ctx, LOBBY_BOTS_BTN.x, LOBBY_BOTS_BTN.y, LOBBY_BOTS_BTN.w, LOBBY_BOTS_BTN.h, 'VS BOTS', UI.steel, hoverAction === 'lobby-vsbots');
  }
  buttonPlate(ctx, RAID_CLOSE_BTN.x, RAID_CLOSE_BTN.y, RAID_CLOSE_BTN.w, RAID_CLOSE_BTN.h, 'CLOSE', UI.steel, hoverAction === 'lobby-close');
}

function drawRaidLobby(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null, mode: ArcadeMode, meta: LobbyMeta): void {
  const host = mesh.isHost();
  const cap = mesh.capacity || 4;
  // The room's seats — filled callsigns, or a seat left open. A five-seat
  // raid room compresses its rows so the fifth clears the difficulty chips.
  const rowH = cap > 4 ? 44 : RAID_SLOT_H;
  const rowGap = cap > 4 ? 6 : RAID_SLOT_GAP;
  const rowY0 = cap > 4 ? 128 : RAID_SLOT_Y0;
  for (let seat = 0; seat < cap; seat++) {
    const ry = rowY0 + seat * (rowH + rowGap);
    const occupied = !!mesh.occupants[seat];
    const isMe = mesh.joined && seat === mesh.mySeat;
    plate(ctx, 70, ry, RAID_W - 140, rowH, {
      cut: 12,
      fill: isMe ? 'rgba(255,122,24,0.14)' : occupied ? meta.seatSoft : 'rgba(150,150,170,0.06)',
      stroke: isMe ? UI.ember : occupied ? meta.accent : UI.steelDim,
      rivets: false,
    });
    ctx.textAlign = 'left';
    ctx.font = '700 23px system-ui, sans-serif';
    ctx.fillStyle = occupied ? UI.text : UI.steelDim;
    const label = occupied ? mesh.names[seat] || `PLAYER ${seat + 1}` : 'open seat…';
    ctx.fillText(label, 92, ry + rowH / 2 + 2);
    ctx.textAlign = 'right';
    const teamTag = seatTeamTag(mode, seat);
    if (seat === 0 && occupied) {
      ctx.font = '800 16px system-ui, sans-serif';
      ctx.fillStyle = meta.hostTag;
      ctx.fillText(teamTag ? `HOST · ${teamTag}` : 'HOST', RAID_W - 92, ry + rowH / 2 + 2);
    } else if (teamTag) {
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.fillStyle = seat < 2 ? UI.coolBright : UI.amberSoft;
      ctx.fillText(teamTag, RAID_W - 92, ry + rowH / 2 + 2);
    }
    ctx.textAlign = 'center';
  }

  // The run difficulty (raid only) — the host picks, the squad sees. Guests
  // get no hover glow (interactive=false); the mirrored pick launches for all.
  if (mode === 'raid') {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.fillStyle = UI.textDim;
    ctx.fillText('DIFFICULTY', 70, RAID_DIFF.y + RAID_DIFF.h / 2);
    drawDiffChips(ctx, RAID_DIFF.x, RAID_DIFF.y, RAID_DIFF.w, RAID_DIFF.gap, RAID_DIFF.h, mesh.raidDifficulty, hoverAction, 'raiddiff-', host);
    ctx.textAlign = 'center';
  }

  // The host breakers (raid only) — the host throws them; all see where they
  // sit. HARDCORE keeps the stakes; FIGHT GOOPLIATH swaps the whole run for
  // one long fight against the tide.
  if (mode === 'raid') {
    const pw = 88;
    const ph = 32;
    const px = RAID_W - 92 - pw;
    const breaker = (y: number, title: string, desc: string, on: boolean, action: MenuAction, accent: string): void => {
      const hot = hoverAction === action && host;
      // Bold title over a dim descriptor — both kept clear of the toggle
      // (they end well before px so the two never touch).
      ctx.textAlign = 'left';
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.fillStyle = on ? accent : hot ? accent : UI.text;
      ctx.fillText(title, 92, y + 18);
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillStyle = UI.textDim;
      ctx.fillText(desc, 92, y + 39);
      // The toggle, vertically centred on the row.
      const py = y + (RAID_BREAKER_H - ph) / 2;
      plate(ctx, px, py, pw, ph, {
        cut: 10,
        fill: on ? hexToRgba(accent, 0.25) : 'rgba(150,150,170,0.12)',
        stroke: on ? accent : hot ? accent : UI.steelDim,
        rivets: false,
      });
      ctx.fillStyle = on ? accent : UI.steelDim;
      const kw = pw / 2 - 10;
      ctx.fillRect(on ? px + pw - kw - 6 : px + 6, py + 6, kw, ph - 12);
      ctx.textAlign = 'center';
    };
    breaker(RAID_HC_Y, 'HARDCORE', 'no healing between titans', mesh.raidHardcore, 'lobby-hardcore', UI.danger);
    breaker(RAID_GOOP_Y, 'FIGHT GOOPLIATH', 'the tide, not the titans', mesh.raidGoopliath, 'lobby-goopliath', GOOP_GREEN);
  }

  // A PRIVATE room's code, kept on screen for the whole lobby so the host can
  // read it out (or re-read it) while seats fill. Only set for a coded room —
  // a room joined out of the public browser has none.
  if (app.privateCode) {
    ctx.textAlign = 'center';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillStyle = UI.textDim;
    ctx.fillText('INVITE CODE', RAID_W / 2, RAID_STATUS_Y - 54);
    ctx.font = stencilFont(38);
    ctx.fillStyle = UI.coolBright;
    ctx.fillText(app.privateCode.split('').join(' '), RAID_W / 2, RAID_STATUS_Y - 20);
  }

  // Launch status. 2v2 auto-launches when full; FFA and RAID can also go
  // short-handed (≥2) — the raid boss scales to the squad that walks in.
  const count = mesh.occupants.filter(Boolean).length;
  const full = count >= cap;
  const shortStart = mode === 'ffa' || mode === 'raid'; // playable with 2+
  const shortReady = shortStart && count >= 2;
  ctx.textAlign = 'center';
  ctx.font = full ? '800 24px system-ui, sans-serif' : '600 21px system-ui, sans-serif';
  ctx.fillStyle = full ? '#d9a832' : 'rgba(230,236,242,0.85)';
  const noun = mode === 'raid' ? 'raiders' : 'players';
  const launchWord = mode === 'raid' ? 'launches the raid' : 'starts the brawl';
  ctx.fillText(
    full
      ? 'ROOM FULL — LAUNCHING…'
      : shortStart
        ? `${count} / ${cap} ${noun} — start at 2, a full room ${launchWord}`
        : `${count} / ${cap} ${noun} — a full room ${launchWord}`,
    RAID_W / 2,
    RAID_STATUS_Y,
  );

  // Short-handed FFA / RAID: host gets a START button once there are ≥2 in.
  if (shortStart && host && shortReady && !full) {
    buttonPlate(ctx, LOBBY_START_BTN.x, LOBBY_START_BTN.y, LOBBY_START_BTN.w, LOBBY_START_BTN.h, 'START NOW', UI.amber, hoverAction === 'lobby-start');
    buttonPlate(ctx, LOBBY_LEAVE_BTN.x, LOBBY_LEAVE_BTN.y, LOBBY_LEAVE_BTN.w, LOBBY_LEAVE_BTN.h, 'LEAVE', UI.steel, hoverAction === 'lobby-leave');
  } else {
    buttonPlate(ctx, RAID_LEAVE_BTN.x, RAID_LEAVE_BTN.y, RAID_LEAVE_BTN.w, RAID_LEAVE_BTN.h, 'LEAVE', UI.steel, hoverAction === 'lobby-leave');
  }
}

function hitRaid(u: number, v: number): MenuAction | null {
  const mode = app.lobbyMode ?? '2v2';
  const x = u * RAID_W;
  const y = (1 - v) * RAID_H;
  const inBtn = (b: { x: number; y: number; w: number; h: number }): boolean =>
    x >= b.x && x <= b.x + b.w && y >= b.y - 4 && y <= b.y + b.h + 4;

  if (app.lobbyView === 'lobby') {
    const onBreaker = (by: number): boolean => y >= by - 4 && y <= by + RAID_BREAKER_H && x >= 70 && x <= RAID_W - 70;
    if (mode === 'raid' && mesh.isHost()) {
      const rd = hitDiffChips(x, y, RAID_DIFF.x, RAID_DIFF.y, RAID_DIFF.w, RAID_DIFF.gap, RAID_DIFF.h, 'raiddiff-');
      if (rd) return rd;
    }
    if (mode === 'raid' && mesh.isHost() && onBreaker(RAID_HC_Y)) return 'lobby-hardcore';
    if (mode === 'raid' && mesh.isHost() && onBreaker(RAID_GOOP_Y)) return 'lobby-goopliath';
    const count = mesh.occupants.filter(Boolean).length;
    if ((mode === 'ffa' || mode === 'raid') && mesh.isHost() && count >= 2 && count < (mesh.capacity || 4)) {
      if (inBtn(LOBBY_START_BTN)) return 'lobby-start';
      if (inBtn(LOBBY_LEAVE_BTN)) return 'lobby-leave';
    }
    if (inBtn(RAID_LEAVE_BTN)) return 'lobby-leave';
    return null;
  }
  if (mode === 'raid') {
    if (inBtn(RAID_HOST_BTN)) return 'lobby-host';
  } else {
    if (inBtn(LOBBY_MAKE_BTN)) return 'lobby-host';
    if (inBtn(LOBBY_BOTS_BTN)) return 'lobby-vsbots';
  }
  if (inBtn(RAID_CLOSE_BTN)) return 'lobby-close';
  const rooms = app.lobbyRooms.slice(0, 4);
  for (let i = 0; i < rooms.length; i++) {
    const ry = RAID_ROW_Y0 + i * (RAID_ROW_H + RAID_ROW_GAP);
    if (y < ry - 4 || y > ry + RAID_ROW_H + 4 || x < 70 || x > RAID_W - 70) continue;
    // The WATCH chip owns the row's right end — a full lobby still has a
    // terrace, so it answers whether or not there is a seat going.
    if (x >= RAID_W - 70 - ROW_WATCH.w) return `lobby-watch-${rooms[i].id}` as MenuAction;
    if (rooms[i].count < rooms[i].cap) return `lobby-join-${rooms[i].id}` as MenuAction;
  }
  return null;
}

// ─────────────────────────── LOCKER & STORE ─────────────────────────────────
// Two faces of one cosmetics plate, switched by the LOCKER | STORE header
// tabs where the title used to sit. STORE lists only the items you DON'T own
// yet, with prices (buying auto-equips AND stocks your locker); LOCKER lists
// only what you own, to equip — plus a COLOUR tab carrying the armour + accent
// hue sliders. Each tile shows a PICTURE of the skin: an animal silhouette (a
// shield for the knight) for avatars, a little coloured pad for platforms.

const PAN_W = 560;
const PAN_H = 600;
const TAB_Y = 84;
const TAB_H = 46;
const GRID_TOP = 152;
const GRID_COLS = 3;
const GRID_GAP = 14;
const ITEM_W = (PAN_W - 80 - (GRID_COLS - 1) * GRID_GAP) / GRID_COLS;
const ITEM_H = 112;
const ROW_STEP = ITEM_H + 12;
const FOOT_CLOSE = { x: PAN_W - 40 - 160, y: PAN_H - 66, w: 160, h: 50 };
// The LOCKER | STORE header pair — sits on the title line, switched like tabs.
const HEAD_TAB = { x0: 104, y: 12, w: 145, gap: 8, h: 48 };
const HEAD_TABS: Array<{ label: string; action: MenuAction }> = [
  { label: 'LOCKER', action: 'open-locker' },
  { label: 'STORE', action: 'open-shop' },
];
// COLOUR-tab tracks (locker only): armour repaints the suit, accent the neon,
// each with a hue track and a lightness track beneath it.
const ARMOUR_BAR = { x: 40, y: 168, w: PAN_W - 210, h: 38 };
const ARMOUR_LIGHT_BAR = { x: 40, y: 250, w: PAN_W - 80, h: 38 };
const BASE_WHITE = { x: 40, y: 168, w: (PAN_W - 100) / 2, h: 64 };
const BASE_BLACK = { x: 60 + (PAN_W - 100) / 2, y: 168, w: (PAN_W - 100) / 2, h: 64 };
const ACCENT_BAR = { x: 40, y: 348, w: PAN_W - 210, h: 38 };
const ACCENT_DEF = { x: PAN_W - 156, y: 348, w: 116, h: 38 };
const ACCENT_LIGHT_BAR = { x: 40, y: 430, w: PAN_W - 80, h: 38 };

interface PanRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A CSS hex colour ('#rrggbb') at the given alpha — breaker fill washes. */
function hexToRgba(css: string, a: number): string {
  const n = parseInt(css.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function hexCss(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}

function inPanRect(x: number, y: number, r: PanRect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
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

/** Which tab is showing. 'colour' and 'arena' are locker-only, so the shop
 *  falls back to avatars for either. */
function activeTab(locker: boolean): 'avatars' | 'platforms' | 'gear' | 'colour' | 'arena' {
  const t = customization.tab;
  // FF2: THE BLANK is the only body — the AVATARS shelf is gone from both
  // faces. Anything that still says 'avatars' (old saves) reads PLATFORMS.
  if (t === 'avatars') return 'platforms';
  return !locker && (t === 'colour' || t === 'arena') ? 'platforms' : t;
}

interface DisplayItem {
  rect: PanRect;
  action: MenuAction;
  kind: 'avatar' | 'platform' | 'gear';
  skin: AvatarSkin | PlatformSkin | GearDef;
  index: number;
}

/** The tiles shown for the current tab — laid out in a 3-wide grid. SHOP shows
 *  everything (+ a COMING SOON slot), the LOCKER only what's owned. */
function panelItems(locker: boolean): { items: DisplayItem[]; soon: PanRect | null } {
  const tab = activeTab(locker);
  const items: DisplayItem[] = [];
  // Count this tab's tiles first: a catalogue tall enough to need a 4th row
  // compresses its rows so the grid stays clear of the footer buttons.
  const count =
    tab === 'avatars'
      ? AVATAR_SKINS.filter((s) => !s.locked && avatarOwned(s.id) === locker).length + (locker ? 0 : 1)
      : tab === 'gear'
        ? GEAR_CATALOGUE.filter((g) => gearOwned(g.id) === locker).length
        : PLATFORM_SKINS.filter((s) => platformOwned(s.id) === locker).length;
  const rows = Math.max(1, Math.ceil(count / GRID_COLS));
  // Up to 3 rows fit at full height (the classic layout, untouched); more
  // than that shares the same vertical span between the rows.
  const rowStep = rows <= 3 ? ROW_STEP : Math.floor((FOOT_CLOSE.y - 12 - GRID_TOP) / rows);
  const itemH = rowStep - (ROW_STEP - ITEM_H);
  let idx = 0;
  const next = (): PanRect => {
    const col = idx % GRID_COLS;
    const row = Math.floor(idx / GRID_COLS);
    idx++;
    return { x: 40 + col * (ITEM_W + GRID_GAP), y: GRID_TOP + row * rowStep, w: ITEM_W, h: itemH };
  };
  // LOCKER shows what you OWN (to equip); SHOP shows what you DON'T (to buy) —
  // owned items drop out of the shop so it only ever lists fresh unlocks.
  if (tab === 'avatars') {
    AVATAR_SKINS.forEach((s, i) => {
      if (s.locked) return;
      if (avatarOwned(s.id) !== locker) return;
      items.push({ rect: next(), action: `shop-av-${i}` as MenuAction, kind: 'avatar', skin: s, index: i });
    });
    return { items, soon: locker ? null : next() };
  }
  if (tab === 'gear') {
    // GEAR: the STORE lists what you don't own (slot-grouped by catalogue
    // order), the LOCKER what you do — tap to wear / take off.
    GEAR_CATALOGUE.forEach((g, k) => {
      if (gearOwned(g.id) !== locker) return;
      items.push({ rect: next(), action: `shop-gr-${k}` as MenuAction, kind: 'gear', skin: g, index: k });
    });
    return { items, soon: null };
  }
  PLATFORM_SKINS.forEach((s, j) => {
    if (platformOwned(s.id) !== locker) return;
    items.push({ rect: next(), action: `shop-pf-${j}` as MenuAction, kind: 'platform', skin: s, index: j });
  });
  return { items, soon: null };
}

/** The BUY button strip inside a previewed STORE tile. */
function buyRect(r: PanRect): PanRect {
  return { x: r.x + 10, y: r.y + r.h - 32, w: r.w - 20, h: 26 };
}

/** Is this tile the skin the STORE is currently trying on? */
function tilePreviewed(it: DisplayItem): boolean {
  return customization.preview?.kind === it.kind && customization.preview.id === it.skin.id;
}

/** One cosmetic tile: a picture, its name, and a status footer. */
function drawTile(ctx: CanvasRenderingContext2D, it: DisplayItem, hoverAction: MenuAction | null, locker: boolean): void {
  const r = it.rect;
  const avatar = it.kind === 'avatar';
  const gear = it.kind === 'gear';
  const accent = avatar ? (it.skin as AvatarSkin).accent : gear ? 0xc9a86a : (it.skin as PlatformSkin).neon;
  const css = hexCss(accent);
  const equipped = avatar
    ? customization.avatar === it.skin.id
    : gear
      ? customization.gear.includes(it.skin.id)
      : customization.platform === it.skin.id;
  const owned = avatar ? avatarOwned(it.skin.id) : gear ? gearOwned(it.skin.id) : platformOwned(it.skin.id);
  const previewed = !locker && tilePreviewed(it);
  const hot = hoverAction === it.action;
  plate(ctx, r.x, r.y, r.w, r.h, {
    cut: 10,
    fill: equipped || previewed ? 'rgba(20,22,30,0.94)' : hot ? 'rgba(20,22,30,0.9)' : 'rgba(10,11,15,0.72)',
    stroke: equipped || previewed || hot ? css : UI.steel,
    rivets: false,
  });
  const icx = r.x + r.w / 2;
  // Short tiles (a catalogue deep enough to compress into 4 rows) tighten
  // the WHOLE layout — icon, name and footer used to keep their full-height
  // offsets and the name sat on top of the price line.
  const compact = r.h < 110;
  const iconR = r.h * (compact ? 0.23 : 0.27);
  const iconCy = r.y + r.h * (compact ? 0.3 : 0.34);
  if (avatar) drawAvatarIcon(ctx, it.skin.id, icx, iconCy, iconR, css);
  else if (gear) drawGearIcon(ctx, it.skin as GearDef, icx, iconCy, iconR, css);
  else drawPlatformIcon(ctx, it.skin as PlatformSkin, icx, iconCy, iconR);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fs = compact ? 15 : 18;
  ctx.font = `700 ${fs}px system-ui, sans-serif`;
  while (fs > 11 && ctx.measureText(it.skin.name).width > r.w - 16) {
    fs -= 1;
    ctx.font = `700 ${fs}px system-ui, sans-serif`;
  }
  ctx.fillStyle = equipped || previewed || hot ? css : UI.text;
  // The BUY button needs the footer strip, so a previewed name rides higher.
  ctx.fillText(it.skin.name, icx, r.y + r.h * (previewed ? (compact ? 0.56 : 0.62) : (compact ? 0.62 : 0.72)));

  const fy = r.y + r.h - (compact ? 10 : 14);
  ctx.font = `800 ${compact ? 10 : 12}px system-ui, sans-serif`;
  if (equipped) {
    ctx.fillStyle = UI.amber;
    ctx.fillText(gear ? 'WORN' : 'EQUIPPED', icx, fy);
  } else if (owned) {
    ctx.fillStyle = 'rgba(232,236,242,0.5)';
    ctx.fillText(gear ? 'WEAR' : 'EQUIP', icx, fy);
  } else if ((it.skin as PlatformSkin).earnedBy) {
    // Earned, never sold — the tile says how to win it, shrunk to fit
    // ('FELL RAID GOOPLIATH' runs the full tile).
    const msg = (it.skin as PlatformSkin).earnedBy as string;
    let efs = compact ? 10 : 12;
    while (efs > 8 && ctx.measureText(msg).width > r.w - 12) {
      efs -= 1;
      ctx.font = `800 ${efs}px system-ui, sans-serif`;
    }
    ctx.fillStyle = UI.steelDim;
    ctx.fillText(msg, icx, fy);
  } else if (previewed) {
    // Tried on (the mirror / your pad is modelling it) — the price row grows
    // into the actual BUY button.
    const price = (it.skin as { price?: number }).price ?? 0;
    const b = buyRect(r);
    const buyAction = `shop-buy-${avatar ? 'av' : gear ? 'gr' : 'pf'}-${it.index}`;
    buttonPlate(ctx, b.x, b.y, b.w, b.h, `BUY  ${price}`, canAfford(price) ? UI.amber : UI.steel, hoverAction === buyAction, !canAfford(price));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  } else {
    const price = (it.skin as { price?: number }).price ?? 0;
    const str = String(price);
    ctx.font = `800 ${compact ? 13 : 15}px system-ui, sans-serif`;
    const tw = ctx.measureText(str).width;
    const sym = compact ? 13 : 16;
    const sx = icx - (sym + 4 + tw) / 2;
    drawCoinSymbol(ctx, sx, fy - sym / 2, sym, sym);
    ctx.textAlign = 'left';
    ctx.fillStyle = canAfford(price) ? UI.amber : UI.steelDim;
    ctx.fillText(str, sx + sym + 4, fy);
  }
}

function drawSoonTile(ctx: CanvasRenderingContext2D, r: PanRect): void {
  plate(ctx, r.x, r.y, r.w, r.h, { cut: 10, fill: 'rgba(60,62,70,0.22)', stroke: UI.steelDim, rivets: false });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = UI.steelDim;
  ctx.font = `900 ${Math.round(r.h * 0.36)}px system-ui, sans-serif`;
  ctx.fillText('?', r.x + r.w / 2, r.y + r.h * 0.36);
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText('SOON', r.x + r.w / 2, r.y + r.h * 0.72);
  ctx.font = '800 12px system-ui, sans-serif';
  ctx.fillText('COMING SOON', r.x + r.w / 2, r.y + r.h - 14);
}

interface TabDef {
  label: string;
  action: MenuAction;
  active: boolean;
}

function drawTabs(ctx: CanvasRenderingContext2D, tabs: TabDef[], hoverAction: MenuAction | null): void {
  const gap = 10;
  const w = (PAN_W - 80 - (tabs.length - 1) * gap) / tabs.length;
  tabs.forEach((t, i) => {
    const x = 40 + i * (w + gap);
    const hot = hoverAction === t.action;
    plate(ctx, x, TAB_Y, w, TAB_H, {
      cut: 8,
      fill: t.active ? 'rgba(255,176,0,0.16)' : hot ? 'rgba(20,22,30,0.9)' : 'rgba(10,11,15,0.6)',
      stroke: t.active ? UI.amber : hot ? UI.steel : UI.steelDim,
      rivets: false,
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Shrink-to-fit with breathing room: four locker tabs leave PLATFORMS a
    // ~112px plate, which 19px caps filled edge-to-edge (the squeezed look).
    let px = 19;
    ctx.font = `800 ${px}px system-ui, sans-serif`;
    while (px > 12 && ctx.measureText(t.label).width > w - 24) {
      px -= 1;
      ctx.font = `800 ${px}px system-ui, sans-serif`;
    }
    ctx.fillStyle = t.active ? UI.amber : UI.textDim;
    ctx.fillText(t.label, x + w / 2, TAB_Y + TAB_H / 2);
  });
}

function tabHit(x: number, y: number, count: number): number | null {
  if (y < TAB_Y || y > TAB_Y + TAB_H) return null;
  const gap = 10;
  const w = (PAN_W - 80 - (count - 1) * gap) / count;
  for (let i = 0; i < count; i++) {
    const tx = 40 + i * (w + gap);
    if (x >= tx && x <= tx + w) return i;
  }
  return null;
}

/** A hue track + knob; `accent` true uses the neon ramp, else a plain spectrum.
 *  `hue` < 0 (armour default) draws no knob. */
function drawHueBar(ctx: CanvasRenderingContext2D, bar: PanRect, hue: number, accent: boolean): void {
  const grad = ctx.createLinearGradient(bar.x, 0, bar.x + bar.w, 0);
  for (let i = 0; i <= 12; i++) {
    const f = i / 12;
    grad.addColorStop(f, accent ? hexCss(hueToColor(f)) : `hsl(${f * 360}, 85%, 55%)`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  ctx.lineWidth = 2;
  ctx.strokeStyle = UI.steel;
  ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);
  if (hue >= 0) {
    const kx = bar.x + Math.min(1, Math.max(0, hue)) * bar.w;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(kx - 3, bar.y - 6, 6, bar.h + 12);
    ctx.strokeRect(kx - 3, bar.y - 6, 6, bar.h + 12);
  }
}

/** A dark→light track for a fixed hue + a knob at the chosen lightness.
 *  `accent` uses the neon ramp; armour uses a suit-tone ramp (grey if no hue). */
function drawLightBar(ctx: CanvasRenderingContext2D, bar: PanRect, light: number, hue: number, accent: boolean): void {
  const grad = ctx.createLinearGradient(bar.x, 0, bar.x + bar.w, 0);
  const h360 = (((hue % 1) + 1) % 1) * 360;
  for (let i = 0; i <= 12; i++) {
    const f = i / 12;
    let col: string;
    if (accent) {
      col = hexCss(hueToColor(hue, f));
    } else if (hue < 0) {
      col = `hsl(0, 0%, ${Math.round((0.06 + f * 0.84) * 100)}%)`; // no hue yet → greyscale
    } else {
      col = `hsl(${h360}, 55%, ${Math.round(Math.max(5, Math.min(92, (0.18 + f * 0.66) * 100)))}%)`;
    }
    grad.addColorStop(f, col);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  ctx.lineWidth = 2;
  ctx.strokeStyle = UI.steel;
  ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);
  const kx = bar.x + Math.min(1, Math.max(0, light)) * bar.w;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1.5;
  ctx.fillRect(kx - 3, bar.y - 6, 6, bar.h + 12);
  ctx.strokeRect(kx - 3, bar.y - 6, 6, bar.h + 12);
}

function drawResetBtn(ctx: CanvasRenderingContext2D, r: PanRect, atDefault: boolean, hot: boolean): void {
  plate(ctx, r.x, r.y, r.w, r.h, {
    cut: 8,
    fill: hot ? 'rgba(255,176,0,0.16)' : 'rgba(10,11,15,0.7)',
    stroke: atDefault || hot ? UI.amber : UI.steelDim,
    rivets: false,
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillStyle = atDefault ? UI.amber : UI.textDim;
  ctx.fillText('DEFAULT', r.x + r.w / 2, r.y + r.h / 2 + 1);
}

/** The locker's COLOUR tab: armour-suit + neon-accent, each a hue track over a
 *  lightness/darkness track. */
function drawColourTab(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const label = (text: string, y: number): void => {
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillStyle = UI.textDim;
    ctx.textAlign = 'left'; // reset — drawResetBtn leaves textAlign 'center'
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, 40, y);
  };

  // FF2: the body's ONE choice — start all white or all black. Everything
  // past the base tone is the paint system's job (DESIGN.md §5.3).
  label('THE BASE', BASE_WHITE.y - 14);
  const onyx = customization.avatar === 'onyx';
  const chip = (rect: PanRect, text: string, fill: string, ink: string, on: boolean, hovered: boolean): void => {
    plate(ctx, rect.x, rect.y, rect.w, rect.h, {
      cut: 12,
      fill,
      stroke: on ? UI.amber : hovered ? UI.text : UI.steelDim,
      rivets: false,
    });
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2 + (on ? -8 : 0));
    if (on) {
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillStyle = UI.amber;
      ctx.fillText('WORN', rect.x + rect.w / 2, rect.y + rect.h / 2 + 18);
    }
  };
  chip(BASE_WHITE, 'ALL WHITE', 'rgba(240,238,232,0.92)', '#16140f', !onyx, hoverAction === 'base-white');
  chip(BASE_BLACK, 'ALL BLACK', 'rgba(12,12,15,0.95)', '#e8e6e0', onyx, hoverAction === 'base-black');
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillStyle = UI.textDim;
  ctx.textAlign = 'left';
  ctx.fillText('the rest of your colour is PAINT, stripe by stripe — coming soon', 40, BASE_WHITE.y + BASE_WHITE.h + 34);

  label('GAUNTLET NEON', ACCENT_BAR.y - 14);
  drawHueBar(ctx, ACCENT_BAR, app.accentHue, true);
  drawResetBtn(ctx, ACCENT_DEF, Math.abs(app.accentHue - DEFAULT_ACCENT_HUE) < 0.005, hoverAction === 'accent-default');
  label('LIGHTNESS', ACCENT_LIGHT_BAR.y - 14);
  drawLightBar(ctx, ACCENT_LIGHT_BAR, app.accentLight, app.accentHue, true);
}

/** The LOCKER's ARENA tab — pick the backdrop that hangs behind your bouts:
 *  bare AR (your real room), the papercraft desert, or the salt flats. This is
 *  now the only place the backdrop is chosen; the quick passthrough disc that
 *  used to hang over the BATTLE panel is gone. */
const ARENA_OPTS: Array<{ env: AppEnvironment | null; label: string; action: MenuAction | null; soon?: boolean }> = [
  { env: 'ar', label: 'PASSTHROUGH', action: null, soon: true },
  { env: 'desert', label: 'DESERT', action: 'env-desert' },
  { env: 'saltflats', label: 'SALT FLATS', action: 'env-saltflats' },
];
const ARENA_ROW = { x: 40, y0: 168, w: PAN_W - 80, h: 96, step: 112 };

function arenaRowRect(i: number): PanRect {
  return { x: ARENA_ROW.x, y: ARENA_ROW.y0 + i * ARENA_ROW.step, w: ARENA_ROW.w, h: ARENA_ROW.h };
}

function drawArenaTab(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  ARENA_OPTS.forEach((opt, i) => {
    const r = arenaRowRect(i);
    // The held slot: a dim, non-interactive COMING SOON placeholder.
    if (opt.soon) {
      plate(ctx, r.x, r.y, r.w, r.h, {
        cut: 16,
        fill: 'rgba(60,62,70,0.16)',
        stroke: UI.steelDim,
        rivets: false,
      });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = stencilFont(30);
      ctx.fillStyle = UI.steelDim;
      ctx.fillText(opt.label, r.x + 36, r.y + r.h / 2);
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('...COMING SOON', r.x + r.w - 24, r.y + r.h / 2);
      return;
    }
    const on = app.environment === opt.env;
    const hot = opt.action !== null && hoverAction === opt.action;
    plate(ctx, r.x, r.y, r.w, r.h, {
      cut: 16,
      fill: on ? 'rgba(79,183,255,0.16)' : hot ? 'rgba(255,176,0,0.12)' : 'rgba(150,150,170,0.08)',
      stroke: on ? UI.cool : hot ? UI.amber : UI.steelDim,
      rivets: false,
    });
    // Selected marker — a lit chip on the left edge.
    ctx.fillStyle = on ? UI.coolBright : UI.steelDim;
    ctx.fillRect(r.x + 14, r.y + r.h / 2 - 16, 6, 32);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = stencilFont(30);
    ctx.fillStyle = on ? UI.coolBright : hot ? UI.amber : UI.text;
    ctx.fillText(opt.label, r.x + 36, r.y + r.h / 2);
    if (on) {
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.fillStyle = UI.coolBright;
      ctx.textAlign = 'right';
      ctx.fillText('EQUIPPED', r.x + r.w - 24, r.y + r.h / 2);
    }
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
}

function hitArenaTab(x: number, y: number): MenuAction | null {
  for (let i = 0; i < ARENA_OPTS.length; i++) {
    const opt = ARENA_OPTS[i];
    if (opt.action && inPanRect(x, y, arenaRowRect(i))) return opt.action;
  }
  return null;
}

function drawGrid(ctx: CanvasRenderingContext2D, locker: boolean, hoverAction: MenuAction | null): void {
  const { items, soon } = panelItems(locker);
  for (const it of items) drawTile(ctx, it, hoverAction, locker);
  if (soon) drawSoonTile(ctx, soon);
}

function gridHit(x: number, y: number, locker: boolean): MenuAction | null {
  for (const it of panelItems(locker).items) {
    // A previewed STORE tile's BUY strip claims its own action (earned-only
    // tiles never grow one — nothing to buy).
    if (!locker && tilePreviewed(it) && !(it.skin as PlatformSkin).earnedBy && inPanRect(x, y, buyRect(it.rect))) {
      return `shop-buy-${it.kind === 'avatar' ? 'av' : it.kind === 'gear' ? 'gr' : 'pf'}-${it.index}` as MenuAction;
    }
    if (inPanRect(x, y, it.rect)) return it.action;
  }
  return null;
}

/** The header pair: LOCKER | STORE drawn on the title line, active face lit. */
function drawHeaderTabs(ctx: CanvasRenderingContext2D, active: 0 | 1, hoverAction: MenuAction | null): void {
  HEAD_TABS.forEach((t, i) => {
    const x = HEAD_TAB.x0 + i * (HEAD_TAB.w + HEAD_TAB.gap);
    const hot = hoverAction === t.action && i !== active;
    plate(ctx, x, HEAD_TAB.y, HEAD_TAB.w, HEAD_TAB.h, {
      cut: 10,
      fill: i === active ? 'rgba(255,176,0,0.16)' : hot ? 'rgba(20,22,30,0.9)' : 'rgba(10,11,15,0.6)',
      stroke: i === active ? UI.amber : hot ? UI.steel : UI.steelDim,
      rivets: false,
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = stencilFont(24);
    ctx.fillStyle = i === active ? UI.amber : hot ? UI.text : UI.textDim;
    ctx.fillText(t.label, x + HEAD_TAB.w / 2, HEAD_TAB.y + HEAD_TAB.h / 2 + 2);
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
}

function hitHeaderTabs(x: number, y: number): MenuAction | null {
  if (y < HEAD_TAB.y || y > HEAD_TAB.y + HEAD_TAB.h) return null;
  for (let i = 0; i < HEAD_TABS.length; i++) {
    const tx = HEAD_TAB.x0 + i * (HEAD_TAB.w + HEAD_TAB.gap);
    if (x >= tx && x <= tx + HEAD_TAB.w) return HEAD_TABS[i].action;
  }
  return null;
}

/** STORE — everything you don't own, with prices. Tabs: AVATARS / PLATFORMS. */
function drawShop(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  panelBg(ctx, false, UI.amber, '', PAN_W, PAN_H);
  drawHeaderTabs(ctx, 1, hoverAction);
  drawCoinSymbol(ctx, PAN_W - 150, 22, 32, 32);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillStyle = UI.amber;
  ctx.fillText(String(coins.balance), PAN_W - 110, 39);

  const tab = activeTab(false);
  drawTabs(ctx, [
    { label: 'PLATFORMS', action: 'tab-platforms', active: tab === 'platforms' },
    { label: 'GEAR', action: 'tab-gear', active: tab === 'gear' },
  ], hoverAction);
  drawGrid(ctx, false, hoverAction);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  buttonPlate(ctx, FOOT_CLOSE.x, FOOT_CLOSE.y, FOOT_CLOSE.w, FOOT_CLOSE.h, 'CLOSE', UI.amber, hoverAction === 'custom-close');
}

function hitShop(u: number, v: number): MenuAction | null {
  const x = u * PAN_W;
  const y = (1 - v) * PAN_H;
  const head = hitHeaderTabs(x, y);
  if (head) return head;
  if (inPanRect(x, y, FOOT_CLOSE)) return 'custom-close';
  const t = tabHit(x, y, 2);
  if (t !== null) return t === 0 ? 'tab-platforms' : 'tab-gear';
  return gridHit(x, y, false);
}

/** LOCKER — your inventory: equip owned skins, plus the COLOUR sliders. */
function drawLocker(ctx: CanvasRenderingContext2D, hoverAction: MenuAction | null): void {
  panelBg(ctx, false, UI.emberBright, '', PAN_W, PAN_H);
  drawHeaderTabs(ctx, 0, hoverAction);
  const tab = activeTab(true);
  drawTabs(ctx, [
    { label: 'PLATFORMS', action: 'tab-platforms', active: tab === 'platforms' },
    { label: 'GEAR', action: 'tab-gear', active: tab === 'gear' },
    { label: 'COLOUR', action: 'tab-colour', active: tab === 'colour' },
    { label: 'ARENA', action: 'tab-arena', active: tab === 'arena' },
  ], hoverAction);
  if (tab === 'colour') drawColourTab(ctx, hoverAction);
  else if (tab === 'arena') drawArenaTab(ctx, hoverAction);
  else drawGrid(ctx, true, hoverAction);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  buttonPlate(ctx, FOOT_CLOSE.x, FOOT_CLOSE.y, FOOT_CLOSE.w, FOOT_CLOSE.h, 'CLOSE', UI.amber, hoverAction === 'custom-close');
}

function hitLocker(u: number, v: number): MenuAction | null {
  const x = u * PAN_W;
  const y = (1 - v) * PAN_H;
  const head = hitHeaderTabs(x, y);
  if (head) return head;
  if (inPanRect(x, y, FOOT_CLOSE)) return 'custom-close';
  const t = tabHit(x, y, 4);
  if (t !== null) return t === 0 ? 'tab-platforms' : t === 1 ? 'tab-gear' : t === 2 ? 'tab-colour' : 'tab-arena';
  const tab = activeTab(true);
  if (tab === 'colour') {
    // FF2: the armour dye is gone; the body offers exactly one choice —
    // the base tone — and then the gauntlet neon. Paint does the rest.
    if (inPanRect(x, y, BASE_WHITE)) return 'base-white';
    if (inPanRect(x, y, BASE_BLACK)) return 'base-black';
    if (inPanRect(x, y, ACCENT_DEF)) return 'accent-default';
    if (inPanRect(x, y, ACCENT_BAR)) return 'accent-color';
    if (inPanRect(x, y, ACCENT_LIGHT_BAR)) return 'accent-light';
    return null;
  }
  if (tab === 'arena') return hitArenaTab(x, y);
  return gridHit(x, y, true);
}

export function createMenu(scene: Scene): Menu {
  const group = new Group();
  group.name = 'lobby-menu';

  const train = makePanel('train', 0.86, 0.86 * (TRAIN_H / PW), drawTrain, hitTrain, { ch: TRAIN_H });
  const duel = makePanel('duel', 0.78, 0.62 * (DUEL_H / PH), drawDuel, hitDuel, { ch: DUEL_H });
  const info = makePanel('info', 0.78, 0.62, drawInfo, hitInfo);
  // The LOCKER (your inventory + colour sliders) reuses the 'custom' id/slot.
  const custom = makePanel('custom', 0.9, 0.9 * (PAN_H / PAN_W), drawLocker, hitLocker, { cw: PAN_W, ch: PAN_H });
  const balls = makePanel('balls', 0.84, 0.72, drawBalls, () => null, {
    cw: BALL_W,
    ch: BALL_H,
    click: clickBalls,
  });
  // The ARCADE campaign line-up (the titan gauntlet) — modal over the lobby.
  const campaign = makePanel('campaign', 1.5, 1.5 * (CAMP_H / CAMP_W), drawCampaign, hitCampaign, {
    cw: CAMP_W,
    ch: CAMP_H,
  });
  // The arcade LOBBY (browser / squad room, for 2v2 / ffa / raid) — same modal
  // slot as the campaign.
  const lobby = makePanel('lobby', 1.05, 1.05 * (RAID_H / RAID_W), drawRaid, hitRaid, {
    cw: RAID_W,
    ch: RAID_H,
  });
  const shop = makePanel('shop', 0.9, 0.9 * (PAN_H / PAN_W), drawShop, hitShop, { cw: PAN_W, ch: PAN_H });

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
  // Customisation: hidden until opened; sits right of centre so the avatar
  // mirror has room to stand beside it (MenuSystem owns the mirror).
  // Shorter plate now (CLOSE moved off it): nudge up so its TOP edge — where
  // the chips sit — stays put while the cropped bottom rises.
  custom.mesh.position.set(0.5, 1.53, -1.1);
  custom.mesh.rotation.y = -0.3;
  custom.mesh.visible = false;
  // BALL LOADOUT lives out on the RIGHT, wrapped toward you alongside the other
  // controls — the whole LEFT is left clear for the avatar mirror, so while
  // changing your skin you can still see it (it used to sit in front of it).
  // Nudged further right + forward so the LOCKER plate's edge no longer
  // clips it.
  balls.mesh.position.set(1.32, 1.18, -0.66);
  balls.mesh.rotation.y = -0.6;
  balls.mesh.visible = false;
  // The platform shop opens where the customise plate sits (it replaces it).
  shop.mesh.position.set(0.5, 1.5, -1.1);
  shop.mesh.rotation.y = -0.3;
  shop.mesh.visible = false;
  // The titan line-up opens dead centre too — same modal slot as the paper.
  campaign.mesh.position.set(0, 1.5, -1.2);
  campaign.mesh.visible = false;
  // The arcade lobby shares the centre modal slot.
  lobby.mesh.position.set(0, 1.5, -1.18);
  lobby.mesh.visible = false;

  const panels = [train, duel, info, custom, balls, shop, campaign, lobby];
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
