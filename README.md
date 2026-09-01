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
- **THE BLANK** — the mannequin (DESIGN.md §5, phase 3 v3):
  `src/avatar/mannequin.ts`, the ONLY body — one smooth lofted surface
  per piece (no crossing parts, no seams, monotonic taper below the
  hips), starting ALL WHITE or ALL BLACK ('blank'/'onyx', picked on the
  locker's COLOUR tab, synced over the skin wire). Honest to the
  hitboxes, immune to every recolour; the rest of your colour is paint.
  THE PODIUM shows your dressed blank beside the YOU wing.
  Preview: `/skin-preview.html?skins=blank,onyx`.
- **THE MOVE GRAMMAR** (DESIGN.md §4, first pass) — the five titans
  learned RAVE RAID's dance: gates, crossfire rails + THE TRAP, THE X,
  the donut's one-two, marching waves that always turn, and GOLIATH's
  ROUTINE (taught corners, then falling blocks). Ported with the laws
  that make it readable — never the same move twice, body-verbs damped,
  THE FLOOR MANAGER — fully seeded for the raid wire, act-gated so easy
  bouts stay honest. Probe: `npm run check:grammar` (add `--shots`).
- **THE STAGE DECK** — the diamond-plate pedestals retired: fighting
  platforms are now the club stage's realistic waxed-oak planking (boards
  running at your foe, brass corner screws, the team-neon tube as edge
  lighting). Skins stain the boards instead of tinting steel.
  Preview: `/deck-preview.html?shape=gate|donut|x|routine`.
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
