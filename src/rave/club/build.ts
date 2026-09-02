/**
 * THE CLUB — the venue itself. (It has no name; regulars just call it the
 * club, and the sign over the stage is a moon, not a word.)
 *
 * One double-height Art Deco hall the social floor fills: herringbone
 * parquet under an eclipse of counter-rotating brass rings, a crescent
 * stage under a golden sunburst, a smoked-oak bar with a backlit
 * ribbed-glass wall, oxblood velvet booths, a raised brass-railed terrace,
 * and a hushed STILL ROOM off the north-west corner for coming down. Where
 * FIRE FIGHT's club was diamond-plate and hazard amber, this is plaster,
 * oak, stone and champagne brass — the rave's neon is allowed in only as
 * LIGHT: coves, candles, signage, and the eclipse itself.
 *
 * Detail discipline (the reason it reads expensive): every edge that
 * matters carries thickness — skirting, dado and picture rails on the
 * walls, a nosing on every counter, fluting on every pilaster, joints in
 * the parquet, wear in the terrazzo, condensation rings on the marble.
 * Colour discipline: surfaces stay in the deco palette; saturation lives
 * in light fixtures only.
 *
 * Perf discipline: hundreds of meshes are baked to one draw call per
 * material look (collapseStatic); only the chandelier, the animated
 * materials and the candle flames stay live. Four real lights, everything
 * else emissive.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RingGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  type Object3D,
  type Scene,
} from 'three';
import { PALETTE, hueToColor } from '../config.js';
import { glowTexture } from '../materials/glow.js';
import { FoyerEnvironment } from '../arena/environment.js';
import { VOID_BG } from '../arena/voidkit.js';
import { CLUB, DECOR } from './config.js';
import {
  blackSteelMat,
  brassGlowMat,
  brassMat,
  bronzeMat,
  marbleTexture,
  oakTexture,
  parquetTexture,
  plasterTexture,
  ribbedGlassTexture,
  runnerTexture,
  terrazzoTexture,
  velvetTexture, neonMat, corrugatedTexture } from './materials.js';
import { collapseStatic } from './merge.js';
import { registerArcade } from './arcade.js';
import { registerStep } from './step.js';
import { font, onFontsReady } from '../ui/fonts.js';

export interface ChandelierRing {
  pivot: Group;
  glowMat: MeshStandardMaterial;
  speed: number;
}

/** The FOYER — the menu place. Not an antechamber of the club anymore but
 *  a piece of THE VOID (the set's own space, see arena/voidkit.ts): a
 *  floating platform in reactive darkness. The club's door is a button on
 *  the board, not a thing in the room. */
export interface FoyerRefs {
  root: Group;
  /** The world around the platform — ClubSystem idles it on the loop. */
  env: FoyerEnvironment;
}

/** Everything the systems animate or query — kept out of the static bake. */
export interface ClubRefs {
  root: Group;
  chandelier: {
    group: Group;
    rings: ChandelierRing[];
  };
  /** The brass inlay rings set into the dance floor (beat shimmer). */
  inlayMat: MeshBasicMaterial;
  /** The backlit ribbed glass behind the bar (slow breathing). */
  barBackMat: MeshStandardMaterial;
  /** Every candle flame in the room shares this sprite material (flicker). */
  candleMat: SpriteMaterial;
  /** The still room's lamp (breathes very slowly — a resting pulse). */
  stillLampMat: MeshStandardMaterial;
  /** The DJ console's fader glow (bar-synced blink). */
  consoleMat: MeshBasicMaterial;
}

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

/** A box with its transform applied — the workhorse of the whole build. */
function box(
  parent: Object3D,
  mat: MeshStandardMaterial | MeshBasicMaterial,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  ry = 0,
): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  parent.add(m);
  return m;
}

/** A round upholstered puck with filleted rims (stool + bench cushions). */
function roundedPuck(radius: number, height: number, fillet = 0.03): LatheGeometry {
  const r = Math.min(fillet, radius * 0.49, height * 0.49);
  const hh = height / 2;
  const pts: Vector2[] = [new Vector2(0.001, -hh)];
  for (let i = 0; i <= 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2);
    pts.push(new Vector2(radius - r + Math.cos(a) * r, -hh + r + Math.sin(a) * r));
  }
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(new Vector2(radius - r + Math.cos(a) * r, hh - r + Math.sin(a) * r));
  }
  pts.push(new Vector2(0.001, hh));
  return new LatheGeometry(pts, 20);
}

/** An elegant canvas sign plane (unlit, so it reads in any gloom). */
function signPlane(w: number, h: number, px: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void): Mesh {
  const c = document.createElement('canvas');
  c.width = px;
  c.height = Math.round((px * h) / w);
  const g = c.getContext('2d')!;
  draw(g, c.width, c.height);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  // The venue is built before the house woff2s land — re-ink the signage
  // the moment the real glyphs arrive (first paint used the fallback).
  onFontsReady(() => {
    g.clearRect(0, 0, c.width, c.height);
    draw(g, c.width, c.height);
    tex.needsUpdate = true;
  });
  const mesh = new Mesh(
    new PlaneGeometry(w, h),
    new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.renderOrder = 6;
  return mesh;
}

/* ═════════════════════════════ THE BUILD ═════════════════════════════════ */

export function buildClub(scene: Scene): ClubRefs {
  const root = new Group();
  root.name = 'the-club';

  const W = CLUB.halfW;
  const NZ = CLUB.minZ;
  const SZ = CLUB.maxZ;
  const H = CLUB.ceilH;

  buildFloors(root);
  buildWalls(root, W, NZ, SZ, H);
  buildCeiling(root, W, NZ, SZ, H);
  const chandelier = buildChandelier(root);
  const consoleMat = buildStage(root);
  buildMirror(root);
  const barBackMat = buildBar(root);
  const candleMat = new SpriteMaterial({
    map: glowTexture(),
    color: DECOR.candle,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    opacity: 0.85,
  });
  buildBooths(root, candleMat);
  buildTerrace(root);
  buildVestibule(root);
  const stillLampMat = buildStillRoom(root, candleMat);
  buildArcade(root);
  buildStep(root);
  const inlayMat = buildFloorInlay(root);
  buildLights(root);

  scene.add(root);

  // ── bake the static shell to a handful of draw calls ──────────────────
  // Live things wear a 'live-' name (and lights/sprites never merge).
  collapseStatic(root, (o) => {
    for (let n: Object3D | null = o; n; n = n.parent) {
      if (n.name.startsWith('live-')) return true;
      if (n === root) break;
    }
    return false;
  });

  return {
    root,
    chandelier,
    inlayMat,
    barBackMat,
    candleMat,
    stillLampMat,
    consoleMat,
  };
}

/* ── floors: parquet heart, terrazzo field, runner in the lounge ────────── */

function buildFloors(root: Group): void {
  const F = CLUB.floor;

  // Terrazzo everywhere first (the walkway field the parquet sits into).
  const terrazzo = new MeshStandardMaterial({
    map: terrazzoTexture([9, 8]),
    metalness: 0.25,
    roughness: 0.4,
  });
  const field = new Mesh(new PlaneGeometry(CLUB.halfW * 2, CLUB.maxZ - CLUB.minZ), terrazzo);
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, 0, (CLUB.minZ + CLUB.maxZ) / 2);
  root.add(field);

  // The dance floor: herringbone parquet disc, a hair proud so it never
  // z-fights the field, with a bronze surround ring easing the step.
  // Checker plate: metal, satin — it catches the eclipse overhead.
  const parquet = new Mesh(
    new CircleGeometry(F.r, 56),
    new MeshStandardMaterial({ map: parquetTexture([5, 5]), metalness: 0.7, roughness: 0.42 }),
  );
  parquet.rotation.x = -Math.PI / 2;
  parquet.position.set(F.x, 0.012, F.z);
  root.add(parquet);
  const surround = new Mesh(new RingGeometry(F.r, F.r + 0.14, 56), bronzeMat());
  surround.rotation.x = -Math.PI / 2;
  surround.position.set(F.x, 0.013, F.z);
  root.add(surround);

  // The lounge runner: a deco carpet down the booth aisle.
  const runner = new Mesh(
    new PlaneGeometry(1.7, 7.6),
    new MeshStandardMaterial({ map: runnerTexture([1, 3]), roughness: 0.92, metalness: 0 }),
  );
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(-6.1, 0.011, -3.4);
  root.add(runner);
}

/** The brass inlay set into the parquet — the raid ring's ghost: an outer
 *  ring, an inner ring, and 24 seat ticks. ClubSystem shimmers it. */
function buildFloorInlay(root: Group): MeshBasicMaterial {
  const F = CLUB.floor;
  const mat = new MeshBasicMaterial({
    color: DECOR.neon,
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const holder = new Group();
  holder.name = 'live-floor-inlay';
  holder.position.set(F.x, 0.017, F.z);
  const outer = new Mesh(new RingGeometry(F.r - 0.34, F.r - 0.28, 64), mat);
  outer.rotation.x = -Math.PI / 2;
  holder.add(outer);
  const inner = new Mesh(new RingGeometry(1.05, 1.09, 48), mat);
  inner.rotation.x = -Math.PI / 2;
  holder.add(inner);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const tick = new Mesh(new PlaneGeometry(0.05, 0.3), mat);
    tick.rotation.x = -Math.PI / 2;
    tick.rotation.z = -a;
    tick.position.set(Math.sin(a) * (F.r - 0.62), 0, Math.cos(a) * (F.r - 0.62));
    holder.add(tick);
  }
  root.add(holder);
  return mat;
}

/* ── walls: plaster panels, brass fluting, rails, drapes, sconces ───────── */

function buildWalls(root: Group, W: number, NZ: number, SZ: number, H: number): void {
  const plaster = new MeshStandardMaterial({ map: plasterTexture([5, 1.6]), roughness: 0.94, metalness: 0.02 });
  const wall = (w: number, x: number, z: number, ry: number): void => {
    const m = new Mesh(new PlaneGeometry(w, H + 1.8), plaster);
    // Walls run past the nominal ceiling: the dome steps read against them.
    m.position.set(x, (H + 1.8) / 2, z);
    m.rotation.y = ry;
    root.add(m);
  };
  // North — the stage's drape wall covers most of it, EXCEPT the mirror's
  // opening in the east corner: the glass there is a window into the
  // mirror recess behind the wall, so the plaster (like the drapes and the
  // trim runs below) parts around it instead of sealing it shut.
  const MR = CLUB.mirror;
  const mx0 = MR.x - MR.w / 2 - 0.05;
  const mx1 = MR.x + MR.w / 2 + 0.05;
  const mTop = MR.baseY + MR.h + 0.05;
  const wallH = H + 1.8;
  {
    const north = (w: number, x: number, y0: number, y1: number): void => {
      const m = new Mesh(new PlaneGeometry(w, y1 - y0), plaster);
      m.position.set(x, (y0 + y1) / 2, NZ);
      root.add(m);
    };
    north(mx0 + W, (mx0 - W) / 2, 0, wallH); // west of the opening
    north(W - mx1, (mx1 + W) / 2, 0, wallH); // east of the opening
    north(mx1 - mx0, MR.x, mTop, wallH); // over the lintel
  }
  wall(W * 2, 0, SZ, Math.PI); // south (vestibule)
  wall(SZ - NZ, -W, (NZ + SZ) / 2, Math.PI / 2); // west
  wall(SZ - NZ, W, (NZ + SZ) / 2, -Math.PI / 2); // east

  // Trim lines every wall carries: a steel kick plate, and the two rails
  // are NEON TUBES now — amber at dado height, cyan at picture height — on
  // dark clips, the lines that make concrete read as a dressed room.
  const skirt = blackSteelMat();
  const railMat = brassMat(0.34);
  const dadoNeon = neonMat(DECOR.cove, 1.15);
  const pictureNeon = neonMat(DECOR.neon, 1.2);
  const trimRun = (len: number, x: number, z: number, ry: number): void => {
    box(root, skirt, len, 0.16, 0.03, x, 0.08, z, ry);
    // Hazard-striped kick plate lip.
    box(root, brassGlowMat(0.35), len, 0.012, 0.034, x, 0.165, z, ry);
    box(root, dadoNeon, len, 0.022, 0.022, x, 1.0, z, ry);
    box(root, pictureNeon, len, 0.022, 0.022, x, 2.62, z, ry);
    // Clips every metre, holding the tubes off the wall.
    const n = Math.max(2, Math.round(len));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const cx = x + Math.cos(ry) * t * len;
      const cz = z - Math.sin(ry) * t * len;
      box(root, skirt, 0.04, 0.05, 0.03, cx, 1.0, cz, ry);
      box(root, skirt, 0.04, 0.05, 0.03, cx, 2.62, cz, ry);
    }
  };
  void railMat;
  // The north runs die into the mirror's frame the way the south's die
  // into the door portal — a dado rail straight across the glass would be
  // a brass line through everyone's reflection.
  trimRun(mx0 + W, (mx0 - W) / 2, NZ + 0.02, 0);
  trimRun(W - mx1, (mx1 + W) / 2, NZ + 0.02, 0);
  trimRun(SZ - NZ, -W + 0.02, (NZ + SZ) / 2, Math.PI / 2);
  trimRun(SZ - NZ, W - 0.02, (NZ + SZ) / 2, -Math.PI / 2);
  // The SOUTH wall's runs die into the entrance portal instead of ploughing
  // through it: a door surround interrupts the mouldings, and the picture
  // rail in particular used to draw a brass line clean across the transom
  // sitting in front of it. The gap clears the widest frame (±1.635).
  const doorGap = 1.75;
  const southRun = W - doorGap;
  for (const side of [-1, 1] as const) {
    trimRun(southRun, side * (doorGap + southRun / 2), SZ - 0.02, Math.PI);
  }

  // Fluted brass pilasters pace the long walls — each a slim core wrapped
  // in reeds with a stepped plinth and capital, deco to the bone. Spacing
  // varies subtly (the anti-repetition rule: no five modules identical).
  const coreMat = bronzeMat();
  const reedMat = brassMat(0.3);
  // The hall's wall dressing stops at the side rooms' doors: a pilaster or
  // a sconce that lands inside one of them is hall furniture standing in
  // somebody's room.
  //
  // This claimed to be generic and was not — it only ever tested the
  // ARCADE, so the moment a second room took the opposite corner it put a
  // fluted brass pilaster on the south wall INSIDE it, standing directly
  // over the portal like a keystone nobody designed, and another through
  // the west wall beside it. It tests every enclosed room now, which is
  // what it always said it did.
  const ROOMS = [CLUB.arcade, CLUB.quiet, CLUB.step];
  const inRoom = (x: number, z: number): boolean =>
    ROOMS.some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ);
  // RIVETED I-BEAM COLUMNS pace the long walls where the fluted brass
  // pilasters stood: a web between two flanges, a base plate bolted down,
  // a row of rivet heads up each flange edge, and a cap plate under the
  // slab. Spacing still varies subtly (no five modules identical).
  const pilaster = (x: number, z: number): void => {
    if (inRoom(x, z)) return;
    const g = new Group();
    g.position.set(x, 0, z);
    const base = new Mesh(new BoxGeometry(0.44, 0.05, 0.3), skirt);
    base.position.y = 0.025;
    g.add(base);
    const H = 2.7;
    const web = new Mesh(new BoxGeometry(0.03, H, 0.16), coreMat);
    web.position.y = 0.05 + H / 2;
    g.add(web);
    for (const sx of [-1, 1]) {
      const flange = new Mesh(new BoxGeometry(0.03, H, 0.26), reedMat);
      flange.position.set(sx * 0.1, 0.05 + H / 2, 0);
      g.add(flange);
      // Rivet heads up both edges of each flange.
      for (let k = 0; k < 9; k++) {
        for (const sz of [-1, 1]) {
          const rivet = new Mesh(new CylinderGeometry(0.014, 0.016, 0.012, 8), skirt);
          rivet.rotation.z = Math.PI / 2;
          rivet.position.set(sx * 0.12, 0.25 + k * 0.28, sz * 0.095);
          g.add(rivet);
        }
      }
    }
    // Four bolts at the base plate's corners.
    for (const [bx, bz] of [
      [-0.17, -0.11],
      [0.17, -0.11],
      [-0.17, 0.11],
      [0.17, 0.11],
    ]) {
      const bolt = new Mesh(new CylinderGeometry(0.018, 0.018, 0.02, 6), reedMat);
      bolt.position.set(bx, 0.06, bz);
      g.add(bolt);
    }
    const cap = new Mesh(new BoxGeometry(0.36, 0.05, 0.3), skirt);
    cap.position.y = 0.05 + H + 0.025;
    g.add(cap);
    root.add(g);
  };
  // East wall (between bar and corners) + west wall (pacing the booths).
  for (const z of [-8.1, 1.6, 3.0]) pilaster(W - 0.14, z);
  for (const z of [-7.9, -4.9, -1.9, 1.4, 3.0]) pilaster(-W + 0.14, z);
  // South wall, flanking the vestibule.
  for (const x of [-3.1, 3.1, -6.4, 6.4]) pilaster(x, SZ - 0.14);

  // Sconces: brass stem, half-shade, and a warm double glow (up + down).
  const shadeMat = brassGlowMat(0.55);
  const glowMat = new SpriteMaterial({
    map: glowTexture(),
    color: DECOR.cove,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    opacity: 0.5,
  });
  // CAGE LAMPS where the deco sconces hung: a junction box on the wall, a
  // short conduit, and a bulb in a wire cage — the bulb a hot amber core
  // in a warm sprite, the cage six bars and two rings of black steel.
  const bulbMat = new MeshStandardMaterial({
    color: 0xfff1d6,
    emissive: DECOR.candle,
    emissiveIntensity: 1.6,
    roughness: 0.4,
  });
  const sconce = (x: number, z: number, ry: number): void => {
    if (inRoom(x, z)) return;
    const g = new Group();
    g.position.set(x, 1.78, z);
    g.rotation.y = ry;
    const back = new Mesh(new BoxGeometry(0.12, 0.12, 0.05), coreMat);
    g.add(back);
    const conduit = new Mesh(new CylinderGeometry(0.014, 0.014, 0.16, 8), coreMat);
    conduit.rotation.x = Math.PI / 2;
    conduit.position.set(0, 0, 0.1);
    g.add(conduit);
    const bulb = new Mesh(new SphereGeometry(0.038, 12, 10), bulbMat);
    bulb.position.set(0, 0, 0.21);
    g.add(bulb);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bar = new Mesh(new CylinderGeometry(0.003, 0.003, 0.15, 4), skirt);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(Math.sin(a) * 0.055, Math.cos(a) * 0.055, 0.215);
      g.add(bar);
    }
    for (const dz of [0.15, 0.27]) {
      const ring = new Mesh(new TorusGeometry(0.055, 0.003, 4, 18), skirt);
      ring.position.set(0, 0, dz);
      g.add(ring);
    }
    const glow = new Sprite(glowMat);
    glow.scale.setScalar(0.5);
    glow.position.set(0, 0, 0.22);
    g.add(glow);
    void shadeMat;
    root.add(g);
  };
  for (const z of [-7.0, 0.5, 2.4]) sconce(W - 0.16, z, -Math.PI / 2);
  for (const z of [-6.35, -3.45, -0.55, 2.4]) sconce(-W + 0.16, z, Math.PI / 2);
  for (const x of [-4.75, 4.75]) sconce(x, SZ - 0.16, Math.PI);
}

/* ── ceiling: a stepped deco dome over the floor, coved all the way up ──── */

function buildCeiling(root: Group, W: number, NZ: number, SZ: number, H: number): void {
  const F = CLUB.floor;
  const slabMat = new MeshStandardMaterial({ color: DECOR.plasterDeep, roughness: 0.95, metalness: 0.02 });
  const fasciaMat = new MeshStandardMaterial({ color: 0x1c1922, roughness: 0.9, metalness: 0.05 });
  // The dome's step coves burn cyan (neon), the perimeter run hazard amber.
  const coveMat = new MeshStandardMaterial({
    color: 0x1d2228,
    emissive: DECOR.neon,
    emissiveIntensity: 1.5,
    metalness: 0.5,
    roughness: 0.4,
  });

  // Main slab with a circular opening over the dance floor — built as four
  // rectangles + a ring closing the circle.
  const R0 = 3.3;
  const slab = (w: number, d: number, x: number, z: number): void => {
    const m = new Mesh(new PlaneGeometry(w, d), slabMat);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, H, z);
    root.add(m);
  };
  slab(W * 2, F.z - R0 - NZ, 0, (NZ + F.z - R0) / 2); // north of the opening
  slab(W * 2, SZ - (F.z + R0), 0, (F.z + R0 + SZ) / 2); // south
  slab(W - F.r + (F.r - R0), F.z + R0 - (F.z - R0), -(W + R0) / 2 + 0, F.z); // west strip
  slab(W - R0, R0 * 2, (W + R0) / 2, F.z); // east strip
  const closer = new Mesh(new RingGeometry(R0, R0 + 1.02, 40), slabMat);
  closer.rotation.x = Math.PI / 2;
  closer.position.set(F.x, H - 0.001, F.z);
  root.add(closer);

  // The dome: three stepped rings rising to a cap — each step a vertical
  // fascia + flat ring, with a brass cove strip glowing on every inner lip.
  const steps = [
    { r: R0, up: 0.55 },
    { r: 2.55, up: 0.55 },
    { r: 1.85, up: 0.6 },
  ];
  let y = H;
  for (const s of steps) {
    const fascia = new Mesh(new CylinderGeometry(s.r, s.r, s.up, 40, 1, true), fasciaMat);
    fascia.position.set(F.x, y + s.up / 2, F.z);
    (fascia.material as MeshStandardMaterial).side = DoubleSide;
    root.add(fascia);
    y += s.up;
    const next = steps[steps.indexOf(s) + 1]?.r ?? 1.3;
    const tread = new Mesh(new RingGeometry(next, s.r, 40), slabMat);
    tread.rotation.x = Math.PI / 2;
    tread.position.set(F.x, y, F.z);
    root.add(tread);
    // The cove: a slim glowing torus tucked into each step's corner.
    const cove = new Mesh(new TorusGeometry(s.r - 0.06, 0.022, 6, 48), coveMat);
    cove.rotation.x = Math.PI / 2;
    cove.position.set(F.x, y - 0.05, F.z);
    root.add(cove);
  }
  const cap = new Mesh(new CircleGeometry(1.3, 32), fasciaMat);
  cap.rotation.x = Math.PI / 2;
  cap.position.set(F.x, y, F.z);
  root.add(cap);

  // Perimeter cove where the walls meet the slab — the room's base glow.
  const runMat = brassGlowMat(1.0);
  for (const [len, x, z, ry] of [
    [W * 2 - 0.3, 0, NZ + 0.09, 0],
    [W * 2 - 0.3, 0, SZ - 0.09, 0],
    [SZ - NZ - 0.3, -W + 0.09, (NZ + SZ) / 2, Math.PI / 2],
    [SZ - NZ - 0.3, W - 0.09, (NZ + SZ) / 2, Math.PI / 2],
  ] as const) {
    box(root, runMat, len, 0.045, 0.045, x, H - 0.05, z, ry);
  }
}

/* ── the eclipse chandelier ─────────────────────────────────────────────── */

function buildChandelier(root: Group): ClubRefs['chandelier'] {
  const F = CLUB.floor;
  const group = new Group();
  group.name = 'live-chandelier';
  group.position.set(F.x, CLUB.chandelier.y, F.z);
  root.add(group);

  const cableMat = blackSteelMat();
  const rings: ChandelierRing[] = [];
  CLUB.chandelier.rings.forEach((def, i) => {
    const pivot = new Group();
    // Each ring hangs at its own height — a shallow inverted cone of rings.
    pivot.position.y = i * 0.16;
    group.add(pivot);

    const brass = new Mesh(new TorusGeometry(def.r, 0.028, 10, 56), brassMat(0.22));
    brass.rotation.x = Math.PI / 2;
    pivot.add(brass);

    // The LED channel on the ring's underside — this is what phases. Cyan
    // now: the rings are the venue's neon, not its brass.
    const glowMat = new MeshStandardMaterial({
      color: 0x1d2228,
      emissive: DECOR.neon,
      emissiveIntensity: 1.4,
      metalness: 0.5,
      roughness: 0.4,
    });
    const glow = new Mesh(new TorusGeometry(def.r, 0.011, 6, 56), glowMat);
    glow.rotation.x = Math.PI / 2;
    glow.position.y = -0.035;
    pivot.add(glow);

    // Three hanger cables per ring, up into the dome.
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + i * 0.6;
      const drop = 1.6 - i * 0.16;
      const cable = new Mesh(new CylinderGeometry(0.004, 0.004, drop, 4), cableMat);
      cable.position.set(Math.sin(a) * def.r, drop / 2, Math.cos(a) * def.r);
      pivot.add(cable);
    }
    rings.push({ pivot, glowMat, speed: def.speed });
  });

  // No moon at the heart. The crescent disc and its corona used to hang in
  // the middle of the rings; the rings are the fixture, and they read
  // better as an open eclipse with nothing in the eye of it.
  const stem = new Mesh(new CylinderGeometry(0.012, 0.012, 1.6, 6), cableMat);
  stem.position.y = 0.8;
  group.add(stem);

  // THE TRUSS. A square lattice frame hung in the dome's mouth, the rings
  // turning inside it: four chords, a rail of diagonals between each pair,
  // and the ring cables now read as hung from something. Static, so it
  // lives beside the live group rather than in it.
  const truss = new Group();
  const T = 3.05; // half-span, just inside the dome's opening (R0 3.3)
  const chordMat = bronzeMat();
  const diagMat = brassMat(0.4);
  const ty = CLUB.ceilH + 0.28;
  for (const side of [0, 1, 2, 3]) {
    const a = (side * Math.PI) / 2;
    const cx = F.x + Math.cos(a) * T;
    const cz = F.z + Math.sin(a) * T;
    for (const dy of [-0.16, 0.16]) {
      const chord = new Mesh(new BoxGeometry(T * 2, 0.05, 0.05), chordMat);
      chord.position.set(cx, ty + dy, cz);
      chord.rotation.y = -a + Math.PI / 2;
      truss.add(chord);
    }
    // Diagonals, zig-zagging between the chords.
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t0 = (i / n - 0.5) * T * 2;
      const t1 = ((i + 1) / n - 0.5) * T * 2;
      const len = Math.hypot(t1 - t0, 0.32);
      const diag = new Mesh(new BoxGeometry(len, 0.028, 0.028), diagMat);
      const along = (t0 + t1) / 2;
      // Place along the chord's line (it runs across the side).
      const dx = Math.sin(a) * along;
      const dz = -Math.cos(a) * along;
      diag.position.set(cx + dx, ty, cz + dz);
      diag.rotation.y = -a + Math.PI / 2;
      diag.rotation.z = (i % 2 ? 1 : -1) * Math.atan2(0.32, t1 - t0);
      truss.add(diag);
    }
  }
  root.add(truss);

  return { group, rings };
}

/* ── the stage: crescent riser, DJ console, sunburst, sheets ─────────────── */

function buildStage(root: Group): MeshBasicMaterial {
  const S = CLUB.stage;
  const oakSkirtMat = new MeshStandardMaterial({ map: oakTexture([6, 1]), roughness: 0.55, metalness: 0.05 });
  const topMat = new MeshStandardMaterial({ map: parquetTexture([3, 3]), metalness: 0.2, roughness: 0.42 });

  // Riser: a half-drum bulging SOUTH toward the crowd. Skirt, lid and
  // nosing all cover the SAME half now — the three used to be authored a
  // half-turn apart, so the curved skirt hid inside the wall and the whole
  // front of the stage was an open see-through shell.
  const drum = new Mesh(new CylinderGeometry(S.r, S.r, S.h, 40, 1, true, -Math.PI / 2, Math.PI), oakSkirtMat);
  drum.position.set(0, S.h / 2, S.z);
  root.add(drum);
  const lid = new Mesh(new CircleGeometry(S.r, 40, Math.PI, Math.PI), topMat);
  lid.rotation.x = -Math.PI / 2;
  lid.position.set(0, S.h + 0.001, S.z);
  root.add(lid);
  // The flat back of the half-drum, closed — the backstage walk sees a
  // panelled face, not the underside of the lid.
  box(root, oakSkirtMat, S.r * 2, S.h, 0.07, 0, S.h / 2, S.z - 0.03);
  // Brass nosing along the curved lip + two shallow guest steps at centre.
  const nose = new Mesh(new TorusGeometry(S.r, 0.02, 8, 40, Math.PI), brassMat(0.25));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, S.h, S.z);
  root.add(nose);
  const stepMat = blackSteelMat();
  box(root, stepMat, 1.6, 0.15, 0.34, 0, 0.075, S.z + S.r + 0.14);
  box(root, stepMat, 1.2, 0.3, 0.3, 0, 0.15, S.z + S.r - 0.05);

  // THE SUNBURST: steel ribs fanning from a half-disc hub on the wall,
  // the deco signature the room was built around — in the new metal, and
  // burning GOLD at its centre. It is the one thing in the house the MC
  // stands in front of, so the house lets it be the sun.
  const hubY = S.h + 1.15;
  const wallZ = CLUB.minZ + 0.1;
  const ribMat = brassMat(0.3);
  const RIBS = 21;
  for (let i = 0; i < RIBS; i++) {
    const a = (i / (RIBS - 1)) * Math.PI - Math.PI / 2; // −90°…+90° fan
    const len = 2.5 + (i % 2) * 0.5; // alternating lengths — a real burst
    const rib = new Mesh(new BoxGeometry(0.05, len, 0.03), ribMat);
    rib.position.set(Math.sin(a) * (len / 2 + 0.42), hubY + Math.cos(a) * (len / 2 + 0.42), wallZ);
    rib.rotation.z = -a;
    root.add(rib);
  }
  // The golden centre: a lit half-disc, ringed in brass, with a short
  // collar of gold tube at its foot so the glow has an edge to sit on.
  const hub = new Mesh(
    new CircleGeometry(0.42, 24, 0, Math.PI),
    new MeshStandardMaterial({
      color: 0x4a3410,
      emissive: DECOR.gold,
      emissiveIntensity: 1.35,
      metalness: 0.55,
      roughness: 0.35,
    }),
  );
  hub.position.set(0, hubY, wallZ + 0.01);
  root.add(hub);
  const halo = new Mesh(new TorusGeometry(0.44, 0.022, 8, 30, Math.PI), brassMat(0.4));
  halo.position.set(0, hubY, wallZ + 0.03);
  root.add(halo);
  box(root, neonMat(DECOR.gold, 1.15), 0.92, 0.03, 0.03, 0, hubY - 0.01, wallZ + 0.04);

  // CORRUGATED STEEL across the whole north wall behind the burst, where
  // the velvet hung: full-height sheets in alternating relief so the ribs
  // catch the light, a magenta neon tube run along their foot washing up
  // the metal, and a steel channel capping the top. They PART around the
  // mirror in the east corner — its glass is a window through this wall.
  const sheetMat = new MeshStandardMaterial({ map: corrugatedTexture([1.4, 3.2]), roughness: 0.48, metalness: 0.78 });
  const MR = CLUB.mirror;
  const footNeon = neonMat(DECOR.neonHot, 1.1);
  for (let i = 0; i < 12; i++) {
    const x = -8.25 + i * 1.5;
    if (Math.abs(x - MR.x) < MR.w / 2 + 1.0) continue; // the mirror's span
    const panel = new Mesh(new PlaneGeometry(1.56, 4.6), sheetMat);
    panel.position.set(x, 2.3, CLUB.minZ + 0.05 + (i % 2) * 0.05);
    root.add(panel);
    // The tube at its foot, on clips, just clear of the stage lid.
    box(root, footNeon, 1.4, 0.022, 0.022, x, S.h + 0.06, CLUB.minZ + 0.16);
    box(root, blackSteelMat(), 0.04, 0.05, 0.05, x - 0.6, S.h + 0.06, CLUB.minZ + 0.14);
    box(root, blackSteelMat(), 0.04, 0.05, 0.05, x + 0.6, S.h + 0.06, CLUB.minZ + 0.14);
  }
  // A steel channel caps the sheets where the drape rail hung.
  box(root, bronzeMat(), 16.9, 0.08, 0.12, 0, 4.62, CLUB.minZ + 0.09);

  // The DJ console: an angled smoked-oak desk with a glowing fader strip
  // and two platters — where the MC earns the name.
  const deskMat = new MeshStandardMaterial({ map: oakTexture([2, 1]), roughness: 0.5, metalness: 0.08 });
  const console = new Group();
  // Stood on the footprint the physics tables read, so the desk the drinks
  // ring off is the desk you can see (club/config.ts, stage.desk).
  console.position.set(0, S.h, S.desk.z);
  // The desk WORKS for the MC: fascia, fader surface and platters face HIM
  // (he stands north of it, deeper on the stage) — the crowd gets the oak
  // back of a working console, the way a real booth reads.
  console.rotation.y = Math.PI;
  const body = new Mesh(new BoxGeometry(2.2, 0.92, 0.6), deskMat);
  body.position.y = 0.46;
  console.add(body);
  // Width, depth and TOP all come from the config: the brass fascia is the
  // widest, tallest part of the desk, so it's the part the drinks' collision
  // box describes. Sizing it from there means the two can't drift apart.
  const FASCIA_H = 0.2;
  const fascia = new Mesh(new BoxGeometry(S.desk.halfW * 2, FASCIA_H, S.desk.halfD * 2), brassMat(0.35));
  fascia.position.y = S.desk.top - S.h - FASCIA_H / 2;
  console.add(fascia);
  // The lit control surface (canvas: faders, dials, a spectrum bar).
  const cc = document.createElement('canvas');
  cc.width = 512;
  cc.height = 128;
  const g = cc.getContext('2d')!;
  g.fillStyle = '#0c0a12';
  g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 9; i++) {
    const x = 36 + i * 40;
    g.strokeStyle = 'rgba(201,168,106,0.8)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, 22);
    g.lineTo(x, 106);
    g.stroke();
    g.fillStyle = i % 3 === 0 ? css(PALETTE.magenta) : i % 3 === 1 ? css(PALETTE.cyan) : css(DECOR.cove);
    g.fillRect(x - 9, 34 + ((i * 37) % 52), 18, 10);
  }
  for (let i = 0; i < 4; i++) {
    g.strokeStyle = 'rgba(201,168,106,0.9)';
    g.beginPath();
    g.arc(420 + (i % 2) * 52, 40 + Math.floor(i / 2) * 52, 14, 0, Math.PI * 2);
    g.stroke();
  }
  const consoleTex = new CanvasTexture(cc);
  consoleTex.colorSpace = SRGBColorSpace;
  const consoleMat = new MeshBasicMaterial({ map: consoleTex, transparent: true });
  const surface = new Mesh(new PlaneGeometry(2.0, 0.5), consoleMat);
  surface.rotation.x = -Math.PI / 2 + 0.42;
  surface.position.set(0, 0.97, 0.06);
  surface.name = 'live-console';
  console.add(surface);
  for (const sx of [-0.62, 0.62]) {
    const platter = new Mesh(new CylinderGeometry(0.22, 0.22, 0.03, 24), blackSteelMat());
    platter.position.set(sx, 0.945, 0.02);
    platter.rotation.x = 0.42 * 0.5;
    console.add(platter);
    const pip = new Mesh(new CylinderGeometry(0.035, 0.035, 0.036, 12), brassMat(0.2));
    pip.position.set(sx, 0.95, 0.02);
    pip.rotation.x = 0.42 * 0.5;
    console.add(pip);
  }
  root.add(console);

  // Nothing hangs over the stage: the wall behind the MC is his backdrop,
  // not a billboard. (The moon-phase house mark used to live here.)

  // Footlights along the stage lip: a run of small warm LENSES so the riser
  // face reads and the MC gets his uplight.
  //
  // Whole circles, not half-shells. They were 180° cylinders, each turned to
  // face out along the crescent — which is a real fixture, a scallop shade
  // open to the front, and it read as one from precisely one spot on the
  // floor. From anywhere else the run was a scatter of crescents all
  // pointing different ways, and from the terrace it looked like the lamps
  // were twisting. A full round has no facing to get wrong: it reads as a
  // lamp from every seat in the room, which is the only thing this row of
  // seven has to do.
  const footMat = brassGlowMat(1.6);
  for (let i = -3; i <= 3; i++) {
    const a = (i / 8) * Math.PI; // spread across the crescent's front
    const fx = Math.sin(a) * (S.r - 0.12);
    const fz = S.z + Math.cos(a) * (S.r - 0.12);
    // 16 sides, where the half wanted 10: the same silhouette smoothness
    // carried round twice the arc. No rotation — a full round is turned
    // the same way whichever way you turn it.
    const lens = new Mesh(new CylinderGeometry(0.05, 0.07, 0.045, 16), footMat);
    lens.position.set(fx, S.h + 0.02, fz);
    root.add(lens);
  }

  return consoleMat;
}

/* ── THE BACK BAR'S BOTTLES ──────────────────────────────────────────────
 *
 * Twenty-four bottles used to be twenty-four Meshes, each carrying its own
 * LatheGeometry AND its own MeshStandardMaterial: twenty-four draw calls
 * and twenty-four material binds for the smallest objects in the room —
 * spending the budget of a crowd scene on a shelf you could count in one
 * glance. One bottle every 66 cm is not a bar, it's a display case.
 *
 * Instancing makes the COUNT nearly free, and that is what pays for a bar
 * that looks stocked: four shelves instead of three, packed shoulder to
 * shoulder, with a second rank behind showing through the gaps — hundreds
 * of bottles in THREE draw calls, one per silhouette.
 *
 * Two more things ride along. The bottles are OPAQUE now: at 0.88 they were
 * nominally see-through and paid for it twice over — sorted every frame and
 * blended over each other — and three hundred of them overlapping would
 * have turned the shelf to mush rather than glass. And the profile is cut
 * down to six rings: a 4 cm bottle two metres behind a glass wall is worth
 * a shoulder and a neck, not a moulded lip.
 */

/** Drink colours — the one place saturated colour touches glass. */
const BOTTLE_TINTS = [0xc97a1e, 0x8a3a10, 0x4fb7ff, 0x7dff5a, 0xb06bff, 0xe8352a, 0xf2e9d4, 0xffd24a];
/** Silhouettes: squat rum, tall spirit, bulb liqueur. Built UNIT-HEIGHT and
 *  stretched per instance, which is exactly what varying `h` did before —
 *  the radius stays put while the bottle grows. */
const BOTTLE_R = 0.036;
const BOTTLE_SEGMENTS = 7;
function bottleProfile(kind: number): Vector2[] {
  const r = BOTTLE_R;
  const bodyTop = kind === 0 ? 0.62 : kind === 1 ? 0.5 : 0.42;
  const neckR = r * (kind === 2 ? 0.24 : 0.3);
  return [
    new Vector2(0, 0),
    new Vector2(r * 0.92, 0.01),
    new Vector2(r, bodyTop),
    new Vector2(r * (kind === 2 ? 0.9 : 0.66), bodyTop + 0.16),
    new Vector2(neckR, 0.86),
    new Vector2(neckR * 1.45, 1),
    new Vector2(0, 1),
  ];
}

/** Shelf heights, floor up. The fourth is new: the glass wall runs to 2.75
 *  and the old top shelf left three quarters of a metre of it bare. */
const SHELF_YS = [0.62, 1.18, 1.74, 2.3];
/** Where each rank stands across the shelf's 26 cm depth, how tightly it is
 *  packed, and how much light it gets. The back rank is half as dense and
 *  darker: it exists to fill the gaps between the front rank's shoulders,
 *  and anything more is triangles nobody will ever see. */
const BOTTLE_RANKS = [
  { x: -0.225, spacing: 0.115, offset: 0, shade: 1 },
  { x: -0.105, spacing: 0.23, offset: 0.115, shade: 0.62 },
];

function buildBackBarBottles(
  root: Group,
  B: typeof CLUB.bar,
  len: number,
  zc: number,
): void {
  const shelfMat = new MeshStandardMaterial({ map: marbleTexture([3, 0.4]), metalness: 0.2, roughness: 0.25 });
  for (const y of SHELF_YS) box(root, shelfMat, 0.26, 0.03, len - 0.3, B.backX - 0.16, y, zc);

  // Lay every bottle out first — the instance count has to be known before
  // the mesh exists — then deal them into one bucket per silhouette.
  const buckets: { x: number; y: number; z: number; h: number; tint: Color }[][] = [[], [], []];
  const z0 = B.z0 + 0.3;
  const z1 = B.z1 - 0.3;
  let n = 0;
  SHELF_YS.forEach((y, shelf) => {
    for (const rank of BOTTLE_RANKS) {
      for (let z = z0 + rank.offset; z <= z1; z += rank.spacing) {
        // Deterministic, not random: the club is rebuilt on every entry and
        // a shelf that reshuffles itself when you walk out and back in is a
        // thing you notice.
        const i = n++;
        const kind = (i + shelf) % 3;
        const tint = new Color(BOTTLE_TINTS[(i * 3 + shelf * 5) % BOTTLE_TINTS.length]);
        tint.multiplyScalar(rank.shade);
        buckets[kind].push({
          x: B.backX + rank.x,
          y: y + 0.015,
          z,
          h: 0.24 + ((i + shelf) % 3) * 0.035,
          tint,
        });
      }
    }
  });

  const _m = new Matrix4();
  buckets.forEach((bottles, kind) => {
    if (!bottles.length) return;
    const mat = new MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.32,
      roughness: 0.18,
      metalness: 0.05,
    });
    // instanceColor reaches the fragment shader as vColor and multiplies the
    // DIFFUSE. These are backlit glass, so most of their tint lives in the
    // emissive — one line makes that per-instance too, and three hundred
    // bottles glow three hundred colours off one material.
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalEmissiveRadiance = emissive;',
        'vec3 totalEmissiveRadiance = emissive * vColor.rgb;',
      );
    };
    const mesh = new InstancedMesh(new LatheGeometry(bottleProfile(kind), BOTTLE_SEGMENTS), mat, bottles.length);
    mesh.name = `live-bar-bottles-${kind}`;
    bottles.forEach((b, i) => {
      mesh.setMatrixAt(i, _m.makeScale(1, b.h, 1).setPosition(b.x, b.y, b.z));
      mesh.setColorAt(i, b.tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    root.add(mesh);
  });
}

/* ── the bar: smoked oak, honed marble, backlit ribbed glass ────────────── */

function buildBar(root: Group): MeshStandardMaterial {
  const B = CLUB.bar;
  const len = B.z1 - B.z0;
  const zc = (B.z0 + B.z1) / 2;

  // Counter: fluted oak front (slats), marble slab, brass nosing, foot rail.
  const oakMat = new MeshStandardMaterial({ map: oakTexture([4, 1]), roughness: 0.52, metalness: 0.06 });
  box(root, oakMat, 0.1, B.top - 0.05, len, B.x + 0.26, (B.top - 0.05) / 2, zc);
  const slatMat = new MeshStandardMaterial({ color: DECOR.oakDark, roughness: 0.6, metalness: 0.05 });
  const slats = Math.floor(len / 0.14);
  for (let i = 0; i < slats; i++) {
    box(root, slatMat, 0.05, B.top - 0.14, 0.07, B.x + 0.005, (B.top - 0.14) / 2, B.z0 + 0.1 + i * 0.14);
  }
  const marble = new MeshStandardMaterial({ map: marbleTexture([4, 1]), metalness: 0.2, roughness: 0.22 });
  box(root, marble, 0.78, 0.045, len + 0.16, B.x + 0.32, B.top - 0.0225, zc);
  box(root, brassMat(0.25), 0.035, 0.05, len + 0.1, B.x - 0.02, B.top - 0.03, zc);
  const railBrass = brassMat(0.3);
  const foot = new Mesh(new CylinderGeometry(0.021, 0.021, len - 0.2, 8), railBrass);
  foot.rotation.x = Math.PI / 2;
  foot.position.set(B.x - 0.12, 0.22, zc);
  root.add(foot);
  for (const z of [B.z0 + 0.3, zc, B.z1 - 0.3]) {
    const bracket = new Mesh(new CylinderGeometry(0.014, 0.014, 0.16, 6), railBrass);
    bracket.rotation.z = Math.PI / 2 - 0.5;
    bracket.position.set(B.x - 0.05, 0.16, z);
    root.add(bracket);
  }

  // Condensation rings on the marble — the loved-in detail at 0.3 m.
  const ringStain = new MeshBasicMaterial({
    color: 0xbfc8d8,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
  });
  for (const [rx, rz] of [
    [B.x + 0.3, zc - 1.3],
    [B.x + 0.42, zc + 0.6],
    [B.x + 0.24, zc + 2.1],
  ] as const) {
    const stain = new Mesh(new RingGeometry(0.035, 0.046, 20), ringStain);
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(rx, B.top + 0.002, rz);
    root.add(stain);
  }

  // The back bar: a backlit ribbed-glass wall in a brass grid, three marble
  // shelves of lathe-turned bottles, and the spirits ladder lighting them.
  const glassMat = new MeshStandardMaterial({
    map: ribbedGlassTexture([7, 1]),
    emissive: DECOR.cove,
    emissiveIntensity: 0.42,
    emissiveMap: ribbedGlassTexture([7, 1]),
    roughness: 0.4,
    metalness: 0.1,
  });
  const back = new Mesh(new PlaneGeometry(len + 0.4, 2.5), glassMat);
  back.rotation.y = -Math.PI / 2;
  back.position.set(B.backX, 1.5, zc);
  back.name = 'live-bar-back';
  root.add(back);
  // Brass grid over the glass.
  for (let i = 0; i <= 4; i++) {
    box(root, railBrass, 0.03, 2.5, 0.03, B.backX - 0.02, 1.5, B.z0 - 0.2 + (i * (len + 0.4)) / 4, 0);
  }
  box(root, railBrass, 0.04, 0.04, len + 0.44, B.backX - 0.02, 2.76, zc);
  box(root, railBrass, 0.04, 0.04, len + 0.44, B.backX - 0.02, 0.26, zc);

  buildBackBarBottles(root, B, len, zc);

  // Five brass pendants over the counter — cones on long stems, glowing.
  const pendantShade = brassGlowMat(1.15);
  const glow = new SpriteMaterial({
    map: glowTexture(),
    color: DECOR.candle,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    opacity: 0.55,
  });
  for (let i = 0; i < 5; i++) {
    const z = B.z0 + 0.7 + i * ((len - 1.4) / 4);
    const stem = new Mesh(new CylinderGeometry(0.006, 0.006, CLUB.ceilH - 1.9, 4), blackSteelMat());
    stem.position.set(B.x + 0.3, CLUB.ceilH - (CLUB.ceilH - 1.9) / 2, z);
    root.add(stem);
    const shade = new Mesh(new CylinderGeometry(0.028, 0.11, 0.16, 12, 1, true), pendantShade);
    shade.position.set(B.x + 0.3, 1.86, z);
    root.add(shade);
    const halo = new Sprite(glow);
    halo.scale.setScalar(0.5);
    halo.position.set(B.x + 0.3, 1.76, z);
    root.add(halo);
  }

  // Stools: velvet pucks on brass columns, footring included.
  const seatMat = new MeshStandardMaterial({ map: velvetTexture([1, 1]), roughness: 0.95, metalness: 0 });
  for (let i = 0; i < 6; i++) {
    const z = B.z0 + 0.75 + i * ((len - 1.5) / 5);
    const g = new Group();
    g.position.set(B.x - 0.55, 0, z);
    const column = new Mesh(new CylinderGeometry(0.03, 0.05, 0.66, 10), railBrass);
    column.position.y = 0.33;
    g.add(column);
    const base = new Mesh(new CylinderGeometry(0.17, 0.19, 0.025, 14), bronzeMat());
    base.position.y = 0.0125;
    g.add(base);
    const ring = new Mesh(new TorusGeometry(0.12, 0.011, 6, 14), railBrass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.24;
    g.add(ring);
    const seat = new Mesh(roundedPuck(0.17, 0.09, 0.035), seatMat);
    seat.position.y = 0.7;
    g.add(seat);
    root.add(g);
  }

  // (No sign. A wall of bottles under four shelves of light is already the
  // most legible thing in the room — spelling BAR over it was labelling a
  // door "DOOR".)

  return glassMat;
}

/* ── THE MIRROR: a smoked pier glass into a recess behind the north wall ── */

/** What ClubMirrorSystem drives: the pane's smoke, the figures' room, the
 *  depth-haze and the recess key. Everything else about the mirror bakes. */
export interface MirrorRefs {
  /** The glass tint — near-opaque asleep, light smoke awake. */
  pane: MeshBasicMaterial;
  /** Where the system parents the mirrored rigs (inside the recess). */
  figures: Group;
  /** The translucent murk planes that swallow deep reflections. */
  haze: Group;
}

/** buildClub() → ClubMirrorSystem hand-off (same pattern as socialView:
 *  the builder runs long before any system's init sees the refs). */
export const mirrorRefs: { current: MirrorRefs | null } = { current: null };

function buildMirror(root: Group): void {
  const M = CLUB.mirror;
  const wallZ = CLUB.minZ;
  const x0 = M.x - M.w / 2;
  const x1 = M.x + M.w / 2;
  const yTop = M.baseY + M.h;
  const cy = M.baseY + M.h / 2;

  /* The RECESS — the room the reflections stand in: a dark shell as deep
   * as the mirror can see, always there (it bakes; an empty black box
   * costs nothing), so the sleeping glass has real darkness behind it. */
  const depth = M.reflectRange + 0.5;
  const shell = new MeshStandardMaterial({ color: 0x121016, roughness: 0.85, metalness: 0.15 });
  const inX0 = M.x - 2.4;
  const inX1 = Math.min(CLUB.halfW + 0.6, M.x + 2.4);
  const inW = inX1 - inX0;
  const inCx = (inX0 + inX1) / 2;
  const inH = 3.1;
  // Floor carries a whisper of the parquet's sheen — a floor, not a pit.
  const rFloor = new Mesh(
    new PlaneGeometry(inW, depth),
    new MeshStandardMaterial({ color: 0x17141a, roughness: 0.45, metalness: 0.35 }),
  );
  rFloor.rotation.x = -Math.PI / 2;
  rFloor.position.set(inCx, 0.002, wallZ - depth / 2);
  root.add(rFloor);
  const rCeil = new Mesh(new PlaneGeometry(inW, depth), shell);
  rCeil.rotation.x = Math.PI / 2;
  rCeil.position.set(inCx, inH, wallZ - depth / 2);
  root.add(rCeil);
  const rBack = new Mesh(new PlaneGeometry(inW, inH), shell);
  rBack.position.set(inCx, inH / 2, wallZ - depth);
  root.add(rBack);
  for (const [sx, ry] of [
    [inX0, Math.PI / 2],
    [inX1, -Math.PI / 2],
  ] as const) {
    const side = new Mesh(new PlaneGeometry(depth, inH), shell);
    side.position.set(sx, inH / 2, wallZ - depth / 2);
    side.rotation.y = ry;
    root.add(side);
  }

  // The figures' room + the murk — LIVE (the system toggles them awake).
  const figures = new Group();
  figures.name = 'live-mirror-figures';
  figures.visible = false;
  root.add(figures);
  const haze = new Group();
  haze.name = 'live-mirror-haze';
  haze.visible = false;
  // The murk starts BEYOND the reflection you came to look at: your own
  // stands as deep as you are far, so haze hung at a metre just dims the
  // one figure that matters. These sit past that and swallow the recess's
  // back wall, where the far reflections trail off into nothing.
  for (let i = 0; i < 3; i++) {
    const murk = new Mesh(
      new PlaneGeometry(inW, inH),
      new MeshBasicMaterial({ color: 0x05060a, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    murk.position.set(inCx, inH / 2, wallZ - 2.6 - i * 0.8);
    haze.add(murk);
  }
  // THE ROOM BEHIND YOU, implied. A real mirror shows the hall over your
  // shoulder; a recess this shallow can't hold one, and without something
  // back there the glass reads as a hatch onto a black cupboard. A few
  // deep warm embers at the candle/cove temperatures — the club's own
  // light, too far off to resolve — sell the depth the geometry lacks,
  // and they hide behind the murk planes rather than lighting anything.
  const emberMat = new SpriteMaterial({
    map: glowTexture(),
    color: DECOR.cove,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    opacity: 0.4,
  });
  for (const [ex, ey, ez, s] of [
    [-1.5, 1.85, 2.9, 0.75],
    [1.35, 2.1, 3.35, 0.6],
    [-0.35, 2.55, 3.6, 0.95],
    [1.8, 1.35, 2.7, 0.5],
    [-1.9, 1.15, 3.3, 0.42],
  ] as const) {
    const ember = new Sprite(emberMat);
    ember.scale.setScalar(s);
    ember.position.set(inCx + ex, ey, wallZ - ez);
    haze.add(ember);
  }
  root.add(haze);
  // No light in the recess. The reflections wear unlit materials (a smoked
  // mirror shows a dim, flat image), and a PointLight toggled as you
  // approached was a light-count change — every lit material in the
  // building recompiled on the frame you turned to face the glass.

  /* The GLASS — one smoked pane at the wall plane. Asleep it is black
   * glass; awake it thins to a tint over the recess. ('live-': its
   * opacity animates, and the bake must not swallow it.) */
  const pane = new MeshBasicMaterial({ color: 0x04050a, transparent: true, opacity: 0.93, depthWrite: false });
  const glass = new Mesh(new PlaneGeometry(M.w, M.h), pane);
  glass.name = 'live-mirror-pane';
  glass.position.set(M.x, cy, wallZ + 0.012);
  root.add(glass);
  // A resting sheen so the black glass reads GLASS from across the hall —
  // a faint cold gleam clipped to the pane, not a lit surface.
  const sheen = new Mesh(
    new PlaneGeometry(M.w * 0.86, M.h * 0.86),
    new MeshBasicMaterial({
      map: glowTexture(),
      color: 0x3a4358,
      transparent: true,
      opacity: 0.16,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  sheen.position.set(M.x - M.w * 0.18, cy + M.h * 0.2, wallZ + 0.016);
  root.add(sheen);

  /* The FRAME — champagne brass over a bronze under-step, deco to match
   * the pilasters; a chunky sill below, a stepped crest above, so the two
   * ends of the wall rhyme. Every
   * face bar OVERLAPS both the glass edge and the wall opening's rim —
   * a frame that covers neither is a picture taped to a hole. */
  const brass = brassMat(0.3);
  const bronze = bronzeMat();
  const B = 0.14; // face bar width
  // Bronze under-step: a sliver peeking around the brass, less proud.
  box(root, bronze, M.w + 0.66, 0.1, 0.08, M.x, yTop + 0.16, wallZ + 0.04);
  for (const sx of [x0 - 0.13, x1 + 0.13]) box(root, bronze, 0.1, M.h + 0.3, 0.08, sx, cy, wallZ + 0.04);
  // Brass face frame (top bar rides the lintel, bottom bar the glass base).
  box(root, brass, M.w + 0.5, B, 0.1, M.x, yTop + 0.05, wallZ + 0.07);
  box(root, brass, M.w + 0.5, B, 0.1, M.x, M.baseY - 0.05, wallZ + 0.07);
  for (const sx of [x0 - 0.02, x1 + 0.02]) box(root, brass, B, M.h + 0.34, 0.1, sx, cy, wallZ + 0.07);
  // Corner blocks — the deco full stop on each mitre.
  for (const sx of [x0 - 0.02, x1 + 0.02]) {
    for (const sy of [M.baseY - 0.05, yTop + 0.05]) {
      box(root, blackSteelMat(), B + 0.06, B + 0.06, 0.11, sx, sy, wallZ + 0.075);
    }
  }
  // The sill — a proper brass shelf on a bronze plinth; the skirting run
  // dies into it from either side.
  box(root, brass, M.w + 0.56, 0.07, 0.22, M.x, 0.155, wallZ + 0.1);
  box(root, bronze, M.w + 0.44, 0.16, 0.1, M.x, 0.08, wallZ + 0.05);
  // The crown: a stepped Deco crest over the frame — the stepped motif the
  // transom wears too, brass over both ends of the room.
  const crownY = yTop + 0.24;
  const crest: Array<[number, number]> = [
    [M.w * 0.62, 0.07],
    [M.w * 0.4, 0.06],
    [M.w * 0.2, 0.05],
  ];
  let crestY = crownY;
  for (const [w, h] of crest) {
    box(root, brass, w, h, 0.05, M.x, crestY, wallZ + 0.05);
    crestY += h + 0.06;
  }
  box(root, blackSteelMat(), 0.16, 0.05, 0.055, M.x, crestY, wallZ + 0.05);

  /* Tied-back velvet flanks — the drape line parts FOR the mirror. */
  const drape = new MeshStandardMaterial({ map: velvetTexture([2, 1], 6), roughness: 0.96, metalness: 0 });
  for (const side of [-1, 1] as const) {
    const panel = new Mesh(new PlaneGeometry(1.3, 4.6), drape);
    panel.position.set(M.x + side * (M.w / 2 + 0.82), 2.3, wallZ + 0.1);
    panel.rotation.y = -side * 0.1;
    root.add(panel);
  }

  mirrorRefs.current = { pane, figures, haze };
}

/* ── booths: velvet horseshoes, marble tables, candlelight ──────────────── */

function buildBooths(root: Group, candleMat: SpriteMaterial): void {
  const bx = CLUB.boothX;
  const seatVelvet = new MeshStandardMaterial({ map: velvetTexture([2, 1]), roughness: 0.96, metalness: 0 });
  const backVelvet = new MeshStandardMaterial({
    map: velvetTexture([3, 1], 9),
    roughness: 0.96,
    metalness: 0,
    side: DoubleSide,
  });
  const marble = new MeshStandardMaterial({ map: marbleTexture([1, 1]), metalness: 0.2, roughness: 0.22 });

  for (const bz of CLUB.boothZs) {
    const g = new Group();
    g.position.set(bx, 0, bz);
    g.rotation.y = Math.PI / 2; // horseshoe opens east, into the room

    // Plinth + curved bench: a half-torus seat ring on a low base drum.
    // EVERY arc here covers the same half now — the drums and the torus
    // rings used to be authored a quarter-turn apart, which left the seat
    // hanging past the plinth with see-through gaps flanking each booth.
    const plinth = new Mesh(new CylinderGeometry(1.16, 1.2, 0.14, 26, 1, false, Math.PI / 2, Math.PI), blackSteelMat());
    plinth.position.y = 0.07;
    g.add(plinth);
    const seat = new Mesh(new TorusGeometry(0.92, 0.2, 10, 26, Math.PI), seatVelvet);
    seat.rotation.x = -Math.PI / 2;
    seat.position.y = 0.42;
    g.add(seat);
    // The seat ring's open tube mouths, closed with velvet bolsters.
    for (const ex of [-0.92, 0.92]) {
      const bolster = new Mesh(new SphereGeometry(0.2, 12, 10), seatVelvet);
      bolster.position.set(ex, 0.42, 0);
      g.add(bolster);
    }
    // The channel-tufted back wall wraps the horseshoe, capped in brass.
    const backWall = new Mesh(new CylinderGeometry(1.18, 1.18, 0.95, 26, 1, true, Math.PI / 2, Math.PI), backVelvet);
    backWall.position.y = 0.85;
    g.add(backWall);
    const cap = new Mesh(new TorusGeometry(1.18, 0.028, 8, 26, Math.PI), brassMat(0.3));
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = 1.33;
    g.add(cap);
    // Bronze edge posts where the back wall ends at the mouth — a finished
    // entry instead of a raw shell edge.
    for (const ex of [-1.18, 1.18]) {
      const post = new Mesh(new CylinderGeometry(0.035, 0.04, 0.95, 10), bronzeMat());
      post.position.set(ex, 0.85, 0);
      g.add(post);
    }

    // Table: honed marble on a brass pedestal, dressed for the evening.
    const pedestal = new Mesh(new CylinderGeometry(0.045, 0.1, 0.72, 12), brassMat(0.3));
    pedestal.position.y = 0.36;
    g.add(pedestal);
    const top = new Mesh(new CylinderGeometry(0.42, 0.42, 0.035, 24), marble);
    top.position.y = 0.745;
    g.add(top);
    const edge = new Mesh(new TorusGeometry(0.42, 0.014, 8, 24), brassMat(0.25));
    edge.rotation.x = Math.PI / 2;
    edge.position.y = 0.75;
    g.add(edge);

    // The candle: a low tumbler, a wax pip, and the shared flame sprite.
    const tumbler = new Mesh(new CylinderGeometry(0.04, 0.034, 0.07, 10, 1, true), new MeshStandardMaterial({
      color: 0x8a7a5a,
      transparent: true,
      opacity: 0.5,
      roughness: 0.2,
      metalness: 0.1,
    }));
    tumbler.position.y = 0.8;
    g.add(tumbler);
    const wax = new Mesh(new CylinderGeometry(0.026, 0.03, 0.035, 8), new MeshStandardMaterial({
      color: 0xe8ddc0,
      emissive: DECOR.candle,
      emissiveIntensity: 0.6,
      roughness: 0.7,
    }));
    wax.position.y = 0.79;
    g.add(wax);
    const flameHolder = new Group();
    flameHolder.name = 'live-candle';
    const flame = new Sprite(candleMat);
    flame.scale.setScalar(0.22);
    flame.position.y = 0.85;
    flameHolder.add(flame);
    g.add(flameHolder);

    // Two coupe glasses waiting — the table is set, the night is young.
    for (const [gx, gz] of [
      [0.16, 0.1],
      [-0.13, -0.14],
    ] as const) {
      const coupePts: Vector2[] = [
        new Vector2(0.001, 0),
        new Vector2(0.028, 0.002),
        new Vector2(0.004, 0.01),
        new Vector2(0.004, 0.075),
        new Vector2(0.02, 0.085),
        new Vector2(0.042, 0.1),
        new Vector2(0.044, 0.125),
      ];
      const coupe = new Mesh(
        new LatheGeometry(coupePts, 10),
        new MeshStandardMaterial({
          color: 0xd8e0e8,
          transparent: true,
          opacity: 0.34,
          roughness: 0.12,
          metalness: 0.1,
        }),
      );
      coupe.position.set(gx, 0.765, gz);
      g.add(coupe);
    }

    root.add(g);
  }
}

/* ── terrace: the raised south gallery behind the spawn ─────────────────── */

function buildTerrace(root: Group): void {
  const T = CLUB.terrace;
  const stoneMat = new MeshStandardMaterial({ map: terrazzoTexture([5, 1.4]), metalness: 0.25, roughness: 0.42 });
  const faceMat = new MeshStandardMaterial({ map: oakTexture([6, 0.6]), roughness: 0.6, metalness: 0.05 });
  const rail = brassMat(0.26);

  for (const side of [-1, 1] as const) {
    // Neither wing runs the full width: the arcade has the back-right
    // corner and THE STEP has the back-left, so each gallery dies into a
    // room's wall — and, both corners being rooms now, the two wings are
    // finally the same length as each other.
    const x0 = side < 0 ? CLUB.step.maxX + 0.12 : T.gapHalfW;
    const x1 = side < 0 ? -T.gapHalfW : CLUB.arcade.minX - 0.12;
    const cx = (x0 + x1) / 2;
    const wdt = x1 - x0;
    // Deck + face + brass nosing.
    box(root, stoneMat, wdt, T.h, T.z1 - T.z0, cx, T.h / 2, (T.z0 + T.z1) / 2);
    box(root, faceMat, wdt, T.h, 0.04, cx, T.h / 2, T.z0 - 0.02);
    box(root, rail, wdt, 0.03, 0.05, cx, T.h - 0.015, T.z0 - 0.02);
    // Railing along the deck edge: posts, double rail, finished newels.
    const posts = Math.max(2, Math.round(wdt / 0.95));
    for (let i = 0; i <= posts; i++) {
      const px = x0 + (i / posts) * wdt;
      if (Math.abs(px) > CLUB.halfW - 0.15) continue;
      const post = new Mesh(new CylinderGeometry(0.016, 0.02, 0.62, 8), rail);
      post.position.set(px, T.h + 0.31, T.z0 + 0.06);
      root.add(post);
    }
    box(root, rail, wdt, 0.035, 0.035, cx, T.h + 0.62, T.z0 + 0.06);
    box(root, rail, wdt, 0.022, 0.022, cx, T.h + 0.34, T.z0 + 0.06);
    // Steps at the inner corner, easing the wing down to the vestibule gap.
    const sx = side < 0 ? -T.gapHalfW - 0.5 : T.gapHalfW + 0.5;
    box(root, stoneMat, 1.0, T.h / 2, 0.42, sx, T.h / 4, T.z0 - 0.23);

    // A brass planter with broad dark leaves anchors each wing's far end.
    const px = side < 0 ? x0 + 0.75 : x1 - 0.75;
    const planter = new Mesh(new CylinderGeometry(0.3, 0.24, 0.42, 14), brassMat(0.35));
    planter.position.set(px, T.h + 0.21, (T.z0 + T.z1) / 2 + 0.3);
    root.add(planter);
    const leafMat = new MeshStandardMaterial({ color: 0x1e3a26, roughness: 0.8, metalness: 0.05, side: DoubleSide });
    for (let leaf = 0; leaf < 6; leaf++) {
      const a = (leaf / 6) * Math.PI * 2;
      const shape = new Shape();
      shape.moveTo(0, 0);
      shape.bezierCurveTo(0.1, 0.18, 0.09, 0.5, 0, 0.72);
      shape.bezierCurveTo(-0.09, 0.5, -0.1, 0.18, 0, 0);
      const leafMesh = new Mesh(new ShapeGeometry(shape, 6), leafMat);
      leafMesh.position.set(px + Math.sin(a) * 0.1, T.h + 0.4, (T.z0 + T.z1) / 2 + 0.3 + Math.cos(a) * 0.1);
      leafMesh.rotation.set(0.5 + (leaf % 3) * 0.22, a, 0);
      root.add(leafMesh);
    }
  }
}

/* ── vestibule: the way in — stepped brass portal, oak doors, the rope ──── */

function buildVestibule(root: Group): void {
  const SZ = CLUB.maxZ;
  const doorW = 2.2;
  const doorH = 2.5;

  // Three nested portal frames stepping outward — the deco doorway.
  //
  // The heads sit HIGH above the doors on purpose: a 0.5 m tympanum over
  // the doors gives the transom the field it needs (a lower head used to
  // cut straight across it), and the tighter 0.14 step keeps the outermost
  // head under the cornice.
  for (let i = 0; i < 3; i++) {
    const w = doorW + 0.3 + i * 0.36;
    const h = doorH + 0.5 + i * 0.14;
    const t = 0.09 - i * 0.02;
    const mat = i === 0 ? brassMat(0.25) : i === 1 ? bronzeMat() : blackSteelMat();
    const z = SZ - 0.16 + i * 0.05;
    box(root, mat, t, h, t, -w / 2, h / 2, z);
    box(root, mat, t, h, t, w / 2, h / 2, z);
    box(root, mat, w + t, t, t, 0, h, z);
  }
  // Double oak doors, closed on the night, brass push plates + kick plates.
  const doorMat = new MeshStandardMaterial({ map: oakTexture([1, 2]), roughness: 0.55, metalness: 0.05 });
  for (const side of [-1, 1] as const) {
    const leaf = new Mesh(new BoxGeometry(doorW / 2 - 0.03, doorH, 0.06), doorMat);
    leaf.position.set((side * doorW) / 4, doorH / 2, SZ - 0.1);
    root.add(leaf);
    box(root, brassMat(0.3), 0.05, 0.34, 0.02, side * 0.16, 1.12, SZ - 0.14);
    box(root, brassMat(0.4), doorW / 2 - 0.1, 0.16, 0.02, (side * doorW) / 4, 0.12, SZ - 0.14);
  }
  // THE TRANSOM: a stepped Deco ziggurat (no sun symbols over the doors in
  // this house): three brass tiers narrowing upward over a soft backlit
  // glass strip.
  const fanY = doorH + 0.06;
  const fanZ = SZ - 0.13;
  const glass = new Mesh(
    new PlaneGeometry(1.5, 0.34),
    new MeshStandardMaterial({ color: 0xf3e3c2, emissive: 0xffdba0, emissiveIntensity: 0.5, roughness: 0.6 }),
  );
  glass.position.set(0, fanY + 0.2, fanZ - 0.015);
  glass.rotation.y = Math.PI;
  root.add(glass);
  const tiers: Array<[number, number]> = [
    [1.6, 0.07],
    [1.14, 0.06],
    [0.7, 0.05],
  ];
  let tierY = fanY + 0.03;
  for (const [w, h] of tiers) {
    box(root, brassMat(0.3), w, h, 0.05, 0, tierY, fanZ);
    tierY += h + 0.075;
  }
  box(root, blackSteelMat(), 0.34, 0.05, 0.055, 0, tierY, fanZ); // the keystone cap

  // The velvet rope and the members-&-dancers plaque used to stand here.
  // The way in is a doorway, not a queue: nothing to sidestep, nothing to
  // read on your way past.
}

/* ── THE STILL ROOM: the quiet decompression corner ─────────────────────── */

function buildStillRoom(root: Group, candleMat: SpriteMaterial): MeshStandardMaterial {
  const Q = CLUB.quiet;
  const H = CLUB.roomCeilH;
  const plaster = new MeshStandardMaterial({ map: plasterTexture([3, 1.4]), roughness: 0.95, metalness: 0.02 });

  // Its two interior walls (east + south), split around the doorway, plus a
  // low lintel — the hall's plaster continues inside.
  const eWall = new Mesh(new PlaneGeometry(Q.maxZ - Q.minZ, H), plaster);
  eWall.position.set(Q.maxX, H / 2, (Q.minZ + Q.maxZ) / 2);
  eWall.rotation.y = Math.PI / 2;
  (eWall.material as MeshStandardMaterial).side = DoubleSide;
  root.add(eWall);
  const south = (x0: number, x1: number): void => {
    const m = new Mesh(new PlaneGeometry(x1 - x0, H), plaster);
    m.position.set((x0 + x1) / 2, H / 2, Q.maxZ);
    (m.material as MeshStandardMaterial).side = DoubleSide;
    root.add(m);
  };
  south(Q.minX, Q.doorX0);
  south(Q.doorX1, Q.maxX);
  const lintel = new Mesh(new PlaneGeometry(Q.doorX1 - Q.doorX0, H - 2.05), plaster);
  lintel.position.set((Q.doorX0 + Q.doorX1) / 2, (H + 2.05) / 2, Q.maxZ);
  (lintel.material as MeshStandardMaterial).side = DoubleSide;
  root.add(lintel);
  // Ceiling cap at door height — the room is a lower, closer volume.
  const cap = new Mesh(new PlaneGeometry(Q.maxX - Q.minX, Q.maxZ - Q.minZ), new MeshStandardMaterial({
    color: 0x191720,
    roughness: 0.95,
  }));
  cap.rotation.x = Math.PI / 2;
  cap.position.set((Q.minX + Q.maxX) / 2, H, (Q.minZ + Q.maxZ) / 2);
  root.add(cap);
  // Door dressing: bronze jambs + a hushed nameplate.
  for (const x of [Q.doorX0, Q.doorX1]) box(root, bronzeMat(), 0.08, 2.05, 0.1, x, 1.025, Q.maxZ);
  box(root, bronzeMat(), Q.doorX1 - Q.doorX0 + 0.08, 0.09, 0.1, (Q.doorX0 + Q.doorX1) / 2, 2.05, Q.maxZ);
  // The nameplate: the house face, two words, on its own backing bar so it
  // reads from across the hall — the old serif whisper sat flush with the
  // plaster and lost the fight with the lintel trim.
  const plate = signPlane(0.96, 0.24, 512, (g, sw, sh) => {
    g.fillStyle = 'rgba(13,10,18,0.85)';
    g.beginPath();
    g.roundRect(4, 4, sw - 8, sh - 8, 14);
    g.fill();
    g.strokeStyle = 'rgba(201,168,106,0.55)';
    g.lineWidth = 2.5;
    g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#e8d9b0';
    g.font = font(600, 64);
    g.letterSpacing = '10px';
    g.fillText('STILL ROOM', sw / 2, sh / 2 + 2);
    g.letterSpacing = '0px';
  });
  plate.name = 'live-still-plate';
  plate.position.set((Q.doorX0 + Q.doorX1) / 2, 2.34, Q.maxZ + 0.06);
  root.add(plate);

  // Inside: a wide curved bench with deep cushions, a low table, a slow
  // lamp. Nothing performs in here — that's the point.
  const cx = (Q.minX + Q.maxX) / 2;
  // The bench hugs the deep side, but it used to hug it THROUGH the wall:
  // its back reached z = −11.455 while the north shell's middle panel stands
  // proud at −11.4, so the velvet was buried 55 mm into the plaster. Sit it
  // far enough forward that the plinth (the widest ring at r = 1.4) clears.
  const cz = (Q.minZ + Q.maxZ) / 2 - 0.1;
  const bench = new Group();
  bench.position.set(cx, 0, cz);
  bench.rotation.y = Math.PI / 2 + Math.PI; // horseshoe opens toward the door
  const seatMat = new MeshStandardMaterial({ map: velvetTexture([3, 1]), roughness: 0.97, metalness: 0 });
  // Same half for every arc (the booths' bug lived in here too): the bench
  // hugs the room's deep side and genuinely opens toward the door.
  const plinth = new Mesh(new CylinderGeometry(1.35, 1.4, 0.13, 24, 1, false, Math.PI, Math.PI), blackSteelMat());
  plinth.position.y = 0.065;
  bench.add(plinth);
  const seat = new Mesh(new TorusGeometry(1.1, 0.23, 10, 24, Math.PI), seatMat);
  seat.rotation.x = -Math.PI / 2;
  seat.rotation.z = Math.PI / 2;
  seat.position.y = 0.4;
  bench.add(seat);
  for (const [px, pz] of [
    [0, -1.1],
    [0, 1.1],
  ] as const) {
    const bolster = new Mesh(new SphereGeometry(0.23, 12, 10), seatMat);
    bolster.position.set(px, 0.4, pz);
    bench.add(bolster);
  }
  const backW = new Mesh(new CylinderGeometry(1.38, 1.38, 0.8, 24, 1, true, Math.PI, Math.PI), new MeshStandardMaterial({
    map: velvetTexture([3, 1], 11),
    roughness: 0.97,
    metalness: 0,
    side: DoubleSide,
  }));
  backW.position.y = 0.75;
  bench.add(backW);
  // The brass cap along the top of the back — every velvet horseshoe in the
  // booths is finished with one, and the still room's was the only bench
  // left showing a raw shell edge. Same half as the wall it caps (the seat
  // torus above uses this identical pair of rotations).
  const backCap = new Mesh(new TorusGeometry(1.38, 0.03, 8, 24, Math.PI), brassMat(0.3));
  backCap.rotation.x = -Math.PI / 2;
  backCap.rotation.z = Math.PI / 2;
  backCap.position.y = 1.15;
  bench.add(backCap);
  root.add(bench);

  const table = new Mesh(new CylinderGeometry(0.34, 0.3, 0.36, 14), new MeshStandardMaterial({
    map: oakTexture([1, 1]),
    roughness: 0.6,
  }));
  table.position.set(cx, 0.18, cz + 0.75);
  root.add(table);

  // The lamp: a moon-egg on the table, breathing at a resting heart rate.
  const lampMat = new MeshStandardMaterial({
    color: 0x3a3630,
    emissive: DECOR.candle,
    emissiveIntensity: 0.9,
    roughness: 0.6,
  });
  const lamp = new Mesh(new CylinderGeometry(0.085, 0.11, 0.16, 14), lampMat);
  lamp.name = 'live-still-lamp';
  lamp.position.set(cx, 0.44, cz + 0.75);
  root.add(lamp);
  const lampGlowHolder = new Group();
  lampGlowHolder.name = 'live-still-glow';
  const lampGlow = new Sprite(candleMat);
  lampGlow.scale.setScalar(0.75);
  lampGlow.position.set(cx, 0.52, cz + 0.75);
  lampGlowHolder.add(lampGlow);
  root.add(lampGlowHolder);

  return lampMat;
}

/* ── THE ARCADE: SUPER OCTAGON's room, the still room's loud mirror ─────── */

function buildArcade(root: Group): void {
  const A = CLUB.arcade;
  const H = CLUB.roomCeilH;
  const plaster = new MeshStandardMaterial({ map: plasterTexture([3, 1.4]), roughness: 0.95, metalness: 0.02 });

  // Interior walls (west + NORTH split around the door), lintel, low cap.
  // The room stands in the hall's back-right corner, so the shell covers
  // its east and south sides and the door looks out over the floor.
  const wWall = new Mesh(new PlaneGeometry(A.maxZ - A.minZ, H), plaster);
  wWall.position.set(A.minX, H / 2, (A.minZ + A.maxZ) / 2);
  wWall.rotation.y = Math.PI / 2;
  (wWall.material as MeshStandardMaterial).side = DoubleSide;
  root.add(wWall);
  const north = (x0: number, x1: number): void => {
    const m = new Mesh(new PlaneGeometry(x1 - x0, H), plaster);
    m.position.set((x0 + x1) / 2, H / 2, A.minZ);
    (m.material as MeshStandardMaterial).side = DoubleSide;
    root.add(m);
  };
  north(A.minX, A.doorX0);
  north(A.doorX1, A.maxX);
  const lintel = new Mesh(new PlaneGeometry(A.doorX1 - A.doorX0, H - 2.05), plaster);
  lintel.position.set((A.doorX0 + A.doorX1) / 2, (H + 2.05) / 2, A.minZ);
  (lintel.material as MeshStandardMaterial).side = DoubleSide;
  root.add(lintel);
  const cap = new Mesh(new PlaneGeometry(A.maxX - A.minX, A.maxZ - A.minZ), new MeshStandardMaterial({
    color: 0x191720,
    roughness: 0.95,
  }));
  cap.rotation.x = Math.PI / 2;
  cap.position.set((A.minX + A.maxX) / 2, H, (A.minZ + A.maxZ) / 2);
  root.add(cap);
  // Door dressing + nameplate, the still room's twin — but this door
  // promises noise, so the plate glows the cabinet's magenta.
  for (const x of [A.doorX0, A.doorX1]) box(root, bronzeMat(), 0.08, 2.05, 0.1, x, 1.025, A.minZ);
  box(root, bronzeMat(), A.doorX1 - A.doorX0 + 0.08, 0.09, 0.1, (A.doorX0 + A.doorX1) / 2, 2.05, A.minZ);
  const plate = signPlane(0.96, 0.24, 512, (g, sw, sh) => {
    g.fillStyle = 'rgba(13,10,18,0.85)';
    g.beginPath();
    g.roundRect(4, 4, sw - 8, sh - 8, 14);
    g.fill();
    g.strokeStyle = 'rgba(255,42,213,0.5)';
    g.lineWidth = 2.5;
    g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffd9f6';
    g.shadowColor = css(PALETTE.magenta);
    g.shadowBlur = 10;
    g.font = font(600, 58);
    g.letterSpacing = '8px';
    g.fillText('ARCADE', sw / 2, sh / 2 + 2);
    g.letterSpacing = '0px';
    g.shadowBlur = 0;
  });
  plate.name = 'live-arcade-plate';
  plate.position.set((A.doorX0 + A.doorX1) / 2, 2.34, A.minZ - 0.06);
  plate.rotation.y = Math.PI; // the nameplate reads from the floor side
  root.add(plate);

  // ── THE CABINET: SUPER OCTAGON, against the back wall, facing the door.
  //
  // ONE SILHOUETTE. The first cut stacked boxes — a marquee hovering over
  // a gap, glowing magenta slabs bolted to the sides — and it read exactly
  // like what it was. A real upright is a single sheet of ply cut to a
  // profile: kick, control deck, screen slope, marquee, canopy, all one
  // continuous edge. So this is that profile, extruded across the width;
  // the headboard can't float because it isn't a separate object.
  const cx = (A.minX + A.maxX) / 2;
  const cz = A.maxZ - 0.45;
  const CW = 0.66; // cabinet width
  const cab = new Group();
  cab.position.set(cx, 0, cz);
  // Built facing +z, then turned to face the door across the room.
  cab.rotation.y = Math.PI;
  const shellMat = blackSteelMat();

  // The side profile, drawn in (depth, height) — front is +depth. It gets
  // extruded along the cabinet's width, so the shape's own faces become
  // the two side panels and the extrusion wrap becomes front/top/back.
  const P: [number, number][] = [
    [-0.30, 0.0],   // back foot
    [0.30, 0.0],    // front foot (kick plate)
    [0.30, 0.90],   // front panel, up to the shelf
    [0.315, 0.95],  // a shallow shelf where a control deck would be — this
    [0.315, 0.99],  // cabinet is played with the lasers, so it's a ledge,
    [0.12, 1.09],   // not a console: no stick, no buttons, nothing fake to
    [0.12, 1.13],   // reach for and find isn't there.
    [0.215, 1.20],  // the monitor bay leans out at the bottom...
    [0.115, 1.78],  // ...and back in at the top, the way a CRT sits
    [0.265, 1.86],  // the marquee shelf steps forward again
    [0.265, 2.10],  // the marquee face
    [0.30, 2.15],   // canopy lip over the lights
    [-0.26, 2.19],  // the top, sloping gently back
    [-0.30, 2.12],
  ];
  const profile = new Shape();
  profile.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length; i++) profile.lineTo(P[i][0], P[i][1]);
  profile.closePath();
  const shell = new Mesh(
    new ExtrudeGeometry(profile, { depth: CW, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, steps: 1 }),
    shellMat,
  );
  // Stand the profile up facing the door: local +depth → world +z.
  shell.rotation.y = -Math.PI / 2;
  shell.position.x = CW / 2;
  cab.add(shell);

  // Brass edge trim following the cabinet's front line — the venue's metal,
  // where a real cabinet wears its T-molding. It replaces the neon siding:
  // the shape reads on its own, so the light can stay in the marquee.
  const trimMat = brassMat(0.3);
  const edge = (d0: number, h0: number, d1: number, h1: number): void => {
    const len = Math.hypot(d1 - d0, h1 - h0);
    for (const sx of [-CW / 2 + 0.012, CW / 2 - 0.012]) {
      const bar = new Mesh(new BoxGeometry(0.016, len, 0.016), trimMat);
      bar.position.set(sx, (h0 + h1) / 2, (d0 + d1) / 2);
      bar.rotation.x = -Math.atan2(d1 - d0, h1 - h0);
      cab.add(bar);
    }
  };
  edge(0.30, 0.06, 0.30, 0.88); // the front panel's two corners

  // Marquee: the game's name, backlit, sitting ON the shelf the profile cut.
  const marquee = signPlane(0.56, 0.2, 512, (g, sw, sh) => {
    g.fillStyle = '#0d0a14';
    g.fillRect(0, 0, sw, sh);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffd9f6';
    g.shadowColor = css(PALETTE.magenta);
    g.shadowBlur = 16;
    g.font = font(700, 64);
    g.letterSpacing = '4px';
    g.fillText('SUPER OCTAGON', sw / 2, sh / 2 + 2, sw - 24);
    g.letterSpacing = '0px';
    g.shadowBlur = 0;
  });
  marquee.name = 'live-octagon-marquee';
  // Proud of the bevel — the extrusion's rounded edge pushes the shell's
  // face out by bevelSize, and a sign flush to the drawn profile vanishes
  // inside it.
  marquee.position.set(0, 1.985, 0.279);
  cab.add(marquee);
  // The lamp under the canopy, washing the header from above.
  const header = new Mesh(new BoxGeometry(0.5, 0.012, 0.012), brassGlowMat(1.8));
  header.position.set(0, 2.135, 0.272);
  cab.add(header);

  // The CRT: a black bay recessed into the profile's monitor slope, and the
  // live screen plane the lasers aim at. The slope is ~9.8° off vertical
  // ((0.215,1.20) → (0.115,1.78)), so the glass matches it.
  const tilt = Math.atan2(0.215 - 0.115, 1.78 - 1.20);
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 384;
  screenCanvas.height = 300;
  const sg = screenCanvas.getContext('2d')!;
  sg.fillStyle = '#08060e';
  sg.fillRect(0, 0, 384, 300);
  const screenTex = new CanvasTexture(screenCanvas);
  screenTex.colorSpace = SRGBColorSpace;
  screenTex.minFilter = LinearFilter;
  // A surface, not a hole: the bezel takes light so the bay doesn't read as
  // a black void with a picture hanging in it.
  const bezel = new Mesh(
    new PlaneGeometry(0.58, 0.57),
    new MeshStandardMaterial({ color: 0x171320, roughness: 0.5, metalness: 0.35 }),
  );
  bezel.position.set(0, 1.49, 0.182);
  bezel.rotation.x = -tilt;
  cab.add(bezel);
  const screen = new Mesh(new PlaneGeometry(0.52, 0.41), new MeshBasicMaterial({ map: screenTex }));
  screen.name = 'live-octagon-screen';
  screen.position.set(0, 1.505, 0.188);
  screen.rotation.x = -tilt;
  cab.add(screen);

  // The ledge gets a brushed plate and nothing else. Fake hardware you
  // can't touch is worse than no hardware: in a room where everything is
  // reached with the lasers, a stick and a row of buttons only promise a
  // control scheme that doesn't exist.
  const ledgeTilt = Math.atan2(0.315 - 0.12, 1.09 - 0.99) - Math.PI / 2;
  const ledgeMat = new MeshStandardMaterial({ color: 0x1a1720, roughness: 0.42, metalness: 0.65 });
  const ledge = new Mesh(new PlaneGeometry(0.58, 0.2), ledgeMat);
  ledge.position.set(0, 1.043, 0.222);
  ledge.rotation.x = ledgeTilt;
  cab.add(ledge);

  // A coin door, because the eye looks for one on a cabinet this size.
  const coinDoor = new Mesh(new PlaneGeometry(0.2, 0.13), new MeshStandardMaterial({ color: 0x241f2b, roughness: 0.6, metalness: 0.5 }));
  coinDoor.position.set(0, 0.5, 0.302);
  cab.add(coinDoor);
  for (const sx of [-0.045, 0.045]) {
    const slot = new Mesh(new BoxGeometry(0.006, 0.03, 0.004), trimMat);
    slot.position.set(sx, 0.53, 0.305);
    cab.add(slot);
  }
  root.add(cab);

  // ── THE BOARD: the wall leaderboard beside the cabinet.
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 512;
  boardCanvas.height = 736;
  const bg = boardCanvas.getContext('2d')!;
  bg.fillStyle = '#0d0a14';
  bg.fillRect(0, 0, 512, 736);
  const boardTex = new CanvasTexture(boardCanvas);
  boardTex.colorSpace = SRGBColorSpace;
  boardTex.minFilter = LinearFilter;
  const board = new Mesh(new PlaneGeometry(0.82, 1.18), new MeshBasicMaterial({ map: boardTex, transparent: true }));
  board.name = 'live-octagon-board';
  // Hung PROUD of the wall trim. At the old 0.03 standoff the board's plane
  // landed on exactly x = 8.97 — which is also the front face of the east
  // wall's dado rail, running the length of the hall at y = 1.0 and straight
  // through the board's bottom edge. Two coplanar surfaces, so the rail
  // shimmered through the last row of scores. A board on a wall stands off
  // the mouldings and covers them; now it does.
  board.position.set(A.maxX - 0.1, 1.55, (A.minZ + A.maxZ) / 2 + 0.5);
  board.rotation.y = -Math.PI / 2;
  root.add(board);

  // A cove strip so the room reads arcade-warm from the hall — and the
  // cabinet's own glow, the fifth (and last) real light in the venue: the
  // room is a sealed box under its low cap, and plaster with no light is
  // just black (FIRE FIGHT's cabinet carried its own marquee light for
  // exactly this reason).
  // Warm, not pink: a magenta bulb was the only light in this sealed room,
  // so every steel and brass surface in it — the cabinet's buttons most of
  // all — came out the colour of the bulb. The house's own warm light lets
  // the metal read as metal and leaves magenta to the marquee and the game.
  const cove = new Mesh(new BoxGeometry(A.maxX - A.minX - 0.4, 0.03, 0.03), brassGlowMat(1.5));
  cove.position.set(cx, H - 0.12, A.maxZ - 0.08);
  root.add(cove);
  const glow = new PointLight(0xffcb96, 1.7, 5.5, 1.4);
  glow.position.set(cx, 2.1, cz - 0.9);
  root.add(glow);

  registerArcade({
    screen,
    screenCanvas,
    screenTex,
    boardCanvas,
    boardTex,
    cabinetPos: new Vector3(cx, 0, cz),
  });
}

/* ── THE STEP: the west corner room, and the door that isn't one ─────────
 *
 * The arcade's plan reflected about the way in — same footprint, same low
 * cap, same north-facing doorway onto the floor — and then, where the
 * arcade puts a cabinet against its back wall, this room puts a DOORWAY:
 * three stepped deco frames (the vestibule's own portal, at two-thirds
 * scale) standing on the south wall with the VOID inside them instead of a
 * night on the street.
 *
 * The room is deliberately bare. There is one thing in it, it is obviously
 * a door, and the only furniture is the light that tells you where its
 * threshold is: a brass-edged plate let into the floor, one stride deep,
 * which is exactly the volume CourseSystem is watching. Nothing here
 * explains itself in words, because a lit doorway doesn't need to.
 */
function buildStep(root: Group): void {
  const S = CLUB.step;
  const H = CLUB.roomCeilH;
  const plaster = new MeshStandardMaterial({ map: plasterTexture([3, 1.4]), roughness: 0.95, metalness: 0.02 });

  // Interior walls (east + NORTH split around the door), lintel, low cap.
  const eWall = new Mesh(new PlaneGeometry(S.maxZ - S.minZ, H), plaster);
  eWall.position.set(S.maxX, H / 2, (S.minZ + S.maxZ) / 2);
  eWall.rotation.y = Math.PI / 2;
  (eWall.material as MeshStandardMaterial).side = DoubleSide;
  root.add(eWall);
  const north = (x0: number, x1: number): void => {
    const m = new Mesh(new PlaneGeometry(x1 - x0, H), plaster);
    m.position.set((x0 + x1) / 2, H / 2, S.minZ);
    (m.material as MeshStandardMaterial).side = DoubleSide;
    root.add(m);
  };
  north(S.minX, S.doorX0);
  north(S.doorX1, S.maxX);
  const lintel = new Mesh(new PlaneGeometry(S.doorX1 - S.doorX0, H - 2.05), plaster);
  lintel.position.set((S.doorX0 + S.doorX1) / 2, (H + 2.05) / 2, S.minZ);
  (lintel.material as MeshStandardMaterial).side = DoubleSide;
  root.add(lintel);
  const cap = new Mesh(
    new PlaneGeometry(S.maxX - S.minX, S.maxZ - S.minZ),
    new MeshStandardMaterial({ color: 0x191720, roughness: 0.95 }),
  );
  cap.rotation.x = Math.PI / 2;
  cap.position.set((S.minX + S.maxX) / 2, H, (S.minZ + S.maxZ) / 2);
  root.add(cap);

  // Door dressing, and NOTHING ELSE. The still room and the arcade wear
  // nameplates because they are rooms and a room can be described. This is
  // a door, and a door that has to tell you what it is has already failed:
  // the whole invitation is the light coming out of it. It is the one
  // opening in the building with nothing written over it.
  for (const x of [S.doorX0, S.doorX1]) box(root, bronzeMat(), 0.08, 2.05, 0.1, x, 1.025, S.minZ);
  box(root, bronzeMat(), S.doorX1 - S.doorX0 + 0.08, 0.09, 0.1, (S.doorX0 + S.doorX1) / 2, 2.05, S.minZ);

  // ── THE FRAME ────────────────────────────────────────────────────────
  // Three nested heads stepping outward, exactly the vestibule's grammar
  // (brass inside, bronze, black steel outside) so the two doors of this
  // building are recognisably the same idea. One leads to the street.
  const pz = S.portalZ;
  // The rings are measured from the OPENING outward, not from a width and a
  // height that happen to be near it. The first cut sized each ring on its
  // own and left the innermost head 14 cm clear of the top of the void:
  // the pane stopped short and a band of dark wall showed between it and
  // the frame, which reads as a picture in a surround rather than as a way
  // through. Ring 0's inner faces now sit exactly on the pane's edges, and
  // each ring steps 9 cm out and 7 cm up from the one inside it — so every
  // reveal is the frame, and none of it is wall. (The step is gentle
  // because the room caps at CLUB.roomCeilH and a bigger one put the
  // outermost bar through the ceiling slab.)
  for (let i = 0; i < 3; i++) {
    const t = 0.08 - i * 0.018;
    const inX = S.portalW / 2 + i * 0.09; // this ring's inner face
    const inY = S.portalH + i * 0.07;
    const px = inX + t / 2; // …so its bar centres sit half a thickness out
    const py = inY + t / 2;
    const mat = i === 0 ? brassMat(0.25) : i === 1 ? bronzeMat() : blackSteelMat();
    const z = pz + 0.07 + i * 0.045;
    box(root, mat, t, py, t, S.portalX - px, py / 2, z);
    box(root, mat, t, py, t, S.portalX + px, py / 2, z);
    box(root, mat, px * 2 + t, t, t, S.portalX, py, z);
  }

  // THE VOID IN THE DOORWAY. A pane of the set's own background colour —
  // not black, the void's black — with a painted depth behind it: a
  // horizon, a floor grid running away, and the far towers as bars of
  // light. It reads as a view rather than a wall the moment it moves,
  // which is CourseSystem's job (the shimmer, and the plate below).
  const portalMat = new MeshBasicMaterial({
    map: voidPaneTexture(),
    toneMapped: false,
    depthWrite: true,
  });
  const portal = new Mesh(new PlaneGeometry(S.portalW, S.portalH), portalMat);
  portal.name = 'live-step-portal';
  portal.position.set(S.portalX, S.portalH / 2, pz);
  portal.rotation.y = Math.PI; // the view faces the room
  root.add(portal);

  const shimmerMat = new MeshBasicMaterial({
    map: glowTexture(),
    color: PALETTE.cyan,
    transparent: true,
    opacity: 0.16,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  // The wash is the pane's own size now too — it used to overhang by a few
  // centimetres, which only ever showed as a bloom smeared on the frame.
  const shimmer = new Mesh(new PlaneGeometry(S.portalW, S.portalH), shimmerMat);
  shimmer.name = 'live-step-shimmer';
  shimmer.position.set(S.portalX, S.portalH / 2, pz - 0.015);
  shimmer.rotation.y = Math.PI;
  root.add(shimmer);

  // ── THE THRESHOLD ────────────────────────────────────────────────────
  // A plate let into the floor, one stride deep, brass-edged. It is the
  // trigger volume made visible, and it brightens as your head enters it —
  // the whole instruction, on the floor, where your feet are already
  // looking. (Same law as the deck wash out on the circuit: the floor is
  // the telegraph.)
  const plateMat = new MeshBasicMaterial({
    color: PALETTE.cyan,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    toneMapped: false,
  });
  const sill = new Mesh(new PlaneGeometry(S.portalW, S.reach), plateMat);
  sill.name = 'live-step-sill';
  sill.rotation.x = -Math.PI / 2;
  sill.position.set(S.portalX, 0.012, pz - S.reach / 2);
  root.add(sill);
  for (const sx of [-1, 1] as const) {
    box(root, brassMat(0.3), 0.02, 0.012, S.reach, S.portalX + (sx * S.portalW) / 2, 0.008, pz - S.reach / 2);
  }
  box(root, brassMat(0.3), S.portalW + 0.02, 0.012, 0.02, S.portalX, 0.008, pz - S.reach);

  // Two uplights either side of the frame — the room's only fittings, and
  // the only ones in the building that burn COLD. They wore the venue's
  // warm brass cove at first and were the brightest thing in the corner:
  // two amber posts flanking a cold blue doorway, pulling the eye off the
  // one thing in the room. Brass body, the course's own light in it.
  const coldGlow = new MeshStandardMaterial({
    color: DECOR.brass,
    emissive: PALETTE.cyan,
    emissiveIntensity: 0.9,
    metalness: 0.6,
    roughness: 0.35,
  });
  for (const sx of [-1, 1] as const) {
    const x = S.portalX + sx * (S.portalW / 2 + 0.62);
    box(root, brassMat(0.3), 0.1, 0.04, 0.16, x, 0.02, pz - 0.22);
    const bar = new Mesh(new BoxGeometry(0.05, 1.35, 0.02), coldGlow);
    bar.position.set(x, 0.72, pz - 0.16);
    root.add(bar);
  }

  // THE DOORWAY IS THE LAMP. Nothing else in here is lit — the hall's own
  // fittings stop at the wall and the room has no fixture of its own — so
  // the light in the corner is the light coming THROUGH, cold against a
  // building that is warm everywhere else. Without it the room read as a
  // black slot from the floor and nobody would ever have found the door.
  const through = new PointLight(PALETTE.cyan, 1.5, 6.5, 1.5);
  through.position.set(S.portalX, 1.35, pz - 0.5);
  root.add(through);
  // A second, weaker one just inside the opening — enough that the bronze
  // jamb reads as a doorway from across the floor, and no more. It used to
  // be twice this and was really lighting a nameplate.
  const doorway = new PointLight(0x9fd8ff, 0.35, 3.4, 1.7);
  doorway.position.set((S.doorX0 + S.doorX1) / 2, 1.4, S.minZ + 0.7);
  root.add(doorway);

  // The room's only light comes OUT OF THE DOOR — cool, low, and short
  // enough that it dies before the hall (the arcade next door is lit by
  // its own cabinet the same way). A corner with a hole in the world in
  // it should not also have a lamp.
  const spill = new PointLight(PALETTE.cyan, 1.1, 4.2, 1.7);
  spill.position.set(S.portalX, S.portalH * 0.55, pz - 0.5);
  root.add(spill);

  // ── THE DANGER SIGN ──────────────────────────────────────────────────
  // The room says nothing, and then it says this. A red neon hung on two
  // drop rods from the low ceiling, out in front of the frame so it reads
  // from the hall through the doorway as well as from inside: the one red
  // thing in a building that is warm brass and cold cyan everywhere else,
  // and the only word anywhere near this door. It is not an explanation —
  // a doorway with moving ground behind it has earned a warning, and a
  // warning is allowed to be a word.
  const signY = 2.15;
  const signZ = pz - 0.34;
  const signW = 1.16;
  const signH = 0.26;
  const tube = neonMat(DECOR.danger, 1.35);
  // Drop rods to the slab.
  for (const sx of [-1, 1] as const) {
    box(root, blackSteelMat(), 0.016, H - (signY + signH / 2), 0.016, S.portalX + sx * (signW / 2 - 0.08), (H + signY + signH / 2) / 2, signZ);
  }
  // The backing box, and the tube running its top and bottom edges.
  box(root, blackSteelMat(), signW, signH, 0.045, S.portalX, signY, signZ);
  for (const sy of [-1, 1] as const) {
    box(root, tube, signW - 0.06, 0.022, 0.022, S.portalX, signY + sy * (signH / 2 - 0.018), signZ - 0.03);
  }
  // The word, in lit red glass, with a hazard chevron either side of it.
  const danger = signPlane(signW - 0.08, signH - 0.06, 512, (g, sw, sh) => {
    g.clearRect(0, 0, sw, sh);
    const red = '#ff2233';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font(700, Math.round(sh * 0.62));
    g.letterSpacing = '12px';
    // Two passes: a wide halo under a crisp core — lit gas, not paint.
    g.shadowColor = red;
    g.shadowBlur = sh * 0.5;
    g.fillStyle = red;
    g.fillText('DANGER', sw / 2, sh / 2 + 1);
    g.shadowBlur = sh * 0.16;
    g.fillStyle = '#ffd9d9';
    g.fillText('DANGER', sw / 2, sh / 2 + 1);
    g.shadowBlur = 0;
    g.letterSpacing = '0px';
    // The chevrons: three strokes leaning into the word from each end.
    g.strokeStyle = red;
    g.lineWidth = Math.max(2, sh * 0.07);
    g.lineCap = 'round';
    g.shadowColor = red;
    g.shadowBlur = sh * 0.3;
    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1] as const) {
        const x = sw / 2 + side * (sw * 0.36 + i * sh * 0.22);
        g.beginPath();
        g.moveTo(x - side * sh * 0.14, sh * 0.24);
        g.lineTo(x + side * sh * 0.06, sh / 2);
        g.lineTo(x - side * sh * 0.14, sh * 0.76);
        g.stroke();
      }
    }
    g.shadowBlur = 0;
  });
  danger.name = 'live-step-danger';
  danger.position.set(S.portalX, signY, signZ - 0.026);
  danger.rotation.y = Math.PI; // it reads from the room, and from the door
  root.add(danger);
  // Its own spill: short and weak, so the red dies well before the hall
  // and never argues with the cyan coming out of the frame below it.
  const warn = new PointLight(DECOR.danger, 0.55, 2.3, 2);
  warn.position.set(S.portalX, signY - 0.12, signZ - 0.16);
  root.add(warn);

  registerStep({ portal, portalMat, shimmerMat, plateMat });
}

/**
 * The picture inside the frame: the void, painted once. A horizon with no
 * land under it, a floor grid running away below it, and the far skyline as
 * bars of light — the same four ideas the real environment is built from
 * (arena/voidkit.ts), flattened to a canvas so a doorway can hold them for
 * one draw call.
 */
function voidPaneTexture(): CanvasTexture {
  const W = 512;
  const Hh = 768;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = Hh;
  const g = c.getContext('2d')!;
  g.fillStyle = css(VOID_BG);
  g.fillRect(0, 0, W, Hh);

  // THE HORIZON SITS AT EYE HEIGHT. The pane stands on the floor and runs
  // to 2.1 m, so a horizon drawn down the middle of the canvas lands around
  // a metre off the ground and the whole view reads as a picture hung low
  // rather than as somewhere you could walk into. Put it where a real one
  // would be — level with the eyes of whoever is standing in front of it —
  // and most of the pane is the floor running away, which is exactly what
  // you see through a door.
  const horizon = Hh * 0.22;
  // The floor grid, converging on the horizon — the deep half of the view.
  g.strokeStyle = 'rgba(79,183,255,0.22)';
  g.lineWidth = 1.6;
  for (let i = -9; i <= 9; i++) {
    g.beginPath();
    g.moveTo(W / 2 + i * (W / 4), Hh);
    g.lineTo(W / 2 + i * 7, horizon);
    g.stroke();
  }
  for (let i = 1; i <= 14; i++) {
    const t = i / 14;
    const y = horizon + (Hh - horizon) * t * t * t;
    g.globalAlpha = 0.55 - t * 0.4;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  g.globalAlpha = 1;

  // The far skyline: bars of light standing on the horizon, deterministic.
  let seed = 0x2f;
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    const h = 14 + rnd() * (horizon - 24);
    const w = 5 + rnd() * 16;
    g.fillStyle = 'rgba(12,10,20,0.95)';
    g.fillRect(x, horizon - h, w, h);
    g.fillStyle = i % 3 === 0 ? 'rgba(255,42,213,0.5)' : 'rgba(79,183,255,0.42)';
    g.fillRect(x, horizon - h, w, 2.5);
  }

  // The horizon band itself — the brightest line in the picture, because a
  // void with no horizon is just a dark room.
  const band = g.createLinearGradient(0, horizon - 60, 0, horizon + 16);
  band.addColorStop(0, 'rgba(176,107,255,0)');
  band.addColorStop(0.78, 'rgba(176,107,255,0.42)');
  band.addColorStop(1, 'rgba(255,42,213,0.12)');
  g.fillStyle = band;
  g.fillRect(0, horizon - 60, W, 76);

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ═════════════════════════════ THE FOYER ═════════════════════════════════
 * The menu place — and a piece of THE VOID, not of the club. You arrive on
 * a floating platform in the set's own abstract space (arena/voidkit.ts):
 * darkness shaped by light — a neon-edged deck, monolith pylons breathing
 * in the distance, two great hexes turning slowly overhead, shards adrift,
 * a horizon band with no land under it, and a grid far below where ground
 * would be. The board floats at the platform's heart, the MC poses beside
 * it, and the PORTAL stands at the north edge: a moon-gate of light,
 * closed to a shimmer until a room of yours is open on the other side —
 * host or join, and the warm room takes you. Solo sets launch from here
 * and the platform gives way to the raid's void.
 */

export function buildFoyer(scene: Scene): FoyerRefs {
  const root = new Group();
  root.name = 'club-foyer';

  const R = 4.0; // platform radius (hex)

  // ── the platform: a dark gloss hex deck with a neon rim ───────────────
  const deck = new Mesh(
    new CylinderGeometry(R, R * 0.94, 0.3, 6),
    new MeshStandardMaterial({ color: 0x0b0a12, metalness: 0.85, roughness: 0.3 }),
  );
  deck.position.y = -0.15;
  root.add(deck);
  const rim = new Mesh(new TorusGeometry(R - 0.03, 0.035, 4, 6), new MeshStandardMaterial({
    color: 0x0c0b12,
    emissive: hueToColor(0.55, 0.55),
    emissiveIntensity: 1.2,
    metalness: 0.3,
    roughness: 0.4,
  }));
  rim.rotation.x = Math.PI / 2;
  rim.rotation.z = Math.PI / 6; // flats align with the deck's
  rim.position.y = 0.012;
  root.add(rim);

  // The platform is FLOATING, so its underside is half of what anyone sees
  // of it — give it a build: six radial ribs under the deck and a tapered
  // keel hanging below, lit along their lower edges.
  const structMat = new MeshStandardMaterial({ color: 0x090810, metalness: 0.8, roughness: 0.4 });
  const ribGlow = new MeshStandardMaterial({
    color: 0x0b0a12,
    emissive: hueToColor(0.75, 0.5),
    emissiveIntensity: 0.7,
    metalness: 0.3,
    roughness: 0.5,
  });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const rib = new Mesh(new BoxGeometry(0.2, 0.62, R * 1.68), structMat);
    rib.position.set(0, -0.52, 0);
    rib.rotation.y = a;
    root.add(rib);
    const lip = new Mesh(new BoxGeometry(0.07, 0.05, R * 1.62), ribGlow);
    lip.position.set(0, -0.83, 0);
    lip.rotation.y = a;
    root.add(lip);
  }
  const keel = new Mesh(new CylinderGeometry(R * 0.52, 0.18, 2.6, 6), structMat);
  keel.position.y = -2.0;
  root.add(keel);
  const keelTip = new Mesh(new CylinderGeometry(0.2, 0.02, 0.5, 6), ribGlow);
  keelTip.position.y = -3.4;
  root.add(keelTip);

  // Deck inlay: two hairline rings and a crown of radial ticks near the
  // rim. Near-field detail is what the eye actually audits — you stand on
  // this thing for the whole menu.
  for (const [ir, op] of [
    [R * 0.55, 0.4],
    [R * 0.82, 0.28],
  ] as const) {
    const ring = new Mesh(
      new RingGeometry(ir - 0.02, ir + 0.02, 72),
      new MeshBasicMaterial({
        color: hueToColor(0.55, 0.5),
        transparent: true,
        opacity: op,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.006;
    root.add(ring);
  }
  const tickMat = new MeshBasicMaterial({
    color: hueToColor(0.75, 0.5),
    transparent: true,
    opacity: 0.35,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const tick = new Mesh(new PlaneGeometry(0.045, i % 4 === 0 ? 0.34 : 0.17), tickMat);
    tick.rotation.set(-Math.PI / 2, 0, -a);
    tick.position.set(Math.sin(a) * (R * 0.9), 0.006, Math.cos(a) * (R * 0.9));
    root.add(tick);
  }

  // Two step-slabs trailing off behind the spawn — the way you "came in".
  for (const [sx, sy, sz, sr] of [
    [0.5, -0.5, 5.1, 0.9],
    [-0.4, -1.1, 6.3, 0.7],
  ] as const) {
    const slab = new Mesh(
      new CylinderGeometry(sr, sr * 0.9, 0.16, 6),
      new MeshStandardMaterial({ color: 0x0b0a12, metalness: 0.8, roughness: 0.35 }),
    );
    slab.position.set(sx, sy, sz);
    root.add(slab);
  }

  // ── the void around: a lit plain far below with a world standing on it
  const env = new FoyerEnvironment(-7);
  env.root.name = 'live-foyer-void';
  root.add(env.root);

  // ── THE PORTAL: the moon-gate to the club floor ───────────────────────
  // A ring of light standing on the deck's north edge; its inner shimmer
  // breathes while the way is shut, flares while the relay is being rung,
  // and the room swap IS the passage.
  // (The TONIGHT bill that used to float off the east edge is gone — the
  // tour map on the board already tells that story, better.)

  // ── light: a cool wash + one soft key — the board does the reading ────
  root.add(new HemisphereLight(0x8a90c8, 0x05040a, 0.6));
  const key = new PointLight(0xc8d4ff, 1.2, 10, 1.6);
  key.position.set(0, 3.1, -1.4);
  root.add(key);

  scene.add(root);
  collapseStatic(root, (o) => {
    for (let n: Object3D | null = o; n; n = n.parent) {
      if (n.name.startsWith('live-')) return true;
      if (n === root) break;
    }
    return false;
  });

  return { root, env };
}

/* ── real lights: four points + a hemisphere, and not one more ──────────── */

function buildLights(root: Group): void {
  // The base wash: a cool sky, near-black ground — enough for board-formed
  // concrete to read as concrete across the hall (plaster could stay in
  // shadow; concrete that does is just black).
  root.add(new HemisphereLight(0xa4b0cc, 0x0b0c10, 0.9));

  const F = CLUB.floor;
  // The chandelier's warmth over the dance floor — the room's key.
  const key = new PointLight(0xffd9ac, 1.9, 16, 1.55);
  key.position.set(F.x, CLUB.chandelier.y - 0.4, F.z);
  root.add(key);
  // The bar's own pool — hung out OVER the counter so the marble and the
  // drinkers catch it, not just the glass wall behind them.
  const barLight = new PointLight(0xffc48a, 1.5, 11, 1.55);
  barLight.position.set(CLUB.bar.x - 0.5, 2.2, (CLUB.bar.z0 + CLUB.bar.z1) / 2);
  root.add(barLight);
  // The lounge's softer amber, warm enough to read a face in a booth.
  const lounge = new PointLight(0xffb87e, 1.35, 10, 1.55);
  lounge.position.set(CLUB.boothX + 1.3, 2.2, -3.4);
  root.add(lounge);
  // The still room's ember — small, low, warm.
  const still = new PointLight(0xffa868, 0.9, 7, 1.6);
  still.position.set((CLUB.quiet.minX + CLUB.quiet.maxX) / 2, 1.6, (CLUB.quiet.minZ + CLUB.quiet.maxZ) / 2);
  root.add(still);
}
