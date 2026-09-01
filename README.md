# FIRE FIGHT 2 🔥🥊⚡

The sequel to [FIRE FIGHT](https://github.com/yellkell/iron-balls-boxing),
with [RAVE RAID](https://github.com/yellkell/dance) folded in as a mode.
One town: fireball boxing, titan raids and rave sets launched from one
shared club, by one fighter you paint over months.

**Read [`DESIGN.md`](DESIGN.md)** — the full sequel design and build order:
the wrap-around three-panel menu, the club-as-launcher (THE BELL), the pit
and the crowd that can't be heard, the new campaign wearing RAVE RAID's
move grammar, the blank mannequin + stripe-paint customization, the
beautiful dark desert, link/Discord match joins, and the web leaderboard.

## What's here now

This repo is seeded with the complete FIRE FIGHT 1 engine — it builds and
plays exactly as FF1 did, and gets rebuilt into FF2 phase by phase
(DESIGN.md §10). [`FOUNDATION.md`](FOUNDATION.md) is FF1's own README,
carried over verbatim: everything in it still applies to this code.

- `public/stats.html` — the web leaderboard: FIRE FIGHT boards first,
  RAVE RAID as a separate-but-equal tab. Standalone, read-only, no SDK.
- **THE WRAP** — the wrap-around three-panel lobby (DESIGN.md §2, phase 2),
  live and SIMPLIFIED to the few-doors law: the center slab's root is just
  FIGHT / ARCADE / THE CLUB, everything else a sub-option behind its door
  (battle flows, arcade modes, the club's region pick — all on the slab,
  one BACK away; ONLY BOTS and SHOOT BACK demoted into their doors). THE
  TOWN (left) is a buttonless live-status board; YOU (right) is the body,
  the shop and the wallet. Headless probe: `npm run dev` then
  `npm run check:wrap` (add `--shots` for panel PNGs).
- **THE BLANK** — the mannequin (DESIGN.md §5): `src/avatar/mannequin.ts`,
  the ONLY body. TWO pieces and no more — ONE continuous lofted surface
  from the neck through shoulders, waist and hips to a monotonic taper,
  and a bare egg of a HEAD that floats free above it. (Chest and pelvis
  used to be separate lofts the IK moved apart, so the waist visibly
  opened as you leaned; the neck used to ride on the head and swung
  through the shoulders on every look-behind. Both joints are gone
  because there are no longer joints there.) Starts ALL WHITE or ALL
  BLACK ('blank'/'onyx', picked on the locker's COLOUR tab, synced over
  the skin wire). Honest to the hitboxes, immune to every recolour; the
  rest of your colour is paint. Preview:
  `/skin-preview.html?skins=blank,onyx`.
- **THE MOVE GRAMMAR** (DESIGN.md §4, first pass) — the five titans
  learned RAVE RAID's dance: gates, crossfire rails + THE TRAP, THE X,
  the donut's one-two, marching waves that always turn, and GOLIATH's
  ROUTINE (taught corners, then falling blocks). Ported with the laws
  that make it readable — never the same move twice, body-verbs damped,
  THE FLOOR MANAGER — fully seeded for the raid wire, act-gated so easy
  bouts stay honest. And every shape has its GESTURE now
  (`src/campaign/gestures.ts`): the lane's point, THE X's crossed arms,
  the rail's scissor, the gate's press, the donut's overhead ring, the
  routine's teaching finger, the wave's piston march — windup, gaze,
  follow-through, per chassis. Probe: `npm run check:grammar` (add
  `--shots`; it also asserts seven distinct silhouettes).
- **THE SITES** — one desert, three places (DESIGN.md §6.1): the lobby
  waits at THE TRAILHEAD (the GASKET sign under its lamp, a campfire, a
  windmill on the sun band), matches box on THE FLATS (the skull, two dead
  trees), and every campaign fight and raid stands in THE BONEYARD (a ring
  of wreck-plates and burning drums round the pit, RUSTHOOK's hook buried
  to the shank). The far layer turns with the site so the skyline moves
  too. With it, Desert 2.0's second pass — and the END of papercraft:
  `src/arena/desert/textures.ts` is a kit of six procedural skins (sand,
  rock, rust, bark, wood, bone; colour + bump from one seeded noise) worn
  by rippled dunes, smooth wind-carved mesas and boulders, bevelled iron,
  a real skull; clouds are soft sprites, the sky band lives on ONE horizon
  and cools to mauve behind you, a heat-haze swims at the ground line and
  dust hangs in the arena light. No litter: nothing on the sand that
  reads as debris.
  Preview: `/env-preview.html?env=desert&site=trailhead|flats|boneyard`;
  probe: `npm run check:desert` (add `--shots`).
- **THE STAGE DECK** — the diamond-plate pedestals retired: fighting
  platforms are now the club stage's realistic waxed-oak planking (boards
  running at your foe, brass corner screws, the team-neon tube as edge
  lighting). Skins stain the boards instead of tinting steel.
  Preview: `/deck-preview.html?shape=gate|donut|x|routine`.
- **THE GASKET GAZETTE'S VOICE** — Sheriff Cole Ironside has a bible now
  ([`docs/gazette-voice.md`](docs/gazette-voice.md)): who he is (a tin-star
  who despises the Clankers and is one), how he sounds, what he never does
  (never names who fell, never breaks the fourth wall, never resolves the
  denial), his dictionary from the game's words to Gasket's, and the shape
  of an edition — headline, subhead, body, mood, plus a WANTED poster for
  the top climber, the Sheriff's NOTICE and the WEATHER (it is always
  dusk), all laid out on the lobby's front page. The daily command lives in
  this repo (`.claude/commands/daily-gazette.md`); the wire report now
  names each fighter's gear and deck beside their paint.
- **GEAR** — the attachments shop (DESIGN.md §5.2): fifteen shapes that
  bolt onto THE BLANK in its own primer — crests, antennae, horns, halos,
  mohawks and visor bands for the head; pauldrons, a chestplate, a collar,
  a dorsal ridge, a belt and epaulettes for the body; cuffs, knuckle spikes
  and gauntlets for the hands. One per slot, purely visual (the hitboxes
  never move), tried on in the STORE's GEAR tab, worn from the LOCKER, and
  seen by everyone: the worn set rides the duel, the squad mesh, the club
  hello and your player doc, re-validated on arrival. `src/avatar/gear.ts`.
- **THE PAINT** ([`docs/paint.md`](docs/paint.md), P1–P4 shipped) — buy
  stripes and splotches by colour, place them minutely on your own body in
  THE PAINT BAY (YOU wing), and the room sees the result: your look packs
  to ~8 bytes a unit and rides the duel `iam`, the squad mesh and the club
  hello, baked once on join wherever your body renders. HIDE PAINT
  (settings, or per-punter on the club console) and REPORT PAINT are the
  moderation backstops. THE RECORD: the look mirrors to your player doc,
  the leaderboard PROFILE card renders the painting behind your name,
  stats.html rows wear your colours as chips, and the Gasket Gazette's
  wire report names a champion's paint. Headless probes:
  `npm run check:paint` (wire + record + two-client room), plus the bay
  verbs under `window.__ff2.paint`.

## Run it

```bash
npm install
npm run dev        # client on https://localhost:5173 (desktop WebXR emulator included)
npm run server     # optional: the 1v1 relay on :8787
npm run server:pub # optional: the club room server on :8788
```

On a Quest, open the dev URL in the headset browser. On desktop, the IWSDK
dev plugin provides a WebXR emulator (WASD + mouse).

## Deploying

The live site is **GitHub Pages, published by GitHub Actions**
(`.github/workflows/deploy.yml` → https://yellkell.github.io/ff2/). A push
builds `dist/` and uploads it; no Firebase involved.

Pages serves the game from a **subpath** (`/ff2/`), not a domain root, so
every reference to a file in `public/` must be written **relatively**
(`signs/fire-fight.png`, never `/signs/fire-fight.png`). Vite rewrites
references inside its HTML inputs, but *not* string literals in TypeScript
and *not* files copied verbatim out of `public/` — both have already
shipped this bug once. `npm run build && npm run check:pages` serves the
build under `/ff2/` in a real browser and fails on any 404; the deploy
workflow runs a fast static version of the same guard.

> Firebase is still used for **Firestore** (leaderboards, matchmaking, the
> gazette) — only hosting moved. `firebase-deploy.yml` remains parked on
> manual dispatch and still points at FIRE FIGHT 1's project, so it must
> not be run from this repo.
