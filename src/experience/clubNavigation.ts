/**
 * THE TOWN'S DOORS — how the arena, the venue and the rave reach each
 * other.
 *
 * In-session, when a host has installed handlers (ClubExperienceManager),
 * every door is a curtain: the black comes down, the world swaps, the black
 * lifts, and the XR session never ends. Without handlers (a standalone
 * page) the doors fall back to what they were — end the session, hop the
 * page — which is the one thing a session can't hide, and why the handlers
 * exist.
 */

import type { World } from '@iwsdk/core';
import { raveUrl } from '../config.js';

type NavigationHandler = () => void | Promise<void>;

interface TownHandlers {
  /** FIRE FIGHT's CLUB tab: the venue's floor. */
  enterVenue: NavigationHandler;
  /** The ARCADE's RAVE RAID: the rave's foyer, at the board. */
  enterRave: NavigationHandler;
  /** Back to the arena's lobby from either. */
  leaveToArena: NavigationHandler;
}

let handlers: TownHandlers | null = null;

export function setTownNavigationHandlers(h: TownHandlers): () => void {
  handlers = h;
  return () => {
    if (handlers === h) handlers = null;
  };
}

function endSessionAndNavigate(world: World, url: string): void {
  const go = (): void => window.location.assign(url);
  const session = world.session as XRSession | undefined;
  if (session) void Promise.resolve(session.end()).then(go, go);
  else go();
}

/** Walk onto the venue's floor. */
export function requestVenueEntry(world: World): void {
  if (handlers) {
    void handlers.enterVenue();
    return;
  }
  endSessionAndNavigate(world, raveUrl());
}

/** Cross to RAVE RAID's foyer. */
export function requestRaveEntry(world: World): void {
  if (handlers) {
    void handlers.enterRave();
    return;
  }
  endSessionAndNavigate(world, raveUrl());
}

export function requestArenaReturn(world: World): void {
  if (handlers) {
    void handlers.leaveToArena();
    return;
  }
  endSessionAndNavigate(world, 'index.html');
}
