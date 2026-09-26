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
 * One piece per SLOT (head · body · hands · face — the last is THE HEADS,
 * FF1's animals worn in place of the skull, avatar/heads.ts). The equipped
 * set is up to four ids, packed for the wire as a short comma-joined
 * string that every receiver re-validates against this catalogue (unknown
 * id → dropped, one per slot, hard length cap) — the same fail-soft law as
 * THE PAINT's look.
 *
 * Local frames (see avatar/mannequin.ts + avatar/hands.ts): the HEAD group
 * sits at the head centre, front −z, skull radius BODY_IK.headRadius; the
 * BODY group is planted at the hips, +y up, front −z — BODY_RINGS are
 * HALF-extents: the shoulder line at y≈0.395 spans ±0.252, the chest at
 * y≈0.29 is ±0.166 wide and ±0.10 deep, the waist pinch at y≈0.13 is
 * ±0.09 by ±0.074; each HAND group has its palm at the origin, fingers
 * toward −z, the cuff toward +z.
 */

import { BoxGeometry, BufferGeometry, CapsuleGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, LatheGeometry, Mesh, MeshStandardMaterial, type Object3D, Quaternion, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3 } from 'three';
import { BODY_IK, PAINT } from '../config.js';
import { BODY_RINGS, EGG_SCALE, HEAD_SCALE, type BlankTone } from './mannequin.js';
import { atlasGear, mergePiece } from './gearAtlas.js';
import { HEAD_FIT, HEAD_PIECES } from './heads.js';

/** 'face' is THE HEADS (avatar/heads.ts): a whole head worn in place of
 *  the bare skull. It came after the other three, so it packs LAST — the
 *  wire is slot-ordered, and an older reader simply drops an id it doesn't
 *  know. */
export type GearSlot = 'head' | 'body' | 'hands' | 'face';
export const GEAR_SLOTS: readonly GearSlot[] = ['head', 'body', 'hands', 'face'];

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
  // ── the fourth wave ──
  { id: 'vcrest', name: 'V-CREST', slot: 'head', price: 180, blurb: 'twin blades in a V off a brow emblem' },
  { id: 'earfins', name: 'EAR FINS', slot: 'head', price: 140, blurb: 'swept fins at the temples' },
  { id: 'thrusters', name: 'THRUSTERS', slot: 'body', price: 300, blurb: 'a jet pack, two lit nozzles' },
  { id: 'wristblades', name: 'WRIST BLADES', slot: 'hands', price: 220, blurb: 'a blade along each forearm' },
  // ── THE HEADS: FIRE FIGHT 1's animals, back on the blank (avatar/heads.ts).
  // Each replaces the bare skull; ids are the FF1 animals, never the old
  // skin ids (cobalt, crimson…), so nothing from the retired roster aliases.
  { id: 'bear', name: 'BEAR', slot: 'face', price: 400, blurb: 'a domed skull, a short deep muzzle' },
  { id: 'panther', name: 'PANTHER', slot: 'face', price: 400, blurb: 'all cheek, a slanted stare, whiskers' },
  { id: 'eagle', name: 'EAGLE', slot: 'face', price: 450, blurb: 'a hooked beak under a scowling brow' },
  { id: 'knight', name: 'KNIGHT', slot: 'face', price: 350, blurb: 'a great helm, a cross at the sight' },
  { id: 'stallion', name: 'STALLION', slot: 'face', price: 450, blurb: 'a long face, a swept mane' },
  { id: 'wolf', name: 'WOLF', slot: 'face', price: 450, blurb: 'a long muzzle, ears up, a ruff' },
  { id: 'frog', name: 'FROG', slot: 'face', price: 300, blurb: 'a wide flat grin, eyes up top' },
  { id: 'bunny', name: 'BUNNY', slot: 'face', price: 350, blurb: 'tall ears, buck teeth' },
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
 * THE GLOW — the third finish, and the only colour gear carries that the
 * wearer didn't paint: their own ACCENT, the hue they picked for their
 * fighter. One element per piece takes it — a halo's lip, a visor's slit,
 * a feeler's bulbs, a pad's rim — lit, not painted. Tagged
 * `accent: 'glow'`, so setAvatarAccent (avatar/boxer.ts) sets it with the
 * rest of the rig, and applyGear lights a freshly built piece in whatever
 * accent its rig already wears. Never a paint surface.
 */
const GLOW_DEFAULT = 0xff7a18;
function glow(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ color: GLOW_DEFAULT, emissive: GLOW_DEFAULT, emissiveIntensity: 1.15, roughness: 0.35, metalness: 0 });
  m.userData.accent = 'glow';
  return m;
}

/** Mark a mesh as glow: lit in the accent, left alone by the paint bake. */
function asGlow<T extends Mesh>(m: T): T {
  m.userData.trim = true;
  m.userData.glow = true;
  return m;
}

/** The accent a rig piece (or any ancestor) was last lit in, if any. */
function accentOf(o: Object3D): number | null {
  for (let p: Object3D | null = o; p; p = p.parent) {
    if (typeof p.userData.accentColor === 'number') return p.userData.accentColor as number;
  }
  return null;
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
const FWD = new Vector3(0, 0, 1);

/* ── the detail kit ──────────────────────────────────────────────────── */
//
// What turns a primitive into a piece of kit: a place it is MOUNTED (a
// collar, a boss, a hinge), EDGES that catch the light (a bevel, a rolled
// rim), and SMALL PARTS in the trim (rivets, bands, studs). Trim is never
// a paint surface, so none of this spends the piece's canvas.

/** The skull the head pieces are modelled on (the old egg, EGG_SCALE ×
 *  R, centred R/20 above the head's origin — mannequin.ts); applyGear
 *  stretches the piece onto the skull it actually gets. */
const EGG = { a: 0.84 * R, b: 1.08 * R, c: 0.93 * R, y0: 0.05 * R };

/** Where a ray from the skull's centre along `dir` leaves it, and the
 *  surface normal there. */
function eggPoint(dir: Vector3): { p: Vector3; n: Vector3 } {
  const d = dir.clone().normalize();
  const t = 1 / Math.sqrt((d.x / EGG.a) ** 2 + (d.y / EGG.b) ** 2 + (d.z / EGG.c) ** 2);
  const p = d.multiplyScalar(t).add(new Vector3(0, EGG.y0, 0));
  const n = new Vector3(p.x / EGG.a ** 2, (p.y - EGG.y0) / EGG.b ** 2, p.z / EGG.c ** 2).normalize();
  return { p, n };
}

/** A point on the skull's midline, `th` radians from the brow (front, −z)
 *  up over the crown to the nape (π, +z), with its normal and the
 *  direction along the midline toward the back. */
function eggMid(th: number): { p: Vector3; n: Vector3; back: Vector3 } {
  const at = eggPoint(new Vector3(0, Math.sin(th), -Math.cos(th)));
  const next = eggPoint(new Vector3(0, Math.sin(th + 0.01), -Math.cos(th + 0.01)));
  return { ...at, back: next.p.sub(at.p).normalize() };
}

/** Orient an object's +y along `dir`. */
function aim(o: Object3D, dir: Vector3): void {
  o.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
}

/** A rivet (a low dome) in the trim, at `at`, domed along `n`. */
/** THE BODY'S SKIN at height `y` (hip-local, BODY_RINGS interpolated as
 *  the loft interpolates them): half-width, half-depth, fore/aft centre —
 *  or null above the neck, where there is no body to meet. */
function skinAt(y: number): { w: number; d: number; z: number } | null {
  const R = BODY_RINGS;
  return y > R[0].y || y < R[R.length - 1].y ? null : bodyRing(y);
}

/**
 * SEAT a body piece ON the body: bake the mesh's placement into its
 * geometry (body-local — body gear hangs at the body group's origin), and
 * push every vertex that falls inside the loft, or within `gap` of it,
 * straight out from the spine to `gap` above the skin. The outside of the
 * piece keeps its shape; only what would have been buried is moved, so
 * the piece meets the body instead of vanishing into it.
 */
function seatOnBody(mesh: Mesh, gap: number): void {
  mesh.updateMatrix();
  const geo = mesh.geometry;
  geo.applyMatrix4(mesh.matrix);
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const skin = skinAt(y);
    if (!skin) continue;
    const x = pos.getX(i);
    const dz = pos.getZ(i) - skin.z;
    const q = Math.hypot(x / skin.w, dz / skin.d);
    const want = 1 + gap / ((skin.w + skin.d) / 2);
    // A SOFT floor (softplus), not a clamp: a clamp leaves a jagged notch
    // where the pushed and unpushed vertices meet along the rim; this
    // eases the piece onto the skin over a short band instead.
    const band = 0.07;
    if (q >= want + band * 5 || q < 1e-6) continue;
    const k = (want + band * Math.log1p(Math.exp((q - want) / band))) / q;
    pos.setXYZ(i, x * k, y, skin.z + dz * k);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function rivet(trimMat: MeshStandardMaterial, at: Vector3, n: Vector3, r: number): Mesh {
  const m = asTrim(new Mesh(new SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), trimMat));
  m.position.copy(at);
  aim(m, n);
  return m;
}

/** A ring round a tube at `at`, its hole along `axis` — a band, a collar. */
function collar(trimMat: MeshStandardMaterial, at: Vector3, axis: Vector3, r: number, tube: number): Mesh {
  const m = asTrim(new Mesh(new TorusGeometry(r, tube, 6, 20), trimMat));
  m.position.copy(at);
  m.quaternion.setFromUnitVectors(FWD, axis.clone().normalize());
  return m;
}

/** The same curve and taper taperedTube builds from `pts`, sampled at `t`:
 *  the point, the tangent, the radius. */
function tubeAt(pts: Vector3[], r0: number, r1: number, t: number): { p: Vector3; tan: Vector3; r: number } {
  const curve = new CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  const k = t < 0.5 ? (t / 0.5) * 0.22 : 0.22 + ((t - 0.5) / 0.5) * 0.78;
  return { p: curve.getPointAt(t), tan: curve.getTangentAt(t), r: r0 + (r1 - r0) * k };
}

/** Trim bands round a tapered tube at each of `ts`. */
function tubeBands(trimMat: MeshStandardMaterial, pts: Vector3[], r0: number, r1: number, ts: number[], thick = 0.16, snug = 1.04): Mesh[] {
  return ts.map((t) => {
    const at = tubeAt(pts, r0, r1, t);
    return collar(trimMat, at.p, at.tan, at.r * snug, at.r * thick);
  });
}

/** A rounded rectangle, CCW in (r, y) — a lathe profile. */
function roundRectProfile(r0: number, r1: number, y0: number, y1: number, c: number): Vector2[] {
  const pts: Vector2[] = [];
  const arc = (cx: number, cy: number, a0: number): void => {
    for (let i = 0; i <= 3; i++) {
      const a = a0 + (i / 3) * (Math.PI / 2);
      pts.push(new Vector2(cx + Math.cos(a) * c, cy + Math.sin(a) * c));
    }
  };
  arc(r1 - c, y1 - c, 0); // outer top
  arc(r0 + c, y1 - c, Math.PI / 2); // inner top
  arc(r0 + c, y0 + c, Math.PI); // inner bottom
  arc(r1 - c, y0 + c, Math.PI * 1.5); // outer bottom
  pts.push(pts[0].clone());
  return pts;
}

/** A flat plate of outline `shape`, `depth` thick with eased edges, centred
 *  on its own thickness — flagged for the atlas's facing split. */
function plate(shape: Shape, depth: number, bevel: number, mat: MeshStandardMaterial): Mesh {
  const geo = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geo.translate(0, 0, -depth / 2);
  const m = new Mesh(geo, mat);
  m.userData.atlasSplit = true;
  return m;
}

/** Place `o` at `at` with its +z along `n` and its +y kept upright. */
function face(o: Object3D, at: Vector3, n: Vector3): void {
  o.position.copy(at);
  o.lookAt(at.clone().add(n));
}

/** An outline from a list of [x, y] points, straight segments. */
function outline(pts: Array<[number, number]>): Shape {
  const sh = new Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) sh.lineTo(x, y);
  sh.closePath();
  return sh;
}

/** A rounded rectangle outline, centred, w × h. */
function roundRect(w: number, h: number, c: number): Shape {
  const sh = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  sh.moveTo(x + c, y);
  sh.lineTo(x + w - c, y);
  sh.quadraticCurveTo(x + w, y, x + w, y + c);
  sh.lineTo(x + w, y + h - c);
  sh.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
  sh.lineTo(x + c, y + h);
  sh.quadraticCurveTo(x, y + h, x, y + h - c);
  sh.lineTo(x, y + c);
  sh.quadraticCurveTo(x, y, x + c, y);
  return sh;
}

/** The body's ring at hip-local height y — the same surface the
 *  mannequin's loft draws (BODY_RINGS, linear between rings). */
function bodyRing(y: number): { w: number; d: number; z: number } {
  const R = BODY_RINGS; // top → down
  if (y >= R[0].y) return { w: R[0].w, d: R[0].d, z: R[0].z ?? 0 };
  for (let i = 0; i < R.length - 1; i++) {
    const a = R[i];
    const b = R[i + 1];
    if (y <= a.y && y >= b.y) {
      const f = (a.y - y) / (a.y - b.y);
      return { w: a.w + (b.w - a.w) * f, d: a.d + (b.d - a.d) * f, z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * f };
    }
  }
  const e = R[R.length - 1];
  return { w: e.w, d: e.d, z: e.z ?? 0 };
}

/**
 * A PLATE LOFTED OVER THE SHOULDER — the way the chestplate is made: rows
 * at heights down the body, columns round it by the loft's own angle t
 * (t = 0 is the right side, π the left), every point pushed out along the
 * body's own ring by `proud(u, v)` metres (u 0→1 top to bottom, v 0→1
 * front to back). The body's surface is the ring itself, so a positive
 * `proud` is outside it everywhere: the plate can never be cut by the
 * shoulder it sits on. A second skin `thick` inside and a wall round the
 * rim close it into a slab. `at(u, v, lift)` gives a point on the outer
 * skin and its normal, for what gets mounted on the plate.
 */
function shoulderShell(
  mat: MeshStandardMaterial,
  side: 1 | -1,
  yTop: number,
  yBot: number,
  half: number | ((u: number) => number),
  proud: (u: number, v: number) => number,
  thick: number,
): { mesh: Mesh; at: (u: number, v: number, lift?: number) => { p: Vector3; n: Vector3 }; edge: (fixU: number | null, fixV: number | null, out: number) => Vector3[] } {
  const ROWS = 9;
  const COLS = 16;
  const t0 = side > 0 ? 0 : Math.PI;
  // Front is −z. On the right side (t = 0) sin t < 0 is the front, on the
  // left (t = π) sin t > 0 is — so v runs front to back on both.
  const halfAt = typeof half === 'number' ? (): number => half : half;
  const tOf = (u: number, v: number): number => t0 + side * (v - 0.5) * 2 * halfAt(u);
  const point = (u: number, v: number, o: number, out = new Vector3()): Vector3 => {
    const y = yTop + (yBot - yTop) * u;
    const r = bodyRing(y);
    const t = tOf(u, v);
    return out.set(Math.cos(t) * (r.w + o), y, Math.sin(t) * (r.d + o) + r.z);
  };
  const outerAt = (u: number, v: number, lift = 0): Vector3 => point(u, v, proud(u, v) + lift);
  const pos: number[] = [];
  const inner: number[] = [];
  const idx: number[] = [];
  const uvs: number[] = [];
  const tmp = new Vector3();
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      const u = r / ROWS;
      const v = c / COLS;
      const o = proud(u, v);
      point(u, v, o, tmp);
      pos.push(tmp.x, tmp.y, tmp.z);
      point(u, v, Math.max(0.0015, o - thick), tmp);
      inner.push(tmp.x, tmp.y, tmp.z);
      uvs.push(v, 1 - u);
      if (r < ROWS && c < COLS) {
        const i0 = r * (COLS + 1) + c;
        const i1 = i0 + COLS + 1;
        // Wound so the outer skin faces out on either shoulder.
        if (side > 0) idx.push(i0, i0 + 1, i1, i0 + 1, i1 + 1, i1);
        else idx.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1);
      }
    }
  }
  const n = pos.length / 3;
  const all = [...pos, ...inner];
  const uv = [...uvs, ...uvs];
  const outerTri = idx;
  const innerTri = idx.map((i) => i + n).reverse();
  const wallTri: number[] = [];
  let run = 0;
  const wall = (a0: number, a1: number): void => {
    const base = all.length / 3;
    for (const v of [a0, a1, a0 + n, a1 + n]) all.push(all[v * 3], all[v * 3 + 1], all[v * 3 + 2]);
    uv.push(run, 0, run + 1, 0, run, 1, run + 1, 1);
    run += 1;
    wallTri.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  };
  const last = ROWS * (COLS + 1);
  for (let c = 0; c < COLS; c++) {
    wall(c, c + 1);
    wall(last + c + 1, last + c);
  }
  for (let r = 0; r < ROWS; r++) {
    wall((r + 1) * (COLS + 1), r * (COLS + 1));
    wall(r * (COLS + 1) + COLS, (r + 1) * (COLS + 1) + COLS);
  }
  for (let i = uv.length - run * 8; i < uv.length; i += 2) uv[i] /= run;
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(all, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex([...outerTri, ...innerTri, ...wallTri]);
  geo.computeVertexNormals();
  const slabMat = mat.clone();
  slabMat.side = DoubleSide; // a hand-wound slab must never cull itself away
  const mesh = new Mesh(geo, slabMat);
  const at = (u: number, v: number, lift = 0): { p: Vector3; n: Vector3 } => {
    const p = outerAt(u, v, lift);
    const e = 0.01;
    const du = outerAt(Math.min(1, u + e), v, lift).sub(outerAt(Math.max(0, u - e), v, lift));
    const dv = outerAt(u, Math.min(1, v + e), lift).sub(outerAt(u, Math.max(0, v - e), lift));
    const nrm = du.cross(dv).normalize();
    // Point it away from the body's axis, whichever way the cross fell.
    if (nrm.x * side < 0 || (Math.abs(nrm.x) < 1e-3 && nrm.y < 0)) nrm.negate();
    return { p, n: nrm };
  };
  // A line along the outer skin — a row (fixU) or a column (fixV) — for trim.
  const edge = (fixU: number | null, fixV: number | null, out: number): Vector3[] => {
    const pts: Vector3[] = [];
    const count = fixU !== null ? COLS : ROWS;
    for (let i = 0; i <= count; i++) {
      const u = fixU ?? i / ROWS;
      const v = fixV ?? i / COLS;
      pts.push(outerAt(u, v, out));
    }
    return pts;
  };
  return { mesh, at, edge };
}

/**
 * ONE SHOULDER'S ARMOUR — the SPIKED PADS' plate (PAULDRONS wore it too
 * for a while, and went back to the plain shells people liked): a domed
 * CAP over the top of the shoulder, framed in trim, and a LAME (a second
 * band of plate) tucked under its lower edge and hanging down the side,
 * its own lower edge lit. Both are lofted over the body's shoulder
 * (shoulderShell), so they sit ON it: the old pads were ellipsoid domes
 * set on the shoulder's slope, and the trapezius rose straight through
 * the inner half of every one. `k` scales the whole pad; `spikes` drives
 * three spikes through the cap (the SPIKED PADS).
 */
function shoulderPad(mat: MeshStandardMaterial, trimMat: MeshStandardMaterial, glowMat: MeshStandardMaterial, s: 1 | -1, k: number, spikes: boolean): Group {
  const pad = new Group();
  const grow = k - 1;
  // A dome: nothing at the rim (so the plate rests on the body), most at
  // the shoulder's point.
  const dome = (u: number, v: number): number => Math.sin(Math.PI * u) ** 0.8 * Math.cos((v - 0.5) * Math.PI) ** 1.1;
  // Narrow at the top, where the body closes in toward the neck, and full
  // width over the shoulder's point — the pauldron's own outline. (A
  // constant span bunched the top edge into a notch by the collar.)
  const capHalf = (u: number): number => (0.98 + grow * 0.6) * (0.5 + 0.5 * Math.sqrt(u));
  const cap = shoulderShell(mat, s, 0.43, 0.372 - grow * 0.1, capHalf, (u, v) => k * (0.006 + 0.032 * dome(u, v)), 0.006);
  pad.add(cap.mesh);
  // The lame starts under the cap's lower third and drops down the side.
  const lameCurve = (u: number, v: number): number => Math.cos((v - 0.5) * Math.PI) ** 1.1 * (1 - u * 0.6);
  const lame = shoulderShell(mat, s, 0.386, 0.334 - grow * 0.12, 1.08 + grow * 0.6, (u, v) => k * (0.004 + 0.013 * lameCurve(u, v)), 0.005);
  pad.add(lame.mesh);
  const tube = (pts: Vector3[], r: number, m: MeshStandardMaterial): Mesh => new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), pts.length * 3, r, 6), m);
  // Trim rolls along the cap's collar and lower edges, and the lame's
  // lower edge is LIT. (Only the edges that run AROUND the body: an edge
  // running down it follows the loft's ring-to-ring corners, and a trim
  // roll laid on one zig-zagged; the plate's own wall reads there.)
  pad.add(asTrim(tube(cap.edge(0, null, 0.002), 0.0045 * k, trimMat)));
  pad.add(asTrim(tube(cap.edge(1, null, 0.002), 0.005 * k, trimMat)));
  pad.add(asGlow(tube(lame.edge(1, null, 0.002), 0.0048 * k, glowMat)));
  // Rivets across the lame, where it's fixed under the cap.
  for (const v of [0.14, 0.32, 0.5, 0.68, 0.86]) {
    const { p, n } = lame.at(0.5, v, 0.001);
    pad.add(rivet(trimMat, p, n, 0.0048 * k));
  }
  if (spikes) {
    // Three spikes up out of the cap: the big one off the top, leaning
    // out over the arm, and a smaller one fore and aft. Each rises along
    // the plate's own normal from a trim collar, so it looks driven
    // through the plate, not glued to it.
    const spec: Array<[number, number, number, number]> = [
      // u, v, length, lean out
      [0.42, 0.5, 0.1, 0.35],
      [0.5, 0.2, 0.07, 0.2],
      [0.5, 0.8, 0.07, 0.2],
    ];
    for (const [u, v, len, lean] of spec) {
      const { p, n } = cap.at(u, v);
      const dir = n.clone().add(new Vector3(s * lean, 0.25, 0)).normalize();
      const q = new Quaternion().setFromUnitVectors(UP, dir);
      const L = len * k;
      const spike = new Mesh(new ConeGeometry(0.014 * k, L, 12), mat);
      spike.quaternion.copy(q);
      spike.position.copy(p).addScaledVector(dir, L / 2 - 0.003);
      pad.add(spike);
      const collar = asTrim(new Mesh(new TorusGeometry(0.0155 * k, 0.0035 * k, 6, 16), trimMat));
      collar.quaternion.copy(q).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2));
      collar.position.copy(p).addScaledVector(dir, 0.002);
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

type Builder = (mat: MeshStandardMaterial, side: 1 | -1, trim: MeshStandardMaterial, glow: MeshStandardMaterial) => Group;

const BUILDERS: Record<string, Builder> = {
  /* head — origin at the head centre, front −z. Modelled on the old EGG
   * skull, R×(0.84, 1.08, 0.93) (mannequin.ts EGG_SCALE); applyGear
   * stretches the whole piece onto whatever the skull is now. */
  crest: (mat, _side, trimMat, glowMat) => {
    // ONE FIN, sculpted: its foot follows the skull's midline from the
    // brow over the crown to the nape, its crest rises off the brow,
    // peaks behind the crown and sweeps down the back, and the back half
    // is SERRATED — a saw of teeth, not a smooth curve. A centimetre
    // thick with eased edges, standing on a rolled rail of trim. (It was
    // eleven boxes in a stepped row and read like a fan of cards.)
    const g = new Group();
    const N = 26;
    const th0 = 0.55;
    const th1 = 2.78;
    const foot: Vector3[] = [];
    const top: Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const { p, n } = eggMid(th0 + (th1 - th0) * t);
      foot.push(p.clone().addScaledVector(n, -0.04 * R));
      let h = R * (0.08 + 0.5 * Math.sin(Math.PI * Math.pow(t, 0.75)));
      // THE TEETH: every other station on the back half drops, and slips
      // back along the skull, so each tooth rakes toward the nape.
      const tooth = t > 0.4 && i % 2 === 1;
      if (tooth) h *= 0.7;
      const q = p.clone().addScaledVector(n, h);
      if (tooth) q.addScaledVector(eggMid(th0 + (th1 - th0) * t).back, 0.05 * R);
      top.push(q);
    }
    // The outline in the fin's own plane (x = z, y = y), foot then crest.
    const sh = new Shape();
    sh.moveTo(foot[0].z, foot[0].y);
    for (const q of top) sh.lineTo(q.z, q.y);
    for (let i = N; i >= 0; i--) sh.lineTo(foot[i].z, foot[i].y);
    const fin = plate(sh, R * 0.07, R * 0.014, mat);
    fin.rotation.y = -Math.PI / 2; // the plane's x onto z; its thickness across the head
    g.add(fin);
    const rail: Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const m = eggMid(th0 + ((th1 - th0) * i) / N);
      rail.push(m.p.addScaledVector(m.n, 0.012 * R));
    }
    g.add(asTrim(new Mesh(new TubeGeometry(new CatmullRomCurve3(rail), 48, 0.05 * R, 8), trimMat)));
    // THE GLOW: a lit inlay run through the fin, below its teeth, showing
    // on both faces.
    const inlay: Vector3[] = [];
    for (let i = 2; i <= N - 2; i++) {
      const t = i / N;
      const { p, n } = eggMid(th0 + (th1 - th0) * t);
      inlay.push(p.clone().addScaledVector(n, R * (0.02 + 0.3 * Math.sin(Math.PI * Math.pow(t, 0.75)))));
    }
    g.add(asGlow(new Mesh(new TubeGeometry(new CatmullRomCurve3(inlay), 40, 0.062 * R, 6), glowMat)));
    return g;
  },
  antennae: (mat, _side, trimMat, glowMat) => {
    // A pair of FEELERS: each rises from a trim boss on the temple, a
    // tapered stalk that bows up, out and forward, banded twice in trim,
    // ending in a faceted bulb on a collar. (They were straight sticks
    // with a ball on the end.)
    const g = new Group();
    for (const s of [-1, 1] as const) {
      const { p, n } = eggPoint(new Vector3(s * 0.72, 0.66, -0.12));
      const boss = asTrim(new Mesh(new CylinderGeometry(0.1 * R, 0.13 * R, 0.08 * R, 16), trimMat));
      boss.position.copy(p).addScaledVector(n, 0.015 * R);
      aim(boss, n);
      g.add(boss);
      const pts = [
        p.clone().addScaledVector(n, 0.02 * R),
        p.clone().add(new Vector3(s * 0.14 * R, 0.36 * R, 0)),
        new Vector3(s * 0.98 * R, 1.25 * R, -0.1 * R),
        new Vector3(s * 1.18 * R, 1.72 * R, -0.32 * R),
      ];
      const r0 = 0.05 * R;
      const r1 = 0.02 * R;
      g.add(new Mesh(taperedTube(pts, r0, r1, 26, 10), mat));
      for (const band of tubeBands(trimMat, pts, r0, r1, [0.3, 0.62])) g.add(band);
      const tip = tubeAt(pts, r0, r1, 1);
      g.add(collar(trimMat, tip.p, tip.tan, 0.035 * R, 0.014 * R));
      const bulb = asGlow(new Mesh(new IcosahedronGeometry(0.13 * R, 1), glowMat)); // the lit bulbs
      bulb.position.copy(tip.p).addScaledVector(tip.tan, 0.1 * R);
      g.add(bulb);
    }
    return g;
  },
  horns: (mat, _side, _trimMat, glowMat) => {
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
      // Two bands of trim just out from the root, where a horn is bound.
      for (const band of tubeBands(glowMat, pts, R * 0.44, R * 0.05, [0.13, 0.2], 0.09, 1.0)) g.add(band); // lit bindings
      // A boss where the horn meets the skull, so the root reads as seated.
      const boss = new Mesh(new SphereGeometry(R * 0.46, 9, 7), faceted);
      boss.position.copy(pts[0]);
      boss.scale.set(1, 0.9, 1.05);
      g.add(boss);
    }
    return g;
  },
  halo: (mat, _side, trimMat, glowMat) => {
    // A BAND of light's metal, not a wire: a flat ring with a rounded
    // section, tipped back a little, a lip of trim round its inside edge
    // and twelve studs round its top.
    const g = new Group();
    const r0 = 0.7 * R;
    const r1 = 0.9 * R;
    const ring = new Mesh(new LatheGeometry(roundRectProfile(r0, r1, -0.03 * R, 0.03 * R, 0.022 * R), 48), mat);
    g.add(ring);
    const lip = asGlow(new Mesh(new TorusGeometry(r0, 0.022 * R, 5, 48), glowMat)); // the lit inner edge
    lip.rotation.x = Math.PI / 2;
    g.add(lip);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const at = new Vector3(Math.sin(a) * (r0 + r1) * 0.5, 0.03 * R, Math.cos(a) * (r0 + r1) * 0.5);
      g.add(rivet(trimMat, at, UP, 0.03 * R));
    }
    g.position.y = R * 1.5;
    g.rotation.x = 0.15; // the front a touch higher: tipped back
    return g;
  },
  mohawk: (mat, _side, _trimMat, glowMat) => {
    // A row of BLADES down the midline: seven flattened spikes, thin side
    // to side and raked back, tallest over the crown, each set into a
    // rolled rail of trim. (They were round cones standing bolt upright.)
    const g = new Group();
    const th0 = 0.85;
    const th1 = 2.55;
    const rail: Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const m = eggMid(th0 + ((th1 - th0) * i) / 20);
      rail.push(m.p.addScaledVector(m.n, 0.012 * R));
    }
    // The rail the blades are set in is the lit part.
    g.add(asGlow(new Mesh(new TubeGeometry(new CatmullRomCurve3(rail), 40, 0.06 * R, 8), glowMat)));
    const count = 7;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const { p, n, back } = eggMid(th0 + 0.08 + (th1 - th0 - 0.16) * t);
      const h = R * (0.42 + 0.42 * Math.sin(Math.PI * (0.15 + 0.7 * t)));
      const dir = n.clone().addScaledVector(back, 0.5).normalize();
      const blade = new Mesh(new ConeGeometry(0.13 * R, h, 6), mat);
      blade.scale.set(0.38, 1, 1); // flat across the head, long fore and aft
      aim(blade, dir);
      blade.position.copy(p).addScaledVector(dir, h / 2 - 0.03 * R);
      g.add(blade);
    }
    return g;
  },
  visorband: (mat, _side, trimMat, glowMat) => {
    // A VISOR: a thick wraparound lens across the eyes — its section
    // swells in the middle and eases to rounded edges, so it has a real
    // edge to catch the light — hinged at each temple on a trim disc,
    // with a slit of dark glass across the front. (It was a flat strip
    // of cylinder that read as a headband.)
    const g = new Group();
    const arc = Math.PI * 1.1;
    const phi0 = Math.PI - arc / 2;
    const lens = [
      new Vector2(1.0 * R, -0.17 * R),
      new Vector2(1.045 * R, -0.12 * R),
      new Vector2(1.068 * R, 0),
      new Vector2(1.045 * R, 0.12 * R),
      new Vector2(1.0 * R, 0.17 * R),
      new Vector2(0.965 * R, 0.15 * R),
      new Vector2(0.955 * R, 0),
      new Vector2(0.965 * R, -0.15 * R),
      new Vector2(1.0 * R, -0.17 * R),
    ];
    const body = new Mesh(new LatheGeometry(lens, 48, phi0, arc), mat);
    g.add(body);
    // The slit is the lit part: the visor's eye.
    const glassMat = glowMat.clone();
    glassMat.side = DoubleSide;
    const glass = asGlow(new Mesh(new CylinderGeometry(1.071 * R, 1.071 * R, 0.085 * R, 44, 1, true, Math.PI - arc * 0.4, arc * 0.8), glassMat));
    g.add(glass);
    for (const phi of [phi0, phi0 + arc]) {
      const hinge = asTrim(new Mesh(new CylinderGeometry(0.15 * R, 0.15 * R, 0.07 * R, 20), trimMat));
      hinge.position.set(Math.sin(phi) * 1.0 * R, 0, Math.cos(phi) * 1.0 * R);
      aim(hinge, new Vector3(Math.cos(phi), 0, -Math.sin(phi)));
      g.add(hinge);
      const bolt = rivet(trimMat, hinge.position.clone().addScaledVector(new Vector3(Math.cos(phi), 0, -Math.sin(phi)), 0.035 * R), new Vector3(Math.cos(phi), 0, -Math.sin(phi)), 0.05 * R);
      g.add(bolt);
    }
    // Fitted to the egg's oval, sat just below the brow.
    g.scale.set(0.9, 1, 1.02);
    g.position.set(0, R * 0.1, -R * 0.02);
    return g;
  },

  /* body — origin at the hips, +y up, front −z, shoulders at (±0.126, 0.395) */
  pauldrons: (mat) => {
    // THE SHELLS, back: one smooth dome per shoulder, tipped down over the
    // arm — the first cut's shape, which was the one people liked. (A
    // riveted cap-lame-rim plate replaced it for a while, because the
    // tipped dome's INSIDE edge dove into the trapezius.) So the shape is
    // kept and the dive is fixed: seatOnBody pushes whatever part of the
    // shell falls inside the body back out onto its skin, and the inner
    // edge now hugs the slope up to the neck instead of cutting into it.
    const g = new Group();
    for (const s of [-1, 1]) {
      const pad = new Mesh(new SphereGeometry(0.1, 48, 28, 0, Math.PI * 2, 0, Math.PI * 0.55), mat);
      pad.scale.set(1.1, 0.8, 1.05);
      // A whisker further out and a touch less tipped than the first cut,
      // so there is less of it to seat — the shape reads the same.
      pad.position.set(s * 0.222, 0.385, 0);
      pad.rotation.z = -s * 0.4;
      seatOnBody(pad, 0.004);
      g.add(pad);
    }
    return g;
  },
  chestplate: (mat, _side, trimMat, glowMat) => {
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
    // draws its outline; the face stays clean — one open plate to paint.
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
    // THE CORE: a lit disc set into the plate over the sternum, in a trim
    // bezel — the plate's heart.
    const coreAt = along(3, null, 0.004)[cols / 2];
    const out = new Vector3(coreAt.x, 0, coreAt.z).normalize();
    const bezel = asTrim(new Mesh(new CylinderGeometry(0.024, 0.026, 0.006, 24), trimMat));
    bezel.position.copy(coreAt);
    aim(bezel, out);
    g.add(bezel);
    const core = asGlow(new Mesh(new CylinderGeometry(0.017, 0.017, 0.004, 24), glowMat));
    core.position.copy(coreAt).addScaledVector(out, 0.002);
    aim(core, out);
    g.add(core);
    return g;
  },
  tail: (mat, _side, _trimMat, glowMat) => {
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
    // Segmented by three bands of trim down its length, and tipped with a
    // flat BLADE — the devil's arrowhead — along the flick.
    for (const band of tubeBands(glowMat, pts, 0.046, 0.0015, [0.2, 0.38, 0.56], 0.14, 1.0)) g.add(band); // lit
    const tip = tubeAt(pts, 0.046, 0.0015, 0.97);
    const blade = new Mesh(new ConeGeometry(0.024, 0.06, 4), faceted);
    blade.scale.set(1, 1, 0.3);
    aim(blade, tip.tan);
    blade.position.copy(tip.p).addScaledVector(tip.tan, 0.024);
    g.add(blade);
    return g;
  },
  belt: (mat, _side, trimMat, glowMat) => {
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
    const buckle = asGlow(new Mesh(new BoxGeometry(0.03, 0.02, 0.004), glowMat)); // the lit buckle
    buckle.position.set(0, 0.13, -D - 0.009);
    g.add(buckle);
    return g;
  },
  /* hands — palm at the origin, fingers −z, cuff +z (hands.ts) */
  cuffs: (mat, _side, trimMat, glowMat) => {
    // A BRACER round the wrist: a short band with a squared, rounded
    // section (lathed), flattened to the hand's own wrist, rolled edges of
    // trim either side and four rivets round its face. (It was a torus —
    // a bangle.)
    const g = new Group();
    const bracer = new Group();
    bracer.add(new Mesh(new LatheGeometry(roundRectProfile(0.039, 0.047, -0.014, 0.014, 0.004), 28), mat));
    for (const y of [-0.0125, 0.0125]) {
      const edge = asTrim(new Mesh(new TorusGeometry(0.0468, 0.0026, 5, 28), trimMat));
      edge.rotation.x = Math.PI / 2;
      edge.position.y = y;
      bracer.add(edge);
    }
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const out = new Vector3(Math.sin(a), 0, Math.cos(a));
      bracer.add(asGlow(rivet(glowMat, out.clone().multiplyScalar(0.047), out, 0.0036))); // lit studs
    }
    bracer.rotation.x = Math.PI / 2; // the lathe's axis along the arm
    bracer.scale.set(1, 1, 0.62); // flattened top to bottom, like a wrist
    bracer.position.z = 0.085;
    g.add(bracer);
    return g;
  },
  knuckles: (mat, side, _trimMat, glowMat) => {
    // A KNUCKLE-DUSTER: a bar across the knuckles, a spike rising off it
    // over each, each spike set in a trim collar. (They were four cones
    // floating over the fingers.)
    const g = new Group();
    const bar = new Mesh(new CapsuleGeometry(0.0078, 0.062, 4, 12), mat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.016, -0.046);
    g.add(bar);
    for (let i = 0; i < 4; i++) {
      const x = side * (0.0285 - i * 0.019);
      const spike = new Mesh(new ConeGeometry(0.0068, 0.03, 8), mat);
      spike.position.set(x, 0.016 + 0.0078 + 0.013, -0.046);
      g.add(spike);
      g.add(asGlow(collar(glowMat, new Vector3(x, 0.016 + 0.0074, -0.046), UP, 0.0072, 0.0019))); // lit collars
    }
    return g;
  },
  gauntlets: (mat, _side, trimMat, glowMat) => {
    // A GAUNTLET, not a tile balanced on the hand: a back plate hugging
    // the top of the palm (palm block is 0.078 × 0.024 × 0.09, top face
    // at y = 0.012), three knuckle ridges across its leading edge, and a
    // flared cuff round the wrist behind it.
    const g = new Group();
    // The back plate: a rounded rectangle with eased edges (it was a box).
    const back = plate(roundRect(0.084, 0.082, 0.014), 0.006, 0.0022, mat);
    back.rotation.x = -Math.PI / 2; // lying flat on the back of the hand
    back.position.set(0, 0.0165, 0.006);
    g.add(back);
    // Three ridges across its leading edge, rolled, not boxed.
    for (let i = 0; i < 3; i++) {
      const ridge = asGlow(new Mesh(new CapsuleGeometry(0.0036, 0.076, 3, 8), glowMat)); // lit ridges
      ridge.rotation.z = Math.PI / 2;
      ridge.position.set(0, 0.0235, -0.024 + i * 0.017);
      g.add(ridge);
    }
    // A rivet at each back corner.
    for (const x of [-0.033, 0.033]) g.add(rivet(trimMat, new Vector3(x, 0.0215, 0.036), UP, 0.0032));
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
  crown: (mat, _side, trimMat, glowMat) => {
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
      // Faceted like cut stone — four faces, not a round cone — and
      // seated on a stud of trim set into the band.
      const point = new Mesh(new ConeGeometry(R * 0.09, h, 4), mat);
      point.position.set(x, R * 0.66 + h * 0.46, z);
      point.rotation.set(Math.sin(a) * 0.22, Math.PI / 4 - a, -Math.cos(a) * 0.22, 'YXZ');
      g.add(point);
      const out = new Vector3(Math.cos(a) * 0.9, 0, Math.sin(a) * 1.02).normalize();
      g.add(asGlow(rivet(glowMat, new Vector3(x * 1.07, R * 0.62, z * 1.05), out, R * 0.055))); // a lit gem under each point
    }
    return g;
  },
  antlers: (mat, _side, trimMat) => {
    // A stag's pair: each a tapered beam off the temple, climbing up and
    // back and curling in at the tip, with a brow tine forward and a
    // second tine off the middle. Faceted like the horns.
    const g = new Group();
    const faceted = mat.clone();
    faceted.flatShading = true;
    const tube = (pts: number[][], s: number, r0: number, r1: number, segs: number): Mesh =>
      new Mesh(taperedTube(pts.map(([x, y, z]) => new Vector3(s * x * R, y * R, z * R)), r0 * R, r1 * R, segs, 6), faceted);
    for (const s of [-1, 1]) {
      const beam = [[0.66, 0.6, -0.08], [0.92, 1.05, 0.05], [1.15, 1.55, 0.3], [1.2, 2.05, 0.55], [1.02, 2.45, 0.82]];
      g.add(tube(beam, s, 0.16, 0.03, 22));
      // THE BURR: the knobbed ring where a real antler meets the skull.
      const burr = tubeBands(trimMat, beam.map(([x, y, z]) => new Vector3(s * x * R, y * R, z * R)), 0.16 * R, 0.03 * R, [0.05], 0.3, 1.12);
      for (const b of burr) g.add(b);
      g.add(tube([[0.82, 0.92, -0.02], [0.98, 1.22, -0.4], [1.02, 1.42, -0.7]], s, 0.09, 0.02, 12)); // the brow tine
      g.add(tube([[1.12, 1.5, 0.28], [1.45, 1.75, 0.15], [1.7, 2.05, 0.05]], s, 0.09, 0.02, 12)); // the second tine
    }
    return g;
  },
  wings: (mat, _side, _trimMat, glowMat) => {
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
        plate.userData.atlasSplit = true; // front and back faces paint apart
        const pivot = new Group();
        pivot.position.set(s * 0.11, 0.36 - i * 0.02, 0.09);
        // Roll lifts the plate; yaw sweeps it back (the back is +z). The
        // top plate stands nearly upright, the lower two fan out under it.
        pivot.rotation.set(0, -s * (0.55 + i * 0.22), s * (1.15 - i * 0.34));
        pivot.add(plate);
        g.add(pivot);
        // Each blade turns on a HINGE — a knuckle of trim at its root.
        g.add(asGlow(rivet(glowMat, pivot.position.clone(), new Vector3(s * 0.4, 0.2, 1), 0.012))); // lit hinges
      }
    }
    // THE MOUNT: a plate across the shoulder blades both fans hang from.
    const mount = plate(roundRect(0.2, 0.07, 0.03), 0.01, 0.003, mat);
    mount.position.set(0, 0.34, 0.108);
    g.add(mount);
    return g;
  },
  claws: (mat, _side, _trimMat, glowMat) => {
    // Three talons rooted on the knuckle line, reaching forward past the
    // fingers and hooking down to a point. The palm block's front face is
    // at z ≈ −0.045; the roots sit just inside it.
    const g = new Group();
    const faceted = mat.clone();
    faceted.flatShading = true;
    // The talons are MOUNTED: a trim bar across the knuckles they grow from.
    const mount = asGlow(new Mesh(new CapsuleGeometry(0.0065, 0.05, 3, 10), glowMat)); // lit
    mount.rotation.z = Math.PI / 2;
    mount.position.set(0, 0.015, -0.036);
    g.add(mount);
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
  spikepads: (mat, _side, trimMat, glowMat) => {
    // SPIKED PADS: the pauldron's cap-lame-rim armour a size up, with
    // three spikes driven up through each cap from trim collars — the big
    // one off the top, leaning out over the arm, one fore, one aft.
    const g = new Group();
    for (const s of [-1, 1] as const) g.add(shoulderPad(mat, trimMat, glowMat, s, 1.14, true));
    return g;
  },
};

/* ── the fourth wave ─────────────────────────────────────────────────── */

const FOURTH_BUILDERS: Record<string, Builder> = {
  vcrest: (mat, _side, trimMat, glowMat) => {
    // A V-CREST — the kuwagata of a samurai's helm: a shield-shaped
    // EMBLEM on the brow, framed in trim with a lit gem at its heart, and
    // two long blades rising from behind it in a V, sweeping up and out
    // and leaning back with the brow.
    const g = new Group();
    const { p, n } = eggPoint(new Vector3(0, 0.36, -1));
    const brow = new Group();
    face(brow, p, n);
    g.add(brow);
    const shield: Array<[number, number]> = [
      [-0.17 * R, 0.13 * R], [0.17 * R, 0.13 * R], [0.15 * R, -0.05 * R], [0, -0.19 * R], [-0.15 * R, -0.05 * R],
    ];
    const emblem = plate(outline(shield), 0.05 * R, 0.012 * R, mat);
    emblem.position.z = 0.05 * R;
    brow.add(emblem);
    const frame = asTrim(plate(outline(shield.map(([x, y]) => [x * 1.2, y * 1.2 + 0.005 * R] as [number, number])), 0.03 * R, 0.008 * R, trimMat));
    frame.position.z = 0.025 * R;
    brow.add(frame);
    const gem = asGlow(plate(outline([[0, 0.07 * R], [0.06 * R, 0], [0, -0.08 * R], [-0.06 * R, 0]]), 0.02 * R, 0.006 * R, glowMat));
    gem.position.z = 0.09 * R;
    brow.add(gem);
    for (const s of [-1, 1] as const) {
      const sh = new Shape();
      sh.moveTo(s * 0.04 * R, 0.02 * R);
      sh.quadraticCurveTo(s * 0.42 * R, 0.22 * R, s * 1.02 * R, 1.38 * R); // the outer edge, out to the tip
      sh.quadraticCurveTo(s * 0.34 * R, 0.62 * R, s * 0.02 * R, 0.16 * R); // and back down the inner
      sh.closePath();
      const blade = plate(sh, 0.04 * R, 0.01 * R, mat);
      blade.position.z = 0.01 * R;
      brow.add(blade);
    }
    return g;
  },
  earfins: (mat, _side, trimMat, glowMat) => {
    // EAR FINS — a winged helm's: at each temple a fin of three swept
    // feathers, splayed out as they run back, on a trim boss with a lit hub.
    const g = new Group();
    for (const s of [-1, 1] as const) {
      const { p, n } = eggPoint(new Vector3(s, 0.14, 0.08));
      const boss = asTrim(new Mesh(new CylinderGeometry(0.16 * R, 0.19 * R, 0.07 * R, 20), trimMat));
      boss.position.copy(p).addScaledVector(n, 0.02 * R);
      aim(boss, n);
      g.add(boss);
      const hub = asGlow(new Mesh(new CylinderGeometry(0.08 * R, 0.08 * R, 0.02 * R, 16), glowMat));
      hub.position.copy(p).addScaledVector(n, 0.06 * R);
      aim(hub, n);
      g.add(hub);
      // The fin's outline in its own plane (x = back along the head, y = up).
      const feathers: Array<[number, number]> = [
        [-0.22 * R, 0.14 * R], [0.2 * R, 0.34 * R], [1.08 * R, 0.86 * R], [0.46 * R, 0.36 * R],
        [0.98 * R, 0.44 * R], [0.42 * R, 0.14 * R], [0.8 * R, 0.02 * R], [0.14 * R, -0.12 * R], [-0.2 * R, -0.06 * R],
      ];
      const fin = plate(outline(feathers), 0.05 * R, 0.012 * R, mat);
      fin.rotation.y = -Math.PI / 2; // the outline's x onto the head's z (back)
      const splay = new Group();
      splay.rotation.y = s * 0.32; // the back of the fin further out than its root
      splay.add(fin);
      splay.position.copy(p).addScaledVector(n, 0.07 * R);
      g.add(splay);
    }
    return g;
  },
  thrusters: (mat, _side, trimMat, glowMat) => {
    // THRUSTERS — a JET PACK between the shoulder blades: a bevelled
    // pack, two bell nozzles hung under it on trim necks, their throats
    // and lips LIT, and a pair of lit rails down its back.
    const g = new Group();
    const pack = plate(roundRect(0.15, 0.17, 0.028), 0.045, 0.006, mat);
    pack.position.set(0, 0.3, 0.13);
    g.add(pack);
    for (const x of [-0.045, 0.045]) {
      const rail = asGlow(new Mesh(new CapsuleGeometry(0.005, 0.12, 3, 8), glowMat)); // lit rails down the pack
      rail.position.set(x, 0.3, 0.16);
      g.add(rail);
      const neck = asTrim(new Mesh(new CylinderGeometry(0.012, 0.015, 0.03, 14), trimMat));
      neck.position.set(x, 0.205, 0.132);
      g.add(neck);
      const bell = new Mesh(
        new LatheGeometry(
          [
            new Vector2(0.014, 0.02), new Vector2(0.02, 0.0), new Vector2(0.03, -0.032), new Vector2(0.036, -0.046),
            new Vector2(0.031, -0.046), new Vector2(0.025, -0.032), new Vector2(0.016, 0.0), new Vector2(0.011, 0.02),
            new Vector2(0.014, 0.02),
          ],
          24,
        ),
        mat,
      );
      bell.position.set(x, 0.175, 0.132);
      g.add(bell);
      const core = asGlow(new Mesh(new CylinderGeometry(0.022, 0.022, 0.004, 20), glowMat)); // the lit throat
      core.position.set(x, 0.148, 0.132);
      g.add(core);
      const lip = asGlow(new Mesh(new TorusGeometry(0.0335, 0.003, 5, 24), glowMat)); // and a lit lip, seen from anywhere
      lip.rotation.x = Math.PI / 2;
      lip.position.set(x, 0.175 - 0.046, 0.132);
      g.add(lip);
    }
    return g;
  },
  wristblades: (mat, side, trimMat, glowMat) => {
    // WRIST BLADES — a blade along the outside of each forearm, rooted at
    // the wrist on a trim bracket and running forward past the knuckles,
    // with a lit line down its spine.
    const g = new Group();
    const x = -side * 0.05; // the little-finger side (the thumb is on +side)
    const sh = outline([[0.07, 0.013], [-0.02, 0.021], [-0.128, 0.0], [-0.03, -0.012], [0.07, -0.01]]);
    const blade = plate(sh, 0.004, 0.0012, mat);
    blade.rotation.y = -Math.PI / 2; // the outline's x onto the hand's z (the tip toward the fingers)
    blade.position.set(x, 0.004, 0);
    g.add(blade);
    const bracket = asTrim(new Mesh(new CapsuleGeometry(0.006, 0.03, 3, 8), trimMat));
    bracket.rotation.x = Math.PI / 2;
    bracket.position.set(x - side * 0.004, 0.002, 0.055);
    g.add(bracket);
    const spine = asGlow(new Mesh(new CapsuleGeometry(0.0042, 0.09, 3, 6), glowMat)); // proud of both faces
    spine.rotation.x = Math.PI / 2;
    spine.position.set(x, 0.006, -0.01);
    g.add(spine);
    return g;
  },
};

Object.assign(BUILDERS, MORE_BUILDERS, THIRD_BUILDERS, FOURTH_BUILDERS);
for (const [id, build] of Object.entries(HEAD_PIECES)) BUILDERS[id] = (mat, _side, trimMat, glowMat) => build(mat, trimMat, glowMat);

/** The rig groups gear can hang off, by the names buildBoxer gives them —
 *  the head carries two slots: its GEAR (horns, crest…) and its FACE. */
const SLOTS_OF_NAME: Record<string, readonly GearSlot[]> = {
  'opponent-head': ['face', 'head'],
  'opponent-body': ['body'],
  'opponent-glove-left': ['hands'],
  'opponent-glove-right': ['hands'],
};

/** The child each slot builds under its rig group ('gear' for the three
 *  that came first, so every probe that looks for it still finds it). */
const childName = (slot: GearSlot): string => (slot === 'face' ? 'gear-face' : 'gear');

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
    const tagged = o.userData.gearSlot as GearSlot | undefined;
    const slots = SLOTS_OF_NAME[o.name] ?? (tagged ? [tagged] : null);
    if (!slots) return;
    // THE WEARER'S OWN HEAD: gear on the head of a first-person rig
    // (userData.firstPerson — the arena's PlayerBodySystem flags its own
    // head) is never built. Your horns are for everyone else to see; from
    // inside the skull they would only sit in the edge of your vision —
    // and a whole bear's head would be all you saw.
    const fp = !!o.userData.firstPerson && slots.includes('face');
    const face = fp ? '' : (slots.includes('face') ? (want.get('face') ?? '') : '');
    for (const slot of slots) dressSlot(o, slot, fp ? '' : (want.get(slot) ?? ''), tone, face);
    // A worn head REPLACES the bare skull (the skull stays built — it is
    // the 'head' paint surface, and it comes back the moment the head
    // comes off).
    if (slots.includes('face')) {
      o.traverse((m) => {
        if (m.userData.paintPart === 'head') m.visible = !face;
      });
    }
  });
}

/** Build (or keep) one slot's piece under a rig group. */
function dressSlot(o: Object3D, slot: GearSlot, id: string, tone: BlankTone, face: string): void {
  const keyName = slot === 'face' ? 'faceKey' : 'gearKey';
  // The head gear is fitted to whatever face it sits on, so a new face is
  // a new fit.
  const key = slot === 'head' ? `${id}|${tone}|${face}` : `${id}|${tone}`;
  if (o.userData[keyName] === key) return;
  o.userData[keyName] = key;
  const old = o.getObjectByName(childName(slot));
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
  const glowMat = glow();
  const accent = accentOf(o);
  if (accent !== null) {
    glowMat.color.set(accent);
    glowMat.emissive.set(accent);
  }
  const g = build(primer(tone), side, trim(tone), glowMat);
  g.name = childName(slot);
  g.userData.gear = id;
  // The head pieces were modelled on the old egg skull; refit them.
  if (slot === 'head') g.scale.set(HEAD_SCALE[0] / EGG_SCALE[0], HEAD_SCALE[1] / EGG_SCALE[1], HEAD_SCALE[2] / EGG_SCALE[2]);
  // A PAINT SURFACE (avatar/paint.ts): the piece shares its slot's
  // canvas, laid out by THE GEAR ATLAS (avatar/gearAtlas.ts) — every
  // mesh and every face its own patch of it, so each pauldron, plate and
  // spike takes paint of its own, and a mark is placed in 3D where it
  // was aimed. Each mesh takes its own material (the bake sets a map per
  // mesh) and the piece is NOT collapsed — the merge would drop the UVs.
  // Each HAND's gear is its own surface — the right hand's is
  // 'gearHandsR' — so a pair of cuffs can be painted two ways.
  const part =
    slot === 'face' ? 'gearFace' : slot === 'head' ? 'gearHead' : slot === 'body' ? 'gearBody' : side === -1 ? 'gearHandsR' : 'gearHands';
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
  mergePiece(g); // a few draw calls per piece, not dozens (gearAtlas.ts)
  // …and out to a worn head's crown (HEAD_FIT): the heads are bigger than
  // the skull, and a horn fitted to the egg would sink inside a bear's
  // dome. Only AFTER the atlas: its map is measured in the piece's frame
  // and kept per piece, so it must be the same map whatever face the
  // piece first met — the mark rides out with the horn, the same mark on
  // every headset.
  const fit = slot === 'head' ? HEAD_FIT[face] : undefined;
  if (fit) {
    g.scale.multiplyScalar(fit.scale);
    g.position.y = fit.lift;
  }
  o.add(g);
}

/** The gear a subtree is wearing right now (dev hooks / probes). */
export function wornGear(root: Object3D): string[] {
  const out: string[] = [];
  root.traverse((o) => {
    if ((o.name === 'gear' || o.name === 'gear-face') && typeof o.userData.gear === 'string') out.push(o.userData.gear);
  });
  return out;
}
