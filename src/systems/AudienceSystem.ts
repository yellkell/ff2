/**
 * THE AUDIENCE (DESIGN §3.2) — watchers travel with the squad, and the
 * terrace is a real place with real people on it.
 *
 * Two jobs, one for each side of the rail:
 *
 *  - IF I AM WATCHING: plant this headset on the audience ground. The
 *    bout is dealt to me exactly as it is to a fighter (same mesh, same
 *    poses, same fireballs), but my slot is the sentinel outside every
 *    layout (config.WATCHER_SLOT), so every seat renders where the arena
 *    actually put it and nothing is standing at my own origin. My rig is
 *    moved out to a stand on the terrace, ONCE, on the frame the bout
 *    starts — after that the ground is mine to look around from. My own
 *    platform goes away; I am not a fighter and there is nothing under my
 *    feet but the plate.
 *
 *  - EITHER WAY: put BODIES on the terrace. Every watcher streams a head
 *    (MeshSystem's `watch` frames), and each one gets a blank standing at
 *    the rail, solved by the same IK a fighter's body uses. This is what
 *    makes the crowd's roar mean something: when the terrace goes up, the
 *    fighters can see it go up.
 *
 * The watchers' WORDS never reach a fighter (MeshSystem.mayHear); their
 * NOISE always does (audio/crowd.ts). That split is the pillar.
 */

import { createSystem } from '@iwsdk/core';
import { Group, Quaternion, Vector3 } from 'three';
import { app } from '../menu/appState.js';
import { mesh } from '../net/mesh.js';
import { buildBoxer, solveTorso, type BoxerRig } from '../avatar/boxer.js';
import { audienceStands, type Stand } from '../arena/desert/audience.js';

const _chest = new Vector3();
const _pelvis = new Vector3();
const _pos = new Vector3();
const _quat = new Quaternion();

/** How many terrace bodies we are willing to build (the seats a room keeps
 *  for watchers — one rig each, and no more). */
const MAX_BODIES = 8;

/** Headless read of where the audience actually is. */
export const audienceView = {
  /** My stand, or null when I'm not watching. */
  mine: null as Stand | null,
  /** How many bodies are on the terrace right now. */
  bodies: 0,
};

interface TerraceBody {
  rig: BoxerRig;
  root: Group;
}

export class AudienceSystem extends createSystem({}) {
  private bodies = new Map<number, TerraceBody>();
  private planted = false;
  private stand: Stand | null = null;

  update(): void {
    const watching = app.spectating && app.state === 'playing';
    if (watching && !this.planted) this.takeMyStand();
    if (!watching && this.planted) this.leaveMyStand();
    this.dressTerrace();
    audienceView.mine = this.stand;
    audienceView.bodies = this.bodies.size;
  }

  /** Which spot on the terrace is mine: my seat's place in the watcher band,
   *  wrapped into however many stands this site offers. */
  private myStand(): Stand | null {
    const stands = audienceStands();
    if (stands.length === 0) return null;
    const w = Math.max(0, mesh.mySeat - mesh.capacity);
    return stands[w % stands.length];
  }

  private takeMyStand(): void {
    const stand = this.myStand();
    if (!stand) return; // this site grew no terraces — stay where you are
    this.planted = true;
    this.stand = stand;
    const player = this.world.player;
    player.position.set(stand.x, stand.y, stand.z);
    player.rotation.y = stand.yaw;
    // Nothing under a watcher's feet: the pedestal belongs to fighters.
    const pad = this.world.scene.getObjectByName('player-platform');
    if (pad) pad.visible = false;
  }

  private leaveMyStand(): void {
    this.planted = false;
    this.stand = null;
    const player = this.world.player;
    player.position.set(0, 0, 0);
    player.rotation.y = 0;
    const pad = this.world.scene.getObjectByName('player-platform');
    if (pad) pad.visible = true;
  }

  /** A blank at the rail for every watcher on the wire. */
  private dressTerrace(): void {
    // Nobody left on the terrace (bout over, room gone) — strike the set.
    if (mesh.watchers.size === 0 && this.bodies.size > 0) {
      for (const [seat] of this.bodies) this.drop(seat);
      return;
    }
    for (const [seat, w] of mesh.watchers) {
      if (seat === mesh.mySeat) continue; // you never see your own body
      let body = this.bodies.get(seat);
      if (!body) {
        if (this.bodies.size >= MAX_BODIES) continue;
        body = this.build();
        this.bodies.set(seat, body);
      }
      body.root.visible = true;
      _pos.set(w.x, w.y, w.z);
      _quat.set(w.qx, w.qy, w.qz, w.qw);
      // The same torso solve a fighter's body uses — a watcher leaning on
      // the rail leans like a person, not like a signpost.
      solveTorso(body.rig, _pos, _quat, w.x, w.z, _chest, _pelvis);
      // Their hands are not on the wire (the terrace streams a head), so
      // the gloves rest at their sides rather than jittering at the origin.
      for (const hand of [0, 1] as const) {
        const side = hand === 0 ? -0.26 : 0.26;
        body.rig.gloves[hand].position.set(w.x + side, Math.max(0, w.y - 0.62), w.z + 0.06);
      }
    }
    // Anyone the wire dropped takes their body with them.
    for (const [seat] of this.bodies) {
      if (!mesh.watchers.has(seat)) this.drop(seat);
    }
  }

  private build(): TerraceBody {
    const root = new Group();
    root.name = 'terrace-watcher';
    const rig = buildBoxer(0, 'blank');
    root.add(...rig.all);
    this.world.scene.add(root);
    return { rig, root };
  }

  private drop(seat: number): void {
    const body = this.bodies.get(seat);
    if (!body) return;
    body.root.removeFromParent();
    this.bodies.delete(seat);
  }
}
