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
import { clearFirePools } from '../fx/fire.js';
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
} = { place: 'arena', busy: false };

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

  /* ── the crossings ─────────────────────────────────────────────────── */

  let rave: RaveExperience | null = null;
  let activeSession: XRSession | null = null;
  const announce = (): void => {
    window.dispatchEvent(new CustomEvent('ibb:location', { detail: townView.place }));
  };

  const enterRave = async (place: RavePlace): Promise<void> => {
    if (townView.busy || townView.place !== 'arena') return;
    townView.busy = true;
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
