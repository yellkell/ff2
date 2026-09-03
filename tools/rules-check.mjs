#!/usr/bin/env node
/**
 * THE RULES, PROVED — firestore.rules against the emulator.
 *
 *   npm run check:rules
 *
 * The rules are the only thing standing between the boards and anyone with a
 * browser console. The client-side guards in net/boards.ts are courtesy — they
 * save a round trip — and a reviewer reading them can talk themselves into
 * believing the rules say the same thing. This file is what actually asks.
 *
 * It runs the real rules file inside the Firestore emulator and checks the
 * things that would matter if they were wrong:
 *
 *   - anonymous or not, you cannot write a row that isn't yours;
 *   - a score may only ever improve, and which direction "improve" means
 *     comes from the board's own name (`-time` boards rank low-to-high);
 *   - a room must carry the lease that lets it be swept, so a crashed host
 *     cannot leak one for ever;
 *   - a report can be filed and then never read back, by anyone;
 *   - the front page is read-only to every client;
 *   - a collection nobody wrote a rule for is closed.
 *
 * Everything is asserted from the CLIENT's side, under a uid, exactly as the
 * game meets it. Nothing here uses admin credentials except the fixture setup,
 * which is explicitly marked.
 */

import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const results = [];
const check = async (name, run) => {
  try {
    await run();
    results.push(true);
    console.log(`  PASS  ${name}`);
  } catch (err) {
    results.push(false);
    console.log(`  FAIL  ${name} — ${err.message?.split('\n')[0] ?? err}`);
  }
};

const env = await initializeTestEnvironment({
  projectId: 'ff2-rules-check',
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

const ME = 'uid-me';
const THEM = 'uid-them';
const me = env.authenticatedContext(ME).firestore();
const them = env.authenticatedContext(THEM).firestore();
const nobody = env.unauthenticatedContext().firestore();

const now = () => Date.now();

/* ── players ────────────────────────────────────────────────────────────── */

console.log('\n=== players: your profile is yours ===');

await check('I can create my own profile', () =>
  assertSucceeds(setDoc(doc(me, 'players', ME), { name: 'IRON', xp: 0, score: 0, at: now() })),
);

await check('I cannot write someone else\'s profile', () =>
  assertFails(setDoc(doc(them, 'players', ME), { name: 'IMPOSTOR', xp: 999, at: now() })),
);

await check('a signed-out visitor cannot write a profile', () =>
  assertFails(setDoc(doc(nobody, 'players', ME), { name: 'GHOST', at: now() })),
);

await check('anyone may READ a profile (boards show names)', () =>
  assertSucceeds(getDoc(doc(them, 'players', ME))),
);

await check('a partial update is allowed (writes are merges)', () =>
  assertSucceeds(updateDoc(doc(me, 'players', ME), { xp: 120, at: now() })),
);

await check('an out-of-range xp is refused', () =>
  assertFails(setDoc(doc(me, 'players', ME), { name: 'IRON', xp: -5, at: now() })),
);

await check('a profile cannot be deleted, even by its owner', () =>
  assertFails(deleteDoc(doc(me, 'players', ME))),
);

/* ── boards: the ratchet ────────────────────────────────────────────────── */

console.log('\n=== boards: one row each, and it may only improve ===');

const SCORE = 'boards/ff2-aim/rows';
const TIME = 'boards/ff2-raid-time/rows';

await check('I can post my own row on a score board', () =>
  assertSucceeds(setDoc(doc(me, SCORE, ME), { name: 'IRON', value: 1000, meta: {}, at: now() })),
);

await check('I cannot post a row under someone else\'s uid', () =>
  assertFails(setDoc(doc(them, SCORE, ME), { name: 'IMPOSTOR', value: 9_999_999, meta: {}, at: now() })),
);

await check('a HIGHER score replaces my row (score board)', () =>
  assertSucceeds(setDoc(doc(me, SCORE, ME), { name: 'IRON', value: 2000, meta: {}, at: now() })),
);

await check('a LOWER score is refused (score board)', () =>
  assertFails(setDoc(doc(me, SCORE, ME), { name: 'IRON', value: 500, meta: {}, at: now() })),
);

await check('an equal score is refused — it must actually beat it', () =>
  assertFails(setDoc(doc(me, SCORE, ME), { name: 'IRON', value: 2000, meta: {}, at: now() })),
);

await check('a score over the cap is refused', () =>
  assertFails(setDoc(doc(me, SCORE, ME), { name: 'IRON', value: 9_000_000, meta: {}, at: now() })),
);

await check('I can post my own row on a -time board', () =>
  assertSucceeds(setDoc(doc(me, TIME, ME), { name: 'IRON', value: 300, meta: {}, at: now() })),
);

await check('a FASTER time replaces my row (-time board ranks the other way)', () =>
  assertSucceeds(setDoc(doc(me, TIME, ME), { name: 'IRON', value: 240, meta: {}, at: now() })),
);

await check('a SLOWER time is refused (-time board)', () =>
  assertFails(setDoc(doc(me, TIME, ME), { name: 'IRON', value: 600, meta: {}, at: now() })),
);

await check('nobody can delete a board row, mine included', () =>
  assertFails(deleteDoc(doc(me, SCORE, ME))),
);

await check('anyone may READ a board', () => assertSucceeds(getDocs(collection(nobody, SCORE))));

/* ── rooms ──────────────────────────────────────────────────────────────── */

console.log('\n=== rooms: signed in, shaped right, and leased ===');

const room = (over = {}) => ({
  mode: 'duel',
  visibility: 'public',
  host: ME,
  open: true,
  at: now(),
  expiresAt: new Date(now() + 90_000),
  ...over,
});

await check('a signed-in player can open a room', () =>
  assertSucceeds(setDoc(doc(me, 'rooms', 'r1'), room())),
);

await check('a room WITHOUT expiresAt is refused — a leaked room is the outage', () =>
  assertFails(setDoc(doc(me, 'rooms', 'r2'), { mode: 'duel', visibility: 'public', host: ME, at: now() })),
);

// The type is the feature: a TTL policy ignores a numeric field entirely, so a
// room whose lease is a number is a room that can never be swept.
await check('a NUMERIC expiresAt is refused — a TTL policy would ignore it', () =>
  assertFails(setDoc(doc(me, 'rooms', 'r2b'), room({ expiresAt: Date.now() + 90_000 }))),
);

await check('an unknown mode is refused', () =>
  assertFails(setDoc(doc(me, 'rooms', 'r3'), room({ mode: 'chess' }))),
);

await check('someone else may join my room (seats are mutual writes)', () =>
  assertSucceeds(setDoc(doc(them, 'rooms', 'r1'), room({ open: false }))),
);

await check('a signed-out visitor cannot open a room', () =>
  assertFails(setDoc(doc(nobody, 'rooms', 'r4'), room())),
);

await check('a signed-out visitor cannot even read the room list', () =>
  assertFails(getDocs(collection(nobody, 'rooms'))),
);

await check('both peers can write the signalling handshake', () =>
  assertSucceeds(setDoc(doc(them, 'rooms/r1/sig', 'duel'), { offer: { sdp: 'x' } })),
);

/* ── presence ───────────────────────────────────────────────────────────── */

console.log('\n=== presence: your own record, and it expires ===');

await check('I can check in', () =>
  assertSucceeds(
    setDoc(doc(me, 'presence', ME), { name: 'IRON', where: 'club', look: '', at: now(), expiresAt: new Date(now() + 150_000) }),
  ),
);

await check('I cannot check someone else in', () =>
  assertFails(
    setDoc(doc(them, 'presence', ME), { name: 'IRON', where: 'club', at: now(), expiresAt: new Date(now() + 150_000) }),
  ),
);

await check('an unknown room is refused', () =>
  assertFails(
    setDoc(doc(me, 'presence', ME), { name: 'IRON', where: 'moon', at: now(), expiresAt: new Date(now() + 150_000) }),
  ),
);

await check('I can check myself out', () => assertSucceeds(deleteDoc(doc(me, 'presence', ME))));

// THE SWEEP. TTL needs a billing plan, so the clients do the housekeeping —
// which only works if anyone may bin a record that has already lapsed.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'presence', 'stale'), {
    name: 'GHOST', where: 'club', at: 1, expiresAt: new Date(Date.now() - 60_000),
  });
  await setDoc(doc(db, 'presence', 'live'), {
    name: 'HERE', where: 'club', at: now(), expiresAt: new Date(now() + 150_000),
  });
  // Written back when the lease was a number — no TTL policy could ever have
  // recognised it, so the sweep has to be able to.
  await setDoc(doc(db, 'presence', 'legacy'), {
    name: 'OLD', where: 'club', at: 1, expiresAt: Date.now() - 60_000,
  });
});

await check('anyone may sweep an EXPIRED record', () =>
  assertSucceeds(deleteDoc(doc(them, 'presence', 'stale'))),
);

await check('…and one whose lease is a leftover number', () =>
  assertSucceeds(deleteDoc(doc(them, 'presence', 'legacy'))),
);

await check('but NOT a live one belonging to somebody else', () =>
  assertFails(deleteDoc(doc(them, 'presence', 'live'))),
);

/* ── probes ─────────────────────────────────────────────────────────────── */

console.log('\n=== probes: the clock probe, and only your own ===');

await check('I can write my own clock probe', () =>
  assertSucceeds(setDoc(doc(me, 'probes', ME), { t: now() })),
);

await check('I cannot write someone else\'s probe', () =>
  assertFails(setDoc(doc(them, 'probes', ME), { t: now() })),
);

/* ── reports ────────────────────────────────────────────────────────────── */

console.log('\n=== reports: file and forget ===');

await check('I can file a report', () =>
  assertSucceeds(setDoc(doc(me, 'reports', 'rep1'), { text: 'someone is cheating', from: 'IRON', uid: ME })),
);

await check('I cannot file one under someone else\'s uid', () =>
  assertFails(setDoc(doc(me, 'reports', 'rep2'), { text: 'framed', from: 'IRON', uid: THEM })),
);

await check('an over-long report is refused', () =>
  assertFails(setDoc(doc(me, 'reports', 'rep3'), { text: 'x'.repeat(500), from: 'IRON', uid: ME })),
);

await check('NOBODY can read reports back, not even the filer', () =>
  assertFails(getDoc(doc(me, 'reports', 'rep1'))),
);

/* ── gazette ────────────────────────────────────────────────────────────── */

console.log('\n=== gazette: the front page is not yours to edit ===');

// Fixture only — the real paper is written by a service account, which the
// rules do not apply to. This is the one place admin credentials appear.
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'gazette', 'latest'), { edition: 1, headline: 'TIDE FALLS' });
});

await check('anyone may read the paper', () => assertSucceeds(getDoc(doc(nobody, 'gazette', 'latest'))));

await check('no client may write the paper', () =>
  assertFails(setDoc(doc(me, 'gazette', 'latest'), { edition: 99, headline: 'I WIN' })),
);

/* ── the default ────────────────────────────────────────────────────────── */

console.log('\n=== everything else is closed ===');

await check('an unruled collection cannot be written', () =>
  assertFails(setDoc(doc(me, 'whatever', 'x'), { a: 1 })),
);

await check('an unruled collection cannot be read', () =>
  assertFails(getDoc(doc(me, 'whatever', 'x'))),
);

await check('the retired run collections are closed', () =>
  assertFails(setDoc(doc(me, 'runGauntlet', 'x'), { seconds: 1 })),
);

await check('the retired lobby collections are closed', () =>
  assertFails(setDoc(doc(me, 'arcadeRooms', 'x'), { mode: 'raid' })),
);

await env.cleanup();

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILURE(S)` : `\nALL PASS (${results.length} checks)`);
process.exit(failed ? 1 : 0);
