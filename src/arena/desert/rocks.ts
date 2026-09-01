/**
 * Rocks of the desert (ported from yellkell/vrenv, mesas rebuilt for DESERT
 * 2.0): faceted boulders scattered across the sand in one instanced draw,
 * plus the big mesas that make the classic western horizon — no longer
 * stacked cardstock drums but ONE wind-carved loft each, strata baked into
 * vertex colour, ledges where a harder band held while the softer rock
 * under it blew away. (The grab-able paper rocks from the original are
 * dropped — the arena has no grab system.)
 */

import {
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  type Group as GroupT,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  Object3D,
} from 'three';
import { CONFIG } from './config.js';
import { makePaper, makeRng, valueNoise2D } from './paper.js';
import { desertHeight } from './terrain.js';
import { collapseStatic } from '../merge.js';

const P = CONFIG.palette;
const dummy = new Object3D();

function trs(x: number, y: number, z: number, sx: number, sy: number, sz: number, ry: number): Object3D['matrix'] {
  dummy.position.set(x, y, z);
  dummy.scale.set(sx, sy, sz);
  dummy.rotation.set(0, ry, 0);
  dummy.updateMatrix();
  return dummy.matrix;
}

/** Faceted boulders strewn across the dunes. */
export function buildBoulders(parent: GroupT): void {
  const rng = makeRng(CONFIG.terrain.seed * 7 + 1);
  const n = CONFIG.rocks.boulders;
  const half = CONFIG.terrain.size / 2 - 6;
  const cols = P.boulder.map((c) => new Color(c));
  const mesh = new InstancedMesh(new IcosahedronGeometry(1, 0), makePaper('#ffffff', 0.98), n);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  for (let i = 0; i < n; i++) {
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;
    const s = 0.4 + rng() * rng() * 2.2;
    const y = desertHeight(x, z) + s * 0.45;
    mesh.setMatrixAt(i, trs(x, y, z, s, s * (0.7 + rng() * 0.4), s, rng() * Math.PI));
    mesh.setColorAt(i, cols[(rng() * cols.length) | 0]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  parent.add(mesh);
}

/** One mesa material for the whole ring — the colour lives in the
 *  vertices, so every mesa merges into a single draw. */
const MESA_MAT = ((): ReturnType<typeof makePaper> => {
  const m = makePaper('#ffffff', 0.96);
  m.vertexColors = true;
  return m;
})();

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * A single mesa: a tapered loft, radially carved by two octaves of noise
 * (the long wind-scour down the face, then the fine grain), stepping in at
 * each stratum with a soft shoulder so the bands read as LEDGES and not as
 * paint. Strata colours come from the palette by height, cross-faded at
 * the band edges, mottled a touch, the cap left a shade paler where the
 * sky bleaches it. Smooth normals: the dusk light rolls over the face.
 */
function makeMesa(rng: () => number, height: number): Mesh {
  const layers = 4 + ((rng() * 3) | 0);
  const baseR = height * (0.48 + rng() * 0.2);
  const step = 0.84 + rng() * 0.06; // per-layer inset
  const radial = 30;
  const geo = new CylinderGeometry(1, 1, 1, radial, layers * 5, false);
  const pos = geo.attributes.position;
  const noiseA = valueNoise2D(rng, 12);
  const noiseB = valueNoise2D(rng, 16);
  const cols: number[] = [];
  const strata = P.rockStrata.map((c) => new Color(c));
  const first = (rng() * strata.length) | 0;
  const a = new Color();
  const b = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y01 = pos.getY(i) + 0.5; // 0 foot → 1 cap
    const rim = Math.hypot(x, z); // 1 on the wall/cap ring, 0 at the cap centre
    const ang = Math.atan2(z, x);
    // Strata: which band, and how far up it.
    const band = Math.min(layers - 1, Math.floor(y01 * layers));
    const local = y01 * layers - band;
    const rBand = baseR * Math.pow(step, band);
    // The shoulder: the top of each band pulls in toward the next.
    let r = rBand * (1 - (1 - step) * smoothstep(0.7, 1, local));
    // Wind carving — long scour, then grain — scaled with the band radius.
    const u = ang / (Math.PI * 2) + 0.5;
    const scour = noiseA(u * 6, y01 * 4 + band) - 0.5;
    const grain = noiseB(u * 24, y01 * 26) - 0.5;
    r += rBand * (scour * 0.22 + grain * 0.05);
    // Cap and foot rings keep the carved profile; the cap centre stays put.
    const rr = rim > 0.5 ? r : 0;
    pos.setXYZ(i, Math.cos(ang) * rr, y01 * height, Math.sin(ang) * rr);
    // Colour: this band's stratum, cross-faded into the next near the edge,
    // mottled by the scour, a shade darker under each ledge, pale on top.
    a.copy(strata[(first + band) % strata.length]);
    b.copy(strata[(first + band + 1) % strata.length]);
    a.lerp(b, smoothstep(0.85, 1, local));
    const shade = 1 + scour * 0.35 + (local < 0.1 ? -0.12 : 0);
    a.multiplyScalar(shade);
    if (rim <= 0.5 || y01 > 0.985) a.lerp(new Color(P.sandLight), 0.35);
    cols.push(a.r, a.g, a.b);
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const mesa = new Mesh(geo, MESA_MAT);
  mesa.castShadow = true;
  mesa.rotation.y = rng() * Math.PI * 2;
  return mesa;
}

/** A ring of mesas out toward the horizon — the western silhouette. */
export function buildMesas(parent: GroupT): void {
  const rng = makeRng(CONFIG.terrain.seed * 13 + 3);
  const { mesas, mesaRingMin, mesaRingMax } = CONFIG.rocks;
  // Mesas never move and their strata colours repeat, so the whole ring merges
  // down to one mesh per strata colour instead of ~5 slabs each.
  const ring = new Group();
  for (let i = 0; i < mesas; i++) {
    const a = (i / mesas) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const r = mesaRingMin + rng() * (mesaRingMax - mesaRingMin);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const height = 16 + rng() * 26;
    const mesa = makeMesa(rng, height);
    mesa.position.set(x, desertHeight(x, z) - 1, z);
    ring.add(mesa);
  }
  collapseStatic(ring);
  parent.add(ring);
}
