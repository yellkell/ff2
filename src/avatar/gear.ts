/**
 * GEAR — the attachments shop (DESIGN.md §5.2: "shapes, never colour").
 *
 * Coins buy SHAPES that bolt onto THE BLANK: crests, antennae, horns and
 * halos for the head; pauldrons, SPIKED PADS, a chestplate, a TAIL and a
 * belt for the body; knuckle spikes and cuffs for the hands. Every piece
 * can be seen worn, front and back, on one sheet: `npm run gear:gallery`
 * (tools/gear-gallery.mjs, with the dev server up). (A COLLAR and a dorsal
 * RIDGE were sold for a while and withdrawn — the collar never sat right
 * on the loft, and the ridge was a 24 mm strip laid along the spine using
 * the loft's half-depths while ignoring the forward LEAN of its upper
 * rings, so the top of it sank inside the back and the rest was too thin
 * to find. Both ids are retired, not reused: an old save still naming one
 * just wears nothing on the body, because cleanGear drops what the
 * catalogue no longer knows.) Every
 * piece is sold in the body's own primer — white on a blank, black on an
 * onyx — so identity still comes from what you bolt on and what you paint,
 * never from a catalogue of colours. Gear is PURELY VISUAL: it parents to
 * the rig's head / body / glove groups and the BODY_IK hitboxes never
 * move, so a horned fighter is exactly as hittable as a bare one.
 *
 * One piece per SLOT (head · body · hands). The equipped set is three ids,
 * packed for the wire as a short comma-joined string that every receiver
 * re-validates against this catalogue (unknown id → dropped, one per slot,
 * hard length cap) — the same fail-soft law as THE PAINT's look.
 *
 * Local frames (see avatar/mannequin.ts + avatar/hands.ts): the HEAD group
 * sits at the head centre, front −z, skull radius BODY_IK.headRadius; the
 * BODY group is planted at the hips, +y up, front −z — BODY_RINGS are
 * HALF-extents: the shoulder line at y≈0.395 spans ±0.252, the chest at
 * y≈0.29 is ±0.166 wide and ±0.10 deep, the waist pinch at y≈0.13 is
 * ±0.09 by ±0.074; each HAND group has its palm at the origin, fingers
 * toward −z, the cuff toward +z.
 */

import { BoxGeometry, BufferGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, type Object3D, Quaternion, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import { BODY_IK, PAINT } from '../config.js';
import { EGG_SCALE, HEAD_SCALE, type BlankTone } from './mannequin.js';
import { atlasGear } from './gearAtlas.js';

export type GearSlot = 'head' | 'body' | 'hands';
export const GEAR_SLOTS: readonly GearSlot[] = ['head', 'body', 'hands'];

export interface GearDef {
  id: string;
  name: string;
  slot: GearSlot;
  /** Coins. */
  price: number;
  /** One line for the tile. */
  blurb: string;
}

/** The catalogue — ids are wire-stable, never renamed. */
export const GEAR: GearDef[] = [
  // ── head ──────────────────────────────────────────────────────────────
  { id: 'crest', name: 'CREST', slot: 'head', price: 60, blurb: 'a dorsal fin, nose to nape' },
  { id: 'antennae', name: 'ANTENNAE', slot: 'head', price: 60, blurb: 'twin whips off the temples' },
  { id: 'horns', name: 'HORNS', slot: 'head', price: 90, blurb: 'a ram\'s pair, curled round' },
  { id: 'halo', name: 'HALO', slot: 'head', price: 150, blurb: 'a ring that floats, no wire' },
  { id: 'mohawk', name: 'MOHAWK', slot: 'head', price: 120, blurb: 'a row of spikes over the crown' },
  { id: 'visorband', name: 'VISOR BAND', slot: 'head', price: 80, blurb: 'a wraparound band across the eyes' },
  // ── body ──────────────────────────────────────────────────────────────
  { id: 'pauldrons', name: 'PAULDRONS', slot: 'body', price: 100, blurb: 'plates on both shoulders' },
  { id: 'chestplate', name: 'CHESTPLATE', slot: 'body', price: 120, blurb: 'one plate over the heart' },
  { id: 'tail', name: 'TAIL', slot: 'body', price: 140, blurb: 'swept back off the spine, tip flicked up' },
  { id: 'belt', name: 'BELT', slot: 'body', price: 60, blurb: 'a band round the waist, buckled' },
  // ── hands ─────────────────────────────────────────────────────────────
  { id: 'cuffs', name: 'CUFFS', slot: 'hands', price: 60, blurb: 'a ring at each wrist' },
  { id: 'knuckles', name: 'KNUCKLES', slot: 'hands', price: 120, blurb: 'four spikes over the fist' },
  { id: 'gauntlets', name: 'GAUNTLETS', slot: 'hands', price: 180, blurb: 'a plate over the back of each hand' },
  // ── the second wave — APPENDED, because the store's tile ids are the
  // catalogue indices and the probes (tools/wrap-check.mjs) know CUFFS as
  // the tenth. A new piece goes on the end, never in among its slot. ──
  { id: 'crown', name: 'CROWN', slot: 'head', price: 240, blurb: 'a circlet, six points rising' },
  { id: 'antlers', name: 'ANTLERS', slot: 'head', price: 200, blurb: "a stag's pair, branched" },
  { id: 'wings', name: 'WINGS', slot: 'body', price: 320, blurb: 'swept plates off the shoulder blades' },
  { id: 'claws', name: 'CLAWS', slot: 'hands', price: 200, blurb: 'three talons over the knuckles' },
  // ── the third wave (appended, as ever) ──
  { id: 'spikepads', name: 'SPIKED PADS', slot: 'body', price: 220, blurb: 'layered plates, three spikes a side' },
];

export function gearDef(id: string): GearDef | undefined {
  return GEAR.find((g) => g.id === id);
}

/** Hard caps: the wire string and what it may carry. */
const WIRE_MAX = 48;

/**
 * Validate a set of gear ids (any order, any junk) down to at most one KNOWN
 * id per slot, in slot order. Everything the wire brings goes through here.
 */
export function cleanGear(ids: readonly string[] | string | undefined | null): string[] {
  const list = typeof ids === 'string' ? (ids.length > WIRE_MAX ? [] : ids.split(',')) : Array.isArray(ids) ? ids : [];
  const bySlot = new Map<GearSlot, string>();
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const def = gearDef(raw.trim());
    if (!def || bySlot.has(def.slot)) continue;
    bySlot.set(def.slot, def.id);
  }
  return GEAR_SLOTS.map((s) => bySlot.get(s)).filter((v): v is string => !!v);
}

/** The wire form: comma-joined slot-ordered ids ('' = bare). */
export function packGear(ids: readonly string[]): string {
  return cleanGear(ids).join(',');
}

/* ── the shapes ──────────────────────────────────────────────────────── */

/** The body's own primer — gear is sold uncoloured, and it matches the
 *  blank it's bolted to (white or onyx). No role tags: immune to every
 *  recolour, like the body itself. */
function primer(tone: BlankTone): MeshStandardMaterial {
  // The body's tone, one finish up: SATIN where the body is matte (white)
  // or gloss where it's satin (onyx). Same colour, so paint and tone
  // still rule; different sheen, so a plate laid on the body reads as a
  // plate and not as a lump of the body.
  return tone === 'white'
    ? new MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.38, metalness: 0.08, envMapIntensity: 1.2 })
    : new MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.22, metalness: 0.45, envMapIntensity: 1.3 });
}

/** THE TRIM — the one other finish a piece may carry: gunmetal on the
 *  white blank, pale steel on the onyx, for a visor's glass, a gauntlet's
 *  ridges. Not a paint surface: the bake leaves it
 *  its own colour, so a dark slit stays dark across a primer plate
 *  instead of vanishing into it. */
function trim(tone: BlankTone): MeshStandardMaterial {
  return tone === 'white'
    ? new MeshStandardMaterial({ color: 0x24262c, roughness: 0.28, metalness: 0.75, envMapIntensity: 1.2 })
    : new MeshStandardMaterial({ color: 0xc8c4bc, roughness: 0.3, metalness: 0.6, envMapIntensity: 1.2 });
}

/** Mark a mesh as trim: it keeps its own material through the paint bake. */
function asTrim<T extends Mesh>(m: T): T {
  m.userData.trim = true;
  return m;
}

/**
 * A tube along a spline whose radius tapers from `r0` at the first point to
 * `r1` at the last — the shape of a horn, a tusk, a whip. three's own
 * TubeGeometry is constant-radius, so this walks a Catmull-Rom curve
 * through `pts`, builds a ring of `sides` vertices at each of `segs`
 * stations (Frenet frames, so the rings follow the bend), caps both ends,
 * and lays UVs u = round the ring, v = along the length so THE PAINT's
 * stripes and dots wrap it like any other piece.
 */
function taperedTube(pts: Vector3[], r0: number, r1: number, segs: number, sides: number): BufferGeometry {
  const curve = new CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  const frames = curve.computeFrenetFrames(segs, false);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = new Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, p);
    // Ease the taper: fat for the first half, then thinning to the point.
    const k = t < 0.5 ? (t / 0.5) * 0.22 : 0.22 + ((t - 0.5) / 0.5) * 0.78;
    const r = r0 + (r1 - r0) * k;
    const n = frames.normals[i];
    const b = frames.binormals[i];
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const cx = Math.cos(a) * r;
      const cy = Math.sin(a) * r;
      pos.push(p.x + n.x * cx + b.x * cy, p.y + n.y * cx + b.y * cy, p.z + n.z * cx + b.z * cy);
      uv.push(j / sides, t);
    }
  }
  // Winding: a Frenet ring runs N → B, and T × dp/dθ points INTO the
  // tube — so the quads are wound the other way round to face out. (They
  // were inside out until the cacti were built on the same loft: a closed
  // tube still shows its far inner wall, so the horns kept their shape,
  // but every normal pointed in and the light sat on the wrong side.)
  const ring = sides + 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * ring + j;
      const c = a + ring;
      idx.push(a, a + 1, c, a + 1, c + 1, c);
    }
  }
  // Caps: a centre vertex at each end fanned to its ring.
  const capRoot = pos.length / 3;
  curve.getPointAt(0, p);
  pos.push(p.x, p.y, p.z);
  uv.push(0.5, 0);
  for (let j = 0; j < sides; j++) idx.push(capRoot, j + 1, j);
  const capTip = pos.length / 3;
  curve.getPointAt(1, p);
  pos.push(p.x, p.y, p.z);
  uv.push(0.5, 1);
  const last = segs * ring;
  for (let j = 0; j < sides; j++) idx.push(capTip, last + j, last + j + 1);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const R = BODY_IK.headRadius;
const UP = new Vector3(0, 1, 0);

/**
 * ONE SHOULDER'S ARMOUR — the pauldron both pads are built from. A domed
 * CAP over the shoulder point, a LAME (a second, wider band of plate)
 * overlapping out from under its edge, and a rim of trim along each lower
 * edge so the plates read as plates and not as one lump. It is SEATED:
 * centred just inside the shoulder point (BODY_RINGS' widest ring is
 * ±0.252 at y 0.395) and tilted to the slope of the shoulder, so it
 * rests on the body instead of standing clear of it like a shell.
 * `k` scales the whole pad; `spikes` studs the cap (the SPIKED PADS).
 */
function shoulderPad(mat: MeshStandardMaterial, trimMat: MeshStandardMaterial, s: 1 | -1, k: number, spikes: boolean): Group {
  const pad = new Group();
  pad.position.set(s * 0.2, 0.388, 0.004);
  pad.rotation.z = -s * 0.36;
  // THE CAP: an ellipsoid dome, (a, b, c) its half-extents.
  const a = 0.104 * k;
  const b = 0.07 * k;
  const c = 0.118 * k;
  const capY = -0.018 * k;
  const cap = new Mesh(new SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI * 0.43), mat);
  cap.scale.set(a, b, c);
  cap.position.y = capY;
  pad.add(cap);
  // THE LAME: a band of the same dome, a size up, lower, overlapping.
  const lame = new Mesh(new SphereGeometry(1, 28, 4, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.17), mat);
  lame.scale.set(a * 1.07, b, c * 1.06);
  lame.position.y = capY - 0.012 * k;
  pad.add(lame);
  // THE RIMS: a thin roll of trim along each plate's lower edge.
  const rim = (theta: number, sx: number, sz: number, y: number): void => {
    const ring = asTrim(new Mesh(new TorusGeometry(1, 0.045, 6, 40), trimMat));
    ring.rotation.x = Math.PI / 2;
    const rr = Math.sin(theta);
    ring.scale.set(sx * rr, sz * rr, 0.1 * k);
    ring.position.y = y + Math.cos(theta) * b;
    pad.add(ring);
  };
  rim(Math.PI * 0.43, a, c, capY);
  rim(Math.PI * 0.57, a * 1.07, c * 1.06, capY - 0.012 * k);
  if (spikes) {
    // Three spikes up out of the cap: the big one off the top, leaning
    // out over the arm, and a smaller one fore and aft. Each rises along
    // the dome's own normal from a trim collar, so it looks driven
    // through the plate, not glued to it.
    const spec: Array<[number, number, number, number]> = [
      [s * 0.42, 1, 0, 0.1],
      [s * 0.62, 0.8, -0.62, 0.07],
      [s * 0.62, 0.8, 0.62, 0.07],
    ];
    for (const [dx, dy, dz, len] of spec) {
      const dir = new Vector3(dx, dy, dz).normalize();
      // Where that direction leaves the ellipsoid, and the normal there.
      const t = 1 / Math.sqrt((dir.x / a) ** 2 + (dir.y / b) ** 2 + (dir.z / c) ** 2);
      const at = dir.clone().multiplyScalar(t).add(new Vector3(0, capY, 0));
      const n = new Vector3((dir.x * t) / (a * a), (dir.y * t) / (b * b), (dir.z * t) / (c * c)).normalize();
      const q = new Quaternion().setFromUnitVectors(UP, n);
      const L = len * k;
      const spike = new Mesh(new ConeGeometry(0.014 * k, L, 12), mat);
      spike.quaternion.copy(q);
      spike.position.copy(at).addScaledVector(n, L / 2 - 0.003);
      pad.add(spike);
      const collar = asTrim(new Mesh(new TorusGeometry(0.0155 * k, 0.0035 * k, 6, 16), trimMat));
      collar.quaternion.copy(q).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2));
      collar.position.copy(at).addScaledVector(n, 0.002);
      pad.add(collar);
    }
  }
  return pad;
}

/** A feather-blade outline, root at the origin, tip at +x (mirrored for
 *  s = −1): full near the root, tapering to a point that lifts a hair. */
function bladeShape(len: number, w: number, s: 1 | -1): Shape {
  const sh = new Shape();
  const X = (x: number): number => x * s;
  sh.moveTo(X(0), -w * 0.32);
  sh.quadraticCurveTo(X(len * 0.2), -w * 0.56, X(len * 0.62), -w * 0.34);
  sh.quadraticCurveTo(X(len * 0.9), -w * 0.18, X(len), w * 0.08);
  sh.quadraticCurveTo(X(len * 0.72), w * 0.5, X(len * 0.2), w * 0.5);
  sh.quadraticCurveTo(X(len * 0.04), w * 0.46, X(0), w * 0.3);
  sh.closePath();
  return sh;
}

type Builder = (mat: MeshStandardMaterial, side: 1 | -1, trim: MeshStandardMaterial) => Group;

const BUILDERS: Record<string, Builder> = {
  /* head — origin at the head centre, front −z. Modelled on the old EGG
   * skull, R×(0.84, 1.08, 0.93) (mannequin.ts EGG_SCALE); applyGear
   * stretches the whole piece onto whatever the skull is now. */
  crest: (mat) => {
    const g = new Group();
    // A fin from the brow over the crown to the nape: eleven plates, each
    // standing PROUD of the skull by its full height, thinning aft.
    for (let i = 0; i < 11; i++) {
      const t = i / 10;
      const z = R * (0.7 - t * 1.55);
      const h = R * (0.35 + Math.sin(t * Math.PI) * 0.6);
      const p = new Mesh(new BoxGeometry(R * 0.1, h, R * 0.19), mat);
      const y = Math.sqrt(Math.max(0, 1 - (z / (R * 0.93)) ** 2)) * R * 1.08;
      p.position.set(0, y + h * 0.45 - R * 0.06, z);
      p.rotation.x = -(t - 0.5) * 1.1;
      g.add(p);
    }
    return g;
  },
  antennae: (mat) => {
    const g = new Group();
    for (const s of [-1, 1]) {
      const base = new Mesh(new CylinderGeometry(R * 0.06, R * 0.09, R * 0.2, 10), mat);
      base.position.set(s * R * 0.7, R * 0.55, -R * 0.1);
      base.rotation.z = -s * 0.5;
      g.add(base);
      const whip = new Mesh(new CylinderGeometry(R * 0.02, R * 0.045, R * 1.3, 8), mat);
      whip.position.set(s * R * 1.0, R * 1.2, -R * 0.2);
      whip.rotation.z = -s * 0.45;
      whip.rotation.x = 0.25;
      g.add(whip);
      const tip = new Mesh(new SphereGeometry(R * 0.07, 10, 8), mat);
      tip.position.set(s * R * 1.28, R * 1.78, -R * 0.35);
      g.add(tip);
    }
    return g;
  },
  horns: (mat) => {
    // THE RAM'S CURL. Each horn is ONE tapered tube along a spline: it
    // roots thick at the temple, climbs out and up, rolls BACK over the
    // ear, drops behind the jaw and sweeps FORWARD again so the point
    // ends level with the eye, just wide of the cheek — the full curl of
    // a ram seen side-on. Seven flat-shaded facets round, so it reads as
    // carved plate like the rest of the kit, not a smooth banana. (The
    // old pair were three stubby cylinders bent back like a bull's.)
    //
    // The wearer never SEES their own: applyGear skips the head slot on a
    // rig flagged first-person (below), and the arena never renders the
    // local head at all — a curl this size would otherwise hang in the
    // corner of both eyes for the whole bout.
    const g = new Group();
    const faceted = mat.clone();
    faceted.flatShading = true;
    for (const s of [-1, 1]) {
      const pts = [
        [0.7, 0.42, -0.02], // the root, on the temple
        [1.22, 0.92, 0.14], // out and up, thick
        [1.66, 1.02, 0.7], // rolling back over the ear
        [1.9, 0.5, 1.12], // the back of the curl, well wide of the skull
        [1.92, -0.22, 1.02], // dropping behind the jaw
        [1.82, -0.62, 0.5], // the low turn
        [1.8, -0.66, -0.2], // sweeping forward past the cheek
        [1.96, -0.48, -0.74], // the point, forward of the face, wide
        [2.08, -0.36, -1.02], // the tip lifting a hair
      ].map(([x, y, z]) => new Vector3(s * x * R, y * R, z * R));
      g.add(new Mesh(taperedTube(pts, R * 0.44, R * 0.05, 34, 7), faceted));
      // A boss where the horn meets the skull, so the root reads as seated.
      const boss = new Mesh(new SphereGeometry(R * 0.46, 9, 7), faceted);
      boss.position.copy(pts[0]);
      boss.scale.set(1, 0.9, 1.05);
      g.add(boss);
    }
    return g;
  },
  halo: (mat) => {
    const g = new Group();
    const ring = new Mesh(new TorusGeometry(R * 0.78, R * 0.055, 10, 40), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = R * 1.5;
    g.add(ring);
    return g;
  },
  mohawk: (mat) => {
    const g = new Group();
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const z = R * (0.55 - t * 1.15);
      const y = Math.sqrt(Math.max(0, 1 - (z / (R * 0.93)) ** 2)) * R * 1.08;
      const h = R * (0.5 + Math.sin(t * Math.PI) * 0.35);
      const spike = new Mesh(new ConeGeometry(R * 0.11, h, 10), mat);
      spike.position.set(0, y + h * 0.42, z);
      spike.rotation.x = -(t - 0.45) * 0.8;
      g.add(spike);
    }
    return g;
  },
  visorband: (mat, _side, trimMat) => {
    // A VISOR, not a hoop: a wraparound plate across the eyes — a thin
    // open cylinder segment hugging the skull, taller than it is thick,
    // with a dark slit and a brow bar along its top. The old torus wore
    // like a bent wire and read as a headband slipping off.
    const g = new Group();
    const arc = Math.PI * 1.15;
    const plate = new Mesh(
      new CylinderGeometry(R * 0.98, R * 1.0, R * 0.34, 40, 1, true, Math.PI - arc / 2, arc),
      mat,
    );
    plate.material = mat.clone();
    (plate.material as MeshStandardMaterial).side = DoubleSide;
    plate.position.set(0, R * 0.1, -R * 0.02);
    plate.scale.set(0.9, 1, 1.02);
    g.add(plate);
    // The slit: the visor's glass, a dark band across the middle — trim,
    // so it stays dark whatever the plate is painted.
    const slitMat = trimMat.clone();
    slitMat.side = DoubleSide;
    const slit = asTrim(new Mesh(
      new CylinderGeometry(R * 1.01, R * 1.01, R * 0.12, 40, 1, true, Math.PI - arc * 0.42, arc * 0.84),
      slitMat,
    ));
    slit.position.copy(plate.position);
    slit.scale.copy(plate.scale);
    g.add(slit);
    // The brow bar over the top edge, a hair proud, in the trim too.
    const brow = asTrim(new Mesh(new TorusGeometry(R * 0.93, R * 0.03, 8, 40, arc), trimMat));
    brow.rotation.set(Math.PI / 2, 0, Math.PI / 2 - arc / 2 + Math.PI);
    brow.position.set(0, R * 0.28, -R * 0.02);
    brow.scale.set(0.9, 1.02, 1);
    g.add(brow);
    return g;
  },

  /* body — origin at the hips, +y up, front −z, shoulders at (±0.126, 0.395) */
  pauldrons: (mat, _side, trimMat) => {
    // Plate on both shoulders — cap, lame and rims (shoulderPad), seated
    // on the shoulder. (They were bare half-spheres standing clear of the
    // body, and read as a pair of shells.)
    const g = new Group();
    for (const s of [-1, 1] as const) g.add(shoulderPad(mat, trimMat, s, 1, false));
    return g;
  },
  chestplate: (mat, _side, trimMat) => {
    const g = new Group();
    // A shell LOFTED over the chest's own profile (the body's ring table,
    // shoulder line to waist), pushed a whisker proud of the surface and
    // spanning the front ±62° — so it sits ON the body like a plate,
    // never pokes through it like a ball.
    const rows: Array<[number, number, number, number]> = [
      // y, half-width, half-depth, z-offset (BODY_RINGS, mannequin.ts)
      [0.2, 0.105, 0.082, 0],
      [0.23, 0.124, 0.09, 0],
      [0.29, 0.166, 0.1, 0],
      [0.35, 0.226, 0.098, 0],
      [0.385, 0.244, 0.09, 0],
      [0.41, 0.19, 0.08, -0.006],
    ];
    const cols = 12;
    const span = Math.PI * 0.6; // ±54°
    const pos: number[] = [];
    const idx: number[] = [];
    rows.forEach(([y, hw, hd, zo], r) => {
      for (let c = 0; c <= cols; c++) {
        const th = -span / 2 + (c / cols) * span;
        // Proud by 16 mm, a touch more at the centre so the plate crowns
        // and throws an edge shadow onto the body beneath it.
        const proud = 1 + 0.018 / hd + 0.06 * Math.cos(th);
        pos.push(Math.sin(th) * hw * proud, y, -Math.cos(th) * hd * proud + zo);
        if (r < rows.length - 1 && c < cols) {
          const i0 = r * (cols + 1) + c;
          const i1 = i0 + cols + 1;
          idx.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1);
        }
      }
    });
    // The plate's THICKNESS: a second, inner skin 12 mm behind the outer
    // one, and a wall of quads joining their rims — a closed slab that
    // casts a real edge. Three islands for THE PAINT's atlas (outer skin,
    // inner skin, the walls on vertices of their own), each with UVs laid
    // across its grid, so the plate can be painted like any other piece.
    const inner: number[] = [];
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1];
      const z = pos[i + 2];
      const len = Math.hypot(x, z) || 1;
      inner.push(x - (x / len) * 0.012, y, z - (z / len) * 0.012);
    }
    const n = pos.length / 3;
    const rowsN = rows.length;
    const gridUv: number[] = [];
    for (let r = 0; r < rowsN; r++) for (let c = 0; c <= cols; c++) gridUv.push(c / cols, r / (rowsN - 1));
    const all = [...pos, ...inner];
    const uvs = [...gridUv, ...gridUv];
    const outerTri = idx;
    const innerTri = idx.map((i) => i + n).reverse();
    // Side walls around the outline, each quad on four fresh vertices.
    const wallTri: number[] = [];
    let run = 0;
    const wall = (a0: number, a1: number): void => {
      const base = all.length / 3;
      for (const v of [a0, a1, a0 + n, a1 + n]) all.push(all[v * 3], all[v * 3 + 1], all[v * 3 + 2]);
      uvs.push(run, 0, run + 1, 0, run, 1, run + 1, 1);
      run += 1;
      wallTri.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    };
    for (let c = 0; c < cols; c++) {
      wall(c + 1, c); // bottom edge (y = rows[0])
      const top = (rowsN - 1) * (cols + 1);
      wall(top + c, top + c + 1); // top edge
    }
    for (let r = 0; r < rowsN - 1; r++) {
      wall(r * (cols + 1), (r + 1) * (cols + 1)); // left column
      wall((r + 1) * (cols + 1) + cols, r * (cols + 1) + cols); // right column
    }
    for (let i = uvs.length - run * 8; i < uvs.length; i += 2) uvs[i] /= run; // walls: one strip, 0..1
    const slab = new BufferGeometry();
    slab.setAttribute('position', new Float32BufferAttribute(all, 3));
    slab.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    slab.setIndex([...outerTri, ...innerTri, ...wallTri]);
    slab.addGroup(0, outerTri.length, 0);
    slab.addGroup(outerTri.length, innerTri.length, 0);
    slab.addGroup(outerTri.length + innerTri.length, wallTri.length, 0);
    slab.computeVertexNormals();
    const slabMat = mat.clone();
    slabMat.side = DoubleSide; // the hand-wound slab must never cull itself away
    g.add(new Mesh(slab, slabMat));
    // The plate was the body's own white laid on the body's own white, and
    // read as nothing but its edge. A roll of TRIM round all four edges
    // draws its outline, and a raised RIDGE down the sternum
    // (in the plate's primer, so it takes paint) gives it a keel.
    const along = (row: number | null, col: number | null, out: number): Vector3[] => {
      const pts: Vector3[] = [];
      const count = row !== null ? cols + 1 : rowsN;
      for (let i = 0; i < count; i++) {
        const v = row !== null ? row * (cols + 1) + i : i * (cols + 1) + (col as number);
        const x = pos[v * 3];
        const z = pos[v * 3 + 2];
        const len = Math.hypot(x, z) || 1;
        pts.push(new Vector3(x + (x / len) * out, pos[v * 3 + 1], z + (z / len) * out));
      }
      return pts;
    };
    // All four edges: a frame, so the plate's outline reads from any side.
    const edges: Vector3[][] = [along(0, null, 0.002), along(rowsN - 1, null, 0.002), along(null, 0, 0.002), along(null, cols, 0.002)];
    for (const pts of edges) {
      g.add(asTrim(new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), pts.length * 3, 0.0055, 6), trimMat)));
    }
    g.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(along(null, cols / 2, 0.002)), 16, 0.007, 8), mat));
    return g;
  },
  tail: (mat) => {
    // A TAIL, where a dorsal ridge used to be. ONE tapered tube along a
    // spline (the horns' own taperedTube), rooted INSIDE the small of the
    // back so it grows out of the surface with no seam and no boss to
    // mark the join, swept back and down, and tapering all the way to a
    // POINT. Flat shaded, so the facets segment it like plate.
    //
    // The ridge it replaces was invisible in play. It sat a 24 mm strip
    // along the spine positioned from BODY_RINGS' half-depths alone —
    // but the upper rings carry a forward `z` lean (the trapezius meets
    // the neck ahead of the chest), so the top plates were placed behind
    // where the back actually is and the whole piece read as nothing.
    // A tail hangs off the silhouette instead, where it cannot hide.
    const g = new Group();
    const faceted = mat.clone();
    faceted.flatShading = true;
    const pts = [
      [0, 0.132, 0.040], // the root, sunk INSIDE the small of the back
      [0, 0.116, 0.108],
      [0, 0.076, 0.196],
      [0, 0.016, 0.280],
      [0, -0.054, 0.338],
      [0, -0.104, 0.380],
      [0, -0.108, 0.430], // the flick
      [0, -0.072, 0.466],
    ].map(([x, y, z]) => new Vector3(x, y, z));
    // 1.5 mm at the tip: a point at any distance you will ever see it from,
    // without the degenerate ring a true zero would leave for the normals.
    g.add(new Mesh(taperedTube(pts, 0.046, 0.0015, 34, 7), faceted));
    return g;
  },
  belt: (mat, _side, trimMat) => {
    // A BAND round the waist, not a hoop: an open ring the shape of the
    // waist pinch itself (BODY_RINGS: ±0.090 by ±0.074 at y 0.13) set a
    // centimetre proud, flaring a touch to the hips, with a rolled edge
    // top and bottom and a buckle — a trim frame round a primer plate —
    // on the front. (It was a torus scaled to an ellipse: from anywhere
    // but square on it read as a hula hoop.)
    const g = new Group();
    const W = 0.101;
    const D = 0.085;
    const band = new Mesh(new CylinderGeometry(1, 1.035, 0.034, 56, 1, true), mat);
    band.scale.set(W, 1, D);
    band.position.y = 0.13;
    g.add(band);
    for (const [y, k] of [[0.147, 1.0], [0.113, 1.035]] as const) {
      const edge = new Mesh(new TorusGeometry(1, 0.0042 / W, 6, 56), mat);
      edge.rotation.x = Math.PI / 2;
      edge.scale.set(W * k, D * k, W);
      edge.position.y = y;
      g.add(edge);
    }
    const frame = asTrim(new Mesh(new BoxGeometry(0.042, 0.032, 0.008), trimMat));
    frame.position.set(0, 0.13, -D - 0.004);
    g.add(frame);
    const plate = new Mesh(new BoxGeometry(0.03, 0.02, 0.004), mat);
    plate.position.set(0, 0.13, -D - 0.009);
    g.add(plate);
    return g;
  },
  /* hands — palm at the origin, fingers −z, cuff +z (hands.ts) */
  cuffs: (mat) => {
    const g = new Group();
    const ring = new Mesh(new TorusGeometry(0.046, 0.011, 8, 28), mat);
    ring.rotation.x = 0; // the torus's hole runs along z: a bracelet round the wrist
    ring.scale.set(1, 0.7, 1);
    ring.position.z = 0.085;
    g.add(ring);
    return g;
  },
  knuckles: (mat, side) => {
    const g = new Group();
    for (let i = 0; i < 4; i++) {
      const x = side * (0.0285 - i * 0.019);
      const spike = new Mesh(new ConeGeometry(0.007, 0.03, 8), mat);
      spike.position.set(x, 0.02, -0.046);
      g.add(spike);
    }
    return g;
  },
  gauntlets: (mat, _side, trimMat) => {
    // A GAUNTLET, not a tile balanced on the hand: a back plate hugging
    // the top of the palm (palm block is 0.078 × 0.024 × 0.09, top face
    // at y = 0.012), three knuckle ridges across its leading edge, and a
    // flared cuff round the wrist behind it.
    const g = new Group();
    const plate = new Mesh(new BoxGeometry(0.086, 0.01, 0.084), mat);
    plate.position.set(0, 0.017, 0.006);
    g.add(plate);
    for (let i = 0; i < 3; i++) {
      const ridge = asTrim(new Mesh(new BoxGeometry(0.088, 0.008, 0.009), trimMat));
      ridge.position.set(0, 0.024, -0.022 + i * 0.02);
      g.add(ridge);
    }
    // The cuff: a short frustum open at both ends, wider toward the arm.
    // FITTED to the wrist: flattened top to bottom (its local z is the
    // hand's vertical once it is laid along the arm) so it hugs the
    // hand's own cuff box, 0.07 × 0.032, instead of hanging round it as
    // a dark hoop twice its height.
    const cuff = asTrim(new Mesh(new CylinderGeometry(0.04, 0.045, 0.03, 28, 1, true), trimMat));
    cuff.material = trimMat.clone();
    (cuff.material as MeshStandardMaterial).side = DoubleSide;
    cuff.rotation.x = Math.PI / 2;
    cuff.position.set(0, 0.0, 0.07);
    cuff.scale.set(1, 1, 0.5);
    g.add(cuff);
    return g;
  },
};

/* ── the second wave ─────────────────────────────────────────────────── */

const MORE_BUILDERS: Record<string, Builder> = {
  crown: (mat, _side, trimMat) => {
    // A circlet on the brow — the band in the trim, so it reads as a ring
    // of metal round the skull — with six points rising off it, the one
    // dead ahead tallest, each leaning a touch outward.
    const g = new Group();
    // The band is a band — a short open ring a hair wider at its foot,
    // the shape of the brow it sits on — where it was a wire.
    const bandMat = trimMat.clone();
    bandMat.side = DoubleSide;
    const band = asTrim(new Mesh(new CylinderGeometry(R * 0.84, R * 0.89, R * 0.17, 44, 1, true), bandMat));
    band.position.y = R * 0.64;
    band.scale.set(0.9, 1, 1.02);
    g.add(band);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2; // i = 0 sits at −z: the front
      const x = Math.cos(a) * R * 0.86 * 0.9;
      const z = Math.sin(a) * R * 0.86 * 1.02;
      const front = 0.5 - 0.5 * Math.sin(a);
      const h = R * (0.3 + front * 0.34);
      const point = new Mesh(new ConeGeometry(R * 0.075, h, 8), mat);
      point.position.set(x, R * 0.62 + h * 0.46, z);
      point.rotation.set(Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22);
      g.add(point);
    }
    return g;
  },
  antlers: (mat) => {
    // A stag's pair: each a tapered beam off the temple, climbing up and
    // back and curling in at the tip, with a brow tine forward and a
    // second tine off the middle. Faceted like the horns.
    const g = new Group();
    const faceted = mat.clone();
    faceted.flatShading = true;
    const tube = (pts: number[][], s: number, r0: number, r1: number, segs: number): Mesh =>
      new Mesh(taperedTube(pts.map(([x, y, z]) => new Vector3(s * x * R, y * R, z * R)), r0 * R, r1 * R, segs, 6), faceted);
    for (const s of [-1, 1]) {
      g.add(tube([[0.66, 0.6, -0.08], [0.92, 1.05, 0.05], [1.15, 1.55, 0.3], [1.2, 2.05, 0.55], [1.02, 2.45, 0.82]], s, 0.16, 0.03, 22));
      g.add(tube([[0.82, 0.92, -0.02], [0.98, 1.22, -0.4], [1.02, 1.42, -0.7]], s, 0.09, 0.02, 12)); // the brow tine
      g.add(tube([[1.12, 1.5, 0.28], [1.45, 1.75, 0.15], [1.7, 2.05, 0.05]], s, 0.09, 0.02, 12)); // the second tine
    }
    return g;
  },
  wings: (mat) => {
    // Two fans of swept blades off the shoulder blades: three per side,
    // the longest on top, each pivoting at the blade and raked up, out
    // and back — a silhouette that reads from across the arena.
    const g = new Group();
    for (const s of [-1, 1] as const) {
      for (let i = 0; i < 3; i++) {
        const len = 0.36 - i * 0.06;
        // A BLADE, not a slat: full at the root, tapering to a lifted
        // point, a few millimetres thick with its edges eased.
        const blade = new ExtrudeGeometry(bladeShape(len, 0.08 - i * 0.012, s), {
          depth: 0.005,
          bevelEnabled: true,
          bevelThickness: 0.0015,
          bevelSize: 0.0015,
          bevelSegments: 1,
          curveSegments: 10,
        });
        blade.translate(0, 0, -0.0025);
        const plate = new Mesh(blade, mat);
        const pivot = new Group();
        pivot.position.set(s * 0.11, 0.36 - i * 0.02, 0.09);
        // Roll lifts the plate; yaw sweeps it back (the back is +z). The
        // top plate stands nearly upright, the lower two fan out under it.
        pivot.rotation.set(0, -s * (0.55 + i * 0.22), s * (1.15 - i * 0.34));
        pivot.add(plate);
        g.add(pivot);
      }
    }
    return g;
  },
  claws: (mat) => {
    // Three talons rooted on the knuckle line, reaching forward past the
    // fingers and hooking down to a point. The palm block's front face is
    // at z ≈ −0.045; the roots sit just inside it.
    const g = new Group();
    const faceted = mat.clone();
    faceted.flatShading = true;
    for (const x of [-0.021, 0, 0.021]) {
      const pts = [
        [x, 0.014, -0.034],
        [x * 1.15, 0.03, -0.062],
        [x * 1.3, 0.022, -0.09],
        [x * 1.4, -0.004, -0.108],
        [x * 1.45, -0.03, -0.112],
      ].map(([px, py, pz]) => new Vector3(px, py, pz));
      g.add(new Mesh(taperedTube(pts, 0.009, 0.0012, 16, 6), faceted));
    }
    return g;
  },
};
/* ── the third wave ──────────────────────────────────────────────────── */

const THIRD_BUILDERS: Record<string, Builder> = {
  spikepads: (mat, _side, trimMat) => {
    // SPIKED PADS: the pauldron's cap-lame-rim armour a size up, with
    // three spikes driven up through each cap from trim collars — the big
    // one off the top, leaning out over the arm, one fore, one aft.
    const g = new Group();
    for (const s of [-1, 1] as const) g.add(shoulderPad(mat, trimMat, s, 1.14, true));
    return g;
  },
};

Object.assign(BUILDERS, MORE_BUILDERS, THIRD_BUILDERS);

/** The rig groups gear can hang off, by the names buildBoxer gives them. */
const SLOT_OF_NAME: Record<string, GearSlot> = {
  'opponent-head': 'head',
  'opponent-body': 'body',
  'opponent-glove-left': 'hands',
  'opponent-glove-right': 'hands',
};

/**
 * Dress a rig (or any subtree holding rig pieces) in a gear set. Finds the
 * head / body / glove groups by name, and under each keeps ONE child named
 * `gear` rebuilt only when that slot's piece or the tone changes — so
 * repeated calls with the same set cost nothing. `tone` picks the primer.
 */
export function applyGear(root: Object3D, ids: readonly string[], tone: BlankTone): void {
  const set = cleanGear(ids);
  const want = new Map<GearSlot, string>();
  for (const id of set) {
    const d = gearDef(id);
    if (d) want.set(d.slot, id);
  }
  root.traverse((o) => {
    // By name for the rig's head and body; by the tag buildHand leaves for
    // any glove — your own gloves are renamed 'player-glove-*' by the
    // arena and left nameless by the pub, and neither got its cuffs.
    const slot = SLOT_OF_NAME[o.name] ?? (o.userData.gearSlot as GearSlot | undefined);
    if (!slot) return;
    // THE WEARER'S OWN HEAD: gear on the head slot of a first-person rig
    // (userData.firstPerson — the arena's PlayerBodySystem flags its own
    // head) is never built. Your horns are for everyone else to see; from
    // inside the skull they would only sit in the edge of your vision.
    const id = slot === 'head' && o.userData.firstPerson ? '' : (want.get(slot) ?? '');
    const key = `${id}|${tone}`;
    if (o.userData.gearKey === key) return;
    o.userData.gearKey = key;
    const old = o.getObjectByName('gear');
    if (old) {
      old.removeFromParent();
      old.traverse((m) => {
        const mesh = m as Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          (mesh.material as MeshStandardMaterial).dispose?.();
        }
      });
    }
    const build = BUILDERS[id];
    if (!build) return;
    const side: 1 | -1 = (o.userData.gearSide as 1 | -1 | undefined) ?? (o.name.endsWith('-right') ? -1 : 1);
    const g = build(primer(tone), side, trim(tone));
    g.name = 'gear';
    g.userData.gear = id;
    // The head pieces were modelled on the old egg skull; refit them.
    if (slot === 'head') g.scale.set(HEAD_SCALE[0] / EGG_SCALE[0], HEAD_SCALE[1] / EGG_SCALE[1], HEAD_SCALE[2] / EGG_SCALE[2]);
    // A PAINT SURFACE (avatar/paint.ts): the piece shares its slot's
    // canvas, laid out by THE GEAR ATLAS (avatar/gearAtlas.ts) — every
    // mesh and every face its own patch of it, so each pauldron, plate and
    // spike takes paint of its own, and a mark is placed in 3D where it
    // was aimed. Each mesh takes its own material (the bake sets a map per
    // mesh) and the piece is NOT collapsed — the merge would drop the UVs.
    const part = slot === 'head' ? 'gearHead' : slot === 'body' ? 'gearBody' : 'gearHands';
    const paintable: Mesh[] = [];
    g.traverse((m) => {
      const mesh = m as Mesh;
      if (!mesh.isMesh) return;
      mesh.material = (mesh.material as MeshStandardMaterial).clone();
      // Trim keeps its own finish: no part tag, so the bake walks past it.
      if (mesh.userData.trim) return;
      mesh.userData.paintPart = part;
      mesh.userData.paintTone = tone;
      paintable.push(mesh);
    });
    const map = atlasGear(g, paintable, `${id}|${side}`, PAINT.canvas[part] ?? 256);
    for (const mesh of paintable) mesh.userData.paintMap = map;
    o.add(g);
  });
}

/** The gear a subtree is wearing right now (dev hooks / probes). */
export function wornGear(root: Object3D): string[] {
  const out: string[] = [];
  root.traverse((o) => {
    if (o.name === 'gear' && typeof o.userData.gear === 'string') out.push(o.userData.gear);
  });
  return out;
}
