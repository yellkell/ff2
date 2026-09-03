/**
 * GEAR — the attachments shop (DESIGN.md §5.2: "shapes, never colour").
 *
 * Coins buy SHAPES that bolt onto THE BLANK: crests, antennae, horns and
 * halos for the head; pauldrons, a chestplate, a TAIL and a belt for the
 * body; knuckle spikes and cuffs for the hands. (A COLLAR and a dorsal
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

import { BoxGeometry, BufferGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, type Object3D, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { BODY_IK } from '../config.js';
import type { BlankTone } from './mannequin.js';

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
  const ring = sides + 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * ring + j;
      const c = a + ring;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
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

type Builder = (mat: MeshStandardMaterial, side: 1 | -1, trim: MeshStandardMaterial) => Group;

const BUILDERS: Record<string, Builder> = {
  /* head — origin at the head centre, front −z, skull ~R×(0.84, 1.08, 0.93) */
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
  pauldrons: (mat) => {
    const g = new Group();
    for (const s of [-1, 1]) {
      const pad = new Mesh(new SphereGeometry(0.1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), mat);
      pad.scale.set(1.1, 0.8, 1.05);
      pad.position.set(s * 0.215, 0.385, 0);
      pad.rotation.z = -s * 0.45;
      g.add(pad);
    }
    return g;
  },
  chestplate: (mat) => {
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
    // A rolled edge along the rim so the plate has a visible thickness.
    // The plate's THICKNESS: a second, inner skin 10 mm behind the outer
    // one, and a wall of quads joining their rims — a closed slab that
    // casts a real edge.
    const inner: number[] = [];
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1];
      const z = pos[i + 2];
      const len = Math.hypot(x, z) || 1;
      inner.push(x - (x / len) * 0.012, y, z - (z / len) * 0.012);
    }
    const n = pos.length / 3;
    const all = [...pos, ...inner];
    const tri = [...idx, ...idx.map((i) => i + n).reverse()];
    // Side walls around the outline: top row, bottom row, and both edge columns.
    const wall = (a0: number, a1: number): void => {
      tri.push(a0, a1, a0 + n, a1, a1 + n, a0 + n);
    };
    const rowsN = rows.length;
    for (let c = 0; c < cols; c++) {
      wall(c + 1, c); // bottom edge (y = rows[0])
      const top = (rowsN - 1) * (cols + 1);
      wall(top + c, top + c + 1); // top edge
    }
    for (let r = 0; r < rowsN - 1; r++) {
      wall(r * (cols + 1), (r + 1) * (cols + 1)); // left column
      wall((r + 1) * (cols + 1) + cols, r * (cols + 1) + cols); // right column
    }
    const slab = new BufferGeometry();
    slab.setAttribute('position', new Float32BufferAttribute(all, 3));
    slab.setIndex(tri);
    slab.computeVertexNormals();
    const slabMat = mat.clone();
    slabMat.side = DoubleSide; // the hand-wound slab must never cull itself away
    g.add(new Mesh(slab, slabMat));
    return g;
  },
  tail: (mat) => {
    // A TAIL, where a dorsal ridge used to be. One tapered tube along a
    // spline (the horns' own taperedTube): rooted in the small of the
    // back, swept back and down under its own weight, and flicked UP at
    // the tip so it reads as a tail rather than a hanging cable. Flat
    // shaded, so the facets segment it like plate.
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
      [0, 0.125, 0.074], // the root, small of the back
      [0, 0.088, 0.185],
      [0, 0.022, 0.276],
      [0, -0.052, 0.336],
      [0, -0.104, 0.376],
      [0, -0.106, 0.428], // the flick
      [0, -0.068, 0.462],
    ].map(([x, y, z]) => new Vector3(x, y, z));
    g.add(new Mesh(taperedTube(pts, 0.044, 0.009, 32, 7), faceted));
    // A boss where it meets the back, so the root reads as seated.
    const boss = new Mesh(new SphereGeometry(0.05, 10, 8), faceted);
    boss.position.copy(pts[0]);
    boss.scale.set(1, 0.92, 0.8);
    g.add(boss);
    return g;
  },
  belt: (mat) => {
    const g = new Group();
    const band = new Mesh(new TorusGeometry(0.058, 0.016, 8, 40), mat);
    band.rotation.x = Math.PI / 2;
    band.scale.set(1.68, 1, 1.38);
    band.position.set(0, 0.13, 0);
    g.add(band);
    const buckle = new Mesh(new BoxGeometry(0.04, 0.034, 0.014), mat);
    buckle.position.set(0, 0.13, -0.086);
    g.add(buckle);
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
    const cuff = asTrim(new Mesh(new CylinderGeometry(0.052, 0.06, 0.05, 24, 1, true), trimMat));
    cuff.material = trimMat.clone();
    (cuff.material as MeshStandardMaterial).side = DoubleSide;
    cuff.rotation.x = Math.PI / 2;
    cuff.position.set(0, 0.0, 0.066);
    cuff.scale.set(1, 0.72, 1);
    g.add(cuff);
    return g;
  },
};

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
    const slot = SLOT_OF_NAME[o.name];
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
    const side: 1 | -1 = o.name === 'opponent-glove-right' ? -1 : 1;
    const g = build(primer(tone), side, trim(tone));
    g.name = 'gear';
    g.userData.gear = id;
    // A PAINT SURFACE (avatar/paint.ts): every mesh of the piece wears its
    // slot's canvas, so the bay can place stripes, dots and squares on it
    // and a pauldron's twin gets the same paint. Each mesh takes its own
    // material (the bake sets a map per mesh) and the piece is NOT
    // collapsed — the merge would drop the UVs the paint samples by.
    const part = slot === 'head' ? 'gearHead' : slot === 'body' ? 'gearBody' : 'gearHands';
    g.traverse((m) => {
      const mesh = m as Mesh;
      if (!mesh.isMesh) return;
      mesh.material = (mesh.material as MeshStandardMaterial).clone();
      // Trim keeps its own finish: no part tag, so the bake walks past it.
      if (mesh.userData.trim) return;
      mesh.userData.paintPart = part;
      mesh.userData.paintTone = tone;
    });
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
