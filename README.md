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
  live: RAVE RAID's panel kit ported to `src/ui/kit/` in FF2's amber, three
  kit panels on an arc replacing the legacy BATTLE / ARCADE / house plates
  (`src/menu/wrap.ts`), every existing flow intact. Headless probe:
  `npm run dev` then `npm run check:wrap` (add `--shots` for panel PNGs).
- **THE BLANK** — the mannequin (DESIGN.md §5, phase 3 v3):
  `src/avatar/mannequin.ts`, the ONLY body — one smooth lofted surface
  per piece (no crossing parts, no seams, monotonic taper below the
  hips), starting ALL WHITE or ALL BLACK ('blank'/'onyx', picked on the
  locker's COLOUR tab, synced over the skin wire). Honest to the
  hitboxes, immune to every recolour; the rest of your colour is paint.
  THE PODIUM shows your dressed blank beside the YOU wing.
  Preview: `/skin-preview.html?skins=blank,onyx`.

## Run it

```bash
npm install
npm run dev        # client on https://localhost:5173 (desktop WebXR emulator included)
npm run server     # optional: the 1v1 relay on :8787
npm run server:pub # optional: the club room server on :8788
```

On a Quest, open the dev URL in the headset browser. On desktop, the IWSDK
dev plugin provides a WebXR emulator (WASD + mouse).

> Note: the Firebase Hosting deploy workflow is parked on manual dispatch —
> it still points at FF1's live project. FF2 needs its own Firebase project
> before automatic deploys switch on.
