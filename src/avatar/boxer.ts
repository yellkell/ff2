/**
 * The iron boxer — the opponent's avatar, styled like a 90s UK robot-wars
 * machine: an eight-sided helmet with a glowing visor slit, a shoulder-heavy
 * torso (wide armoured yoke + sloped pauldrons tapering down to a narrow
 * waist — the silhouette is THICKEST at the shoulders), a small pelvis block,
 * and two chunky mechanical gauntlets driven straight by the (bot or remote)
 * hand poses. No legs — floating hands and iron, on brand.
 *
 * The body volumes still track the gameplay hitboxes (head/chest/pelvis
 * spheres from BODY_IK) so what you see is what you can hit.
 */

import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Quaternion,
  RepeatWrapping,
  Vector3,
} from 'three';
import { buildMannequinChest, buildMannequinHead, buildMannequinPelvis } from './mannequin.js';
import { BODY_IK, PALETTE, teamColor } from '../config.js';
import { collapseStatic } from '../arena/merge.js';
import { buildHand } from './hands.js';

/**
 * A shared brushed-steel roughness map: fine horizontal grain + speckle so the
 * armour plate reads as worked metal under the room reflections, not a flat
 * panel. One texture, tiled across every chassis/trim material.
 */
function brushedSteelMap(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const len = 4 + Math.random() * 22;
    const g = (110 + Math.random() * 110) | 0;
    ctx.strokeStyle = `rgba(${g},${g},${g},0.5)`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y); // horizontal brush strokes
    ctx.stroke();
  }
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

const STEEL_ROUGH = brushedSteelMap();

export interface BoxerRig {
  /** Helmet + visor; position/orient from the head pose. */
  head: Group;
  /** Container for the solved torso pieces (sits at the world origin). */
  torso: Group;
  /** Shoulder yoke + pauldrons + trunk; placed/oriented at the chest point. */
  chest: Group;
  /** Pelvis block; placed at the hips. */
  pelvis: Group;
  /** One gauntlet per hand; position/orient from the hand poses. */
  gloves: [Group, Group];
  /** Everything, for showing/hiding as one. */
  all: Group[];
}

export const GLOVE_VISUAL_SCALE = 1.28;

function chassisMat(emissive = 0, intensity = 0): MeshStandardMaterial {
  // Near-black mirror steel: the RoomEnvironment reflections do the reading.
  const m = new MeshStandardMaterial({
    color: 0x1c1f25,
    emissive,
    emissiveIntensity: intensity,
    metalness: 0.96,
    roughness: 0.2,
  });
  if (STEEL_ROUGH) m.roughnessMap = STEEL_ROUGH; // brushed-metal grain
  m.userData.role = 'chassis'; // skin recolour target (avatar/skins.ts)
  // Steel body tinted by the accent through its emissive channel only.
  if (emissive) m.userData.accent = 'emissive';
  return m;
}

function darkMat(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: 0x121419,
    metalness: 0.9,
    roughness: 0.3,
  });
  if (STEEL_ROUGH) m.roughnessMap = STEEL_ROUGH;
  m.userData.role = 'trim';
  return m;
}

function glowMat(color: number, intensity = 1.4): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.2,
    roughness: 0.3,
  });
  m.userData.role = 'glow';
  // A pure neon highlight: both its base colour and glow follow the accent.
  m.userData.accent = 'glow';
  return m;
}


/**
 * How much of the accent the STEEL BODY takes through its emissive channel.
 * The glowing neon parts wear the colour at full; the chassis takes a softened
 * share of it — enough to keep that neon-lit sheen washing over the suit, but
 * short of the full hue (which used to paint the body a slab of the accent).
 */
const BODY_ACCENT_TINT = 0.5;

/**
 * Re-tint every accent-tagged material under a built avatar (glove or boxer)
 * to `color`. Glow highlights take it on both colour + emissive; chassis steel
 * only on a heavily DAMPENED emissive tint, so the body stays forged metal
 * rather than a slab of the accent. Cheap enough to call live while dragging a
 * slider.
 */
export function setAvatarAccent(root: Object3D, color: number): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const mode = (mat as MeshStandardMaterial).userData?.accent;
      const m = mat as MeshStandardMaterial;
      if (mode === 'glow') {
        m.color.set(color);
        m.emissive.set(color);
      } else if (mode === 'emissive') {
        // `set` resets from the hue, then the scale dims it — idempotent across
        // repeated slider drags, so the body never builds up colour.
        m.emissive.set(color).multiplyScalar(BODY_ACCENT_TINT);
      }
    }
  });
}

/**
 * A chunky mechanical gauntlet: armoured fist block, riveted knuckle plate
 * with glowing studs, side armour, a top piston, and a flared cuff with a
 * team-glow ring. Knuckles point down local -Z.
 *
 * The glow parts double as LEDs: they're registered on `glove.userData.leds`
 * and `setGloveLit` flares them while the owner squeezes trigger/grip — a
 * readable tell on BOTH boxers' fists.
 */
export function buildGlove(team: number, accent: number = teamColor(team)): Group {
  const glove = new Group();
  glove.scale.setScalar(GLOVE_VISUAL_SCALE);

  const leds: MeshStandardMaterial[] = [];
  /** Register a material as an LED: `lit` flares it to litIntensity. */
  const registerLed = (
    m: MeshStandardMaterial,
    base: number,
    litIntensity: number,
    whiten: number,
  ): MeshStandardMaterial => {
    m.userData.baseIntensity = base;
    m.userData.litIntensity = litIntensity;
    m.userData.baseColor = new Color(accent);
    m.userData.litColor = new Color(accent).lerp(new Color(PALETTE.white), whiten);
    leds.push(m);
    return m;
  };
  const ledMat = (base: number, litIntensity: number): MeshStandardMaterial =>
    registerLed(glowMat(accent, base), base, litIntensity, 0.7);
  glove.userData.leds = leds;

  // The fist: one thick armoured block — its faint team glow joins the LED
  // set so the WHOLE fist visibly charges up, readable across the arena.
  const fist = new Mesh(
    new BoxGeometry(0.16, 0.125, 0.17),
    registerLed(chassisMat(accent, 0.06), 0.06, 1.1, 0.35),
  );
  fist.position.z = -0.015;
  glove.add(fist);

  // Knuckle plate riding the top front edge.
  const plate = new Mesh(new BoxGeometry(0.165, 0.05, 0.07), darkMat());
  plate.position.set(0, 0.05, -0.075);
  glove.add(plate);

  // Four glowing knuckle studs across the strike face.
  for (let i = 0; i < 4; i++) {
    const stud = new Mesh(new BoxGeometry(0.024, 0.022, 0.02), ledMat(1.1, 5.0));
    stud.position.set(-0.054 + i * 0.036, 0.052, -0.108);
    glove.add(stud);
  }

  // Side armour cheeks.
  for (const side of [-1, 1]) {
    const cheek = new Mesh(new BoxGeometry(0.022, 0.1, 0.13), darkMat());
    cheek.position.set(side * 0.09, 0, -0.01);
    glove.add(cheek);
  }

  // Recoil piston along the top.
  const piston = new Mesh(new CylinderGeometry(0.016, 0.016, 0.1, 8), darkMat());
  piston.rotation.x = Math.PI / 2;
  piston.position.set(0, 0.07, 0.02);
  glove.add(piston);
  const rod = new Mesh(new CylinderGeometry(0.008, 0.008, 0.06, 8), ledMat(0.7, 3.5));
  rod.rotation.x = Math.PI / 2;
  rod.position.set(0, 0.07, -0.05);
  glove.add(rod);

  // Flared cuff with a glowing team ring.
  const cuff = new Mesh(new CylinderGeometry(0.06, 0.078, 0.08, 8), chassisMat());
  cuff.rotation.x = Math.PI / 2;
  cuff.position.z = 0.095;
  glove.add(cuff);
  const ring = new Mesh(new CylinderGeometry(0.073, 0.073, 0.018, 8), ledMat(0.9, 4.0));
  ring.rotation.x = Math.PI / 2;
  ring.position.z = 0.07;
  glove.add(ring);

  return glove;
}

/**
 * Flare (or settle) a gauntlet's LEDs. `lit` = the hand is ACTIVE — its
 * owner is squeezing trigger/grip, or its ball is mid-return. Eases so the
 * light blooms on and fades off.
 */
export function setGloveLit(glove: Group, lit: boolean, delta: number): void {
  const leds = glove.userData.leds as MeshStandardMaterial[] | undefined;
  if (!leds) return;
  const k = Math.min(1, delta * 14);
  for (const m of leds) {
    const target = lit
      ? ((m.userData.litIntensity as number) ?? 3)
      : ((m.userData.baseIntensity as number) ?? 1);
    m.emissiveIntensity += (target - m.emissiveIntensity) * k;
    m.emissive.lerp(lit ? (m.userData.litColor as Color) : (m.userData.baseColor as Color), k);
  }
}

// ---------------------------------------------------------------------------
// Animal heads — a detailed metallic head per skin. Each is a self-contained
// Group tagged with the skin id it belongs to (applyAvatarSkin shows one). The
// front faces −z; everything is sized off BODY_IK.headRadius so the head fills
// the (unchanged) head hitbox sphere. Materials are role-tagged so a skin
// recolours them: chassis = body steel, trim = dark, glow = the accent (eyes).
// ---------------------------------------------------------------------------


// FF2: THE BLANK is the only body in town. The FF1 animal chassis
// (bear/panther/eagle/knight/stallion/wolf/frog/oswald — ~2,100 lines of
// lofted steel) retired with the skins system; the mannequin is the one
// entry every table serves, and the paint system owns identity from here.
const HEAD_BUILDERS: Record<string, (accent: number) => Group> = {
  blank: buildMannequinHead,
};
const CHEST_BUILDERS: Record<string, (accent: number) => Group> = {
  blank: buildMannequinChest,
};
const PELVIS_BUILDERS: Record<string, (accent: number) => Group> = {
  blank: buildMannequinPelvis,
};
const ALL_SKIN_IDS = ['blank'];

/**
 * Build the full opponent rig. Pieces start hidden; add them to the scene.
 *
 * Pass `skinId` when the wearer never changes skin (a pub punter, the bartender,
 * a chosen fighter) and ONLY that skin's head/cuirass/hips are built — and shown
 * straight away. With no `skinId` all three are built (two left hidden) so the
 * customisation mirror can flip between them live; `applyAvatarSkin` reveals one.
 * Building just the one avoids carrying two extra skins' geometry per rig — a
 * real saving with a roomful of punters.
 */
export function buildBoxer(team: number, skinId?: string): BoxerRig {
  const accent = teamColor(team);
  const ids = skinId && HEAD_BUILDERS[skinId] ? [skinId] : ALL_SKIN_IDS;
  const sole = ids.length === 1; // the one built skin shows without applyAvatarSkin

  // Each skin part is rigid after build (only the hands articulate), so bake
  // its dozens of plates down to one mesh per material look — the KNIGHT set
  // alone was ~75 draw calls per bot, and three FFA bots rolling the heavy
  // skins was a visible frame hit. The tagged group survives the collapse, so
  // applyAvatarSkin's show-one-skin toggle and the accent/role recolours all
  // work unchanged.
  const buildCollapsed = (builder: (accent: number) => Group): Group => {
    const g = builder(accent);
    collapseStatic(g);
    if (sole) g.visible = true;
    return g;
  };

  // --- Head: a detailed metallic ANIMAL head per built skin (front is −z).
  //     Hitboxes are the BODY_IK spheres and never change, so every fighter is
  //     equally hittable whatever's built. ---
  const head = new Group();
  head.name = 'opponent-head';
  for (const id of ids) head.add(buildCollapsed(HEAD_BUILDERS[id]));

  // --- Torso: a DISTINCT armoured cuirass + hip set per built skin. Same
  //     silhouette envelope and BODY_IK hitbox spheres, equally hittable. ---
  const chest = new Group();
  chest.name = 'opponent-chest';
  for (const id of ids) chest.add(buildCollapsed(CHEST_BUILDERS[id]));

  const pelvis = new Group();
  pelvis.name = 'opponent-pelvis';
  for (const id of ids) pelvis.add(buildCollapsed(PELVIS_BUILDERS[id]));

  const torso = new Group();
  torso.name = 'opponent-torso';
  torso.add(chest, pelvis);

  // Articulated VR hands (left thumb +x, right thumb -x), not gauntlets.
  const gloves: [Group, Group] = [buildHand(1), buildHand(-1)];
  gloves[0].name = 'opponent-glove-left';
  gloves[1].name = 'opponent-glove-right';

  return { head, torso, chest, pelvis, gloves, all: [head, torso, gloves[0], gloves[1]] };
}

const UP = new Vector3(0, 1, 0);
/** Platform top in the solve's local space — the torso never sinks below it. */
const GROUND_Y = 0.14;
const _hips = new Vector3();
const _chest = new Vector3();
const _spine = new Vector3();
const _fwd = new Vector3();
const _anchor = new Vector3();
const _tilt = new Quaternion();
const _yaw = new Quaternion();

/**
 * Solve the torso under the head, mirroring PlayerBodySystem: hips over the
 * pad centre (padX/padZ) — but dragged DOWN when the head ducks, so a dodge
 * folds the whole machine instead of leaving the pelvis hanging in the air —
 * chest lerped hips→head, both oriented to the spine lean and the head's yaw.
 *
 * The spine hangs from a point slightly BEHIND the head along its yaw
 * (faces sit forward of spines): looking down shows the player the front of
 * their own chest instead of the base of their neck, and the torso stops
 * blocking the view of what's in front.
 *
 * That set-back is tuned for the FIRST-PERSON wearer; a third-person viewer
 * just sees the head jutting ahead of the chest, so callers rendering OTHER
 * people (the pub crowd) can pass a smaller `setBackBase` to seat the head
 * more naturally over the shoulders.
 *
 * Returns chest/pelvis world positions for the caller's hitboxes via out args.
 */
export function solveTorso(
  rig: BoxerRig,
  headPos: Vector3,
  headQuat: Quaternion,
  padX: number,
  padZ: number,
  outChest: Vector3,
  outPelvis: Vector3,
  setBackBase: number = BODY_IK.spineSetBack,
): void {
  rig.head.position.copy(headPos);
  rig.head.quaternion.copy(headQuat);

  // Horizontal yaw-forward of the head; the spine anchor sits behind it.
  _fwd.set(0, 0, -1).applyQuaternion(headQuat);
  const hl = Math.hypot(_fwd.x, _fwd.z);
  const nx = hl > 1e-3 ? _fwd.x / hl : 0;
  const nz = hl > 1e-3 ? _fwd.z / hl : -1;
  // How far the head has dropped toward the platform — 0 standing, →1 laid
  // right out. As you go down, the spine anchor backs FURTHER off so the torso
  // stretches flat out BEHIND you along the slab instead of folding straight
  // down through it.
  const duck = Math.min(1, Math.max(0, (BODY_IK.hipHeight - headPos.y + 0.35) / 0.8));
  const setBack = setBackBase + duck * 0.5;
  _anchor.set(headPos.x - nx * setBack, headPos.y, headPos.z - nz * setBack);

  // Hips track the anchor laterally so big leans drag the torso along, and
  // follow it down on a duck — but NEVER below the platform top, so a low
  // lay-out smushes up against the slab rather than clipping through it.
  const hipY = Math.max(GROUND_Y, Math.min(BODY_IK.hipHeight, headPos.y - 0.5));
  _hips.set(padX * 0.4 + _anchor.x * 0.6, hipY, padZ * 0.4 + _anchor.z * 0.6);
  _chest.copy(_hips).lerp(_anchor, BODY_IK.chestAlong);
  _chest.y = Math.max(GROUND_Y + 0.12, _chest.y); // chest stays off the slab too

  // Orientation: lean the chest along the hips→anchor spine, yaw with the head.
  _spine.copy(_anchor).sub(_hips).normalize();
  _tilt.setFromUnitVectors(UP, _spine);
  _yaw.setFromAxisAngle(UP, Math.atan2(-_fwd.x, -_fwd.z));

  // The torso group sits at the world origin, so world coords ARE local here.
  rig.chest.position.copy(_chest);
  rig.chest.quaternion.copy(_tilt).multiply(_yaw);
  rig.pelvis.position.copy(_hips);
  rig.pelvis.quaternion.copy(_yaw);

  outChest.copy(_chest);
  outPelvis.copy(_hips);
}

/**
 * A static, posed bust of YOUR boxer for the lobby customization preview —
 * head over chest over pelvis with both gauntlets up in a guard. Built at the
 * given accent so the slider visibly drives the whole avatar's neon, not just
 * the gloves. Returns one group; scale/position/spin it as you like, and call
 * `setAvatarAccent` on it to recolour live.
 */
export function buildBoxerPreview(accent: number): Group {
  const rig = buildBoxer(0, 'cobalt');

  rig.pelvis.position.set(0, 0, 0);
  rig.chest.position.set(0, 0.4, 0);
  rig.head.position.set(0, 0.78, 0);
  rig.gloves[0].position.set(-0.26, 0.46, -0.14);
  rig.gloves[1].position.set(0.26, 0.46, -0.14);

  const preview = new Group();
  preview.name = 'avatar-preview';
  preview.add(...rig.all); // head, torso (chest+pelvis), both gloves
  setAvatarAccent(preview, accent);
  return preview;
}
