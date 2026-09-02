/**
 * THE DECKS — what a platform is MADE OF.
 *
 * The platform shop used to sell neon tints over one diamond-plate slab,
 * plus a grin, a bolt and a grid. FF2's decks are stage floors in the
 * club's realistic idiom (DESIGN.md §6: real materials, colour in light),
 * so a skin is now a MATERIAL first — charred oak, pale ash, quarried
 * slate, veined marble, black glass, river ice, jade, gold leaf, crimson
 * lacquer — and the neon tube round the edge is the light it stands in.
 *
 * Every deck is a procedural canvas skin: a colour map and a bump map from
 * the same seeded noise (the desert's material kit does the same for
 * rock and rust), cached per style and shared by every pad that wears it.
 * No image assets; the whole catalogue is a function of its seeds.
 */

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { makeRng, valueNoise2D } from './desert/paper.js';

export type DeckStyle =
  | 'oak'
  | 'charred'
  | 'ash'
  | 'redwood'
  | 'walnut'
  | 'slate'
  | 'marble'
  | 'obsidian'
  | 'frost'
  | 'jade'
  | 'bullion'
  | 'lacquer'
  | 'tide';

export interface DeckLook {
  map: CanvasTexture;
  bump: CanvasTexture;
  /** Tint over the map (the map is authored near its final tone; this is
   *  for lamp-light warmth or a stain). */
  color: number;
  roughness: number;
  metalness: number;
  bumpScale: number;
  envMapIntensity: number;
  /** Self-glow, for decks that burn or shine from within. */
  emissive?: number;
  emissiveIntensity?: number;
  /** Texture repeats per metre (ExtrudeGeometry UVs are in shape units). */
  repeat: [number, number];
  /** Rotate the map a quarter turn so boards run at the foe (planks only). */
  rotate?: boolean;
  /** Texture offset — a CENTRED design (the lacquer's inlay ring) needs its
   *  tile centre on the deck's origin, not half a tile off it. */
  offset?: [number, number];
}

const cache = new Map<DeckStyle, { map: CanvasTexture; bump: CanvasTexture }>();

type Shader = (x: number, y: number, n: (fx: number, fy: number, oct?: number) => number, r: () => number) => [number, number, number, number];

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Paint a tileable colour + height pair from a per-texel shader. */
function skin(style: DeckStyle, size: number, seed: number, shade: Shader): { map: CanvasTexture; bump: CanvasTexture } {
  const hit = cache.get(style);
  if (hit) return hit;
  const rng = makeRng(seed);
  const cells = 32;
  const nA = valueNoise2D(rng, cells);
  const nB = valueNoise2D(rng, cells);
  const n = (fx: number, fy: number, oct = 2): number => {
    let v = 0;
    let amp = 1;
    let sum = 0;
    for (let o = 0; o < oct; o++) {
      const s = 1 << o;
      v += (o % 2 ? nB : nA)(fx * s, fy * s) * amp;
      sum += amp;
      amp *= 0.5;
    }
    return v / sum;
  };
  const col = document.createElement('canvas');
  const hgt = document.createElement('canvas');
  col.width = col.height = hgt.width = hgt.height = size;
  const cc = col.getContext('2d')!;
  const hc = hgt.getContext('2d')!;
  const ci = cc.createImageData(size, size);
  const hi = hc.createImageData(size, size);
  const r2 = makeRng(seed * 3 + 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, h] = shade(x / size, y / size, n, r2);
      const i = (y * size + x) * 4;
      ci.data[i] = clamp01(r) * 255;
      ci.data[i + 1] = clamp01(g) * 255;
      ci.data[i + 2] = clamp01(b) * 255;
      ci.data[i + 3] = 255;
      const hv = clamp01(h) * 255;
      hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = hv;
      hi.data[i + 3] = 255;
    }
  }
  cc.putImageData(ci, 0, 0);
  hc.putImageData(hi, 0, 0);
  const wrap = (c: HTMLCanvasElement, srgb: boolean): CanvasTexture => {
    const t = new CanvasTexture(c);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = SRGBColorSpace;
    return t;
  };
  const out = { map: wrap(col, true), bump: wrap(hgt, false) };
  cache.set(style, out);
  return out;
}

/* ── planks ─────────────────────────────────────────────────────────── */

/** Boards across v: eight per tile, a dark seam between, long grain along
 *  u, the odd knot. `tone` is [r,g,b] of the wood; `spread` how much the
 *  boards differ; `seamDepth` how dark the gaps read. */
function planks(style: DeckStyle, seed: number, tone: [number, number, number], spread: number, seamDepth: number, grainStrength = 0.1): { map: CanvasTexture; bump: CanvasTexture } {
  const BOARDS = 8;
  return skin(style, 256, seed, (x, y, n, r) => {
    const board = Math.floor(y * BOARDS);
    const local = y * BOARDS - board;
    // Per-board tone drift (stable per board via a hash of its index).
    const drift = (Math.sin(board * 12.9898 + seed) * 43758.5453) % 1;
    const boardTone = 1 + (Math.abs(drift) - 0.5) * spread;
    // Long grain: fine sines along u warped by noise, plus figure.
    const grain = 0.5 + 0.5 * Math.sin((y * 40 + n(x * 3 + board, y * 8) * 4) * Math.PI * 2 + x * 2);
    const figure = n(x * 4, y * 6 + board * 3, 3);
    // Seam: a dark groove at each board edge, with a soft shoulder.
    const edge = Math.min(local, 1 - local);
    const seam = 1 - clamp01(edge / 0.06);
    const knot = clamp01((n(x * 6 + board * 7, y * 30) - 0.72) * 6);
    const l = boardTone * (1 + (figure - 0.5) * 0.25 + (grain - 0.5) * grainStrength) * (1 - seam * seamDepth) * (1 - knot * 0.35);
    const h = clamp01(0.55 + (grain - 0.5) * 0.3 + (figure - 0.5) * 0.2 - seam * 0.8 - knot * 0.2 + (r() - 0.5) * 0.02);
    return [tone[0] * l, tone[1] * l, tone[2] * l, h];
  });
}

/* ── stone + glass + metal ──────────────────────────────────────────── */

function slateSkin(): { map: CanvasTexture; bump: CanvasTexture } {
  // Flagstones: a 3×3 grid of tiles with grout, each a slightly different grey, cleaved.
  return skin('slate', 256, 3101, (x, y, n) => {
    const gx = x * 3;
    const gy = y * 3;
    const tx = Math.floor(gx);
    const ty = Math.floor(gy);
    const ex = Math.min(gx - tx, 1 - (gx - tx));
    const ey = Math.min(gy - ty, 1 - (gy - ty));
    const grout = 1 - clamp01(Math.min(ex, ey) / 0.035);
    const tileTone = 0.8 + ((Math.sin(tx * 7.1 + ty * 13.7) * 0.5) % 1) * 0.35;
    const cleave = n(x * 10 + tx, y * 10 + ty, 3);
    const l = tileTone * (0.52 + (cleave - 0.5) * 0.3) * (1 - grout * 0.6);
    const h = clamp01(0.5 + (cleave - 0.5) * 0.5 - grout * 0.9);
    return [l * 0.86, l * 0.9, l * 0.98, h];
  });
}

function marbleSkin(): { map: CanvasTexture; bump: CanvasTexture } {
  return skin('marble', 256, 3202, (x, y, n) => {
    // Veins: thin dark lines where a warped noise crosses a threshold band.
    const warp = n(x * 2, y * 2, 3);
    const v = Math.abs(Math.sin((x * 3 + warp * 5 + y * 1.3) * Math.PI));
    const vein = clamp01((0.06 - v) / 0.06) * (0.4 + n(x * 8, y * 8) * 0.6);
    const cloud = n(x * 3 + 5, y * 3 + 5, 3);
    const l = 0.92 + (cloud - 0.5) * 0.1 - vein * 0.45;
    const h = clamp01(0.6 - vein * 0.25 + (cloud - 0.5) * 0.08);
    return [l, l * 0.99, l * 0.97, h];
  });
}

function obsidianSkin(): { map: CanvasTexture; bump: CanvasTexture } {
  return skin('obsidian', 256, 3303, (x, y, n) => {
    // Black glass: conchoidal ripples in the height, almost nothing in the colour.
    const ripple = 0.5 + 0.5 * Math.sin((Math.hypot(x - 0.3, y - 0.6) * 14 + n(x * 4, y * 4) * 2) * Math.PI * 2);
    const sheen = n(x * 6, y * 6, 2);
    const l = 0.08 + sheen * 0.05;
    return [l, l * 1.05, l * 1.2, clamp01(0.5 + (ripple - 0.5) * 0.35)];
  });
}

function frostSkin(): { map: CanvasTexture; bump: CanvasTexture } {
  return skin('frost', 256, 3404, (x, y, n) => {
    // River ice: pale blue-white, frozen bubbles, a few long cracks.
    const bubbles = clamp01((n(x * 14, y * 14, 2) - 0.6) * 5);
    const crackA = Math.abs(Math.sin((x * 2.2 + n(x, y * 3) * 1.5) * Math.PI));
    const crack = clamp01((0.03 - crackA) / 0.03);
    const depth = n(x * 3, y * 3, 3);
    const l = 0.82 + (depth - 0.5) * 0.14 + bubbles * 0.1 - crack * 0.25;
    return [l * 0.88, l * 0.95, l * 1.02, clamp01(0.6 + bubbles * 0.25 - crack * 0.5 + (depth - 0.5) * 0.1)];
  });
}

function jadeSkin(): { map: CanvasTexture; bump: CanvasTexture } {
  return skin('jade', 256, 3505, (x, y, n) => {
    const cloud = n(x * 3, y * 3, 3);
    const swirl = 0.5 + 0.5 * Math.sin((cloud * 6 + x * 2) * Math.PI);
    const l = 0.42 + (cloud - 0.5) * 0.22 + swirl * 0.12;
    return [l * 0.55, l, l * 0.72, clamp01(0.55 + (cloud - 0.5) * 0.12)];
  });
}

function bullionSkin(): { map: CanvasTexture; bump: CanvasTexture } {
  // Gold leaf laid in squares, each a hair off the next, the overlaps a line.
  return skin('bullion', 256, 3606, (x, y, n) => {
    const gx = x * 4;
    const gy = y * 4;
    const tx = Math.floor(gx);
    const ty = Math.floor(gy);
    const lx = gx - tx;
    const ly = gy - ty;
    const overlap = clamp01((0.04 - Math.min(lx, ly)) / 0.04);
    const leafTone = 0.9 + ((Math.sin(tx * 5.3 + ty * 9.1) * 0.5) % 1) * 0.16;
    const burnish = n(x * 12, y * 12, 2);
    const l = leafTone * (0.9 + (burnish - 0.5) * 0.12) * (1 - overlap * 0.15);
    return [l, l * 0.8, l * 0.42, clamp01(0.6 + (burnish - 0.5) * 0.1 - overlap * 0.3)];
  });
}

function lacquerSkin(): { map: CanvasTexture; bump: CanvasTexture } {
  // Crimson lacquer with a gold inlay ring + radiating lines: a champion's floor.
  return skin('lacquer', 256, 3707, (x, y, n) => {
    const dx = x - 0.5;
    const dy = y - 0.5;
    const rr = Math.hypot(dx, dy);
    const ring = clamp01((0.012 - Math.abs(rr - 0.36)) / 0.012) + clamp01((0.008 - Math.abs(rr - 0.3)) / 0.008);
    const ang = Math.atan2(dy, dx);
    const ray = rr > 0.36 && rr < 0.5 ? clamp01((0.02 - Math.abs(((ang / (Math.PI * 2)) * 16) % 1 - 0.5) * 0.4) / 0.02) : 0;
    const gold = clamp01(ring + ray);
    const depth = n(x * 4, y * 4, 2);
    const base: [number, number, number] = [0.46 + (depth - 0.5) * 0.06, 0.08, 0.09];
    const g: [number, number, number] = [0.92, 0.72, 0.32];
    return [
      base[0] * (1 - gold) + g[0] * gold,
      base[1] * (1 - gold) + g[1] * gold,
      base[2] * (1 - gold) + g[2] * gold,
      clamp01(0.55 + gold * 0.2),
    ];
  });
}

function tideSkin(): { map: CanvasTexture; bump: CanvasTexture } {
  // Wet green stone under a slick — the tide's own ground.
  return skin('tide', 256, 3808, (x, y, n) => {
    const cloud = n(x * 4, y * 4, 3);
    const wet = 0.5 + 0.5 * Math.sin((n(x * 2, y * 2) * 4 + y * 3) * Math.PI * 2);
    const l = 0.2 + (cloud - 0.5) * 0.14 + wet * 0.08;
    return [l * 0.45, l, l * 0.7, clamp01(0.5 + (cloud - 0.5) * 0.2)];
  });
}

/* ── the looks ───────────────────────────────────────────────────────── */

const tuned = new Set<DeckStyle>();

/** The look for a deck style. The textures are shared per style and tuned
 *  once — repeat in tiles per metre (ExtrudeGeometry UVs are shape units)
 *  and, for planks, a quarter turn so the boards run at the foe. */
export function deckLook(style: DeckStyle): DeckLook {
  const look = rawLook(style);
  if (!tuned.has(style)) {
    tuned.add(style);
    for (const t of [look.map, look.bump]) {
      t.repeat.set(look.repeat[0], look.repeat[1]);
      t.center.set(0.5, 0.5);
      t.rotation = look.rotate ? Math.PI / 2 : 0;
      if (look.offset) t.offset.set(look.offset[0], look.offset[1]);
      t.needsUpdate = true;
    }
  }
  return look;
}

function rawLook(style: DeckStyle): DeckLook {
  switch (style) {
    case 'oak':
      return { ...planks('oak', 1001, [0.72, 0.5, 0.3], 0.14, 0.55), color: 0xffce9a, roughness: 0.55, metalness: 0.05, bumpScale: 0.5, envMapIntensity: 0.25, repeat: [1.05, 1.05], rotate: true };
    case 'charred':
      return { ...planks('charred', 1002, [0.16, 0.13, 0.12], 0.3, 0.7, 0.2), color: 0xffffff, roughness: 0.8, metalness: 0.02, bumpScale: 0.7, envMapIntensity: 0.2, emissive: 0xff5a1a, emissiveIntensity: 0.05, repeat: [1.05, 1.05], rotate: true };
    case 'ash':
      return { ...planks('ash', 1003, [0.82, 0.8, 0.74], 0.12, 0.45, 0.08), color: 0xffffff, roughness: 0.6, metalness: 0.03, bumpScale: 0.45, envMapIntensity: 0.3, repeat: [1.05, 1.05], rotate: true };
    case 'redwood':
      return { ...planks('redwood', 1004, [0.58, 0.24, 0.16], 0.16, 0.6, 0.12), color: 0xffffff, roughness: 0.5, metalness: 0.04, bumpScale: 0.5, envMapIntensity: 0.3, repeat: [1.05, 1.05], rotate: true };
    case 'walnut':
      return { ...planks('walnut', 1005, [0.34, 0.22, 0.15], 0.22, 0.65, 0.16), color: 0xffffff, roughness: 0.42, metalness: 0.05, bumpScale: 0.45, envMapIntensity: 0.4, repeat: [1.05, 1.05], rotate: true };
    case 'slate':
      return { ...slateSkin(), color: 0xffffff, roughness: 0.85, metalness: 0.05, bumpScale: 0.6, envMapIntensity: 0.3, repeat: [0.9, 0.9] };
    case 'marble':
      return { ...marbleSkin(), color: 0xffffff, roughness: 0.22, metalness: 0.02, bumpScale: 0.2, envMapIntensity: 0.6, repeat: [0.7, 0.7] };
    case 'obsidian':
      return { ...obsidianSkin(), color: 0xffffff, roughness: 0.12, metalness: 0.1, bumpScale: 0.25, envMapIntensity: 0.9, repeat: [0.8, 0.8] };
    case 'frost':
      return { ...frostSkin(), color: 0xffffff, roughness: 0.28, metalness: 0.02, bumpScale: 0.3, envMapIntensity: 0.6, emissive: 0x6ac8ff, emissiveIntensity: 0.06, repeat: [0.8, 0.8] };
    case 'jade':
      return { ...jadeSkin(), color: 0xffffff, roughness: 0.3, metalness: 0.02, bumpScale: 0.15, envMapIntensity: 0.55, repeat: [0.7, 0.7] };
    case 'bullion':
      return { ...bullionSkin(), color: 0xffffff, roughness: 0.32, metalness: 0.85, bumpScale: 0.2, envMapIntensity: 0.8, emissive: 0x3a2400, emissiveIntensity: 0.25, repeat: [1, 1] };
    case 'lacquer':
      return { ...lacquerSkin(), color: 0xffffff, roughness: 0.18, metalness: 0.08, bumpScale: 0.15, envMapIntensity: 0.6, emissive: 0x3a0606, emissiveIntensity: 0.18, repeat: [0.5, 0.5], offset: [0.25, 0.25] };
    case 'tide':
      return { ...tideSkin(), color: 0xffffff, roughness: 0.2, metalness: 0.05, bumpScale: 0.3, envMapIntensity: 0.7, emissive: 0x0d3f2b, emissiveIntensity: 0.14, repeat: [0.8, 0.8] };
  }
}
