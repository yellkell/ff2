/**
 * CrowdSystem — the crowd bed's clock and the HANDS-UP detector.
 *
 * Raises the bed (audio/crowd.ts) the frame a bout goes live and lowers
 * it back in the lobby; drains the sound kit's cue sheet each frame so a
 * landing swells the crowd. And it reads the one gesture the audience is
 * allowed into the fighters' ears: BOTH HANDS ABOVE THE HEAD. Two
 * controller heights against the head's — cheap — eased into a 0..1
 * level. Today that is your own hands (raise them at the bell and the
 * terrace answers); once the audience travels with the squad the same
 * byte rides the room wire and the relay's aggregate lands here instead.
 */

import { createSystem } from '@iwsdk/core';
import { Vector3 } from 'three';
import { app } from '../menu/appState.js';
import { crowd, setCrowdRoar, startCrowd, stopCrowd, tickCrowd } from '../audio/crowd.js';

const _head = new Vector3();
const _left = new Vector3();
const _right = new Vector3();

/** Hands this far above the head centre count as UP. */
const HANDS_UP_RISE = 0.08;

export class CrowdSystem extends createSystem({}) {
  private roar = 0;
  /** Where the bout stood last frame — the bed raises/lowers on the edge. */
  private wasLive = false;

  update(delta: number): void {
    // Every bout is a show: quick, ranked, brawls, the raid, the campaign.
    const live = app.state === 'playing';
    if (live !== this.wasLive) {
      this.wasLive = live;
      if (live) startCrowd();
      else stopCrowd();
    }
    if (live) this.readHands(delta);
    else this.roar = 0;
    setCrowdRoar(this.roar);
    tickCrowd(delta);
  }

  private readHands(delta: number): void {
    const head = this.player.head;
    const spaces = this.player.gripSpaces;
    const l = spaces?.left;
    const r = spaces?.right;
    let want = 0;
    if (head && l && r) {
      head.getWorldPosition(_head);
      l.getWorldPosition(_left);
      r.getWorldPosition(_right);
      const up = _left.y > _head.y + HANDS_UP_RISE && _right.y > _head.y + HANDS_UP_RISE;
      want = up ? 1 : 0;
    }
    // Up fast (the terrace answers the gesture), down slower (a roar
    // that has started finishes).
    const rate = want > this.roar ? 3.5 : 1.2;
    this.roar += (want - this.roar) * Math.min(1, delta * rate);
    crowd.level = crowd.level; // (read by probes; the bed owns the value)
  }
}
