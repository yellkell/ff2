/**
 * THE BLANK — FIRE FIGHT 2's mannequin body (DESIGN.md §5.1).
 *
 * One bland humanoid, primer-grey, sized honestly to the BODY_IK hitbox
 * spheres: wide shoulders, thin waist, the silhouette everyone reads in a
 * fight. Everyone starts identical and unpainted; shape comes later from
 * bought attachments and colour ONLY from placed paint stripes (§5.3), so
 * the blank itself must stay mute — clean forms, no glow, no branding.
 *
 * It plugs into the existing skin machinery as the 'blank' chassis: three
 * builders registered in boxer.ts's HEAD/CHEST/PELVIS tables, a skinTag
 * group each so applyAvatarSkin's show-one-skin toggle works unchanged.
 * DELIBERATELY different from every other skin: its materials carry NO
 * `userData.role` and NO accent tags, so skin recolours, the locker's hue
 * wheel and setAvatarAccent all leave it primer — a blank is not a
 * colourway, and the only way it will ever take colour is the paint system.
 *
 * Front faces −z (the house convention). Hitboxes are the BODY_IK spheres
 * and never change — the blank is exactly as hittable as every FF1 skin.
 */

import { CylinderGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial, SphereGeometry, Vector2 } from 'three';
import { BODY_IK } from '../config.js';

/** Primer: matte workshop grey with the faintest warm cast — reads as an
 *  unpainted factory shell under the arena's IBL, never as a colour. */
function primerMat(): MeshStandardMaterial {
  // No userData.role / accent: immune to applyAvatarSkin + setAvatarAccent.
  return new MeshStandardMaterial({ color: 0x98948b, roughness: 0.82, metalness: 0.06 });
}

/** Joint shadow: the darker rubber at neck and seams that gives the primer
 *  forms their read without a single painted line. */
function jointMat(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: 0x4e4b45, roughness: 0.9, metalness: 0.04 });
}

function tagged(): Group {
  const g = new Group();
  g.userData.skinTag = 'blank';
  g.visible = false;
  return g;
}

/** A featureless smooth head: an egg with a hairline visor seam and a
 *  rubber neck — a face for the paint to land on later, not a character. */
export function buildMannequinHead(_accent: number): Group {
  const r = BODY_IK.headRadius;
  const g = tagged();

  // The egg: cranium fuller than the jaw, front barely flattened.
  const skull = new Mesh(new SphereGeometry(r, 24, 18), primerMat());
  skull.scale.set(0.84, 1.1, 0.93);
  skull.position.y = r * 0.06;
  g.add(skull);

  // Hairline seam at the sight line — the one mark on the whole head, so a
  // fighter still reads WHERE it is looking from silhouette alone.
  const seam = new Mesh(new CylinderGeometry(1, 1, r * 0.06, 24, 1, true), jointMat());
  seam.scale.set(r * 0.845, 1, r * 0.935);
  seam.position.y = r * 0.1;
  g.add(seam);

  // Rubber neck stub.
  const neck = new Mesh(new CylinderGeometry(r * 0.38, r * 0.48, r * 1.05, 14), jointMat());
  neck.position.y = -r * 1.2;
  g.add(neck);

  return g;
}

/** Wide shoulders down to a thin waist: a lofted trunk hugged by a clavicle
 *  bar and deltoid caps. Widest point ≈ the chest hitbox sphere. */
export function buildMannequinChest(_accent: number): Group {
  const g = tagged();
  const R = BODY_IK.chestRadius; // 0.2 — the honest envelope

  // The trunk: one lathe from upper chest to the waist pinch. (radius, y)
  // pairs; the lathe is circular, squashed to an elliptical section below.
  // Slender by appearance: the visual trunk runs well INSIDE the chest
  // hitbox sphere (R = 0.2) — like FF1's SHADOW, looks slimmer, hits the
  // same. Only the shoulder line keeps its width; everything below tapers.
  const profile: Array<[number, number]> = [
    [0.08, 0.155], // neck root
    [0.148, 0.12], // upper chest shelf
    [R * 0.82, 0.045], // pecs — the widest ring, slimmed
    [0.158, -0.01], // ribcage holding its line
    [0.126, -0.085], // the drop into the waist
    [0.09, -0.15], // THE WAIST — properly thin
    [0.09, -0.17],
    [0.094, -0.19], // slight flare handing off to the pelvis
  ];
  const trunk = new Mesh(new LatheGeometry(profile.map(([x, y]) => new Vector2(x, y)), 28), primerMat());
  trunk.scale.set(1, 1, 0.68); // chest section: wider than deep
  g.add(trunk);

  // Clavicle bar: the width. A lying capsule spanning shoulder to shoulder.
  const bar = new Mesh(new CylinderGeometry(0.058, 0.058, 0.46, 14), primerMat());
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.095, 0.005);
  g.add(bar);

  // Deltoid caps: wide shoulders, rounded — the mannequin's signature line.
  for (const side of [-1, 1]) {
    const cap = new Mesh(new SphereGeometry(0.09, 18, 14), primerMat());
    cap.scale.set(1, 0.94, 0.94);
    cap.position.set(side * 0.265, 0.09, 0.005);
    g.add(cap);
    // Arm-socket shadow under each cap — the seam where a pauldron
    // attachment will one day bolt on.
    const socket = new Mesh(new CylinderGeometry(0.058, 0.064, 0.055, 12, 1, true), jointMat());
    socket.rotation.z = side * (Math.PI / 2 - 0.25);
    socket.position.set(side * 0.315, 0.05, 0.005);
    g.add(socket);
  }

  return g;
}

/** The hip block under the waist: rounded, legless (on brand), fading out
 *  below like every fighter in town. */
export function buildMannequinPelvis(_accent: number): Group {
  const g = tagged();
  const R = BODY_IK.pelvisRadius; // 0.17

  // Waist coupler: the thin ring the trunk hands down to.
  const coupler = new Mesh(new CylinderGeometry(0.084, 0.104, 0.09, 20), jointMat());
  coupler.position.y = 0.09;
  coupler.scale.z = 0.76;
  g.add(coupler);

  // The hips: one squashed sphere, slimmer than the hitbox sphere it sits
  // in (the pelvis hitbox is R and never changes — hips this slender are a
  // pure appearance call, same as FF1's SHADOW).
  const hips = new Mesh(new SphereGeometry(R * 0.86, 22, 16), primerMat());
  hips.scale.set(1.0, 0.76, 0.8);
  g.add(hips);

  // The close: a slim taper fading the body out underneath — NOT a bulge.
  // The hitbox ends at the pelvis sphere; nothing down here is hittable,
  // so nothing down here should look like it is.
  const close = new Mesh(new CylinderGeometry(0.098, 0.024, 0.16, 18), jointMat());
  close.scale.z = 0.78;
  close.position.y = -R * 0.68;
  g.add(close);

  return g;
}
