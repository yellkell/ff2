#!/usr/bin/env node
/**
 * THE REFLECTION, and where it is allowed to be.
 *
 *   node tools/mirror-check.mjs
 *
 * VOIDSTEP's decks hang a two-step KEEL under their face, and the circuit
 * draws its reflection by flipping the live instance buffers about the
 * floor (course/banks.ts mirrorBank). A flip is only honest for geometry
 * that stands ENTIRELY ABOVE the mirror plane — and a deck resting at
 * ground level does not: its keel is below the floor, so the flip folded
 * that keel back UP through the deck and every grounded platform wore a
 * stack of blocks on its face, covering the etch and the scan line.
 *
 * The fix is a world-space clipping plane on each mirror material, keeping
 * only what is genuinely under the glass. This checks the arithmetic that
 * makes the fix necessary and the wiring that makes it work, reading both
 * from the source so neither can drift away from the other:
 *
 *   1. the keel really does reach below the floor on a grounded deck
 *      (i.e. the bug was real, and would come back if the plane went);
 *   2. every mirrored bank carries a clipping plane;
 *   3. the renderer is told to respect object-level clipping, which is off
 *      by default and silently makes the planes do nothing;
 *   4. the plane keeps a deck reflected from HEIGHT and rejects the keel
 *      reflected from the GROUND — the two cases in one test.
 */

import { readFileSync } from 'node:fs';

const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const platform = read('src/rave/systems/CoursePlatformSystem.ts');
const banks = read('src/rave/course/banks.ts');
const voidSys = read('src/rave/systems/CourseVoidSystem.ts');

console.log('=== the floor, and what hangs under it ===');

const floorY = Number(/export const FLOOR_Y = (-?[\d.]+)/.exec(voidSys)?.[1]);
const keelUpper = Number(/const KEEL_UPPER = \{[^}]*y: (-?[\d.]+)/.exec(platform)?.[1]);
const keelLower = Number(/const KEEL_LOWER = \{[^}]*y: (-?[\d.]+)/.exec(platform)?.[1]);
check('the floor and both keel steps are readable', Number.isFinite(floorY) && Number.isFinite(keelUpper) && Number.isFinite(keelLower), `floor ${floorY}, keel ${keelUpper} / ${keelLower}`);
check('the keel hangs BELOW the deck it belongs to', keelUpper < 0 && keelLower < keelUpper, `${keelUpper} then ${keelLower}`);

/* A deck resting on the ground sits at y = 0; one in flight is up at 1.5.
   The mirror maps y to 2*floorY − y. */
const mirror = (y) => 2 * floorY - y;
const groundedKeel = mirror(0 + keelLower);
const flyingKeel = mirror(1.5 + keelLower);
check('a GROUNDED deck reflects its keel above the floor — the bug', groundedKeel > floorY, `keel at ${(0 + keelLower).toFixed(3)} reflects to ${groundedKeel.toFixed(3)}, floor ${floorY}`);
check('a FLYING deck reflects its keel below the floor — always was fine', flyingKeel < floorY, `reflects to ${flyingKeel.toFixed(3)}`);

console.log('\n=== the plane that fixes it ===');

check('the mirrored banks carry a clipping plane', /clippingPlanes = \[new Plane\(new Vector3\(0, -1, 0\), floorY\)\]/.test(banks), 'course/banks.ts mirrorBank');
check("the venue's mirror carries the same one", /clippingPlanes = \[new Plane\(new Vector3\(0, -1, 0\), floorY\)\]/.test(read('src/rave/arena/voidkit.ts')), 'arena/voidkit.ts mirrorOf');
check('the circuit turns local clipping ON (off by default, or the planes do nothing)', /this\.renderer\.localClippingEnabled = true/.test(platform), 'CoursePlatformSystem.init');

/* three.js keeps a fragment where normal·p + constant > 0. With a normal of
   -Y and constant floorY that is  -y + floorY > 0,  i.e.  y < floorY. */
const kept = (y) => -y + floorY > 0;
check('the plane REJECTS the grounded deck\'s folded-up keel', !kept(groundedKeel), `y ${groundedKeel.toFixed(3)} vs floor ${floorY}`);
check("the plane KEEPS a flying deck's reflection", kept(flyingKeel), `y ${flyingKeel.toFixed(3)}`);
check('the plane keeps the reflection of the grounded deck FACE itself', kept(mirror(0) - 0.001), `face reflects to ${mirror(0).toFixed(3)}`);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
