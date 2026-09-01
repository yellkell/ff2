/**
 * THE GESTURE LANGUAGE — how a titan's BODY reads a grammar move
 * (DESIGN.md §4, second pass: "bespoke gestures per shape").
 *
 * The floor telegraph is the near tell; the titan's silhouette is the far
 * one. RAVE RAID's bosses sold every shape with a different gesture, and
 * the classic titan kinds already do (the slam's sky-high hoist, the
 * sweep's wide wind-out, the nova's two-fisted coil). The seven grammar
 * kinds arrived with no gesture at all — arms at rest while the deck lit
 * up — so this module gives each SHAPE a windup, a follow-through, and a
 * gaze, all pure functions of the charge so every client animates the
 * same pose from the same seed:
 *
 *   point    a lane: ONE arm levels down the strip, the other tucks
 *   x        THE X: both arms cross in front, a lattice of iron
 *   scissor  a rail: both arms flat out like wings, snapping across
 *   press    the gate: arms spread, then CLOSE toward the gap that lives
 *   ring     the donut: hands meet overhead, then slam down wide
 *   teach    THE ROUTINE: the king POINTS at each taught corner in turn
 *   march    the wave: the piston drumline — arms pump on the beat
 *   blade    the duckdonut's cut: the classic sweep's wind-out
 *
 * Every pose is a DELTA from the arm's rest pivot (restX/restZ): `x` is
 * the pivot's pitch (negative raises the arm forward/up — the slam hoists
 * at −2.5), `z` its yaw about the body, signed per arm by `out` (+1 swings
 * that arm away from the body, −1 across it). CampaignSystem eases the
 * pivots toward the returned targets, so a pose is a destination, never a
 * keyframe — and a cascade whose next read hasn't opened yet (fill 0)
 * simply eases the arms home between steps.
 */

import type { GrammarKind } from './grammar.js';

export type GestureShape = 'point' | 'x' | 'scissor' | 'press' | 'ring' | 'teach' | 'march' | 'blade';

/** Where the next landing sits, in the TARGET's local frame, as two signs:
 *  `side` lateral (+x is the player's right — the titan's LEFT arm, arm 0),
 *  `fwd` depth (+z is the player's side of the deck, away from the titan).
 *  Zero means "no preference" (a centre lane, the donut, a full-width row). */
export interface GestureFocus {
  side: number;
  fwd: number;
}

export interface ArmDelta {
  x: number;
  z: number;
}

export interface GesturePose {
  arms: [ArmDelta, ArmDelta];
  /** Root pitch toward the player (positive tips the face down/forward). */
  lean: number;
  /** Root lift in body units (the donut's up-on-the-toes). */
  rise: number;
  /** How hard the head turns from the player to the marked spot (0..1). */
  gaze: number;
}

/** Which arm a lateral sign asks for: arm 0 strikes the player's +x side
 *  (CampaignSystem's own arm choice), arm 1 the −x. Centre → arm 0. */
export function armFor(side: number): 0 | 1 {
  return side < 0 ? 1 : 0;
}

/** The outward yaw sign per arm — how animateTitan's sweep already reads
 *  it (arm 0 winds out toward −z, arm 1 toward +z). */
const OUT: readonly [number, number] = [-1, 1];

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (t: number): number => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};

/**
 * Map a grammar move's next pending zone onto its gesture shape. The kind
 * matters too: a lane inside the WAVE is one step of the march, not a
 * pointed strip, and a lane with a yaw is one arm of THE X.
 */
export function gestureShapeOf(
  kind: GrammarKind | string,
  zone: { kind: string; yaw?: number },
): GestureShape | null {
  switch (zone.kind) {
    case 'lane':
      if (kind === 'wave') return 'march';
      return zone.yaw ? 'x' : 'point';
    case 'rail':
      return kind === 'wave' ? 'march' : 'scissor';
    case 'gate':
      return 'press';
    case 'ring':
      return 'ring';
    case 'quad':
      return 'teach';
    case 'sweep':
      return 'blade';
    default:
      return null;
  }
}

/** The lateral/depth signs a zone asks the body to lean toward. */
export function gestureFocusOf(zone: {
  kind: string;
  x?: number;
  z?: number;
  at?: number;
  axis?: number;
  corner?: number;
  from?: number;
}): GestureFocus {
  switch (zone.kind) {
    case 'lane':
      return { side: Math.abs(zone.x ?? 0) < 0.12 ? 0 : Math.sign(zone.x ?? 0), fwd: 0 };
    case 'rail':
      return { side: 0, fwd: zone.from ?? Math.sign(zone.z ?? 0) };
    case 'gate':
      return zone.axis === 1
        ? { side: 0, fwd: Math.sign(zone.at ?? 0) }
        : { side: Math.sign(zone.at ?? 0), fwd: 0 };
    case 'quad':
      return { side: (zone.corner ?? 0) & 1 ? 1 : -1, fwd: (zone.corner ?? 0) & 2 ? 1 : -1 };
    default:
      return { side: 0, fwd: 0 };
  }
}

/** Per-chassis temperament: how big the gesture swings and how hard it
 *  snaps. The press is all servo; the king is all reach. */
export function gestureTemper(style: string): { amp: number; snap: number } {
  switch (style) {
    case 'piston':
      return { amp: 0.92, snap: 1.7 };
    case 'vulture':
      return { amp: 1.1, snap: 1.25 };
    case 'king':
      return { amp: 1.18, snap: 0.85 };
    case 'fortress':
      return { amp: 0.95, snap: 0.75 };
    default:
      return { amp: 1, snap: 1 };
  }
}

/**
 * The WINDUP pose for a shape at charge `fill` (0..1 across the read).
 * `beatPhase` is the titan's pulse in beats (time / beat) for the shapes
 * that step in time (the march); `focus` steers the pointing shapes.
 */
export function grammarGesture(
  shape: GestureShape,
  fill: number,
  focus: GestureFocus,
  beatPhase: number,
  amp = 1,
): GesturePose {
  const e = smooth(fill);
  const arms: [ArmDelta, ArmDelta] = [
    { x: 0, z: 0 },
    { x: 0, z: 0 },
  ];
  let lean = 0;
  let rise = 0;
  let gaze = 0;

  switch (shape) {
    case 'point': {
      // ONE arm levels down the strip — horizontal, swung in to aim along
      // the deck — the other tucks back; a centre lane points both.
      const lead = armFor(focus.side);
      for (const i of [0, 1] as const) {
        const pointing = focus.side === 0 || i === lead;
        if (pointing) {
          arms[i].x = -1.55 * e;
          arms[i].z = -OUT[i] * 0.35 * e;
        } else {
          arms[i].x = 0.3 * e;
          arms[i].z = OUT[i] * 0.15 * e;
        }
      }
      lean = 0.06 * e;
      gaze = 1;
      break;
    }
    case 'x': {
      // Both arms raised and swung ACROSS each other — the lattice made
      // of iron before it's made of light.
      for (const i of [0, 1] as const) {
        arms[i].x = -1.5 * e;
        arms[i].z = -OUT[i] * 1.1 * e;
      }
      lean = -0.04 * e;
      break;
    }
    case 'scissor': {
      // Wings: both arms flat out to the sides for most of the read, then
      // the last third snaps them forward across the body — the jaws. The
      // rail's own side leads a touch higher.
      const close = smooth((fill - 0.66) / 0.34);
      for (const i of [0, 1] as const) {
        const lead = (i === 0 ? 1 : -1) === focus.fwd ? 0.25 : 0;
        // Higher than the press's level spread — wings, not a shelf.
        arms[i].x = -(1.95 + lead) * e + 0.6 * close;
        arms[i].z = OUT[i] * 1.3 * e - OUT[i] * 2.2 * close;
      }
      lean = 0.03 * e;
      gaze = 0.4;
      break;
    }
    case 'press': {
      // The gate: arms spread wide and level, then CLOSE toward the gap —
      // everything the hands sweep through burns; the band between them
      // lives. A row gate presses forward/back instead of sideways.
      const spread = smooth(fill / 0.55);
      const close = smooth((fill - 0.55) / 0.45);
      for (const i of [0, 1] as const) {
        if (focus.fwd !== 0) {
          arms[i].x = -1.3 * spread + (focus.fwd > 0 ? -0.5 : 0.9) * close;
          arms[i].z = OUT[i] * 0.9 * spread - OUT[i] * 0.7 * close;
        } else {
          // The hands come in from both sides and STOP either side of the
          // gap — shifted toward its side so the body points at the answer.
          arms[i].x = -1.35 * spread - 0.1 * close;
          arms[i].z = OUT[i] * 1.25 * spread - OUT[i] * 1.0 * close + focus.side * 0.45 * close;
        }
      }
      lean = (focus.fwd > 0 ? 0.08 : focus.fwd < 0 ? -0.05 : 0.04) * e;
      gaze = 0.7;
      break;
    }
    case 'ring': {
      // Both hands meet OVERHEAD — the body goes up on its toes — the rim
      // is what comes down when they part.
      for (const i of [0, 1] as const) {
        arms[i].x = -2.7 * e;
        arms[i].z = -OUT[i] * 0.55 * e;
      }
      rise = 0.08 * e;
      lean = -0.05 * e;
      break;
    }
    case 'teach': {
      // THE ROUTINE: the king POINTS at the taught corner — one arm level,
      // swung to the corner's side, dipped for a corner near his feet,
      // raised for one at the player's end — and his head follows it.
      const lead = armFor(focus.side);
      for (const i of [0, 1] as const) {
        if (i === lead) {
          arms[i].x = (focus.fwd > 0 ? -1.4 : -0.95) * e;
          arms[i].z = (focus.fwd > 0 ? 0.55 : 0.2) * e * OUT[i];
        } else {
          arms[i].x = 0.35 * e;
          arms[i].z = OUT[i] * 0.25 * e;
        }
      }
      lean = 0.05 * e;
      gaze = 1;
      break;
    }
    case 'march': {
      // The drumline: arms pump in alternation on the beat, the whole
      // machine bobbing with them — the wave is a march before it's a fire.
      const ph = beatPhase % 2;
      const upA = smooth(Math.sin(ph * Math.PI) * 0.5 + 0.5);
      const pump = 0.35 + 0.65 * e;
      arms[0].x = (-1.6 * upA + 0.5 * (1 - upA)) * pump;
      arms[1].x = (-1.6 * (1 - upA) + 0.5 * upA) * pump;
      arms[0].z = OUT[0] * 0.2 * pump;
      arms[1].z = OUT[1] * 0.2 * pump;
      rise = Math.abs(Math.sin(ph * Math.PI)) * 0.03 * pump;
      lean = 0.05 * e;
      break;
    }
    case 'blade': {
      // The classic sweep's wind-out, on the arm the cut comes from.
      const lead = armFor(focus.side);
      arms[lead].z = OUT[lead] * 1.7 * e;
      arms[lead].x = -0.4 * e;
      break;
    }
  }

  for (const a of arms) {
    a.x *= amp;
    a.z *= amp;
  }
  return { arms, lean: lean * amp, rise, gaze };
}

/**
 * The FOLLOW-THROUGH after a landing fires — `k` runs 1 (the strike) → 0
 * (home) over the swing window. The gesture's promise is kept here: the
 * point JABS, the jaws CROSS, the press CLAPS, the ring SLAMS DOWN wide,
 * the teacher FLICKS, the drum PUMPS.
 */
export function grammarFollowThrough(shape: GestureShape, k: number, arm: 0 | 1, focus: GestureFocus): [ArmDelta, ArmDelta] {
  const arms: [ArmDelta, ArmDelta] = [
    { x: 0, z: 0 },
    { x: 0, z: 0 },
  ];
  switch (shape) {
    case 'point': {
      const lead = focus.side === 0 ? arm : armFor(focus.side);
      arms[lead].x = -1.9 * k;
      arms[lead].z = -OUT[lead] * 0.5 * k;
      break;
    }
    case 'x':
    case 'scissor':
      for (const i of [0, 1] as const) {
        arms[i].x = -1.2 * k;
        arms[i].z = -OUT[i] * 1.3 * k;
      }
      break;
    case 'press':
      for (const i of [0, 1] as const) {
        arms[i].x = -1.3 * k;
        arms[i].z = -OUT[i] * 0.55 * k + focus.side * 0.3 * k;
      }
      break;
    case 'ring':
      for (const i of [0, 1] as const) {
        arms[i].x = 0.9 * k;
        arms[i].z = OUT[i] * 1.4 * k;
      }
      break;
    case 'teach': {
      const lead = armFor(focus.side);
      arms[lead].x = -0.6 * k;
      arms[lead].z = OUT[lead] * 0.3 * k;
      break;
    }
    case 'march':
      arms[arm].x = 0.9 * k;
      break;
    case 'blade':
      // Swung hard across the body (the classic sweep's own follow-through).
      arms[arm].z = -OUT[arm] * 1.4 * k;
      arms[arm].x = 0.3 * k;
      break;
  }
  return arms;
}
