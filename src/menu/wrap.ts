/**
 * THE WRAP — FIRE FIGHT 2's wrap-around three-panel lobby, built on the
 * panel kit ported from RAVE RAID (src/ui/kit/).
 *
 * SIMPLIFIED (the few-doors law): the lobby never presents everything at
 * once. The CENTER slab is the whole menu — a root of THREE doors:
 *
 *   FIGHT  → quick · ranked · private · 2v2 · ffa   (the battle flows)
 *   ARCADE → tutorial · campaign · raid · aim
 *   CLUB   → the social scene (region pick rides the same slab)
 *
 * Everything else is a SUB-OPTION behind its door, reached by drilling in
 * and left by BACK. The old top-level breakers are demoted to where they
 * matter: ONLY BOTS lives inside FIGHT, SHOOT BACK inside ARCADE. The
 * LEFT wing is THE TOWN — a quiet live-status board with no buttons at
 * all; the RIGHT wing stays YOU (name · body · shop · wallet).
 *
 * HOW IT PLUGS IN: each wrap panel implements FF1's `MenuPanel` contract
 * and replaces the legacy 'train' / 'duel' / 'info' plates in place. The
 * adapters use MenuPanel's optional `click()` so the wrap can own its
 * LOCAL sub-navigation (`wrap:*` ids) while global ids — real MenuAction
 * strings — go through MenuSystem.run via the dispatcher installWrap is
 * handed. Every existing mechanism (modal visibility, the pre-tutorial
 * clank gate, hover repaints, the freshness tick) drives it untouched;
 * MenuSystem's post-click redrawAll repaints whichever face state a click
 * moved to, so the battle flows render fine on the center slab even
 * though their old id-targeted repaints pointed at the left wing.
 */

import type { Menu, MenuAction, MenuPanel, PanelId } from './menu.js';
import { Panel, KIT, type PanelButton } from '../ui/kit/panel.js';
import { font } from '../ui/kit/fonts.js';
import { app } from './appState.js';
import { coins } from './wallet.js';
import { tierForXp } from './progression.js';
import { myStats } from '../net/leaderboard.js';
import { PUB_REGIONS } from '../pub/config.js';

/** One face of a wrap panel: everything Panel.paint needs. */
interface Face {
  title: string;
  body?: (g: CanvasRenderingContext2D) => void;
  buttons: PanelButton[];
}

/** A kit panel wearing FF1's MenuPanel contract. `onClick` receives every
 *  pressed button id (local `wrap:*` or a real MenuAction) — defining
 *  MenuPanel.click keeps MenuSystem's pre-tutorial gate in front of us
 *  while letting the wrap route ids itself. */
class WrapPanel implements MenuPanel {
  readonly kit: Panel;
  readonly mesh;
  click?: (u: number, v: number) => boolean;

  constructor(
    readonly id: PanelId,
    wM: number,
    hM: number,
    pxW: number,
    pxH: number,
    private face: () => Face,
    onClick?: (id: string) => void,
  ) {
    this.kit = new Panel(wM, hM, pxW, pxH);
    this.mesh = this.kit.mesh;
    this.mesh.name = `menu-panel:${id}`;
    if (onClick) {
      this.click = (u: number, v: number): boolean => {
        const id = this.kit.buttonAt(u, v);
        if (!id) return false;
        this.kit.press(id);
        onClick(id);
        return true; // MenuSystem clicks the relay + redraws all panels
      };
    }
  }

  redraw(hoverAction: MenuAction | null): void {
    const f = this.face();
    this.kit.paint(f.title, f.body ?? (() => {}), f.buttons, hoverAction);
  }

  hitTest(u: number, v: number): MenuAction | null {
    return this.kit.buttonAt(u, v) as MenuAction | null;
  }

  tick(delta: number, pulse: number): void {
    this.kit.tick(delta, pulse);
  }
}

/* ── shared bits ──────────────────────────────────────────────────────── */

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

/* ── CENTER — the whole menu, three doors deep ────────────────────────── */

const CW = 1536; // canvas
const M = 96; // margin
const WIDE = CW - M * 2; // 1344
const COL = 656; // half column
const C2 = M + COL + 32; // right column x

/** Which door the center slab is inside (wrap-local, not app state). */
const center = { view: 'root' as 'root' | 'fight' | 'arcade' };

const BACK: PanelButton = { id: 'wrap:back', label: 'BACK', x: M, y: 888, w: 320, h: 84, small: true };

function rootFace(): Face {
  if (sealed()) {
    return {
      title: 'FIRE FIGHT 2',
      body: note('the tutorial unseals the town', 900, CW),
      buttons: [
        {
          id: 'start-tutorial',
          label: 'TUTORIAL',
          sub: 'the guided basics — start here',
          x: M, y: 190, w: WIDE, h: 240,
          primary: true,
        },
        { id: 'wrap:fight', label: 'FIGHT', sub: SEAL_SUB, x: M, y: 480, w: COL, h: 190, disabled: true },
        { id: 'open-pub', label: 'THE CLUB', sub: SEAL_SUB, x: C2, y: 480, w: COL, h: 190, disabled: true },
      ],
    };
  }
  return {
    title: 'FIRE FIGHT 2',
    body: note('three doors — everything else lives inside', 920, CW),
    buttons: [
      {
        id: 'wrap:fight',
        label: 'FIGHT',
        sub: app.searching > 0 ? `${app.searching} searching right now` : 'quick · ranked · private · brawls',
        x: M, y: 180, w: COL, h: 280,
        primary: true,
      },
      {
        id: 'wrap:arcade',
        label: 'ARCADE',
        sub: 'tutorial · campaign · raid · aim',
        x: C2, y: 180, w: COL, h: 280,
      },
      {
        id: 'open-pub',
        label: 'THE CLUB',
        sub: app.pubCount > 0 ? `${app.pubCount} inside right now` : 'the social scene',
        x: M, y: 520, w: WIDE, h: 190,
        tone: app.pubCount > 0 ? KIT.positive : undefined,
      },
    ],
  };
}

function fightRoot(): Face {
  const queueing = app.state === 'queueing';
  const buttons: PanelButton[] = [
    queueing
      ? {
          id: 'cancel-queue',
          label: 'CANCEL SEARCH',
          sub: app.searching > 0 ? `${app.searching} in the queue` : 'searching…',
          x: M, y: 160, w: COL, h: 200,
          tone: KIT.danger,
        }
      : {
          id: 'quick-match',
          label: 'QUICK MATCH',
          sub: app.searching > 0 ? `${app.searching} searching now` : 'best of three · drop in',
          x: M, y: 160, w: COL, h: 200,
          primary: true,
        },
    {
      id: 'ranked-match',
      label: 'RANKED',
      sub: app.onlyBots ? 'off while ONLY BOTS is on' : 'best of five · the ladder',
      x: M, y: 390, w: COL, h: 150,
      disabled: app.onlyBots || queueing,
    },
    {
      id: 'private-open',
      label: 'PRIVATE MATCH',
      sub: 'a five-digit code for your lot',
      x: M, y: 570, w: COL, h: 150,
      disabled: queueing,
    },
    { id: 'arcade-2v2', label: '2V2', sub: 'tag brawl', x: C2, y: 160, w: COL, h: 170, disabled: queueing },
    { id: 'arcade-ffa', label: 'FFA', sub: 'last one up', x: C2, y: 360, w: COL, h: 170, disabled: queueing },
    {
      id: 'toggle-onlybots',
      label: 'ONLY BOTS',
      sub: 'never queue online',
      x: C2, y: 590, w: COL, h: 110,
      small: true,
      selected: app.onlyBots,
    },
    BACK,
  ];
  return {
    title: 'FIGHT',
    body: note('every finished bout banks 10 bolt-dollars', 800, CW),
    buttons,
  };
}

function privateFace(): Face {
  const modes = [
    { id: 'private-mode-1v1' as MenuAction, label: '1V1', mode: '1v1', seats: '2 seats' },
    { id: 'private-mode-2v2' as MenuAction, label: '2V2', mode: '2v2', seats: '4 seats' },
    { id: 'private-mode-ffa' as MenuAction, label: 'FFA', mode: 'ffa', seats: '4 seats' },
  ];
  const buttons: PanelButton[] = modes.map((m, i) => ({
    id: m.id,
    label: m.label,
    sub: m.seats,
    x: C2 + (i % 2) * (COL / 2 + 16), y: 170 + Math.floor(i / 2) * 150, w: COL / 2 - 16, h: 130,
    small: true,
    selected: app.privateMode === m.mode,
  }));
  buttons.push(
    {
      id: 'private-create',
      label: 'CREATE CODE',
      sub: 'reserve a room of that shape',
      x: M, y: 170, w: COL, h: 190,
      primary: true,
    },
    {
      id: 'private-enter',
      label: 'ENTER A CODE',
      sub: 'join whatever your mate opened',
      x: M, y: 400, w: COL, h: 150,
    },
    { ...BACK, id: 'private-back' },
  );
  return {
    title: 'PRIVATE',
    body: note('pick a format on the right, then create or enter', 800, CW),
    buttons,
  };
}

function keypadFace(): Face {
  const draft = app.codeEntry.padEnd(5, '·').split('').join(' ');
  const buttons: PanelButton[] = [
    { id: 'code-draft', label: draft, sub: 'the code', x: M, y: 200, w: COL, h: 170, display: true, px: 72 },
    {
      id: 'kp-join',
      label: 'JOIN',
      x: M, y: 430, w: COL, h: 170,
      primary: app.codeEntry.length === 5,
      disabled: app.codeEntry.length < 5,
    },
    { ...BACK, id: 'private-back' },
  ];
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', ''];
  const kw = 200;
  const kh = 130;
  keys.forEach((k, i) => {
    if (!k) return;
    const id = k === '⌫' ? 'kp-del' : `kp-${k}`;
    buttons.push({
      id: id as MenuAction,
      label: k,
      x: C2 + (i % 3) * (kw + 24), y: 160 + Math.floor(i / 3) * (kh + 20), w: kw, h: kh,
      px: 44,
      disabled: k === '⌫' && app.codeEntry.length === 0,
    });
  });
  return { title: 'ENTER CODE', buttons };
}

function hostingFace(): Face {
  return {
    title: 'PRIVATE',
    body: note('the room launches itself once the seats fill', 700, CW),
    buttons: [
      {
        id: 'code-live',
        label: app.privateCode ? app.privateCode.split('').join(' ') : 'RESERVING…',
        sub: 'your code — shout it, ping it, text it',
        x: M + 240, y: 240, w: WIDE - 480, h: 240,
        display: true,
        px: 110,
        tone: KIT.accent,
      },
      { ...BACK, id: 'private-back', label: 'CANCEL', tone: KIT.danger },
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
    x: M, y: 160 + i * 136, w: 800, h: 118,
    small: true,
    disabled: r.id === app.rankedRoomId || hostingOwn,
    selected: r.id === app.rankedRoomId,
  }));
  buttons.push(
    hostingOwn || app.rankedHost
      ? { id: 'ranked-cancel', label: 'STAND DOWN', sub: 'close your room', x: 968, y: 160, w: 472, h: 170, tone: KIT.danger }
      : { id: 'ranked-host', label: 'HOST A ROOM', sub: 'your name on the board', x: 968, y: 160, w: 472, h: 170, primary: true },
    { ...BACK, id: 'ranked-back' },
  );
  return {
    title: 'RANKED',
    body: rows.length === 0 ? note('no open rooms — put your name up', 500, CW) : undefined,
    buttons,
  };
}

function arcadeFace(): Face {
  const buttons: PanelButton[] = [
    { id: 'start-tutorial', label: 'TUTORIAL', sub: 'the guided basics', x: M, y: 160, w: COL, h: 200 },
    { id: 'open-campaign', label: 'CAMPAIGN', sub: 'five titans, left to right', x: C2, y: 160, w: COL, h: 200 },
    {
      id: 'open-raid',
      label: 'RAID',
      sub: app.raidsOpen > 0 ? `${app.raidsOpen} squad${app.raidsOpen === 1 ? '' : 's'} forming now` : 'four boxers, one gauntlet',
      x: M, y: 390, w: COL, h: 200,
      tone: app.raidsOpen > 0 ? KIT.positive : undefined,
    },
    { id: 'start-training', label: 'AIM TRAINING', sub: 'the heart of the game', x: C2, y: 390, w: COL, h: 200 },
    {
      id: 'toggle-shootback',
      label: 'SHOOT BACK',
      sub: 'aim-training targets return fire',
      x: C2, y: 630, w: COL, h: 110,
      small: true,
      selected: app.shootBack,
    },
    BACK,
  ];
  return {
    title: 'ARCADE',
    body: note('every finished run pays the same flat coins', 800, CW),
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
      x: M, y: 200 + i * 200, w: WIDE, h: 170,
    };
  });
  buttons.push({ ...BACK, id: 'pub-back' });
  return {
    title: 'PICK A DOOR',
    body: note('same club, different corner of the map', 720, CW),
    buttons,
  };
}

function centerFace(): Face {
  // The club's region picker takes the slab over, whatever door was open.
  if (app.infoView === 'pubpick') return pubPickFace();
  if (center.view === 'fight') {
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
        return fightRoot();
    }
  }
  if (center.view === 'arcade') return arcadeFace();
  return rootFace();
}

/* ── LEFT WING — THE TOWN (a status board; no buttons at all) ─────────── */

const LW = 832;

function townFace(): Face {
  const n = (v: number): string => (v >= 0 ? String(v) : '—');
  const chip = (id: string, label: string, sub: string, y: number, tone?: string): PanelButton => ({
    id, label, sub, x: 96, y, w: LW - 192, h: 150, display: true, px: 64, tone,
  });
  return {
    title: 'THE TOWN',
    body: note('the leaderboard hangs behind you', 940, LW),
    buttons: [
      chip('town-queue', n(app.searching), 'searching for a fight', 200, app.searching > 0 ? KIT.positive : undefined),
      chip('town-raids', n(app.raidsOpen), 'raid squads forming', 400, app.raidsOpen > 0 ? KIT.positive : undefined),
      chip('town-club', n(app.pubCount), 'in the club tonight', 600, app.pubCount > 0 ? KIT.accent : undefined),
    ],
  };
}

/* ── RIGHT WING — YOU ─────────────────────────────────────────────────── */

function youFace(): Face {
  const lock = sealed();
  const stats = myStats();
  const tier = tierForXp(stats.xp);
  const X = 96;
  const W = LW - 192;
  return {
    title: 'YOU',
    body: note("that's you on the podium — everyone sees this body", 940, LW),
    buttons: [
      { id: 'you-name', label: stats.name, sub: `${tier.name} · ${stats.xp} XP`, x: X, y: 150, w: W, h: 120, display: true, px: 52 },
      {
        id: 'open-custom',
        label: 'YOUR BLANK',
        sub: lock ? SEAL_SUB : 'base tone · gauntlet neon · pads · arena',
        x: X, y: 310, w: W, h: 130,
        primary: !lock,
        disabled: lock,
      },
      {
        id: 'open-shop',
        label: 'SHOP',
        sub: lock ? SEAL_SUB : 'attachments and pads — spend your bolt-dollars',
        x: X, y: 470, w: W, h: 110,
        disabled: lock,
      },
      { id: 'you-coins', label: `$ ${coins.balance}`, sub: 'bolt-dollars', x: X, y: 620, w: (W - 32) / 2, h: 100, display: true, small: true, tone: KIT.accent },
      { id: 'you-record', label: `${app.stats.wins}W — ${app.stats.losses}L`, sub: 'lifetime', x: X + (W + 32) / 2, y: 620, w: (W - 32) / 2, h: 100, display: true, small: true },
      { id: 'rename', label: 'RENAME', x: X, y: 780, w: W, h: 84, small: true, disabled: lock },
    ],
  };
}

/* ── the rig ──────────────────────────────────────────────────────────── */

export interface Wrap {
  /** Advance kit transitions (hover eases, press flashes, halo breath). */
  tick(delta: number): void;
}

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
 * place — same ids, same slots, same parent group. Call once, right after
 * `createMenu`. `act` is MenuSystem.run — global ids go through it; the
 * wrap's own `wrap:*` door navigation is handled here.
 */
export function installWrap(menu: Menu, act?: (action: MenuAction) => void): Wrap {
  /** Route one pressed id: local door-nav, or the real dispatcher. */
  const dispatch = (id: string): void => {
    if (id === 'wrap:fight') {
      center.view = 'fight';
      return;
    }
    if (id === 'wrap:arcade') {
      center.view = 'arcade';
      return;
    }
    if (id === 'wrap:back') {
      center.view = 'root';
      return;
    }
    act?.(id as MenuAction);
  };

  const slab = new WrapPanel('train', 1.42, 0.95, CW, 1024, centerFace, dispatch);
  const town = new WrapPanel('duel', 0.74, 0.91, LW, 1024, townFace, dispatch);
  const you = new WrapPanel('info', 0.74, 0.91, LW, 1024, youFace, dispatch);

  const y = 1.45;
  slab.mesh.position.set(0, y, -1.26);
  town.mesh.position.set(-1.02, y, -1.02);
  town.mesh.rotation.y = 0.58;
  you.mesh.position.set(1.02, y, -1.02);
  you.mesh.rotation.y = -0.58;

  const panels = [slab, town, you];
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
        dispatch(action);
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
      const pulse = 0.5 + 0.5 * Math.sin((clock * 2 * Math.PI) / 6);
      for (const p of panels) p.tick(delta, pulse);
    },
  };
}
