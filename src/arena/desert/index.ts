/**
 * Assembles the whole papercraft desert (ported from yellkell/vrenv) under ONE
 * Group so FIRE FIGHT can show/hide it as a single unit — the optional arena
 * backdrop behind the platforms. Unlike the standalone project, the sky and
 * lighting live in this group too (a gradient sky dome instead of the global
 * DomeGradient/IBLGradient components), so toggling the group's visibility
 * flips between the desert and bare AR passthrough cleanly.
 *
 * The opaque sky dome is what hides passthrough: in immersive-AR, opaque
 * geometry replaces the camera feed, so an enclosing dome reads as full VR.
 */

import {
  AmbientLight,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  Object3D,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { CONFIG } from './config.js';
import { makePaperDouble, makeRng } from './paper.js';
import { buildTerrain } from './terrain.js';
import { buildBoulders, buildMesas } from './rocks.js';
import { buildCacti } from './cactus.js';
import { buildAgave } from './agave.js';
import { animateClouds, buildClouds, type CloudDrift } from './clouds.js';
import { animateVultures, buildVultures } from './birds.js';
import { DustField } from './dustdevil.js';
import { buildProps } from './props.js';
import { animateTumbleweeds, buildTumbleweeds, type Tumbleweed } from './tumbleweed.js';

/** A plant that leans back and forth in the wind about its base. */
export interface Swayer {
  obj: Object3D;
  phase: number;
  amp: number;
  speed: number;
}

export interface Desert {
  /** Everything: terrain, sky, sun, props. Toggle `.visible` to show/hide. */
  root: Group;
  /** Advance the living parts — sway, clouds, tumbleweeds, dust devils. */
  update(delta: number, time: number): void;
}

/** A big inward-facing gradient sky sphere — top → horizon → sandy ground. */
function makeSkyDome(): Mesh {
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new Color(CONFIG.sky.top) },
      horizon: { value: new Color(CONFIG.sky.horizon) },
      bottom: { value: new Color(CONFIG.sky.bottom) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top, horizon, bottom;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 c = h > 0.0
          ? mix(horizon, top, smoothstep(0.0, 0.45, h))
          : mix(horizon, bottom, smoothstep(0.0, -0.35, h));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const dome = new Mesh(new SphereGeometry(800, 32, 16), mat);
  dome.renderOrder = -1; // paint the sky first, everything draws over it
  dome.frustumCulled = false;
  return dome;
}

/** Early stars over the dying light: none in the orange band, thickening
 *  toward the zenith, each with its own brightness — one Points draw. */
function makeStars(): Points {
  const { count, minElevation, radius } = CONFIG.stars;
  const rng = makeRng(CONFIG.terrain.seed * 7 + 1);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Bias the density upward: elevation from a squared roll.
    const elev = minElevation + (1 - minElevation) * Math.sqrt(rng());
    const phi = Math.asin(elev);
    const theta = rng() * Math.PI * 2;
    pos[i * 3] = Math.cos(phi) * Math.cos(theta) * radius;
    pos[i * 3 + 1] = Math.sin(phi) * radius;
    pos[i * 3 + 2] = Math.cos(phi) * Math.sin(theta) * radius;
    // Cool white with the odd warm one, fading toward the horizon band.
    const b = (0.35 + 0.65 * rng()) * Math.min(1, (elev - minElevation) * 6 + 0.25);
    const warm = rng() < 0.12;
    col[i * 3] = b * (warm ? 1 : 0.82);
    col[i * 3 + 1] = b * (warm ? 0.85 : 0.86);
    col[i * 3 + 2] = b * (warm ? 0.7 : 1);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size: 2.4,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const stars = new Points(geo, mat);
  stars.frustumCulled = false;
  return stars;
}

export function buildDesert(): Desert {
  const root = new Group();
  root.name = 'desert-environment';
  root.visible = false;

  root.add(makeSkyDome());
  root.add(makeStars());

  // A low warm sun — ambiguous sunrise/sunset, with long readable shadows.
  const e = CONFIG.mood.sunElevation * (Math.PI / 2);
  const sunDir = new Vector3(0.35 * Math.cos(e), Math.sin(e), -0.94 * Math.cos(e)).normalize();

  // The dying sun: deeper, lower, still the longest shadows in the game.
  const sun = new DirectionalLight(new Color('#ff8d4e'), 1.5);
  sun.position.copy(sunDir).multiplyScalar(55);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0004;
  const cam = sun.shadow.camera;
  cam.near = 8;
  cam.far = 140;
  cam.left = cam.bottom = -42;
  cam.right = cam.top = 42;
  cam.updateProjectionMatrix();
  root.add(sun);
  root.add(sun.target); // target sits at the origin → sun points at the platforms

  root.add(new AmbientLight(new Color('#332c4a'), 0.3)); // night creeping in
  root.add(new HemisphereLight(new Color(CONFIG.ibl.sky), new Color(CONFIG.ibl.ground), 0.55));

  // The dying sun on the horizon, swollen the way a sunset sun reads,
  // with a wide ember halo bleeding into the haze behind it.
  const halo = new Mesh(new CircleGeometry(52, 36), makePaperDouble('#e86a34', 0.5));
  halo.position.copy(sunDir).multiplyScalar(602);
  halo.lookAt(0, halo.position.y, 0);
  root.add(halo);
  const disc = new Mesh(new CircleGeometry(30, 32), makePaperDouble(CONFIG.palette.sun, 1.25));
  disc.position.copy(sunDir).multiplyScalar(600);
  disc.lookAt(0, disc.position.y, 0);
  root.add(disc);

  // The world itself.
  buildTerrain(root);
  buildMesas(root);
  buildBoulders(root);
  const swayers: Swayer[] = [...buildCacti(root), ...buildAgave(root)];
  buildProps(root);
  const weeds: Tumbleweed[] = buildTumbleweeds(root);
  const clouds: CloudDrift[] = buildClouds(root);
  const vultures = buildVultures(root);
  const dust = new DustField(root);

  return {
    root,
    update: (delta, time) => {
      for (const s of swayers) s.obj.rotation.z = Math.sin(time * s.speed + s.phase) * s.amp;
      animateClouds(clouds, delta);
      animateTumbleweeds(weeds, delta, time);
      animateVultures(vultures, time);
      dust.update(delta, time);
    },
  };
}
