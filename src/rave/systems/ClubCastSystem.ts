/**
 * THE FLOOR'S CAMERA — the club's half of FFTV's picture.
 *
 * FFTV peeps into the club when nothing else is on. Until now that peep
 * was a MAP: the relay draws the floor from the poses every member sends
 * anyway (server/rave.mjs clubSnapshot), which tells you how many people
 * are in and roughly where, and nothing whatever about what the room looks
 * like. This sends a picture of it instead.
 *
 * WHO SHOOTS: the HOST, and only the host. One camera for the room, chosen
 * by something both ends already agree on, so two headsets never fight over
 * the feed and nobody who merely walked in pays for television. A guest
 * costs nothing at all — this system does no work for them beyond a
 * boolean.
 *
 * WHAT IT COSTS: one 256x144 render three times a second, fenced rather
 * than stalled (net/tvVideo.ts). The club is a far cheaper scene to shoot
 * than a bout and nobody in it is being scored, which is why the floor is
 * the right place to have tried this first.
 *
 * The picture never keeps the club "on air": the floor is on whenever there
 * are people on it. If this stops sending — the host leaves, an old headset
 * can't render to a target — the relay's map comes straight back.
 */

import { createSystem } from '@iwsdk/core';
import { Quaternion, Vector3 } from 'three';
import { VIDEO } from '../../config.js';
import { captureFrame, cameraBroken, releaseCamera, tvCamera } from '../../net/tvVideo.js';
import { tvCast } from '../../net/tvCast.js';
import { inRoom, net } from '../net/session.js';

const _aim = new Vector3();
const _eye = new Vector3();
const _v = new Vector3();
const _q = new Quaternion();

export class ClubCastSystem extends createSystem({}) {
  private shotT = 0;

  update(delta: number): void {
    // Guests, solo floors and broken contexts never shoot.
    if (!net.isHost || !inRoom() || net.solo || cameraBroken()) return;
    this.shotT -= delta;
    if (this.shotT > 0) return;
    this.shotT = 1 / VIDEO.hz;
    void this.shoot();
  }

  stop(): void {
    releaseCamera();
  }

  private async shoot(): Promise<void> {
    this.aim();
    const d = await captureFrame(this.renderer, this.scene);
    if (d) tvCast.clubVideo(d);
  }

  /**
   * A wide shot of the floor, over the host's shoulder: high enough to see
   * the room, low enough that people read as people rather than dots, and
   * pointed the way they are looking so the shot is of the club rather
   * than of the back of a head.
   */
  private aim(): void {
    const cam = tvCamera();
    // The camera watches the HOST — the one person the room is guaranteed
    // to have, and the one already paying for the render. Whoever is near
    // them is in shot, which on a floor this size is the floor.
    const head = this.playerHeadEntity?.object3D;
    if (head) head.getWorldPosition(_aim);
    else _aim.set(0, 1.4, -3);
    _aim.y = 1.25;

    // Which way they are facing, so the shot looks along the room rather
    // than into the back of their head.
    if (head) {
      head.getWorldQuaternion(_q);
      _v.set(0, 0, -1).applyQuaternion(_q).setY(0);
      if (_v.lengthSq() < 1e-4) _v.set(0, 0, -1);
      _v.normalize();
    } else _v.set(0, 0, -1);
    // Look a little ahead of them, and stand off one shoulder and above:
    // a camera on the floor, not a camera on their face.
    _aim.addScaledVector(_v, 1.6);
    _eye.copy(_aim).addScaledVector(_v, -4.6);
    _eye.x += 1.5;
    _eye.y = 2.9;
    cam.position.copy(_eye);
    cam.lookAt(_aim);
    cam.updateMatrixWorld();
  }
}
