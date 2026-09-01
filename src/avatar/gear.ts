/**
 * GEAR — the attachments shop (DESIGN.md §5.2: "shapes, never colour").
 *
 * Coins buy SHAPES that bolt onto THE BLANK: crests, antennae, horns and
 * halos for the head; pauldrons, a chestplate, a collar, a dorsal ridge
 * and a belt for the body; knuckle spikes and cuffs for the hands. Every
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

import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, type Object3D, SphereGeometry, TorusGeometry } from 'three';
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
  { id: 'horns', name: 'HORNS', slot: 'head', price: 90, blurb: 'a bull\'s pair, swept back' },
  { id: 'halo', name: 'HALO', slot: 'head', price: 150, blurb: 'a ring that floats, no wire' },
  { id: 'mohawk', name: 'MOHAWK', slot: 'head', price: 120, blurb: 'a row of spikes over the crown' },
  { id: 'visorband', name: 'VISOR BAND', slot: 'head', price: 80, blurb: 'a wraparound band across the eyes' },
  // ── body ──────────────────────────────────────────────────────────────
  { id: 'pauldrons', name: 'PAULDRONS', slot: 'body', price: 100, blurb: 'plates on both shoulders' },
  { id: 'chestplate', name: 'CHESTPLATE', slot: 'body', price: 120, blurb: 'one plate over the heart' },
  { id: 'collar', name: 'COLLAR', slot: 'body', price: 80, blurb: 'a ruff ring under the head' },
  { id: 'ridge', name: 'RIDGE', slot: 'body', price: 140, blurb: 'a dorsal ridge down the spine' },
  { id: 'belt', name: 'BELT', slot: 'body', price: 60, blurb: 'a band round the waist, buckled' },
  { id: 'epaulettes', name: 'EPAULETTES', slot: 'body', price: 200, blurb: 'shoulder boards with a boss' },
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

const R = BODY_IK.headRadius;

type Builder = (mat: MeshStandardMaterial, side: 1 | -1) => Group;

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
    const g = new Group();
    for (const s of [-1, 1]) {
      const horn = new Group();
      // Three tapering segments, each bent a little further back and out.
      let r0 = R * 0.16;
      let len = R * 0.42;
      const seg = new Group();
      horn.add(seg);
      let cur: Object3D = seg;
      for (let i = 0; i < 3; i++) {
        const m = new Mesh(new CylinderGeometry(r0 * 0.7, r0, len, 12), mat);
        m.position.y = len / 2;
        cur.add(m);
        const next = new Group();
        next.position.y = len;
        next.rotation.z = -s * 0.35;
        next.rotation.x = 0.3;
        cur.add(next);
        cur = next;
        r0 *= 0.7;
        len *= 0.85;
      }
      const tip = new Mesh(new ConeGeometry(r0, len * 0.9, 12), mat);
      tip.position.y = len * 0.45;
      cur.add(tip);
      horn.position.set(s * R * 0.72, R * 0.62, -R * 0.05);
      horn.rotation.z = -s * 0.9;
      horn.rotation.x = -0.35;
      g.add(horn);
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
  visorband: (mat) => {
    const g = new Group();
    const band = new Mesh(new TorusGeometry(R * 0.86, R * 0.07, 8, 40, Math.PI * 1.3), mat);
    band.rotation.set(Math.PI / 2, 0, Math.PI * 0.35);
    band.scale.set(1, 1.02, 1);
    band.position.set(0, R * 0.12, 0);
    g.add(band);
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
  collar: (mat) => {
    const g = new Group();
    const ruff = new Mesh(new TorusGeometry(0.082, 0.03, 10, 36), mat);
    ruff.rotation.x = Math.PI / 2;
    ruff.position.set(0, 0.45, -0.028);
    ruff.scale.set(1.2, 1, 0.95);
    g.add(ruff);
    return g;
  },
  ridge: (mat) => {
    const g = new Group();
    // Down the spine (the back is +z): plates from the nape to the hips.
    // The back's half-depth by height (BODY_RINGS d, top to hips).
    const depth = [0.062, 0.09, 0.1, 0.098, 0.09, 0.077, 0.074, 0.086, 0.1, 0.104];
    for (let i = 0; i < depth.length; i++) {
      const t = i / (depth.length - 1);
      const y = 0.44 - t * 0.47;
      const h = 0.045 + Math.sin(t * Math.PI) * 0.035;
      const p = new Mesh(new BoxGeometry(0.024, 0.055, h), mat);
      p.position.set(0, y, depth[i] + h * 0.35 - 0.004);
      p.rotation.x = 0.5;
      g.add(p);
    }
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
  epaulettes: (mat) => {
    const g = new Group();
    for (const s of [-1, 1]) {
      // A board that reaches PAST the shoulder line, and a boss at its tip.
      const board = new Mesh(new BoxGeometry(0.13, 0.022, 0.09), mat);
      board.position.set(s * 0.19, 0.41, 0);
      board.rotation.z = -s * 0.3;
      g.add(board);
      const boss = new Mesh(new SphereGeometry(0.032, 14, 10), mat);
      boss.position.set(s * 0.245, 0.4, 0);
      g.add(boss);
    }
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
  gauntlets: (mat) => {
    const g = new Group();
    const plate = new Mesh(new BoxGeometry(0.084, 0.012, 0.1), mat);
    plate.position.set(0, 0.02, 0.01);
    g.add(plate);
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
    const id = want.get(slot) ?? '';
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
    const g = build(primer(tone), side);
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
