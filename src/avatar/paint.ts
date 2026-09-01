/**
 * THE PAINT, phase P1 — the render pipeline (docs/paint.md §4, §7).
 *
 * A LOOK is the base tone plus an ordered list of placed paint units —
 * stripes and splotches — each quantized to bytes by construction (u, v,
 * angle, len, wid all live in 0..255; colour and variant are indices), so
 * the caps ARE the validation and the same data renders the same
 * everywhere. This module owns:
 *
 *   - the Look model + localStorage persistence (yours only, for now —
 *     the wire ride is P3),
 *   - the BAKE: each mannequin paint surface (skull, trunk, hips — the
 *     meshes tagged `userData.paintPart`, exempted from the static
 *     collapse) gets a per-part canvas painted base-tone-first, then
 *     every unit oldest-first, uploaded ONCE as the material's map. A
 *     repaint happens only when the look changes; at runtime a painted
 *     fighter costs exactly what a blank costs.
 *
 * Wrap handling: u runs 0..1 around the body (the lofts carry
 * seam-duplicated cylindrical UVs; the head is a plain sphere unwrap), so
 * every unit draws three times at u−1, u, u+1 and seams never cut a
 * stripe. Front of the body sits at u = 0.75 (the lofts start on +x and
 * wind through −z at three-quarters).
 *
 * The bake keys off the material's own tone tag (`userData.paintTone`),
 * so a look bakes correctly onto the white body and the onyx body alike —
 * unpainted texels ARE the base tone.
 */

import { CanvasTexture, Mesh, MeshStandardMaterial, SRGBColorSpace, type Object3D } from 'three';
import { PAINT } from '../config.js';

export type PaintKind = 'stripe' | 'splotch';
export type PaintPart = 'head' | 'chest' | 'pelvis';

export interface PlacedPaint {
  kind: PaintKind;
  /** Index into PAINT.colours — the wire value, never a free RGB. */
  colour: number;
  /** Splotch silhouette roll (stripes: reserved for end-cap styles). */
  variant: number;
  part: PaintPart;
  /** Anchor + pose, all quantized 0..255 on the wire; floats 0..1 here. */
  u: number;
  v: number;
  /** Fraction of a full turn (0..1). */
  angle: number;
  /** Fractions of the part canvas (0..1). */
  len: number;
  wid: number;
}

export interface Look {
  paint: PlacedPaint[];
}

/* ── the store ────────────────────────────────────────────────────────── */

const KEY = 'ff2-look';

/** Bumped on every look change — applyOwnSkins repaints when it moves. */
export const paintState = { version: 1 };

let current: Look | null = null;

const clamp01 = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/** Validate one stored/received unit; null drops it (fail-soft). */
function cleanUnit(raw: unknown): PlacedPaint | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind === 'splotch' ? 'splotch' : r.kind === 'stripe' ? 'stripe' : null;
  const part = r.part === 'head' || r.part === 'chest' || r.part === 'pelvis' ? r.part : null;
  const colour = typeof r.colour === 'number' ? Math.floor(r.colour) : -1;
  if (!kind || !part || colour < 0 || colour >= PAINT.colours.length) return null;
  return {
    kind,
    part,
    colour,
    variant: typeof r.variant === 'number' ? Math.floor(Math.abs(r.variant)) % 256 : 0,
    u: clamp01(r.u),
    v: clamp01(r.v),
    angle: clamp01(r.angle),
    len: clamp01(r.len),
    wid: clamp01(r.wid),
  };
}

export function myLook(): Look {
  if (current) return current;
  let paint: PlacedPaint[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { paint?: unknown[] };
    paint = (raw.paint ?? []).map(cleanUnit).filter((p): p is PlacedPaint => p !== null).slice(0, PAINT.maxUnits);
  } catch {
    /* fresh body */
  }
  current = { paint };
  return current;
}

export function setLook(look: Look): void {
  current = { paint: look.paint.map(cleanUnit).filter((p): p is PlacedPaint => p !== null).slice(0, PAINT.maxUnits) };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode — the look lives for the session */
  }
  paintState.version += 1;
}

export function clearLook(): void {
  setLook({ paint: [] });
}

/* ── the wire form (docs/paint.md §3, §5) ─────────────────────────────── */
//
// One unit is exactly 8 bytes, every field quantized by construction:
//
//   b0  kind (bit 0) | part index (bits 1..3)
//   b1  colour index          b2  variant
//   b3  u ·255   b4  v ·255   b5  angle ·255   b6  len ·255   b7  wid ·255
//
// A whole look is [format byte = 1][units…], base64'd so it rides every
// JSON channel (the 1v1 `iam`, the mesh `iam`, the pub hello) as one short
// string — a maxed 64-unit look is 513 bytes / ~684 base64 chars, smaller
// than a single pose-packet burst. The receive side re-validates every
// unit through cleanUnit, so malformed or hostile data fails soft to the
// bare base tone — never to an error.

const WIRE_FORMAT = 1;
/** Part order ON THE WIRE — append-only (3/4 are reserved for the gloves). */
const WIRE_PARTS: PaintPart[] = ['head', 'chest', 'pelvis'];
/** Longest base64 string unpackLook will even look at (a maxed look is ~700). */
const WIRE_MAX_CHARS = 1024;

const q255 = (n: number): number => Math.max(0, Math.min(255, Math.round(n * 255)));

/** Pack a look into its base64 wire string ('' = nothing to carry). */
export function packLook(look: Look): string {
  const units = look.paint.slice(0, PAINT.maxUnits);
  if (units.length === 0) return '';
  const bytes = new Uint8Array(1 + units.length * 8);
  bytes[0] = WIRE_FORMAT;
  units.forEach((p, i) => {
    const o = 1 + i * 8;
    bytes[o] = (p.kind === 'splotch' ? 1 : 0) | (Math.max(0, WIRE_PARTS.indexOf(p.part)) << 1);
    bytes[o + 1] = Math.min(255, p.colour);
    bytes[o + 2] = p.variant % 256;
    bytes[o + 3] = q255(p.u);
    bytes[o + 4] = q255(p.v);
    bytes[o + 5] = q255(p.angle);
    bytes[o + 6] = q255(p.len);
    bytes[o + 7] = q255(p.wid);
  });
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Unpack a wire string back into a Look. ANYTHING wrong — not a string, too
 * long, bad base64, wrong format byte, truncated units, out-of-range fields —
 * quietly yields the bare base tone (docs/paint.md §5: late or bad data never
 * beats no data). Every surviving unit still passes cleanUnit.
 */
export function unpackLook(wire: unknown): Look {
  const bare: Look = { paint: [] };
  if (typeof wire !== 'string' || wire.length === 0 || wire.length > WIRE_MAX_CHARS) return bare;
  let bin: string;
  try {
    bin = atob(wire);
  } catch {
    return bare;
  }
  if (bin.length < 1 + 8 || (bin.length - 1) % 8 !== 0) return bare;
  if (bin.charCodeAt(0) !== WIRE_FORMAT) return bare;
  const count = Math.min((bin.length - 1) / 8, PAINT.maxUnits);
  const paint: PlacedPaint[] = [];
  for (let i = 0; i < count; i++) {
    const o = 1 + i * 8;
    const b0 = bin.charCodeAt(o);
    const unit = cleanUnit({
      kind: (b0 & 1) === 1 ? 'splotch' : 'stripe',
      part: WIRE_PARTS[b0 >> 1], // out of range → undefined → dropped
      colour: bin.charCodeAt(o + 1),
      variant: bin.charCodeAt(o + 2),
      u: bin.charCodeAt(o + 3) / 255,
      v: bin.charCodeAt(o + 4) / 255,
      angle: bin.charCodeAt(o + 5) / 255,
      len: bin.charCodeAt(o + 6) / 255,
      wid: bin.charCodeAt(o + 7) / 255,
    });
    if (unit) paint.push(unit);
  }
  return { paint };
}

let packedCache = { version: -1, wire: '' };

/** MY look, packed for the wire — cached per look version (the mesh `iam`
 *  rebroadcasts every 2 s; repacking each time would be pure waste). */
export function myPackedLook(): string {
  if (packedCache.version !== paintState.version) {
    packedCache = { version: paintState.version, wire: packLook(myLook()) };
  }
  return packedCache.wire;
}

/* ── HIDE PAINT (docs/paint.md §6) ────────────────────────────────────── */

const HIDE_KEY = 'ff2-hide-paint';

/** Bumped whenever a hide-paint preference flips — remote-rig bake keys fold
 *  this in so every painted body repaints on the spot. */
export const paintPrefs = { version: 1 };

let hideAll: boolean | null = null;

/** The global settings breaker: render EVERY other player's body bare.
 *  Strictly local, total defence; your own paint stays yours. */
export function paintHiddenAll(): boolean {
  if (hideAll === null) {
    try {
      hideAll = localStorage.getItem(HIDE_KEY) === '1';
    } catch {
      hideAll = false;
    }
  }
  return hideAll;
}

export function togglePaintHiddenAll(): void {
  hideAll = !paintHiddenAll();
  try {
    localStorage.setItem(HIDE_KEY, hideAll ? '1' : '0');
  } catch {
    /* session-only */
  }
  paintPrefs.version += 1;
}

/* ── the locker: owned, unplaced paint ────────────────────────────────── */

const INV_KEY = 'ff2-paint-inv';

/** Owned-but-unplaced unit counts, keyed `<kind>:<colour>`. Placing takes
 *  a unit out; lifting a placed unit puts it IN YOUR HAND, not back here —
 *  RETURN does that. Paint is never consumed (docs/paint.md §1). */
export const invState = { version: 1 };

let inv: Record<string, number> | null = null;

function loadInv(): Record<string, number> {
  if (inv) return inv;
  inv = {};
  try {
    const raw = JSON.parse(localStorage.getItem(INV_KEY) ?? '{}') as Record<string, unknown>;
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'number' && v > 0 && /^(stripe|splotch):\d+$/.test(k)) inv[k] = Math.min(999, Math.floor(v));
    }
  } catch {
    /* empty locker */
  }
  return inv;
}

function saveInv(): void {
  try {
    localStorage.setItem(INV_KEY, JSON.stringify(loadInv()));
  } catch {
    /* private mode */
  }
  invState.version += 1;
}

export function ownedCount(kind: PaintKind, colour: number): number {
  return loadInv()[`${kind}:${colour}`] ?? 0;
}

export function unitPrice(kind: PaintKind, colour: number): number {
  return PAINT.price[kind] * PAINT.tierMult[PAINT.tierOf(colour)];
}

/** Add one unit to the locker (a purchase or a grant). */
export function grantUnit(kind: PaintKind, colour: number): void {
  const store = loadInv();
  store[`${kind}:${colour}`] = (store[`${kind}:${colour}`] ?? 0) + 1;
  saveInv();
}

/** Take one unit out of the locker (into the hand). False if none owned. */
export function takeUnit(kind: PaintKind, colour: number): boolean {
  const store = loadInv();
  const k = `${kind}:${colour}`;
  if (!store[k]) return false;
  store[k] -= 1;
  if (!store[k]) delete store[k];
  saveInv();
  return true;
}

/** THE HAND — the one unit currently held on the ray in the bay, plus the
 *  live body-hover it would land on. MenuSystem drives this; the bay face
 *  reads it. */
export const bay = {
  held: null as PlacedPaint | null,
  /** Where the ray touches the body this frame (null = not on the body). */
  hover: null as { part: PaintPart; u: number; v: number } | null,
  version: 1,
};

/** Take a fresh unit from the locker into the hand (returns any held unit
 *  first). Default pose: modest size, upright. */
export function handTake(kind: PaintKind, colour: number): boolean {
  if (bay.held) handReturn();
  if (!takeUnit(kind, colour)) return false;
  bay.held = {
    kind,
    colour,
    variant: Math.floor(Math.random() * 8),
    part: 'chest',
    u: 0.75,
    v: 0.5,
    angle: 0,
    len: kind === 'stripe' ? 0.3 : 0.35,
    wid: kind === 'stripe' ? 0.12 : 0.5,
  };
  bay.version += 1;
  return true;
}

/** Put the held unit back in the locker. */
export function handReturn(): void {
  if (!bay.held) return;
  grantUnit(bay.held.kind, bay.held.colour);
  bay.held = null;
  bay.version += 1;
}

/** Commit the held unit onto the body at the hovered spot. */
export function handPlace(part: PaintPart, u: number, v: number): boolean {
  if (!bay.held) return false;
  const look = myLook();
  if (look.paint.length >= PAINT.maxUnits) return false;
  setLook({ paint: [...look.paint, { ...bay.held, part, u, v }] });
  bay.held = null;
  bay.version += 1;
  return true;
}

/** Lift the placed unit nearest (part, u, v) into the hand. u distance
 *  wraps; the pick radius is generous — a stripe is a thin target. */
export function handLift(part: PaintPart, u: number, v: number): boolean {
  if (bay.held) return false;
  const look = myLook();
  let best = -1;
  let bestD = 0.16; // pick radius in uv space
  look.paint.forEach((p, i) => {
    if (p.part !== part) return;
    const du = Math.min(Math.abs(p.u - u), 1 - Math.abs(p.u - u));
    const d = Math.hypot(du, p.v - v);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  if (best < 0) return false;
  const paint = [...look.paint];
  const [unit] = paint.splice(best, 1);
  setLook({ paint });
  bay.held = unit;
  bay.version += 1;
  return true;
}

/** The tutorial's graduation gift: one stripe in the contrast tone, once. */
export function grantGraduationStripe(onyxBase: boolean): void {
  try {
    if (localStorage.getItem('ff2-grad-paint') === '1') return;
    localStorage.setItem('ff2-grad-paint', '1');
  } catch {
    /* still grant in-session */
  }
  grantUnit('stripe', onyxBase ? 0 : 1); // white on onyx, black on white
}

/* ── the bake ─────────────────────────────────────────────────────────── */

const TONE_FILL: Record<string, string> = { white: '#f4f2ee', onyx: '#17171a' };

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

/** Deterministic per-unit rng (mulberry32) — a splotch rolls the same
 *  silhouette on every headset that ever bakes it. */
function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawUnit(g: CanvasRenderingContext2D, p: PlacedPaint, W: number, H: number): void {
  g.fillStyle = css(PAINT.colours[p.colour]);
  const cy = (1 - p.v) * H;
  // Three passes across the u seam so a wrap never cuts a unit.
  for (const off of [-1, 0, 1]) {
    const cx = (p.u + off) * W;
    if (cx < -W * 0.6 || cx > W * 1.6) continue;
    g.save();
    g.translate(cx, cy);
    g.rotate(p.angle * Math.PI * 2);
    if (p.kind === 'stripe') {
      const w = Math.max(4, p.len * W);
      const h = Math.max(3, p.wid * H * 0.35);
      g.beginPath();
      g.roundRect(-w / 2, -h / 2, w, h, h / 2);
      g.fill();
    } else {
      const r = Math.max(4, p.len * W * 0.3);
      const squash = 0.6 + 0.4 * (p.wid || 0.5);
      const roll = rng(p.variant + p.colour * 31 + 7);
      const points = 9;
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const rad = r * (0.62 + 0.38 * roll());
        const x = Math.cos(a) * rad;
        const y = Math.sin(a) * rad * squash;
        if (i === 0) g.moveTo(x, y);
        else {
          const pa = ((i - 0.5) / points) * Math.PI * 2;
          const pr = r * (0.75 + 0.35 * roll());
          g.quadraticCurveTo(Math.cos(pa) * pr, Math.sin(pa) * pr * squash, x, y);
        }
      }
      g.closePath();
      g.fill();
      // A couple of satellite droplets — the splat's read.
      for (let d = 0; d < 3; d++) {
        const a = roll() * Math.PI * 2;
        const dist = r * (1.15 + roll() * 0.5);
        const dr = r * (0.08 + roll() * 0.1);
        g.beginPath();
        g.arc(Math.cos(a) * dist, Math.sin(a) * dist * squash, dr, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }
}

interface PaintStore {
  canvas: HTMLCanvasElement;
  tex: CanvasTexture;
}

/**
 * Bake `look` onto every paint surface under `root`. Cheap enough to call
 * on every look change (a handful of canvas fills); call it only then —
 * never per frame.
 */
export function applyLook(root: Object3D, look: Look): void {
  root.traverse((o) => {
    const part = o.userData?.paintPart as PaintPart | undefined;
    if (!part) return;
    const mesh = o as Mesh;
    const mat = mesh.material as MeshStandardMaterial;
    if (Array.isArray(mesh.material)) return;
    const size = PAINT.canvas[part] ?? 256;
    let store = mesh.userData.paintStore as PaintStore | undefined;
    if (!store) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const tex = new CanvasTexture(canvas);
      tex.colorSpace = SRGBColorSpace;
      store = { canvas, tex };
      mesh.userData.paintStore = store;
    }
    const g = store.canvas.getContext('2d')!;
    const tone = (mesh.userData.paintTone as string) ?? 'white';
    g.fillStyle = TONE_FILL[tone] ?? TONE_FILL.white;
    g.fillRect(0, 0, size, size);
    for (const p of look.paint) {
      if (p.part === part) drawUnit(g, p, size, size);
    }
    store.tex.needsUpdate = true;
    // The map carries ALL the colour now (base tone included), so the
    // material tint steps aside — sheen/roughness stay the tone's own.
    if (mat.map !== store.tex) {
      mat.map = store.tex;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    }
  });
}

/* ── the demo look (dev + probes: prove the pipeline makes cool art) ──── */

export function demoLook(): Look {
  const s = (part: PaintPart, u: number, v: number, angle: number, len: number, wid: number, colour: number): PlacedPaint => ({
    kind: 'stripe', part, u, v, angle, len, wid, colour, variant: 0,
  });
  const b = (part: PaintPart, u: number, v: number, len: number, colour: number, variant: number): PlacedPaint => ({
    kind: 'splotch', part, u, v, angle: 0, len, wid: 0.5, colour, variant,
  });
  return {
    paint: [
      // Twin racing stripes down the chest front (front = u 0.75).
      s('chest', 0.72, 0.45, 0.25, 0.62, 0.16, 9), // ember
      s('chest', 0.78, 0.45, 0.25, 0.62, 0.16, 9),
      s('chest', 0.75, 0.45, 0.25, 0.66, 0.05, 1), // the black pin between
      // A gold sash crossing them.
      s('chest', 0.75, 0.62, 0.12, 0.34, 0.1, 20),
      // Shoulder chevrons, cyan.
      s('chest', 0.58, 0.82, 0.1, 0.16, 0.14, 11),
      s('chest', 0.92, 0.82, 0.9, 0.16, 0.14, 11),
      // The visor band across the face, cyan over a magenta underline.
      s('head', 0.75, 0.56, 0.0, 0.4, 0.12, 11),
      s('head', 0.75, 0.49, 0.0, 0.34, 0.05, 10),
      // Hip splotches — the chameleon's flanks.
      b('pelvis', 0.02, 0.55, 0.42, 10, 3), // magenta, right flank
      b('pelvis', 0.48, 0.55, 0.42, 13, 7), // lime, left flank
      b('pelvis', 0.75, 0.3, 0.3, 9, 11), // ember, front low
      // A crown dot on the skull.
      b('head', 0.75, 0.88, 0.2, 20, 5),
    ],
  };
}

/** Dev/test hook — rides the __ff2 namespace installed by the wrap. */
export function installPaintDevHook(): void {
  const hook = window.__ff2 as (typeof window.__ff2 & { paint?: unknown }) | undefined;
  if (!hook) return;
  hook.paint = {
    demo: (): void => setLook(demoLook()),
    clear: (): void => clearLook(),
    count: (): number => myLook().paint.length,
    set: (look: Look): void => setLook(look),
    // THE BAY, headless: the same ops the controllers drive.
    grant: (kind: PaintKind, colour: number): void => grantUnit(kind, colour),
    owned: (kind: PaintKind, colour: number): number => ownedCount(kind, colour),
    take: (kind: PaintKind, colour: number): boolean => handTake(kind, colour),
    place: (part: PaintPart, u: number, v: number): boolean => handPlace(part, u, v),
    lift: (part: PaintPart, u: number, v: number): boolean => handLift(part, u, v),
    ret: (): void => handReturn(),
    held: (): PlacedPaint | null => bay.held,
    // P3 wire verbs, for the headless channel probes.
    pack: (): string => myPackedLook(),
    unpack: (wire: unknown): Look => unpackLook(wire),
    hideAll: (): boolean => paintHiddenAll(),
    toggleHide: (): void => togglePaintHiddenAll(),
  };
}
