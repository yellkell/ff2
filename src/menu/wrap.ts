/**
 * THE WRAP — FIRE FIGHT 2's wrap-around three-panel lobby, built on the
 * panel kit ported from RAVE RAID (src/ui/kit/). Three kit panels stand on
 * a shallow arc around your spawn: BATTLE on the left wing, ARCADE dead
 * ahead, and the house panel (club · locker · you) on the right wing, both
 * wings yawed in so the menu wraps around you instead of standing in a row.
 *
 * HOW IT PLUGS IN (deliberately boring): each wrap panel implements FF1's
 * `MenuPanel` contract and REPLACES the legacy 'train' / 'duel' / 'info'
 * plates inside `menu.panels`, keeping their ids. Every existing MenuSystem
 * mechanism — visibility per modal, the pre-tutorial gate, hover repaints,
 * the freshness tick, `run(action)` — keeps working untouched, because the
 * button ids painted here ARE the existing `MenuAction` strings. The old
 * canvas-drawing code in menu.ts still exists but its three plates never
 * reach the scene; screens retire from it one wrap face at a time.
 *
 * Faces mirror the legacy panels' state machines exactly: the BATTLE wing
 * renders `app.duelView` (root / private / keypad / hosting / browser) and
 * the house wing renders `app.infoView` (root / pubpick), so every
 * mid-flow repaint MenuSystem fires by id lands on the right face.
 */

import type { Menu, MenuAction, MenuPanel, PanelId } from './menu.js';
import { Panel, KIT, type PanelButton } from '../ui/kit/panel.js';
import { font } from '../ui/kit/fonts.js';
import { app } from './appState.js';
import { coins } from './wallet.js';
import { tierForXp } from './progression.js';
import { myStats } from '../net/leaderboard.js';
import { GAME_TITLE } from '../config.js';
import { PUB_REGIONS } from '../pub/config.js';

/** One face of a wrap panel: everything Panel.paint needs. */
interface Face {
  title: string;
  body?: (g: CanvasRenderingContext2D) => void;
  buttons: PanelButton[];
}

/** A kit panel wearing FF1's MenuPanel contract. */
class WrapPanel implements MenuPanel {
  readonly kit: Panel;
  readonly mesh;

  constructor(
    readonly id: PanelId,
    wM: number,
    hM: number,
    pxW: number,
    pxH: number,
    private face: () => Face,
  ) {
    this.kit = new Panel(wM, hM, pxW, pxH);
    this.mesh = this.kit.mesh;
    this.mesh.name = `menu-panel:${id}`;
  }

  redraw(hoverAction: MenuAction | null): void {
    const f = this.face();
    this.kit.paint(f.title, f.body ?? (() => {}), f.buttons, hoverAction);
  }

  hitTest(u: number, v: number): MenuAction | null {
    return this.kit.buttonAt(u, v) as MenuAction | null;
  }

  /** Press feedback — MenuSystem calls this beside run(action). */
  flash(id: string): void {
    this.kit.press(id);
  }

  tick(delta: number, pulse: number): void {
    // A transition repaint inside the kit re-runs the LAST paint args; keep
    // them fresh by repainting from live state only while animating is
    // plausible — the kit itself no-ops when nothing moves, and full
    // repaints stay on MenuSystem's hover/freshness paths.
    this.kit.tick(delta, pulse);
  }
}

/* ── shared face bits ─────────────────────────────────────────────────── */

/** Pre-tutorial the lobby is sealed: everything but the tutorial reads as
 *  bolted shut, matching MenuSystem's clank gate. */
const sealed = (): boolean => !app.tutorialDone;
const SEAL_SUB = 'sealed — run the tutorial';

function note(text: string, y: number, W: number): (g: CanvasRenderingContext2D) => void {
  return (g) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font(500, 24);
    g.fillStyle = KIT.faint;
    g.fillText(text, W / 2, y);
  };
}

/* ── CENTER — ARCADE ──────────────────────────────────────────────────── */

const CX = 132;
const CW = 760;

function arcadeFace(): Face {
  const lock = sealed();
  const buttons: PanelButton[] = [
    {
      id: 'start-tutorial',
      label: 'TUTORIAL',
      sub: 'the guided basics',
      x: CX, y: 150, w: CW, h: 110,
      primary: lock, // pre-tutorial it IS the call to action
    },
    {
      id: 'open-campaign',
      label: 'CAMPAIGN',
      sub: lock ? SEAL_SUB : 'five titans, left to right',
      x: CX, y: 286, w: CW, h: 110,
      disabled: lock,
    },
    {
      id: 'open-raid',
      label: 'RAID',
      sub: lock ? SEAL_SUB : app.raidsOpen > 0 ? `${app.raidsOpen} squad${app.raidsOpen === 1 ? '' : 's'} forming now` : 'four boxers, one gauntlet',
      x: CX, y: 422, w: CW, h: 110,
      disabled: lock,
      tone: app.raidsOpen > 0 ? KIT.positive : undefined,
    },
    {
      id: 'start-training',
      label: 'AIM TRAINING',
      sub: lock ? SEAL_SUB : 'the heart of the game',
      x: CX, y: 558, w: CW, h: 110,
      disabled: lock,
    },
    {
      id: 'toggle-shootback',
      label: 'SHOOT BACK',
      sub: 'targets return fire',
      x: CX, y: 726, w: 368, h: 92,
      small: true,
      selected: app.shootBack,
      disabled: lock,
    },
    {
      id: 'toggle-onlybots',
      label: 'ONLY BOTS',
      sub: 'never queue online',
      x: CX + 392, y: 726, w: 368, h: 92,
      small: true,
      selected: app.onlyBots,
      disabled: lock,
    },
  ];
  return {
    title: 'ARCADE',
    body: note(lock ? 'the tutorial unseals the whole lobby' : 'every finished run pays the same flat coins', 950, 1024),
    buttons,
  };
}

/* ── LEFT WING — BATTLE (renders app.duelView) ────────────────────────── */

const LW = 832; // canvas width
const LX = 96;
const LWIDE = LW - LX * 2;

function battleFace(): Face {
  switch (app.duelView) {
    case 'private':
      return privateFace();
    case 'keypad':
      return keypadFace();
    case 'hosting':
      return hostingFace();
    case 'browser':
      return browserFace();
    default:
      return battleRoot();
  }
}

function battleRoot(): Face {
  const lock = sealed();
  const queueing = app.state === 'queueing';
  const buttons: PanelButton[] = [
    queueing
      ? {
          id: 'cancel-queue',
          label: 'CANCEL SEARCH',
          sub: app.searching > 0 ? `${app.searching} in the queue` : 'searching…',
          x: LX, y: 156, w: LWIDE, h: 132,
          tone: KIT.danger,
        }
      : {
          id: 'quick-match',
          label: 'QUICK MATCH',
          sub: lock ? SEAL_SUB : app.searching > 0 ? `${app.searching} searching now` : 'best of three · drop in',
          x: LX, y: 156, w: LWIDE, h: 132,
          primary: !lock,
          disabled: lock,
        },
    {
      id: 'ranked-match',
      label: 'RANKED',
      sub: lock ? SEAL_SUB : app.onlyBots ? 'off while ONLY BOTS is on' : 'best of five · the ladder',
      x: LX, y: 324, w: LWIDE, h: 116,
      disabled: lock || app.onlyBots || queueing,
    },
    {
      id: 'private-open',
      label: 'PRIVATE MATCH',
      sub: lock ? SEAL_SUB : 'a five-digit code for your lot',
      x: LX, y: 464, w: LWIDE, h: 116,
      disabled: lock || queueing,
    },
    {
      id: 'arcade-2v2',
      label: '2V2',
      sub: 'tag brawl',
      x: LX, y: 640, w: 304, h: 124,
      disabled: lock || queueing,
    },
    {
      id: 'arcade-ffa',
      label: 'FFA',
      sub: 'last one up',
      x: LX + 336, y: 640, w: 304, h: 124,
      disabled: lock || queueing,
    },
  ];
  // The connection line only earns its place while something is happening —
  // an idle lobby's "not connected" reads as a fault, not a fact.
  const status = queueing ? app.netStatus : '';
  return {
    title: 'BATTLE',
    body: status ? note(status, 880, LW) : note('every finished bout banks 10 bolt-dollars', 880, LW),
    buttons,
  };
}

function privateFace(): Face {
  const modes = [
    { id: 'private-mode-1v1' as MenuAction, label: '1V1', mode: '1v1', seats: '2 seats' },
    { id: 'private-mode-2v2' as MenuAction, label: '2V2', mode: '2v2', seats: '4 seats' },
    { id: 'private-mode-ffa' as MenuAction, label: 'FFA', mode: 'ffa', seats: '4 seats' },
  ];
  const chipW = 197;
  const buttons: PanelButton[] = modes.map((m, i) => ({
    id: m.id,
    label: m.label,
    sub: m.seats,
    x: LX + i * (chipW + 24), y: 170, w: chipW, h: 96,
    small: true,
    selected: app.privateMode === m.mode,
  }));
  buttons.push(
    {
      id: 'private-create',
      label: 'CREATE CODE',
      sub: 'reserve a room of that shape',
      x: LX, y: 320, w: LWIDE, h: 110,
      primary: true,
    },
    {
      id: 'private-enter',
      label: 'ENTER A CODE',
      sub: 'join whatever your mate opened',
      x: LX, y: 460, w: LWIDE, h: 100,
    },
    { id: 'private-back', label: 'BACK', x: LX, y: 856, w: LWIDE, h: 76, small: true },
  );
  return {
    title: 'PRIVATE',
    body: note('pick a format, then create or enter a code', 620, LW),
    buttons,
  };
}

function keypadFace(): Face {
  const draft = app.codeEntry.padEnd(5, '·').split('').join(' ');
  const buttons: PanelButton[] = [
    { id: 'code-draft', label: draft, sub: 'the code', x: LX, y: 140, w: LWIDE, h: 96, display: true, px: 56 },
  ];
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const kw = 196;
  const kh = 96;
  keys.forEach((k, i) => {
    buttons.push({
      id: `kp-${k}` as MenuAction,
      label: k,
      x: LX + (i % 3) * (kw + 26), y: 268 + Math.floor(i / 3) * (kh + 20), w: kw, h: kh,
      px: 40,
    });
  });
  buttons.push(
    { id: 'kp-del', label: '⌫', x: LX, y: 616, w: kw, h: kh, px: 40, disabled: app.codeEntry.length === 0 },
    { id: 'kp-0', label: '0', x: LX + kw + 26, y: 616, w: kw, h: kh, px: 40 },
    {
      id: 'kp-join',
      label: 'JOIN',
      x: LX + (kw + 26) * 2, y: 616, w: kw, h: kh,
      primary: app.codeEntry.length === 5,
      disabled: app.codeEntry.length < 5,
    },
    { id: 'private-back', label: 'BACK', x: LX, y: 856, w: LWIDE, h: 76, small: true },
  );
  return { title: 'ENTER CODE', buttons };
}

function hostingFace(): Face {
  const code = app.privateCode || '· · · · ·';
  return {
    title: 'PRIVATE',
    body: note('the room launches itself once the seats fill', 460, LW),
    buttons: [
      {
        id: 'code-live',
        label: app.privateCode ? code.split('').join(' ') : 'RESERVING…',
        sub: 'your code — shout it, ping it, text it',
        x: LX, y: 190, w: LWIDE, h: 150,
        display: true,
        px: 72,
        tone: KIT.accent,
      },
      { id: 'private-back', label: 'CANCEL', x: LX, y: 856, w: LWIDE, h: 76, small: true, tone: KIT.danger },
    ],
  };
}

function browserFace(): Face {
  const hostingOwn = app.rankedRoomId !== '';
  const rows = app.rankedRooms.slice(0, 5);
  const buttons: PanelButton[] = rows.map((r, i) => ({
    id: `ranked-join-${r.id}` as MenuAction,
    label: r.host,
    sub: r.id === app.rankedRoomId ? 'your room — holding the door' : 'open — step in',
    x: LX, y: 168 + i * 108, w: LWIDE, h: 92,
    small: true,
    disabled: r.id === app.rankedRoomId || hostingOwn,
    selected: r.id === app.rankedRoomId,
  }));
  buttons.push(
    hostingOwn || app.rankedHost
      ? { id: 'ranked-cancel', label: 'STAND DOWN', sub: 'close your room', x: LX, y: 724, w: LWIDE, h: 100, tone: KIT.danger }
      : { id: 'ranked-host', label: 'HOST A ROOM', sub: 'your name on the board', x: LX, y: 724, w: LWIDE, h: 100, primary: true },
    { id: 'ranked-back', label: 'BACK', x: LX, y: 856, w: LWIDE, h: 76, small: true },
  );
  return {
    title: 'RANKED',
    body: rows.length === 0 ? note('no open rooms — put your name up', 400, LW) : undefined,
    buttons,
  };
}

/* ── RIGHT WING — the house (renders app.infoView) ────────────────────── */

function houseFace(): Face {
  if (app.infoView === 'pubpick') return pubPickFace();
  return houseRoot();
}

function houseRoot(): Face {
  const lock = sealed();
  const stats = myStats();
  const tier = tierForXp(stats.xp);
  const buttons: PanelButton[] = [
    {
      id: 'open-pub',
      label: 'IRON BALLS CLUB',
      sub: lock ? SEAL_SUB : app.pubCount > 0 ? `${app.pubCount} in the club right now` : 'the social scene',
      x: LX, y: 150, w: LWIDE, h: 116,
      primary: !lock,
      disabled: lock,
      tone: app.pubCount > 0 ? KIT.positive : undefined,
    },
    {
      id: 'open-custom',
      label: 'LOCKER',
      sub: lock ? SEAL_SUB : 'skins · colours · loadout',
      x: LX, y: 296, w: LWIDE, h: 100,
      disabled: lock,
    },
    {
      id: 'open-shop',
      label: 'SHOP',
      sub: lock ? SEAL_SUB : 'spend your bolt-dollars',
      x: LX, y: 416, w: LWIDE, h: 100,
      disabled: lock,
    },
    {
      id: 'you-name',
      label: stats.name,
      sub: `${tier.name} · ${stats.xp} XP`,
      x: LX, y: 576, w: LWIDE, h: 96,
      display: true,
    },
    {
      id: 'you-coins',
      label: `$ ${coins.balance}`,
      sub: 'bolt-dollars',
      x: LX, y: 692, w: 304, h: 88,
      display: true,
      small: true,
      tone: KIT.accent,
    },
    {
      id: 'you-record',
      label: `${app.stats.wins}W — ${app.stats.losses}L`,
      sub: 'lifetime',
      x: LX + 336, y: 692, w: 304, h: 88,
      display: true,
      small: true,
    },
    {
      id: 'rename',
      label: 'RENAME',
      x: LX, y: 812, w: LWIDE, h: 72,
      small: true,
      disabled: lock,
    },
  ];
  return {
    title: GAME_TITLE,
    body: note('the leaderboard hangs behind you', 940, LW),
    buttons,
  };
}

function pubPickFace(): Face {
  const buttons: PanelButton[] = PUB_REGIONS.map((region, i) => {
    const count = app.pubRegionCounts[region.id] ?? -1;
    return {
      id: `pub-go-${region.id}` as MenuAction,
      label: region.label,
      sub: count >= 0 ? `${count} inside` : 'knock and see',
      x: LX, y: 190 + i * 136, w: LWIDE, h: 112,
    };
  });
  buttons.push({ id: 'pub-back', label: 'BACK', x: LX, y: 856, w: LWIDE, h: 76, small: true });
  return {
    title: 'PICK A DOOR',
    body: note('same club, different corner of the map', 560, LW),
    buttons,
  };
}

/* ── the rig ──────────────────────────────────────────────────────────── */

export interface Wrap {
  /** Advance kit transitions (hover eases, press flashes, halo breath). */
  tick(delta: number): void;
}

/** Headless introspection, in the spirit of RAVE RAID's `__gdr`: probes ask
 *  what each wrap panel is offering, snapshot its canvas, and fire actions
 *  through the same dispatcher the trigger uses. Dev/test only by nature —
 *  it drives real state, so nothing here is reachable from painted UI. */
declare global {
  interface Window {
    __ff2?: {
      wrap: {
        buttons: (id: string) => string[];
        live: (id: string) => string[];
        snap: (id: string) => string;
        act: (action: string) => void;
        redraw: () => void;
      };
    };
  }
}

/**
 * Replace the legacy 'train' / 'duel' / 'info' plates with the wrap, in
 * place: same ids, same slots in `menu.panels`, same parent group — so
 * MenuSystem's visibility switch, gating, hover repaints and freshness
 * tick drive the new panels with no changes. Call once, right after
 * `createMenu`.
 */
export function installWrap(menu: Menu, act?: (action: MenuAction) => void): Wrap {
  const center = new WrapPanel('train', 0.94, 0.94, 1024, 1024, arcadeFace);
  const left = new WrapPanel('duel', 0.74, 0.91, LW, 1024, battleFace);
  const right = new WrapPanel('info', 0.74, 0.91, LW, 1024, houseFace);

  // The arc: centre dead ahead, wings pulled in close and yawed hard so the
  // three read as one wrapped console, not a row of signs.
  const y = 1.45;
  center.mesh.position.set(0, y, -1.28);
  left.mesh.position.set(-0.92, y, -0.94);
  left.mesh.rotation.y = 0.62;
  right.mesh.position.set(0.92, y, -0.94);
  right.mesh.rotation.y = -0.62;

  const panels = [center, left, right];
  for (const p of panels) {
    const i = menu.panels.findIndex((old) => old.id === p.id);
    if (i < 0) continue;
    const old = menu.panels[i];
    old.mesh.removeFromParent();
    menu.panels[i] = p;
    menu.group.add(p.mesh);
    p.redraw(null);
  }

  const byId = (id: string): WrapPanel | undefined => panels.find((p) => p.id === id);
  window.__ff2 = {
    wrap: {
      buttons: (id) => byId(id)?.kit.buttonIds() ?? [],
      live: (id) => byId(id)?.kit.liveButtons() ?? [],
      snap: (id) => (byId(id)?.kit.ctx().canvas as HTMLCanvasElement | undefined)?.toDataURL('image/png') ?? '',
      act: (action) => {
        act?.(action as MenuAction);
        for (const p of panels) p.redraw(null);
      },
      redraw: () => {
        for (const p of panels) p.redraw(null);
      },
    },
  };

  let clock = 0;
  return {
    tick(delta: number): void {
      clock += delta;
      // A slow furnace breath on the halos — subtle, upload-free.
      const pulse = 0.5 + 0.5 * Math.sin((clock * 2 * Math.PI) / 6);
      for (const p of panels) p.tick(delta, pulse);
    },
  };
}
