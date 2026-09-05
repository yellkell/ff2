/**
 * THE TOWN — one World, three places, and the curtain between them.
 *
 * The arena is built at boot. The rave (and the venue, which is the rave's
 * club) is mounted the first time you walk through a door to it, and then
 * kept: its systems stay registered and are paused, its objects stay in
 * the graph and are hidden. Every crossing is the same four beats — the
 * curtain falls, the outgoing place is paused and hidden, the incoming one
 * is shown and played, the curtain lifts — and the XR session, the
 * renderer, the XR origin and the controller spaces are never touched.
 *
 * WHO OWNS WHAT is decided by watching the scene graph rather than by
 * asking: everything under the shared roots (scene, level, camera, player,
 * grip and ray spaces) that IWSDK put there at boot is infrastructure and
 * is never hidden; everything the arena had built by the time the rave was
 * first mounted is the arena's; everything that appears while the rave is
 * up is the rave's. Neither experience has to register its objects, and a
 * glass in your hand (the rave attaches it to a controller space) or a
 * glove on your fist (the arena does the same) is put away and handed back
 * with the world it belongs to.
 */

import type { World } from '@iwsdk/core';
import { Color, type Fog, type FogExp2, type Object3D, type Texture } from 'three';
import { setMenuMusicActive } from '../audio/menuMusic.js';
import { myPackedLook } from '../avatar/paint.js';
import { clearFirePools } from '../fx/fire.js';
import { app, saveDifficulty } from '../menu/appState.js';
import { myPackedGear, myTone } from '../menu/customization.js';
import { net as duel } from '../net/client.js';
import { myStats } from '../net/leaderboard.js';
import { mesh } from '../net/mesh.js';
import { raveBridge } from '../rave/bridge.js';
import type { FightDeal } from '../rave/club/bell.js';
import type { RaveExperience, RavePlace } from '../rave/experience.js';
import { DesertSystem } from '../systems/DesertSystem.js';
import { Curtain } from './Curtain.js';
import { setTownNavigationHandlers } from './clubNavigation.js';

interface PausableSystem {
  play(): void;
  stop(): void;
}

interface VisualBaselines {
  scene: ReadonlySet<Object3D>;
  level: ReadonlySet<Object3D>;
  /** Children of the camera, the XR origin and the controller spaces. */
  body: ReadonlySet<Object3D>;
}

type Background = Color | Texture | null;

interface ArenaRenderState {
  background: Background;
  environment: Texture | null;
  environmentIntensity: number;
  fog: Fog | FogExp2 | null;
  clearColor: Color;
  clearAlpha: number;
}

export type TownPlace = 'arena' | 'venue' | 'rave';

/** How long the black holds while a place is swapped (seconds each way). */
const FALL = 0.42;
const LIFT = 0.55;

/** How often the held door looks at the floor (ms). */
const FLOOR_LOOK_MS = 200;
/** Under the black, how many looks the floor gets to be open before the
 *  curtain lifts regardless. The door was held for the floor BEFORE the
 *  curtain fell, so this is insurance against a socket dropping in the
 *  gap, not the wait itself. */
const FLOOR_SETTLE_TICKS = 25;

type FloorNet = typeof import('../rave/net/session.js');

const sleep = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

/** What the CLUB tab reads out while the door is held. */
function floorStatus(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 2) return 'knocking on the door…';
  if (s < 8) return 'the house is waking up…';
  return `waking the house — a cold host takes up to a minute · ${s}s`;
}

function nextRenderFrame(world: World): Promise<void> {
  return new Promise((resolve) => {
    const session = world.session;
    if (session) session.requestAnimationFrame(() => resolve());
    else window.requestAnimationFrame(() => resolve());
  });
}

/** The live state, for the probe: where we are and whether we're between,
 *  and the doors themselves so a headless walk can open them. Published as
 *  its own window (`__town`) because the wrap rebuilds `__ff2` wholesale
 *  every lobby and would wipe it. */
export const townView: {
  place: TownPlace;
  busy: boolean;
  enterVenue?: () => Promise<void>;
  enterRave?: () => Promise<void>;
  leave?: () => Promise<void>;
  /** THE BELL's live deal, and where the arena put me for it. */
  bell?: () => { deal: FightDeal | null; state: string; lobbyMode: string | null; privateCode: string };
  /** The fight is over (or the probe says so): everyone home to the floor. */
  foldHome?: () => Promise<void>;
} = { place: 'arena', busy: false };

/* ── THE BELL: fights called from the club floor (DESIGN §3.1) ─────────── */

/** Headless probes and offline dev serves have no signalling: with this
 *  flag set, the arena hands the ball a PAPER room — a code that names no
 *  room — so the relay's deal and the crossing can be walked without
 *  Firestore. Never set on a real deploy. */
const paperRooms = (): boolean => {
  try {
    return localStorage.getItem('ff-paper-rooms') === '1';
  } catch {
    return false;
  }
};

/** How long the arena gets to open (or join) a room for the ball. */
const ROOM_OPEN_MS = 8000;
/** The host's grace for a dealt squad to claim its seats before the
 *  lobby launches with whoever made it (the rest of the seats fill with
 *  bots, as a short-handed lobby always has). */
const SEAT_GRACE_MS = 20_000;
/** How often the home watch looks. */
const HOME_WATCH_MS = 500;
/** A deal whose fight never starts (a room that failed to form) folds
 *  home after this long rather than stranding a squad in a lobby. */
const NEVER_PLAYED_MS = 60_000;

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(what)), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        window.clearTimeout(t);
        reject(e instanceof Error ? e : new Error(what));
      },
    );
  });
}


export function installTownExperienceManager(
  world: World,
  arenaSystems: PausableSystem[],
  baselines: VisualBaselines,
): void {
  const curtain = new Curtain(world.camera);
  const frame = (): Promise<void> => nextRenderFrame(world);

  /* ── ownership ──────────────────────────────────────────────────────── */

  const roots = (): Object3D[] => {
    const out: Object3D[] = [world.scene, world.getActiveRoot(), world.camera, world.player];
    const spaces = world.playerSpaceEntities as
      | { gripSpaces?: Record<string, { object3D?: Object3D }>; raySpaces?: Record<string, { object3D?: Object3D }> }
      | undefined;
    for (const table of [spaces?.gripSpaces, spaces?.raySpaces]) {
      for (const hand of ['left', 'right']) {
        const o = table?.[hand]?.object3D;
        if (o) out.push(o);
      }
    }
    return out;
  };

  // Infrastructure: what was there before either place built anything —
  // captured at BOOT by main.ts, not here. (This installs after the arena
  // has built, so a snapshot taken now would file the whole arena under
  // "never hide", which is exactly the bug the first walk found: the wrap
  // panels and the neon sign standing in the middle of the club.)
  const baseline = new Set<Object3D>([...baselines.scene, ...baselines.level, ...baselines.body]);
  baseline.add(curtain.mesh);

  const arenaOwned = new WeakSet<Object3D>();
  const raveOwned = new WeakSet<Object3D>();
  const hidden = new Map<Object3D, boolean>();

  const claim = (owner: WeakSet<Object3D>, other: WeakSet<Object3D>): void => {
    for (const r of roots()) {
      for (const c of r.children) {
        if (baseline.has(c) || other.has(c)) continue;
        owner.add(c);
      }
    }
  };
  const hide = (owner: WeakSet<Object3D>): void => {
    for (const r of roots()) {
      for (const c of r.children) {
        if (!owner.has(c) || hidden.has(c)) continue;
        hidden.set(c, c.visible);
        c.visible = false;
      }
    }
  };
  const restore = (owner: WeakSet<Object3D>): void => {
    for (const [o, vis] of hidden) {
      if (!owner.has(o)) continue;
      o.visible = vis;
      hidden.delete(o);
    }
  };

  /* ── the arena's render state, saved across a visit ────────────────── */

  let renderState: ArenaRenderState | null = null;
  const captureRenderState = (): void => {
    renderState = {
      background: world.scene.background,
      environment: world.scene.environment,
      environmentIntensity: world.scene.environmentIntensity,
      fog: world.scene.fog,
      clearColor: world.renderer.getClearColor(new Color()).clone(),
      clearAlpha: world.renderer.getClearAlpha(),
    };
  };
  const restoreRenderState = (): void => {
    if (!renderState) return;
    world.scene.background = renderState.background;
    world.scene.environment = renderState.environment;
    world.scene.environmentIntensity = renderState.environmentIntensity;
    world.scene.fog = renderState.fog;
    world.renderer.setClearColor(renderState.clearColor, renderState.clearAlpha);
    renderState = null;
  };

  const pauseArena = (): void => {
    for (const system of arenaSystems) system.stop();
    setMenuMusicActive(false);
    clearFirePools();
  };
  const resumeArena = (): void => {
    world.player.position.set(0, 0, 0);
    world.player.rotation.set(0, 0, 0);
    for (const system of arenaSystems) system.play();
    restoreRenderState();
    restore(arenaOwned);
    world.getSystem(DesertSystem)?.restoreEnvironment();
    setMenuMusicActive(true);
    clearFirePools();
  };

  /* ── THE DOOR, HELD ─────────────────────────────────────────────────── */

  let floorNet: FloorNet | null = null;

  /**
   * Get the venue's floor to answer BEFORE the curtain falls.
   *
   * The rave shows the club only once you are in a room — a relay's, or
   * the room of one — and until then its foyer (the RAVE RAID menu) stands
   * where the club will be. The crossing used to drop the curtain, mount
   * the rave and lift with the join still in flight: so the black came up
   * on the foyer, and the club arrived a beat later — or, against a host
   * asleep on its free tier, most of a minute later. Now the arena stays
   * exactly where it is, the CLUB tab reads out the wait, and the curtain
   * falls only once there is a floor to lift it on.
   *
   * Resolves true when the floor is open (either kind); false if the
   * player did something else meanwhile — started a bout, ended the
   * session — in which case nothing has moved and nothing needs undoing.
   * The rave's session module failing to load is not a reason to refuse
   * the door: the crossing then goes ahead as it always did.
   */
  const holdForTheFloor = async (): Promise<boolean> => {
    // The board flips the moment the door is pressed — before the rave's
    // session chunk has even been fetched — so the press is never a dead
    // tap while the first import lands.
    const t0 = performance.now();
    app.venueStatus = floorStatus(0);
    try {
      let net: FloorNet;
      try {
        const [session, profile] = await Promise.all([import('../rave/net/session.js'), import('../rave/game/profile.js')]);
        net = session;
        floorNet = session;
        // The greeting that joins a room carries the name and the body, and
        // the rave's menu — which normally signs them on mount — is not up
        // yet. Sign them here, or the floor meets a bare DANCER for the whole
        // visit (a name travels with the greeting and never after).
        session.setDancerName(profile.profileName());
        session.setDancerHue(profile.profileHue());
        session.setDancerBody(myPackedLook(), myPackedGear(), myTone());
      } catch (error) {
        console.warn('[town] the floor could not be asked ahead of the door', error);
        return true;
      }
      // Home from THE BELL (still a member of the room), or already on a
      // floor: nothing to wait for.
      if (net.net.dealtAway || net.inRoom()) return true;

      // The rave's chunk downloads while the host wakes — two waits, overlapped.
      void import('../rave/experience.js').catch(() => {});

      const sessionAtStart = world.session ?? null;
      let wanted = true;
      net.openPublicFloor(() => wanted);
      for (;;) {
        if (net.inRoom()) return true;
        if (app.state !== 'menu' || (sessionAtStart && world.session !== sessionAtStart)) {
          // The player went elsewhere: stand down, and close whatever
          // socket was still knocking.
          wanted = false;
          net.cancelPublicFloor();
          net.leaveRoom();
          return false;
        }
        app.venueStatus = floorStatus(performance.now() - t0);
        await sleep(FLOOR_LOOK_MS);
      }
    } finally {
      app.venueStatus = '';
    }
  };

  /** Under the black: give the floor a moment to be open before the lift. */
  const settleFloor = async (): Promise<void> => {
    const net = floorNet;
    if (!net) return;
    for (let i = 0; i < FLOOR_SETTLE_TICKS && !net.inRoom(); i++) {
      await frame();
      await sleep(FLOOR_LOOK_MS);
    }
  };

  /* ── the crossings ─────────────────────────────────────────────────── */

  let rave: RaveExperience | null = null;
  let activeSession: XRSession | null = null;
  const announce = (): void => {
    window.dispatchEvent(new CustomEvent('ibb:location', { detail: townView.place }));
  };

  const enterRave = async (place: RavePlace): Promise<void> => {
    if (townView.busy || townView.place !== 'arena') return;
    townView.busy = true;
    // THE CLUB's door is held for its floor before anything moves (above).
    // A held door that is let go leaves the arena exactly as it was.
    if (place === 'club') {
      let ready = true;
      try {
        ready = await holdForTheFloor();
      } catch {
        ready = true;
      }
      if (!ready) {
        townView.busy = false;
        return;
      }
    }
    try {
      await curtain.to(1, FALL, frame);

      captureRenderState();
      pauseArena();
      claim(arenaOwned, raveOwned);
      hide(arenaOwned);
      world.scene.fog = null;

      // Loaded on first visit only — the rave is not a static dependency
      // of the arena bundle.
      const { mountRaveExperience } = await import('../rave/experience.js');
      rave ??= mountRaveExperience(world, () => void leaveRave());
      claim(raveOwned, arenaOwned);
      restore(raveOwned);
      rave.enter(place);
      townView.place = place === 'club' ? 'venue' : 'rave';
      announce();
      activeSession = world.session ?? null;
      activeSession?.addEventListener('end', onSessionEnd, { once: true });

      // Two frames under the black: one for the systems' first update to
      // put everything where it lives, one for the render to catch up.
      await frame();
      await frame();
      // And the floor itself: the club is shown only once you are in a
      // room, so the black waits for that — briefly, the door was held for
      // it already — rather than lifting on the foyer.
      if (place === 'club') await settleFloor();
      await curtain.to(0, LIFT, frame);
    } catch (error) {
      console.error('[town] crossing failed', error);
      rave?.leave();
      hide(raveOwned);
      resumeArena();
      townView.place = 'arena';
      announce();
      curtain.set(0);
    } finally {
      townView.busy = false;
    }
  };

  const leaveRave = async (fade = true): Promise<void> => {
    if (townView.busy || townView.place === 'arena') return;
    townView.busy = true;
    try {
      if (fade) await curtain.to(1, FALL, frame);
      activeSession?.removeEventListener('end', onSessionEnd);
      activeSession = null;
      rave?.leave();
      claim(raveOwned, arenaOwned);
      hide(raveOwned);
      resumeArena();
      townView.place = 'arena';
      announce();
      await frame();
      if (fade) await curtain.to(0, LIFT, frame);
      else curtain.set(0);
    } finally {
      townView.busy = false;
    }
  };

  const onSessionEnd = (): void => {
    if (townView.place !== 'arena') void leaveRave(false);
  };

  /* ── THE BELL ──────────────────────────────────────────────────────── */

  let bellDeal: FightDeal | null = null;
  let bellWatch = 0;

  // The caller's side: a fight needs an arena room before its ball can
  // rise. The duel stack and the mesh each open theirs their own way, and
  // both resolve to the five-digit code the ball carries up.
  raveBridge.openFightRoom = async (mode, name) => {
    const who = name || myStats().name;
    if (paperRooms()) return `P${String(Math.floor(Math.random() * 9000) + 1000)}`;
    // Every fight the bell calls — the duel included — is a MESH room: its
    // seat array runs past the fighters into the audience band, which is
    // what seats a duel's watchers on the terrace (combat/layout.ts
    // classicDuel). The two-peer duel wire stays for quick match and ranked.
    return withTimeout(
      mesh.hostPrivate(mode, who, (s) => {
        app.netStatus = s;
      }),
      ROOM_OPEN_MS,
      'the arena could not open a room',
    );
  };

  /** The host waits for the dealt fighters to take their seats, then
   *  launches — or launches with whoever made it once the grace is up.
   *  (A full room launches itself; this is for the short-handed one.) */
  const startWhenSeated = (deal: FightDeal): void => {
    const t0 = performance.now();
    const tick = (): void => {
      if (bellDeal !== deal || app.state === 'playing' || !mesh.joined) return;
      const seated = mesh.occupants.slice(0, mesh.capacity).filter(Boolean).length;
      if (mesh.full || seated >= deal.fighters.length || performance.now() - t0 > SEAT_GRACE_MS) {
        mesh.startLobby();
        return;
      }
      window.setTimeout(tick, HOME_WATCH_MS);
    };
    window.setTimeout(tick, HOME_WATCH_MS);
  };

  /** Everyone folds back to the floor when the fight is over: the arena's
   *  room is torn down, the lobby cleared, and the curtain brings the
   *  venue back — where the relay has been holding my place. */
  const foldHome = async (): Promise<void> => {
    window.clearInterval(bellWatch);
    bellWatch = 0;
    if (!bellDeal || app.state === 'playing') return;
    bellDeal = null;
    mesh.cancel();
    duel.cancel();
    app.lobbyMode = null;
    app.lobbyRooms = [];
    app.privateCode = '';
    app.state = 'menu';
    app.duelView = 'root';
    await enterRave('club');
  };

  /** Watch the fight from outside: once it has been played and is over,
   *  or if it never starts, fold home. */
  const watchForHome = (): void => {
    window.clearInterval(bellWatch);
    const t0 = performance.now();
    let played = false;
    bellWatch = window.setInterval(() => {
      if (!bellDeal) {
        window.clearInterval(bellWatch);
        return;
      }
      if (app.state === 'playing') played = true;
      const over = played ? app.state !== 'playing' : performance.now() - t0 > NEVER_PLAYED_MS;
      if (over && !townView.busy && townView.place === 'arena') void foldHome();
    }, HOME_WATCH_MS);
  };

  /** The bell rang with me on it: cross to the arena and take the seat
   *  the deal gave me — the host's own room, or a joiner's claim in it. */
  const carryToFight = async (deal: FightDeal): Promise<void> => {
    if (townView.place === 'arena') return;
    bellDeal = deal;
    // THE TIER: a titan raid is built to the difficulty the caller picked
    // on the club desk, for the whole squad. It is set here for every
    // dealt headset AND mirrored into the mesh's own room state, because
    // launchLobby reads the host's pick back off the mesh — and the room
    // doc's round trip may not have landed by the time the lobby launches.
    // The caller's pick is already saved (the desk saved it); a joiner's
    // own saved pick is left alone, exactly as the arena's lobby does.
    if (deal.mode === 'raid') {
      app.difficulty = deal.difficulty;
      mesh.raidDifficulty = deal.difficulty;
      if (deal.mine) saveDifficulty();
    }
    // The arena's lobby state is set BEFORE the arena resumes, so its menu
    // wakes already seated in the room and never tears it down as stale.
    app.privateCode = deal.code;
    app.netStatus = deal.role === 'watcher' ? 'dealt to the rail' : 'dealt to the platforms';
    app.quickDuel = false; // a called duel is the long format, like a private one
    if (deal.solo) {
      // A ROOM OF ONE dealt me: no arena room, no lobby — straight into a
      // bout of that shape against the arena's own bots (the menu's ONLY
      // BOTS path, and its solo raid), the way the floor promised.
      mesh.cancel();
      app.lobbyMode = null;
      app.lobbyRooms = [];
      app.duelView = 'root';
      app.spectating = false;
      app.mySlot = 0;
      app.arcade = deal.mode;
      if (deal.mode === 'raid') {
        app.mode = 'campaign';
        app.campaignMode = 'raid';
        app.raidHardcore = false;
        app.raidGoopliath = false;
        app.raidSize = 1;
        app.campaignStage = 0;
      } else {
        app.mode = 'bot';
      }
      app.state = 'playing';
    } else {
      app.lobbyMode = deal.mode;
      app.lobbyView = 'lobby';
      app.state = 'menu';
      app.duelView = 'root';
    }
    await leaveRave();
    // (Narrowing: the crossing above changes the place under the await.)
    if ((townView.place as TownPlace) !== 'arena') {
      bellDeal = null;
      return; // the crossing failed and the rave kept me
    }
    if (!paperRooms() && !deal.solo) {
      if (!deal.mine) {
        const joined = await withTimeout(
          mesh.joinPrivate(
            deal.code,
            myStats().name,
            (s) => {
              app.netStatus = s;
            },
            deal.role === 'watcher',
          ),
          ROOM_OPEN_MS,
          'the arena room was gone',
        ).catch(() => null);
        if (!joined) {
          app.netStatus = 'the arena room was gone';
          await foldHome();
          return;
        }
      } else {
        // The host writes the tier to the room doc too, so a seat claimed
        // late still mirrors the same boss.
        if (deal.mode === 'raid') mesh.setRaidDifficulty(deal.difficulty);
        startWhenSeated(deal);
      }
    }
    watchForHome();
  };
  raveBridge.dealToFight = (deal) => {
    void carryToFight(deal);
  };
  townView.bell = () => ({ deal: bellDeal, state: app.state, lobbyMode: app.lobbyMode, privateCode: app.privateCode });
  townView.foldHome = () => foldHome();

  setTownNavigationHandlers({
    enterVenue: () => enterRave('club'),
    enterRave: () => enterRave('foyer'),
    leaveToArena: () => leaveRave(),
  });
  townView.enterVenue = () => enterRave('club');
  townView.enterRave = () => enterRave('foyer');
  townView.leave = () => leaveRave();
  (window as unknown as { __town?: typeof townView }).__town = townView;
}
