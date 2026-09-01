/**
 * THE SITES — three places in one desert (DESIGN.md §6.1).
 *
 * The desert used to be one clearing you never left: the same sign, the
 * same skull, the same skyline whether you were reading the wrap, boxing
 * a stranger or standing five abreast against a king. Now the SAME desert
 * has three sites, and the game walks you between them by what you're
 * doing:
 *
 *   TRAILHEAD  the lobby — the edge of GASKET. The signpost under its own
 *              buzzing lamp, the broken fence, a campfire burning low, a
 *              windmill turning against the last light, telegraph poles
 *              marching off toward town. Somewhere you'd wait.
 *   THE FLATS  a match — open ground, nothing to hide behind. The skull, a
 *              dead tree throwing the longest shadow in the game, and the
 *              ribs of something enormous, half under the sand.
 *   BONEYARD   the campaign and every raid — where titans are broken. A
 *              ring of standing wreck-plates around the pit, oil drums
 *              burning, RUSTHOOK's own hook buried to the shank, scrap
 *              heaped where it fell.
 *
 * Only ONE site is visible at a time and each collapses to a few static
 * draws; the living bits (fire, the windmill) stay out of the merge. The
 * far layer — sky, sun, terrain, mesas — is shared and simply YAWED per
 * site (SITE_YAW), so the sun band and the skyline sit somewhere new too:
 * the lobby's dying sun hangs to your left, a match's rival stands backlit
 * against it, and a raid's titan is lit full in the face while the squad
 * has the light at its back.
 */

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  TorusGeometry,
} from 'three';
import { CONFIG } from './config.js';
import { makePaper, makePaperDouble, makeRng } from './paper.js';
import { desertHeight } from './terrain.js';
import { fence, signpost, skull } from './props.js';
import { collapseStatic } from '../merge.js';

export type DesertSite = 'trailhead' | 'flats' | 'boneyard';

/** How far the shared far layer turns for each site (radians about +y).
 *  The sun sits at azimuth (0.35, −0.94) unturned — ahead and to the right.
 *  0.75 swings it to the LEFT-front for the lobby (the TOWN board's side);
 *  0.36 puts it dead behind the far platform so a rival is backlit; the
 *  boneyard adds a half turn so it's behind the squad, on the titan. */
export const SITE_YAW: Record<DesertSite, number> = {
  trailhead: 0.75,
  flats: 0.36,
  boneyard: 0.36 + Math.PI,
};

export interface SiteSet {
  root: Group;
  update(delta: number, time: number): void;
}

const P = CONFIG.palette;

/** Ground height under a WORLD point when the far layer is yawed: the
 *  terrain lives in the far layer's frame, so un-turn the point first. */
function groundAt(x: number, z: number, yaw: number): number {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return desertHeight(x * c - z * s, x * s + z * c);
}

function rustMat(hex: number, rough = 0.62): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0.55, envMapIntensity: 0.5 });
}

/* ── fire: crossed emissive planes + rising embers + a flickering light ── */

interface Flame {
  group: Group;
  planes: Mesh[];
  light: PointLight | null;
  embers: Points;
  emberVel: Float32Array;
  base: number;
  seed: number;
}

/** A small fire: three crossed tongues that breathe and lean, a spray of
 *  embers climbing out of it, and (optionally — lights are the one thing
 *  we ration) a warm point light that gutters with the flame. */
function makeFlame(scale: number, lit: boolean, seed: number): Flame {
  const group = new Group();
  const planes: Mesh[] = [];
  const tongue = new PlaneGeometry(0.5, 0.9).translate(0, 0.45, 0);
  const cols = ['#ff7a18', '#ffb347', '#ff4d12'];
  for (let i = 0; i < 3; i++) {
    const m = new Mesh(tongue, makePaperDouble(cols[i], 2.4 - i * 0.4));
    m.rotation.y = (i / 3) * Math.PI;
    m.scale.setScalar(scale * (1 - i * 0.18));
    group.add(m);
    planes.push(m);
  }
  const n = 26;
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 0.3 * scale;
    pos[i * 3 + 1] = Math.random() * 1.6 * scale;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.3 * scale;
    vel[i] = 0.3 + Math.random() * 0.5;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  const embers = new Points(
    geo,
    new PointsMaterial({ color: 0xffa040, size: 0.035 * scale, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  embers.frustumCulled = false;
  group.add(embers);
  let light: PointLight | null = null;
  if (lit) {
    light = new PointLight(0xff8a2a, 6 * scale, 7 * scale, 2);
    light.position.y = 0.6 * scale;
    group.add(light);
  }
  return { group, planes, light, embers, emberVel: vel, base: scale, seed };
}

function tickFlame(f: Flame, delta: number, time: number): void {
  const t = time * 9 + f.seed;
  f.planes.forEach((p, i) => {
    const k = 1 + Math.sin(t + i * 2.1) * 0.12 + Math.sin(t * 1.7 + i) * 0.08;
    p.scale.set(f.base * (1 - i * 0.18) * (1.05 - (k - 1) * 0.6), f.base * (1 - i * 0.18) * k, 1);
    p.rotation.z = Math.sin(t * 0.6 + i * 1.3) * 0.12;
  });
  if (f.light) f.light.intensity = 6 * f.base * (0.85 + Math.sin(t * 1.3) * 0.08 + Math.sin(t * 3.1) * 0.07);
  const pos = f.embers.geometry.attributes.position as BufferAttribute;
  const arr = pos.array as Float32Array;
  const top = 1.7 * f.base;
  for (let i = 0; i < f.emberVel.length; i++) {
    arr[i * 3 + 1] += f.emberVel[i] * f.base * delta;
    arr[i * 3] += Math.sin(time * 2 + i) * 0.15 * delta;
    if (arr[i * 3 + 1] > top) {
      arr[i * 3 + 1] = 0.1;
      arr[i * 3] = (Math.random() - 0.5) * 0.3 * f.base;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.3 * f.base;
    }
  }
  pos.needsUpdate = true;
}

/* ── TRAILHEAD ─────────────────────────────────────────────────────────── */

/** A stone-ringed campfire: the lobby's hearth. */
function campfire(rng: () => number): { group: Group; flame: Flame } {
  const g = new Group();
  const stone = makePaper('#5a4a3f', 0.95);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng() * 0.3;
    const r = 0.55 + rng() * 0.08;
    const s = new Mesh(new DodecahedronGeometry(0.11 + rng() * 0.05, 0), stone);
    s.position.set(Math.cos(a) * r, 0.07, Math.sin(a) * r);
    s.rotation.set(rng() * 3, rng() * 3, 0);
    s.scale.y = 0.75;
    g.add(s);
  }
  const wood = makePaper('#2a1a10', 0.9);
  for (let i = 0; i < 4; i++) {
    const log = new Mesh(new CylinderGeometry(0.05, 0.06, 0.7, 6), wood);
    log.rotation.z = Math.PI / 2 - 0.5;
    log.rotation.y = (i / 4) * Math.PI * 2;
    log.position.set(0, 0.14, 0);
    g.add(log);
  }
  // Char + ember glow in the centre: an emissive disc under the flame.
  const bed = new Mesh(new CylinderGeometry(0.3, 0.34, 0.04, 10), makePaperDouble('#ff5a1a', 1.1));
  bed.position.y = 0.06;
  g.add(bed);
  const flame = makeFlame(0.8, true, 3.1);
  flame.group.position.y = 0.1;
  g.add(flame.group);
  return { group: g, flame };
}

/** An Aermotor-style windmill on a lattice tower, the fan free to spin. */
function windmill(): { group: Group; fan: Group } {
  const g = new Group();
  const steel = rustMat(0x5a4a3c, 0.7);
  const H = 9;
  // Four splayed legs + three rings of cross bracing.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new Mesh(new CylinderGeometry(0.05, 0.07, H, 5), steel);
    leg.position.set(Math.cos(a) * 0.65, H / 2, Math.sin(a) * 0.65);
    leg.lookAt(Math.cos(a) * 0.2, H, Math.sin(a) * 0.2);
    leg.rotateX(Math.PI / 2);
    g.add(leg);
  }
  for (const y of [2.2, 4.6, 7]) {
    const w = 1.3 - (y / H) * 0.9;
    for (let i = 0; i < 4; i++) {
      const bar = new Mesh(new BoxGeometry(w, 0.04, 0.04), steel);
      bar.position.set(0, y, 0);
      bar.rotation.y = (i / 4) * Math.PI * 2;
      bar.translateZ(w / 2);
      g.add(bar);
    }
  }
  // Platform, hub, and the fan.
  const deck = new Mesh(new BoxGeometry(0.9, 0.06, 0.9), steel);
  deck.position.y = H;
  g.add(deck);
  const fan = new Group();
  fan.position.set(0, H + 0.7, 0.55);
  const hub = new Mesh(new CylinderGeometry(0.14, 0.14, 0.2, 10), steel);
  hub.rotation.x = Math.PI / 2;
  fan.add(hub);
  const bladeMat = makePaper('#8a7a68', 0.85);
  const rim = new Mesh(new TorusGeometry(1.35, 0.025, 5, 28), steel);
  fan.add(rim);
  for (let i = 0; i < 14; i++) {
    const b = new Mesh(new BoxGeometry(0.28, 1.15, 0.015), bladeMat);
    b.position.y = 0.72;
    b.rotation.y = 0.55; // sail pitch
    const spoke = new Group();
    spoke.rotation.z = (i / 14) * Math.PI * 2;
    spoke.add(b);
    fan.add(spoke);
  }
  g.add(fan);
  // Tail vane, the length of the machine behind the hub.
  const boom = new Mesh(new BoxGeometry(0.05, 0.05, 1.6), steel);
  boom.position.set(0, H + 0.7, -0.4);
  g.add(boom);
  const vane = new Mesh(new BoxGeometry(0.02, 0.9, 0.7), bladeMat);
  vane.position.set(0, H + 0.85, -1.3);
  g.add(vane);
  g.traverse((o) => (o.castShadow = true));
  return { group: g, fan };
}

/** Telegraph poles marching off along a line — the road to town. */
function telegraphLine(n: number): Group {
  const g = new Group();
  const wood = makePaper(P.wood, 0.98);
  for (let i = 0; i < n; i++) {
    const pole = new Group();
    const post = new Mesh(new CylinderGeometry(0.09, 0.12, 6.2, 6), wood);
    post.position.y = 3.1;
    const arm = new Mesh(new BoxGeometry(1.4, 0.1, 0.1), wood);
    arm.position.y = 5.7;
    const arm2 = arm.clone();
    arm2.position.y = 5.2;
    pole.add(post, arm, arm2);
    pole.position.z = -i * 7;
    pole.rotation.z = (i % 2 ? 1 : -1) * 0.02;
    g.add(pole);
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/** The hooded lamp over the GASKET sign — the one lit thing at the
 *  trailhead besides the fire. Its light is the sign's, so it's real. */
function signLamp(): { group: Group; light: PointLight; bulb: Mesh } {
  const g = new Group();
  const steel = rustMat(0x3c3430, 0.75);
  const arm = new Mesh(new CylinderGeometry(0.025, 0.025, 0.9, 6), steel);
  arm.rotation.z = Math.PI / 2 - 0.35;
  arm.position.set(0.3, 2.45, -0.02);
  const hood = new Mesh(new ConeGeometry(0.22, 0.16, 12, 1, true), steel);
  hood.position.set(0.75, 2.6, 0);
  hood.rotation.x = Math.PI; // mouth down
  const bulb = new Mesh(new IcosahedronGeometry(0.05, 1), makePaperDouble('#ffd9a0', 3.2));
  bulb.position.set(0.75, 2.52, 0);
  const light = new PointLight(0xffc27a, 4.5, 5.5, 2);
  light.position.set(0.75, 2.45, 0);
  g.add(arm, hood, bulb, light);
  return { group: g, light, bulb };
}

function buildTrailhead(yaw: number): SiteSet {
  const root = new Group();
  root.name = 'site-trailhead';
  root.visible = false;
  const rng = makeRng(CONFIG.terrain.seed * 31 + 7);
  const statics = new Group();
  const place = (o: Object3D, x: number, z: number, ry: number, into: Object3D = statics): void => {
    o.position.set(x, groundAt(x, z, yaw), z);
    o.rotation.y = ry;
    into.add(o);
  };

  // The sign, now with its lamp, clear of the raid arc as before.
  const sign = signpost();
  const lamp = signLamp();
  sign.add(lamp.group);
  place(sign, 8.2, -2.0, -0.85, root); // the lamp flickers: keep it live
  place(fence(), -7, 6, 0.3);
  // The hearth: left-front, four and a half metres out — beyond the wrap's
  // arc and the podium, close enough to warm the TOWN board's side.
  const fire = campfire(rng);
  place(fire.group, -4.6, -3.4, 0, root);
  // A second, dead fire ring further out — someone was here before you.
  const old = new Group();
  const stone = makePaper('#4d4038', 0.95);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const s = new Mesh(new DodecahedronGeometry(0.1, 0), stone);
    s.position.set(Math.cos(a) * 0.5, 0.06, Math.sin(a) * 0.5);
    s.scale.y = 0.7;
    old.add(s);
  }
  place(old, 6.5, 7.5, 0);
  // The windmill against the sun band (left-front once the far layer
  // turns), and the poles heading off the other way, toward town.
  const mill = windmill();
  place(mill.group, -19, -24, 0.4, root);
  place(telegraphLine(6), 14, -4, -0.6);

  collapseStatic(statics);
  root.add(statics);

  return {
    root,
    update(delta, time) {
      tickFlame(fire.flame, delta, time);
      mill.fan.rotation.z += delta * 0.9;
      // The lamp buzzes: a steady glow with a nervous flicker under it.
      const f = 0.9 + Math.sin(time * 37) * 0.04 + (Math.sin(time * 5.3) > 0.97 ? -0.35 : 0);
      lamp.light.intensity = 4.5 * f;
      (lamp.bulb.material as MeshStandardMaterial).emissiveIntensity = 3.2 * f;
    },
  };
}

/* ── THE FLATS ─────────────────────────────────────────────────────────── */

/** A dead tree: a leaning trunk forking into bare branches. */
function deadTree(rng: () => number): Group {
  const g = new Group();
  const bark = makePaper('#3a2a1e', 0.98);
  const branch = (parent: Object3D, len: number, r: number, depth: number): void => {
    const m = new Mesh(new CylinderGeometry(r * 0.55, r, len, 6), bark);
    m.position.y = len / 2;
    const holder = new Group();
    holder.add(m);
    parent.add(holder);
    if (depth === 0) return;
    const kids = 2 + (rng() < 0.4 ? 1 : 0);
    for (let i = 0; i < kids; i++) {
      const h = new Group();
      h.position.y = len * (0.55 + rng() * 0.4);
      h.rotation.set((rng() - 0.5) * 0.4, rng() * Math.PI * 2, 0.45 + rng() * 0.5);
      holder.add(h);
      branch(h, len * (0.55 + rng() * 0.2), r * 0.6, depth - 1);
    }
  };
  branch(g, 3.2, 0.22, 3);
  g.rotation.z = 0.12;
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/** The ribs of something enormous, half under the sand. */
function titanRibs(rng: () => number): Group {
  const g = new Group();
  const bone = makePaper(P.bone, 0.6);
  bone.envMapIntensity = 0.9; // bleached bone catches the light
  const n = 6;
  for (let i = 0; i < n; i++) {
    const r = 2.6 - i * 0.22;
    const rib = new Mesh(new TorusGeometry(r, 0.11 - i * 0.008, 6, 22, Math.PI * 0.62), bone);
    rib.position.set(0, -0.35, i * 0.75);
    rib.rotation.set(0, Math.PI / 2, Math.PI * 0.2 + (rng() - 0.5) * 0.1);
    g.add(rib);
  }
  // The spine they hang from.
  const spine = new Mesh(new CylinderGeometry(0.16, 0.2, n * 0.75 + 0.8, 8), bone);
  spine.rotation.x = Math.PI / 2;
  spine.position.set(0, 1.9, (n * 0.75) / 2 - 0.4);
  g.add(spine);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

function buildFlats(yaw: number): SiteSet {
  const root = new Group();
  root.name = 'site-flats';
  root.visible = false;
  const rng = makeRng(CONFIG.terrain.seed * 37 + 11);
  const statics = new Group();
  const place = (o: Object3D, x: number, z: number, ry: number): void => {
    o.position.set(x, groundAt(x, z, yaw), z);
    o.rotation.y = ry;
    statics.add(o);
  };
  place(skull(), -6.8, -1.6, 0.8);
  place(deadTree(rng), 7.6, 2.4, 0.3);
  place(titanRibs(rng), -10.5, -9.5, 0.9);
  // A few bleached long bones scattered toward the ribs.
  const bone = makePaper(P.bone, 0.7);
  for (let i = 0; i < 4; i++) {
    const b = new Mesh(new CylinderGeometry(0.06, 0.08, 1.1 + rng() * 0.6, 6), bone);
    const x = -6 - rng() * 4;
    const z = -4 - rng() * 5;
    b.position.set(x, groundAt(x, z, yaw) + 0.05, z);
    b.rotation.set(Math.PI / 2, 0, rng() * Math.PI);
    statics.add(b);
  }
  collapseStatic(statics);
  root.add(statics);
  return { root, update: () => {} };
}

/* ── BONEYARD ──────────────────────────────────────────────────────────── */

/** A standing wreck-plate: a rusted titan panel driven into the sand. */
function wreckPlate(rng: () => number, mat: MeshStandardMaterial): Group {
  const g = new Group();
  const h = 3.4 + rng() * 2.6;
  const w = 1.4 + rng() * 1.2;
  const plate = new Mesh(new BoxGeometry(w, h, 0.18), mat);
  plate.position.y = h / 2 - 0.4;
  plate.rotation.set((rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.25);
  g.add(plate);
  // A rib of structure showing on one face.
  const rib = new Mesh(new BoxGeometry(0.12, h * 0.8, 0.1), mat);
  rib.position.set((rng() - 0.5) * w * 0.6, h / 2 - 0.4, 0.14);
  rib.rotation.copy(plate.rotation);
  g.add(rib);
  return g;
}

/** An oil drum with a fire in it. */
function burningDrum(lit: boolean, seed: number): { group: Group; flame: Flame } {
  const g = new Group();
  const drum = new Mesh(new CylinderGeometry(0.3, 0.3, 0.9, 12, 1, true), rustMat(0x4a2e22, 0.8));
  drum.position.y = 0.45;
  g.add(drum);
  for (const y of [0.15, 0.75]) {
    const band = new Mesh(new TorusGeometry(0.31, 0.02, 5, 16), rustMat(0x2e1d16, 0.85));
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    g.add(band);
  }
  const flame = makeFlame(0.6, lit, seed);
  flame.group.position.y = 0.75;
  g.add(flame.group);
  return { group: g, flame };
}

/** RUSTHOOK's hook, buried to the shank — the boneyard's monument. */
function buriedHook(): Group {
  const g = new Group();
  const mat = rustMat(0x4a3b2b, 0.66);
  const bend = new Mesh(new TorusGeometry(1.7, 0.28, 8, 24, Math.PI * 1.15), mat);
  bend.rotation.set(0, 0, -0.3);
  bend.position.y = 0.6;
  g.add(bend);
  const shank = new Mesh(new CylinderGeometry(0.26, 0.3, 3.2, 10), mat);
  shank.position.set(1.7, -0.6, 0);
  shank.rotation.z = -0.3;
  g.add(shank);
  const tip = new Mesh(new ConeGeometry(0.28, 0.9, 10), mat);
  tip.position.set(-1.05, 1.95, 0);
  tip.rotation.z = -1.2;
  g.add(tip);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/** A heap of scrap: plates and struts thrown together. */
function scrapHeap(rng: () => number, mat: MeshStandardMaterial, n: number): Group {
  const g = new Group();
  for (let i = 0; i < n; i++) {
    const long = rng() < 0.4;
    const m = new Mesh(
      long ? new BoxGeometry(0.12, 0.12, 1.2 + rng() * 1.2) : new BoxGeometry(0.6 + rng() * 0.8, 0.08, 0.5 + rng() * 0.7),
      mat,
    );
    const a = rng() * Math.PI * 2;
    const r = rng() * 1.3;
    m.position.set(Math.cos(a) * r, 0.05 + rng() * 0.6, Math.sin(a) * r);
    m.rotation.set((rng() - 0.5) * 0.9, rng() * Math.PI, (rng() - 0.5) * 0.9);
    g.add(m);
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}

function buildBoneyard(yaw: number): SiteSet {
  const root = new Group();
  root.name = 'site-boneyard';
  root.visible = false;
  const rng = makeRng(CONFIG.terrain.seed * 41 + 13);
  const statics = new Group();
  const place = (o: Object3D, x: number, z: number, ry: number, into: Object3D = statics): void => {
    o.position.set(x, groundAt(x, z, yaw), z);
    o.rotation.y = ry;
    into.add(o);
  };
  // Everything clears the RAID footprint: five seats out to (±5.7, −4.15),
  // the pit pad at (0, −6) two-and-a-half metres across — nothing inside
  // ten metres of the origin or six of the pit, and the front (+z) stays
  // open so the lobby-to-fight cut never puts a wall at your back.
  const plates = [rustMat(0x4a3b2b), rustMat(0x33373f), rustMat(0x342e40, 0.7)];
  const ring = 12.5;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8 - 0.5) * Math.PI * 1.25; // the back arc, −z
    const r = ring + (rng() - 0.5) * 2.5;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    place(wreckPlate(rng, plates[i % plates.length]), x, z, -a + (rng() - 0.5) * 0.5);
  }
  place(buriedHook(), -13.5, -13, 0.6);
  place(scrapHeap(rng, plates[0], 14), 11.5, -7, 0);
  place(scrapHeap(rng, plates[1], 10), -11, 4.5, 1.2);
  place(scrapHeap(rng, plates[2], 8), 9.5, 7.5, 0.4);
  // Drums: two LIT (the light budget), two just burning.
  const drums = [
    burningDrum(true, 1.7),
    burningDrum(true, 4.2),
    burningDrum(false, 8.8),
    burningDrum(false, 12.4),
  ];
  place(drums[0].group, -9.6, -3.2, 0, root);
  place(drums[1].group, 9.6, -3.2, 0, root);
  place(drums[2].group, -7.4, 6.5, 0, root);
  place(drums[3].group, 7.6, 6.2, 0, root);
  collapseStatic(statics);
  root.add(statics);
  return {
    root,
    update(delta, time) {
      for (const d of drums) tickFlame(d.flame, delta, time);
    },
  };
}

/* ── the set ───────────────────────────────────────────────────────────── */

export function buildSites(): Record<DesertSite, SiteSet> {
  return {
    trailhead: buildTrailhead(SITE_YAW.trailhead),
    flats: buildFlats(SITE_YAW.flats),
    boneyard: buildBoneyard(SITE_YAW.boneyard),
  };
}
