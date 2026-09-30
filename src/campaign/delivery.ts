/**
 * THE DELIVERY — where a titan's blow comes FROM.
 *
 * Every floor attack used to charge a decal on your deck and then simply
 * go off there: the titan mimed from across the pit, but nothing ever left
 * its body. A delivery closes that gap — a fire bolt thrown from the
 * striking fist that lands on the exact beat its zone detonates. Two laws:
 *
 *  1. IT LANDS IN THE DANGER. `impactOf` picks a point inside the burning
 *     part of the zone — the doomed half, the rim, the lane — never the
 *     safe gap, so the throw can only ever confirm the read, not argue
 *     with it.
 *  2. IT CHANGES NOTHING ELSE. Zones, staggers and the judge are the
 *     campaign's own; a delivery is a visual that leaves early enough to
 *     arrive on time. (`lungeEnvelope` shapes the chassis step that goes
 *     with it.)
 *
 * Pure except for `Bolt`, which owns its meshes.
 */

import { CylinderGeometry, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, Vector3, type Scene } from 'three';
import type { Zone } from './zones.js';
import { glowSprite } from '../materials/glow.js';

/** How far in from a zone's edge an impact sits (m) — clear of the lip. */
const INSET = 0.45;

/**
 * Where on the TARGET's deck (target-local, y = 0) a zone's blow lands, or
 * null when the zone has no thrown blow: the sweep is the arm itself (see
 * the scythe shaft), the beam already fires from the visor, a volley shot
 * is its own projectile, and the recital is CONDUCTED — the body never
 * points at the answer.
 */
export function impactOf(zone: Zone): { x: number; z: number } | null {
  switch (zone.kind) {
    case 'circle':
      return { x: zone.x, z: zone.z };
    case 'lane': {
      // THE X's arms cross at the deck centre — the knot always burns.
      if (zone.yaw) return { x: 0, z: 0 };
      return { x: zone.x, z: 0 };
    }
    case 'rail':
      return { x: 0, z: zone.z };
    case 'gate': {
      // Everything burns except the band at `at`: land on the far side of
      // the deck from the gap.
      const off = zone.at >= 0 ? -INSET : INSET;
      return zone.axis === 0 ? { x: off, z: 0 } : { x: 0, z: off };
    }
    case 'ring':
      // The rim burns and the middle lives: land on the rim, boss-side.
      return { x: 0, z: -Math.max(zone.innerR + 0.15, INSET) };
    case 'half':
      return zone.axis === 0 ? { x: zone.side * INSET, z: 0 } : { x: 0, z: zone.side * INSET * 0.85 };
    case 'nova': {
      // Everything burns except the wedge at `angle` (atan2(x, z)): land
      // dead opposite it.
      const a = zone.angle + Math.PI;
      return { x: Math.sin(a) * INSET, z: Math.cos(a) * INSET };
    }
    default:
      return null;
  }
}

/** Which fist throws at a target-local x: the same convention as the rest
 *  of the campaign (armFor) — arm 1 takes the −x side, arm 0 the +x side,
 *  and dead centre keeps the attack's own arm. */
export function throwingArm(x: number, fallback: 0 | 1): 0 | 1 {
  if (Math.abs(x) < 0.05) return fallback;
  return x < 0 ? 1 : 0;
}

/**
 * The chassis step, 0..1 over `t` = elapsed / lungeTime: in FAST (a quarter
 * sine over the first 30 %), then a smooth settle home — a lunge and a
 * recoil, not a slide.
 */
export function lungeEnvelope(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.3) return Math.sin((t / 0.3) * (Math.PI / 2));
  const k = (t - 0.3) / 0.7;
  return 1 - k * k * (3 - 2 * k);
}

/** A lob from `from` to `to`, bowed upward by `lift` at the middle. */
export function arcPoint(from: Vector3, to: Vector3, k: number, lift: number, out: Vector3): Vector3 {
  out.lerpVectors(from, to, k);
  out.y += 4 * k * (1 - k) * lift;
  return out;
}

/**
 * How a thrown bolt looks. A titan throws FIRE: a halo, a hot core and an
 * ember trail. GOOPLIATH throws GEL: a wobbling glob stretched along its
 * flight, still tied to his fist by a strand that snaps a third of the way
 * out, shedding droplets as it goes.
 */
export interface BoltLook {
  halo: number;
  core: number;
  /** Halo size, metres. */
  size: number;
  /** A translucent gel glob instead of a fire bolt. */
  glob?: boolean;
  /** Called every ~50 ms of flight with the bolt's position and direction. */
  trail?: (at: Vector3, dir: Vector3) => void;
  /** The throwing hand, sampled live: a strand runs from it to the bolt
   *  until it snaps at `SNAP_AT` of the flight. */
  tether?: (out: Vector3) => Vector3;
}

/** Fraction of the flight at which a tethered bolt's strand snaps. */
const SNAP_AT = 0.35;
const _up = new Vector3(0, 1, 0);
const _fwd = new Vector3(0, 0, 1);

/**
 * One thrown bolt in flight. The launch point is sampled at the throw (the
 * fist keeps moving after it lets go); the impact point is fixed. `update`
 * returns false once it has landed — the zone's own strike visual takes it
 * from there.
 */
export class Bolt {
  readonly group = new Group();
  /** Where it left the fist (world). */
  readonly from: Vector3;
  /** Where it lands (world). */
  readonly target: Vector3;
  private age = 0;
  private trailClock = 0;
  private readonly body = new Group();
  private readonly strand: Mesh | null = null;
  private snapped = false;
  private readonly _p = new Vector3();
  private readonly _q = new Vector3();
  private readonly _dir = new Vector3();
  private readonly travel: number;
  private readonly lift: number;
  private readonly look: BoltLook;
  /** Theatre for someone else's deck: no trail (it's across the pit). */
  private readonly quiet: boolean;

  constructor(scene: Scene, from: Vector3, to: Vector3, travel: number, lift: number, look: BoltLook, quiet = false) {
    this.from = from.clone();
    this.target = to.clone();
    this.travel = travel;
    this.lift = lift;
    this.look = look;
    this.quiet = quiet;
    if (look.glob) {
      // The glob: a lumpy translucent gel body round a lit heart.
      const gel = new Mesh(
        new IcosahedronGeometry(look.size * 0.3, 1),
        new MeshBasicMaterial({ color: look.halo, transparent: true, opacity: 0.72, depthWrite: false }),
      );
      this.body.add(gel);
      this.body.add(glowSprite(look.core, look.size * 0.45));
      this.group.add(glowSprite(look.halo, look.size * 0.9, 0.55));
    } else {
      this.body.add(glowSprite(look.halo, look.size));
      this.body.add(glowSprite(look.core, look.size * 0.5));
    }
    this.group.add(this.body);
    this.group.position.copy(this.from);
    scene.add(this.group);
    if (look.tether) {
      this.strand = new Mesh(
        new CylinderGeometry(0.02, 0.035, 1, 6, 1, true),
        new MeshBasicMaterial({ color: look.halo, transparent: true, opacity: 0.8, depthWrite: false }),
      );
      scene.add(this.strand);
    }
  }

  update(delta: number): boolean {
    this.age += delta;
    const k = Math.min(1, this.age / this.travel);
    arcPoint(this.from, this.target, k, this.lift, this._p);
    arcPoint(this.from, this.target, Math.min(1, k + 0.02), this.lift, this._q);
    this._dir.copy(this._q).sub(this._p);
    if (this._dir.lengthSq() < 1e-10) this._dir.copy(this.target).sub(this.from);
    this._dir.normalize();
    this.group.position.copy(this._p);
    // It swells as it closes — the last thing you see is how big it is.
    this.group.scale.setScalar(0.7 + 0.5 * k);
    if (this.look.glob) {
      // Stretched along its flight and never quite still: gel, not metal.
      this.body.quaternion.setFromUnitVectors(_fwd, this._dir);
      const w = Math.sin(this.age * 38) * 0.12;
      this.body.scale.set(0.85 - w, 0.85 + w, 1.35 + w);
    }
    if (this.strand) this.updateStrand(k);
    this.trailClock -= delta;
    if (!this.quiet && this.look.trail && this.trailClock <= 0) {
      this.trailClock = 0.05;
      this.look.trail(this._p, this._dir);
    }
    return k < 1;
  }

  /** The strand from the live fist to the bolt, thinning until it snaps. */
  private updateStrand(k: number): void {
    const strand = this.strand!;
    if (this.snapped || k >= SNAP_AT) {
      if (!this.snapped) {
        this.snapped = true;
        strand.visible = false;
        if (!this.quiet) this.look.trail?.(this._p, this._dir);
      }
      return;
    }
    this.look.tether!(this._q);
    this._q.sub(this._p); // bolt → fist
    const len = this._q.length();
    strand.visible = len > 0.05;
    if (!strand.visible) return;
    const thin = 1 - k / SNAP_AT; // pulled thin as it stretches
    strand.position.copy(this._p).addScaledVector(this._q, 0.5);
    strand.quaternion.setFromUnitVectors(_up, this._q.multiplyScalar(1 / len));
    strand.scale.set(0.4 + thin, len, 0.4 + thin);
  }

  dispose(): void {
    for (const root of [this.group, this.strand]) {
      root?.traverse((o) => {
        const m = o as unknown as { geometry?: { dispose(): void }; material?: { dispose(): void } };
        m.geometry?.dispose();
        m.material?.dispose();
      });
      root?.removeFromParent();
    }
  }
}
