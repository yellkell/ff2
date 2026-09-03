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

- `public/stats.html` — **THE WORLDWIDE LEADERBOARD**, rebuilt on RAVE
  RAID's stats-page surface language (near-black glass, corner brackets,
  the rail with its eased marker, Rajdhani) with FIRE FIGHT's hazard amber
  as the accent. Three faces on one rail, each swapping the accent and the
  pools on the floor:
  - **FIRE FIGHT** — RANKED · XP · AIM · 2V2 · FFA read off `players`
    docs; **SPEEDRUN** (what GAUNTLET is called now) · RAID · GOOPLIATH
    read off `boards/{board}/rows`. SPEEDRUN carries a difficulty
    sub-rail — NORMAL · HARD · BLAZING — because it is three boards, one
    per tier (`src/net/boards.ts` `speedrunBoard()`): a board is a
    ratchet keyed on your uid, so a single board would let your blazing
    run and your normal run fight over one row. The lobby's own board
    merges the three back into one ranked list wearing difficulty symbols.
  - **THE LAB**, a board of that same rail rather than a tab of its own.
    Every bout that lasts keeps a TAPE (`src/net/telemetry.ts`, posted to
    the `bouts` collection at the final bell): platform HEATMAPS of where
    you stand, where each hand throws from and where you were when hit;
    the play-by-play of every throw, hit taken, hit dealt, parry and round
    as timed events; the rounds with both health pools at the bell. The
    page aggregates the last two hundred, filtered by boxer, into stat
    tiles, the four heatmaps, a hands panel, a damage panel, and the tape
    itself — open one for its rounds, both health lines rebuilt from the
    hits, and the play-by-play.
  - **THE CHANNEL** — television. The headset RUNNING a bout (a bot
    bout's one player, a duel's host, the mesh authority, the raid host)
    casts a top-down frame five times a second to THE ROOM SERVER's `/tv`
    relay (`server/tv.mjs`; `systems/BroadcastSystem.ts` and
    `net/tvCast.ts` on the headset), and the page draws it: every
    platform, head, hands and health, the balls in the air, the round
    clock, the titan. Nothing on air and it peeps into THE CLUB — the
    rave relay's public floor, who is dancing where, the ball if one
    hangs. Club dark too and it says so. `?tv=ws://…` points the page at
    another relay.

  It reads the SAME project the game writes to (`flappy-ff9f6`, behind
  ff2.web.app) over the plain Firestore REST API — no SDK, read-only, and
  boards are read one at a time rather than as a collection group, which
  is what the rules allow. Probe: `npm run check:tv` (needs `npm run dev`).
- **THE JOIN LINK + THE BOT'S WRITE PATH** (DESIGN.md §8, phase 10, first
  pass) — every hosted room mints `?join=CODE`: a five-digit arena code
  booted with it walks the lobby into whatever the host opened (the keypad
  types itself; a four-digit club code hops to `rave.html?room=`). The
  squad room's invite band shows the code, the link, a QR a phone reads
  off the screen mirror (`src/ui/qr.ts`, byte mode, level M, verified
  against a third-party decoder) and, for the host, SHARE ON DISCORD. The
  Discord bot that has polled the bar-TV channel for years now POSTS
  (`server/discord.mjs`, one paced queue): THE BELL in the club posts the
  game and its join link when the ball goes up; SHARE posts a room card
  through `/tv/invite`; THE CHANNEL posts LIVE once a match has held eight
  seconds, and the final when it ends (bot bouts never make the paper).
  `DISCORD_BOT_TOKEN` arms it, `PUBLIC_URL` sets the links, and
  `DISCORD_BELL=off` quiets the bell.
- **THE HORNS** re-cut: the gear shop's HORNS are a ram's pair now — one
  tapered tube per side along a spline, rooted thick on the temple, up and
  back over the ear, down behind the jaw and forward to a point level with
  the eye, flat-shaded like the rest of the kit. You never see your own:
  `applyGear` skips the head slot on a rig flagged first-person, and the
  arena never draws the local head anyway.
- **THE WRAP** — the wrap-around three-panel lobby (DESIGN.md §2, phase 2),
  now TABBED (MENUS 2, the Overwatch / Fortnite grammar): every panel wears
  a strip of horizontal tabs across its top. The center slab is FIGHT ·
  ARCADE · CLUB (the battle flows drill in and BACK out inside FIGHT; the
  club's region pick is the CLUB tab; ONLY BOTS and SHOOT BACK stay demoted
  inside their tabs). THE TOWN (left) is TOWN · LADDER · NEWS — the
  leaderboard came in off the back wall and the Gasket Gazette is a tab,
  not a modal. YOU (right) is YOU · SETTINGS — the gear disc became a tab.
  Above the right wing, THE PROFILE pop-out replaced the floating coin
  readout: a chip with your name, rank and bolt-dollars that drops your
  card out over the wing — the painting, honours, achievements, your
  note, and RENAME (the only place a callsign changes now). Headless
  probe: `npm run dev` then `npm run check:wrap` (add `--shots` for
  face PNGs).
- **RAVE RAID, INSIDE** (DESIGN.md §7, phase 7) — the rhythm game is a
  third page of this app: `rave.html` boots `src/rave/` (the dance repo's
  source, file identities intact: the set, THE VOID, the decks and the 26
  masters, the tour, the club, the relay client) — reached from the
  ARCADE tab's RAVE RAID button, and its rail's FIRE FIGHT entry hops
  back. ONE TOWN: the dancer's name is the arena's callsign and their
  colour the arena's accent (`src/rave/game/profile.ts` reads FIRE
  FIGHT's keys first and writes them back on a rename); every finished
  record pays bolt-dollars into the one wallet (`config.songCoins`,
  named on the grade card); and every figure on the ring — the groupies,
  the giant MC, your reflection in the club's pier glass — wears THE
  BLANK (`src/rave/game/blankDancer.ts`: the arena's rig, IK, gear and
  paint bakes, with glowsticks). Relay: `npm run server:rave`. Headless
  probe: `npm run check:rave` (add `--shots`).
- **WHO HEARS WHOM** (DESIGN.md §3.2, phase 6) — `src/net/voiceRules.ts`
  is the one table every voice path reads: RANKED is silence (no mic, no
  ears), quick/private bouts hear their fighters, brawls every fighter,
  the raid its squad, the club the room, an audience everyone (fighters
  never hear a watcher's words). THE CROWD: a synthesised bed under every
  bout (`src/audio/crowd.ts` — distant murmur, a rumble that swells with
  the landings, roar stings on hits, cores, rounds and the win) with the
  HANDS-UP channel: both hands over the head swell the roar. THE
  AUDIENCE travels — a WATCH chip on any lobby row takes a watcher seat
  past the fighters' band in the same room (`config.AUDIENCE_SEATS`), and
  when the room launches you are dealt to the match's own place with the
  squad: onto the standing terraces (`src/arena/desert/audience.ts`) on
  the flanks of the flats and the boneyard, outside the cage line, rails
  capped hazard amber. A watcher sees every fighter where the arena
  actually put them, throws nothing and judges nothing, and every other
  watcher stands at the rail beside them
  (`systems/AudienceSystem.ts`). Their hands ride the mesh and each
  headset aggregates the same room-wide roar; their WORDS never reach a
  fighter, only the crowd. Probed in `npm run check:wrap`'s terrace
  section.
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
- **THE BOT LADDER** — the sparring bots scale with your rank. Every bot
  bout (QUICK MATCH, VS BOTS 2v2 / FFA) reads your cumulative XP, finds your
  Bronze→Overlord tier and blends one brain from the rows either side of it
  (`config.BOT_LADDER`, one row per rank; `src/combat/botBrain.ts` does the
  blend, `systems/BotSystem.ts` drives it). A fresh Bronze account spars the
  ROOKIE: slow, sloppy, throws at where your head WAS, notices fire late and
  often just watches it land. Every rank up is a ramp, not a cliff — by
  PLATINUM the BRUISER is FIRE FIGHT 1's old practice bot; the OVERLORD
  leads your head off its velocity, punishes the instant both your fists
  are empty, feints past its beat, double-taps, keeps a wall of a guard and
  steps the moment you spin up. Below DIAMOND a bout you're losing on rounds
  eases the bot a notch per round (`config.BOT_MERCY`); the tutorial always
  spars the ROOKIE. The bout panel names the grade you're facing
  ("contender · gold grade"). Dev: `?bot=gold` pins a rank's row,
  `?botskill=0.6` a raw skill. Headless probe: `npm run check:bot`.
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
- **THE PADS** — the platform shop rebuilt from scratch. A pad is what it
  is MADE OF now (`src/arena/decks.ts`, thirteen procedural deck
  materials with colour + bump from one seeded noise): the free three are
  charred oak (SMOULDER), pale ash (AZURE) and redwood (INFERNO); the shop
  climbs from WALNUT through SLATE flagstones, veined MARBLE, FROST (river
  ice), OBSIDIAN (black glass) and JADE to BULLION (gold leaf, laid square
  by square); CHAMPION is crimson lacquer with a gold inlay, TIDEBREAKER
  wet green stone under GOOPLIATH's pool, BLAZING scorched boards under
  the burning rail. Each skin also picks the neon tube's colour and the
  corner screws' metal. The tint-era ornaments (the XD grin, VOLT's bolt,
  SYNTHWAVE's grid, GOLD RUSH's medallion) are gone with their skins; a
  saved retired id falls back to SMOULDER. Tiles show a material swatch.
  Preview: `/skin-preview.html?pads=slate,marble,bullion`; the deck's
  telegraph shapes still at `/deck-preview.html?shape=gate|donut|x|routine`.
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
  (the SETTINGS tab, or per-punter on the club console) and REPORT PAINT are the
  moderation backstops. P5: every piece of GEAR is a paint surface, and
  the rack sells DOTS and SQUARES beside stripes and splotches — sized and
  spun with the stick as you place them, capped so nothing swallows the
  body. THE RECORD: the look mirrors to your player doc,
  the LADDER's profile view and your PROFILE card render the painting behind your name,
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

The live site is **https://ff2.web.app**, published by GitHub Actions
(`.github/workflows/firebase-deploy.yml`). A push to `main` goes live; a pull
request gets a temporary preview channel so a change can be walked around in a
headset before it is merged.

A **GitHub Pages** mirror still builds from `.github/workflows/deploy.yml`
(https://yellkell.github.io/ff2/).

Pages serves the game from a **subpath** (`/ff2/`), not a domain root, so
every reference to a file in `public/` must be written **relatively**
(`signs/fire-fight.png`, never `/signs/fire-fight.png`). Vite rewrites
references inside its HTML inputs, but *not* string literals in TypeScript
and *not* files copied verbatim out of `public/` — both have already
shipped this bug once. `npm run build && npm run check:pages` serves the
build under `/ff2/` in a real browser and fails on any 404; the deploy
workflow runs a fast static version of the same guard.

### The room server

Three relays, one process, one host: `server/room.mjs` mounts the duel relay at
`/ff`, the Iron Balls pub at `/pub` and the rave's room relay at `/rave`. The
client resolves all three off one `ROOM_SERVER` constant (`src/config.ts`).

On a free plan that consolidation matters more than tidiness — a sleeping
service takes the best part of a minute to wake, and one service means everyone
arriving anywhere in the town wakes the same one.

`render.yaml` is a Blueprint: **Render → New → Blueprint → this repo** creates
the service and prompts for the secrets. Setting one up by hand instead, the
four things that matter are:

| Setting | Value |
| --- | --- |
| Root Directory | `server` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/` |

`server/` is self-contained — node built-ins, `ws`, and its own files — so
Render never builds the client to run the relay.

**The env vars do not travel with the code.** `LIVEKIT_URL`,
`LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` live on whichever service used to
run the pub; without them the pub still works and nobody can hear each other.
`DISCORD_BOT_TOKEN` / `DISCORD_CHANNEL_ID` (the bar TV) and `ADMIN_TOKEN` (the
ban panel) are optional.

You can tell by eye which build a host is running — the room server answers `/`
with `{"room":"fire-fight-2","relays":[…]}`, where a single old relay answers
with its own name.

> If the host's name changes, `ROOM_SERVER` in `src/config.ts` has to change
> with it. It is one constant, and it is the only place the hostname appears.

### The Firebase project

Everything server-side — boards, matchmaking, presence, the gazette — lives in
**one Firestore**, the project behind ff2.web.app, shared by FIRE FIGHT 2, RAVE
RAID and the club.

It did not use to. FF2 talked to `arfi-b68f9`, inherited from the ARFI era and
also **FIRE FIGHT 1's live hosting** — which is why this workflow sat parked on
manual dispatch, since an automatic deploy from this repo would have
overwritten the live FF1 site. RAVE RAID kept its world board in a project of
its own, and the pub's arcade board was a single document wedged into FF2's.
One player had three identities and a board in one game could not see a name
from another.

> The project id reads `flappy-ff9f6`, which is where the `ff2` hosting site
> was reserved. A `.web.app` name is globally unique, so prising it loose to
> rename the project would mean releasing `ff2` into the pool where anyone
> could take it. The id is invisible to players — treat it as **the FF2
> project**.

Two pieces of setup are not in this repo, because they cannot be:

- **Anonymous sign-in must be ON** (Authentication → Sign-in method →
  Anonymous). Every security rule identifies a row by its document name
  matching `request.auth.uid`, so with it off there is no uid, and every write
  in the game is denied — boards go quiet and matchmaking never pairs.
- **Nothing else.** There WAS a second item here — a Firestore TTL policy on
  `expiresAt` for `rooms` and `presence` — and it turned out not to be needed.
  TTL requires the Blaze plan, and more to the point it was never load
  bearing: both collections are queried with `where('expiresAt', '>', now)`,
  so an expired record is filtered out SERVER-SIDE. It is never returned,
  never shown, and never costs a read, which means a ghost cannot crowd a live
  room out of a `limit()`ed scan — the failure the field exists to prevent.

  Removing the records is housekeeping on top of that, and the clients do it:
  `net/presence.ts` sweeps a handful of lapsed records once per session, and
  the rules let any signed-in player bin one that has already expired. That is
  the same arrangement the duel lobbies have always had, where
  `webrtcTransport` reaps the ghosts it scans past.

  Turn TTL on if you move to Blaze for other reasons — the field is the right
  type for it (a timestamp; a policy aimed at a number sweeps nothing and says
  nothing about it) — but it buys tidiness, not correctness.

Rules and indexes DO live here and ship with the repo:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```
