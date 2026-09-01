/**
 * THE BLANK — FIRE FIGHT 2's mannequin body (DESIGN.md §5.1), the polish
 * pass: smooth, symmetrical, basic, uniform.
 *
 * One body, TWO base tones — you start ALL WHITE ('blank') or ALL BLACK
 * ('onyx'), picked on the locker's COLOUR tab, and everything past that is
 * the paint system's job. Each tone is its own skin id riding the existing
 * skin machinery, so the pick syncs to rivals and squadmates over the same
 * wire every FF1 skin used.
 *
 * THE CONSTRUCTION RULES (each one answers a real complaint):
 *  - ONE material per body. No trim tone, no joint rubber, no seam bands —
 *    a uniform shell, so nothing can read as "parts".
 *  - ONE surface per piece. Chest and pelvis are each a single LOFT — a
 *    stack of elliptical rings stitched into one indexed mesh with smooth
 *    shared-vertex normals — instead of bars, caps and sockets crossing
 *    each other. Nothing overlaps because there is nothing TO overlap;
 *    symmetry is by construction (every ring is centred).
 *  - NO BULGE below the hips. The pelvis loft is monotonic after its
 *    widest ring: hips, then a smooth unbroken taper to a rounded tip.
 *    (The hitbox never bulged — it ends at the BODY_IK pelvis sphere —
 *    and now the body's silhouette says the same thing.)
 *  - The head is a bare egg; its short neck stub rides IN the head group,
 *    entering the egg from below at near-tangent — the one visible joint,
 *    and it reads as a mannequin's ball joint, not a crossing part.
 *
 * Materials carry NO role/accent tags: recolours, the hue wheel and
 * setAvatarAccent all leave the base tones alone. Front faces −z. The
 * BODY_IK hitbox spheres never change — the blank stays exactly as
 * hittable as everything before it, and the visual runs INSIDE them.
 */

import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { BODY_IK } from '../config.js';

export type BlankTone = 'white' | 'onyx';

/** The two factory finishes. WHITE is a soft matte porcelain; ONYX keeps a
 *  little sheen and metal so a black body still draws its silhouette from
 *  the room's light instead of vanishing into a dark arena. */
function toneMat(tone: BlankTone): MeshStandardMaterial {
  // No userData.role / accent: immune to applyAvatarSkin + setAvatarAccent.
  return tone === 'white'
    ? new MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.72, metalness: 0.02 })
    : new MeshStandardMaterial({ color: 0x17171a, roughness: 0.4, metalness: 0.3 });
}

/** The skin id each tone answers to (skinTag drives applyAvatarSkin's
 *  show-one-body toggle, exactly like the FF1 roster did). */
export function toneSkinId(tone: BlankTone): string {
  return tone === 'white' ? 'blank' : 'onyx';
}

function tagged(tone: BlankTone): Group {
  const g = new Group();
  g.userData.skinTag = toneSkinId(tone);
  g.visible = false;
  return g;
}

/** One elliptical cross-section of a loft: centred at x=0 (mirror symmetry
 *  by construction), `w`/`d` are half-width/half-depth at height `y`.
 *  `z` shifts the ring fore/aft — the neck-root rings lean FORWARD to meet
 *  the head, which the IK deliberately hangs ahead of the spine. */
interface Ring {
  y: number;
  w: number;
  d: number;
  z?: number;
}

const SEG = 36;

/**
 * Stitch rings into ONE smooth closed surface: shared vertices ring to
 * ring, capped flat top and bottom, normals computed over the whole
 * indexed mesh so the shading rolls continuously — no crossing primitives,
 * no visible seams, mirror-symmetric on both axes by construction.
 */
function loft(rings: Ring[], mat: MeshStandardMaterial): Mesh {
  // SEG+1 columns per ring: the seam vertex is duplicated so u runs a
  // clean 0..1 around the body — THE PAINT bakes into these UVs, and a
  // shared seam vertex would smear the last column across the whole map.
  const cols = SEG + 1;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  // v by cumulative profile arc, so paint stays even where rings crowd.
  const arc: number[] = [0];
  for (let k = 1; k < rings.length; k++) {
    const a = rings[k - 1];
    const b = rings[k];
    arc.push(arc[k - 1] + Math.hypot(b.y - a.y, ((b.w + b.d) - (a.w + a.d)) / 2));
  }
  const total = arc[arc.length - 1] || 1;
  rings.forEach((r, k) => {
    for (let s = 0; s < cols; s++) {
      const t = ((s % SEG) / SEG) * Math.PI * 2;
      pos.push(Math.cos(t) * r.w, r.y, Math.sin(t) * r.d + (r.z ?? 0));
      uv.push(s / SEG, 1 - arc[k] / total);
    }
  });
  for (let k = 0; k < rings.length - 1; k++) {
    const a0 = k * cols;
    const b0 = (k + 1) * cols;
    for (let s = 0; s < SEG; s++) {
      // Wound so faces point OUTWARD (rings run top→down): a culled-inward
      // body renders its own interior — the paint looked like it was on
      // the wrong side of the world until this flipped.
      idx.push(a0 + s, b0 + s + 1, b0 + s, a0 + s, a0 + s + 1, b0 + s + 1);
    }
  }
  // Flat caps close the tube (the end rings are small, so the cap is a
  // sliver — the averaged normals round it off rather than crease it).
  const top = pos.length / 3;
  pos.push(0, rings[0].y, rings[0].z ?? 0);
  uv.push(0.5, 1);
  const bottom = top + 1;
  pos.push(0, rings[rings.length - 1].y, rings[rings.length - 1].z ?? 0);
  uv.push(0.5, 0);
  for (let s = 0; s < SEG; s++) {
    idx.push(top, s, s + 1);
    const l0 = (rings.length - 1) * cols;
    idx.push(bottom, l0 + s + 1, l0 + s);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new Mesh(geo, mat);
}

/** The bare egg, and the ball-joint neck stub that rides with it. */
export function buildMannequinHead(tone: BlankTone): Group {
  const r = BODY_IK.headRadius;
  const g = tagged(tone);
  const mat = toneMat(tone);

  const skull = new Mesh(new SphereGeometry(r, 28, 22), mat);
  skull.scale.set(0.84, 1.08, 0.93);
  skull.position.y = r * 0.05;
  skull.userData.paintPart = 'head'; // THE PAINT bakes into this mesh's map
  skull.userData.paintTone = tone;
  g.add(skull);

  // The neck: a short column entering the egg from below — in the HEAD
  // group so it follows every nod and turn. The IK hangs the spine BEHIND
  // the head (BODY_IK.spineSetBack), so the stub sits back toward +z and
  // leans further back on the way down; with the chest's neck-root rings
  // leaning forward to meet it, the column reads as ONE line from jaw to
  // shoulders instead of a post standing in front of the body.
  const neck = new Mesh(new CylinderGeometry(r * 0.4, r * 0.46, r * 1.2, 20), mat);
  neck.position.set(0, -r * 0.92, r * 0.42);
  neck.rotation.x = -0.32; // bottom swings toward the spine
  g.add(neck);
  const neckCap = new Mesh(new SphereGeometry(r * 0.46, 20, 12), mat);
  neckCap.scale.y = 0.55;
  neckCap.position.set(0, -r * 1.48, r * 0.62);
  g.add(neckCap);

  return g;
}

/** The trunk: ONE loft from neck root over the shoulder line down to the
 *  waist — wide shoulders and a thin waist in a single unbroken surface. */
export function buildMannequinChest(tone: BlankTone): Group {
  const g = tagged(tone);
  // (y, halfW, halfD) — widest ring stays inside the 0.2 chest hitbox
  // sphere; the shoulder line carries the width, the waist the pinch.
  const trunk = loft(
    [
      { y: 0.185, w: 0.052, d: 0.046, z: -0.075 }, // neck root, leaning to the head
      { y: 0.155, w: 0.07, d: 0.057, z: -0.05 },
      { y: 0.125, w: 0.16, d: 0.078, z: -0.02 }, // trapezius spreading
      { y: 0.095, w: 0.252, d: 0.09 }, // THE SHOULDER LINE — widest
      { y: 0.05, w: 0.232, d: 0.098 },
      { y: -0.015, w: 0.166, d: 0.1 }, // chest
      { y: -0.085, w: 0.124, d: 0.09 },
      { y: -0.148, w: 0.094, d: 0.077 }, // THE WAIST — thin
      { y: -0.175, w: 0.093, d: 0.076 },
      { y: -0.195, w: 0.097, d: 0.079 }, // hem, handing off to the hips
    ],
    toneMat(tone),
  );
  trunk.userData.paintPart = 'chest';
  trunk.userData.paintTone = tone;
  g.add(trunk);
  return g;
}

/** The hips: ONE loft — waist in, hips barely out, then a smooth monotonic
 *  taper to a rounded tip. Nothing below the hip line gets wider again. */
export function buildMannequinPelvis(tone: BlankTone): Group {
  const g = tagged(tone);
  const hips = loft(
    [
      { y: 0.115, w: 0.09, d: 0.074 }, // tucks up inside the chest hem
      { y: 0.06, w: 0.112, d: 0.09 },
      { y: 0.0, w: 0.132, d: 0.104 }, // the hip line — widest, subtle
      { y: -0.07, w: 0.115, d: 0.092 }, // and from here: only narrower
      { y: -0.135, w: 0.078, d: 0.065 },
      { y: -0.19, w: 0.04, d: 0.035 },
      { y: -0.225, w: 0.014, d: 0.013 }, // the rounded tip
    ],
    toneMat(tone),
  );
  hips.userData.paintPart = 'pelvis';
  hips.userData.paintTone = tone;
  g.add(hips);
  return g;
}
