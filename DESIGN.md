# FIRE FIGHT 2 — DESIGN

The sequel to FIRE FIGHT, with RAVE RAID folded in as a mode. One game, one
club, one body you paint over months. This document turns the kickoff brief
into a build plan grounded in the two shipped codebases:

- **FIRE FIGHT** (`yellkell/iron-balls-boxing`) — the fireball boxing game.
  Its full engine is seeded into this repo (see `FOUNDATION.md`, the FF1
  README carried over verbatim — everything in it still runs here).
- **RAVE RAID** (`yellkell/dance`) — the rhythm battle royale. Its menu kit,
  club architecture and boss-move grammar are the sequel's raw material;
  they get ported in, not rewritten from memory.

Both games run the same stack (`@iwsdk/core` 0.4.2, three 0.184, Vite 7,
strict TS, a WebSocket relay, Firestore for boards), so "fold them together"
is a port, not a rewrite.

---

## 1 · The pillars

1. **One town.** You are one fighter with one name, one wallet, one painted
   body, across boxing, raiding and raving. Nothing forks per mode.
2. **The club is the lobby.** There is no menu-room-then-game. You are in
   the venue with everyone else; games are called down onto the floor and
   the floor never closes.
3. **Watching is playing.** Every match launched from the club is a show.
   Spectators have a place to stand, things to do, and a voice the fighters
   feel (as crowd roar) but never hear (as words).
4. **Beautiful first, fast second.** Art-direct for the most beautiful
   version we can imagine on next-gen headset hardware, then buy the
   framerate back with the tricks both games already know (baked merges,
   instancing, the mirror trick, light-instead-of-geometry). Never the
   other way round.
5. **The paint is the endgame.** Cosmetic progression is a canvas, not a
   catalogue. What you own matters less than what you've made of it.

---

## 2 · The wrap-around three-panel menu

RAVE RAID's menus are the standard; FF2 pushes past them.

**What we take, whole** (from `dance`):

- `src/ui/panel.ts` — the `Panel` class (one canvas → one CanvasTexture →
  one plane + additive halo; `paint`/`press`/`setShown`/`tick`/`hoverOf`/
  `buttonAt`; the `PanelButton` role vocabulary: `primary`, `selected`,
  `disabled`, `display`, **`ghost`** for custom-drawn widgets, `tone`).
- `src/ui/pointer.ts` — the `PointerRay` (beam only when on something
  interactable, dot swells on hover, pops on click).
- `src/ui/safety.ts` — the *fragment* pattern: reusable panel content that
  takes a layout struct and emits buttons + a draw function. This is how
  three panels stay one design system.
- The repaint-key discipline (`lastKey` built from every state input; no
  canvas work when nothing changed) — non-negotiable, or three big canvases
  re-upload every frame.
- The flat `action(id)` dispatcher with id namespacing (`tab-*`, `song:*`,
  `kb:*`…) and the multi-target raycast loop (`panelFor(hit.object)` →
  `buttonAt(uv)`), which already supports N panels at arbitrary rotations.

**What's new — THE WRAP:**

Three panels on a shallow arc around the player (center dead ahead,
left/right yawed in ~28–35°, all at podium height), run by one shared
hover/click/scroll loop. RAVE RAID already parents a fly-out leaf panel to a
desk and hit-tests both; the wrap generalises that into a **rig**: an
`ArcRig` that places any number of `Panel`s on a circle of radius ~1.5 m
about the head's spawn pose, eases them open in sequence (center first,
wings 80 ms behind), and folds them away as one.

Panel roles:

| Panel | Contents |
| --- | --- |
| **LEFT — THE FLOOR** | Who's here: the room roster (name, hue, crown), live counts (queue / club / sets in progress), the safety console fragment (mute/block/report), voice toggle. |
| **CENTER — THE CALL** | What we're doing: FIGHT (1v1 ranked/quick/private · 2v2 · FFA), RAID (titans), **RAVE** (the full RAVE RAID mode), TRAIN (tutorial/aim), the campaign line-up. Primary CTA lives here and only here. |
| **RIGHT — YOU** | The locker: your mannequin live-rendered, paint mode entry, the shop, wallet, rank, stats, settings. |

**The few-doors law** (added when the first wrap proved too busy): the
lobby never presents everything at once. The center slab's root offers
exactly THREE doors — FIGHT, ARCADE, THE CLUB — and every other option
is a sub-option behind its door, one BACK away. Preference breakers live
where they matter (ONLY BOTS inside FIGHT, SHOOT BACK inside ARCADE),
never at top level. The left wing is THE TOWN, a buttonless live-status
board; the right wing stays YOU.

The wrap is the *foyer* menu (solo/spawn context). On the club floor the
same three panels compress into the summonable console (the RAVE RAID
desk pattern) so the design system is identical in both places.

FF1's `src/menu/menu.ts` (3,914 lines of bespoke canvas) is **retired
gradually**: each screen is rebuilt as a panel-kit fragment, ported one at a
time onto the wrap, and the old plates deleted when their last screen moves
over. No big-bang rewrite of a working lobby.

---

## 3 · The social area — the club is the launcher

**Out:** the Iron Balls pub's fight hall (live claim-console duels in the
social space). **In:** RAVE RAID's club law, extended.

The four-places law carries over (where you are is what you're doing):
foyer (menu), **the club** (social), and the match (wherever your game
seats you — with audience ground around it). **The club itself contains
no arena — ever.** RAVE RAID's floor is the model exactly: games are
CALLED from the floor and PLAYED somewhere else; the venue stays a
venue.

### 3.1 Calling a game — DISCO BALLS, always

RAVE RAID's BALL doesn't generalise into something else — **it IS the
launcher, for everything**. Anyone on the floor opens the A-button
console; it has TWO TABS:

- **FIGHT** — start FIRE FIGHT matches and raids: 1V1 · 2V2 · FFA ·
  TITAN RAID.
- **RAVE** — the record shelf: RAVE RAID's charted songs and the
  difficulty chips.

Either way the CTA is the same verb: **CALL THE BALL.** A mirror ball is
winched down out of the ceiling on its cable (the under-damped spring
drop, the 60 s relay-owned countdown plate — the game or the song, the
caller, one orbiting pip per person touched in). The ball is
mode-agnostic: it carries `{ mode, params, caller, seats[] }` and the
relay deals seats + seed + a shared start clock, whether that's a duel,
a titan gauntlet or a rave set.
*(Shipped so far: THE BALL's visual ported whole (`src/club/ball.ts` +
the mirror-ball glint in materials/glow), the record shelf as data
(`src/club/records.ts`, 24 RR masters' measured metadata), and the
tabbed console face + local state (`src/club/console.ts`) — the relay
drop/deal wiring lands with presence.)*

Joining is physical (walk up, touch, trigger), leaving is touching again,
the caller can START early or cancel, and at zero the squad is dealt into
the match **without leaving the venue** (see 3.2). The floor never closes:
stay-behinds keep talking, newcomers keep arriving, finished players fold
back home automatically.

### 3.2 Watching — travel together, and the crowd that can't be heard

No pit, no fight hall — **nothing fights inside the club** (the Iron
Balls pub's indoor duel was FF1; FF2 ends it). Instead, RAVE RAID's law
extended to watchers: when the bell hits zero, the caller's squad AND
everyone who touched in as AUDIENCE are dealt to the match's own place
together — fighters onto the platforms, watchers onto **audience
ground** built into each arena (rails and standing terraces outside the
cage line, in the dark beyond the fighters' light). "We can all stay
together and watch" is literal: the group travels as one, the club
floor stays open behind them, and everyone folds back to the floor when
the bout ends. Fighters stream poses + fireballs to the audience over
the wire FF1's fight hall already proved at 20 Hz.

Crowd rules (this is a design pillar, so it's spelled out):

- **Fighters never hear the audience's words.** The FF1 match voice bubble
  is law: fighters hear only each other; spectators hear everyone.
- **Fighters always hear the crowd as a crowd.** A layered ambient bed —
  *distant* crowd murmur under everything, mid rumble that swells with the
  action — plays for everyone, fighters included. We need to **source real
  crowd recordings** for this (distant stadium murmur, close roar, swell
  stings); neither repo has any — FF1's "crowd" is emergent voice only.
  Until sourced, a synthesized placeholder bed ships via FF1's `sfx.ts`
  noise kit so the mix is designed early.
- **Hands up = roar.** Spectators raising both hands above their head is
  detected locally (two controller heights vs. head height, cheap), sent
  as a 1-byte intensity on the room wire, and the relay aggregates it into
  a room-wide `crowd` level: the roar bed swells with how much of the crowd
  has hands up, plus a clap/stomp layer. It's the one channel the audience
  has into the fighters' ears — pure noise, no words — so a comeback
  landing while the whole terrace goes up FEELS like it.
- Environments are designed around the watchers: every competitive
  arena grows audience ground with clean sightlines, the fight lit like
  a show (fighters brightest thing in the place — Desert 2.0 already
  obeys), watchers close enough to feel it but outside the cage line.

### 3.3 The venue

We move off the Iron Balls pub. The new venue is built on RAVE RAID's club
architecture (`club/build.ts` + `merge.ts` + place-scoped fog/voice/music)
— the four-places plumbing, the still room idea, spatial voice, prop
brokering — but **re-skinned into FF2's world**: the industrial fight-club
language (gunmetal, hazard amber, riveted steel) fused with the supper-club
craft level (every edge carries thickness; saturated colour reserved for
light). Rooms: the floor + bar, the locker room (paint + shop in person
— your mannequin on a plinth), the arcade corner (cabinets carry over),
and a dark door we keep for whatever the next experiment is — THE STEP
taught us the value of an unexplained door. No pit, no ring, no
consoles: the only way a fight starts here is the bell, and the only
place it happens is elsewhere.

Both games' clubs keep their servers' good bones: RAVE RAID's relay owns
the bell clock and deals seats; FF1's pub server contributes the voice
bubble, prop ownership brokering and ban tooling. Target one merged FF2
room server (`server/`), 24 heads, region-picked like `PUB_REGIONS`.

---

## 4 · New campaign — titans that learned to dance

FF1's campaign spine stays (it's excellent): bespoke chassis, pit-lane
intros, bespoke deaths, blinking weak-point patterns, coins/XP, first-fell
double, gauntlet run, hardcore, raids with escalating targeting.

What's new: **the move grammar from RAVE RAID.** The titans' attack roster
grows from FF1's five kinds (slam/sweep/beam/volley/nova) to the full
RAVE RAID vocabulary, ported from `dance/src/config.ts` (`MoveKind`,
`MOVES`, `CHOREO`), `choreo/setlist.ts`, `choreo/telegraphs.ts`,
`choreo/strikes.ts`, `choreo/blockfall.ts`:

| New move | On your platform | The answer |
| --- | --- | --- |
| **gate** | everything burns but one band | stand in the gap |
| **cross / THE TRAP** | rails ahead/behind, both at once | step off the strip / squeeze the band |
| **donut** | center lane, then all-but-center | step out, run back in |
| **THE ROUTINE** | the boss *teaches* corners, then hides them | remember and commit |
| **wave / THE LONG WAVE** | marching strips with a dark exit that turns | travel with the march |
| **seesaw / surge** | half-court cascades (already in FF1 as halves — upgraded to RR's chained cascades) | cross on the beat |
| **duckdonut** | sweep + donut on one beat | middle AND duck |

And the generation laws come with them — they're what makes RAVE RAID's
choreography readable: never the same move twice running, the **VERB table**
damping repeated body-verbs, **THE FLOOR MANAGER** (`parkOf`/`evictsPark`:
a correct dodge is never punished by where it parks you), windups sacred
(escalation compresses gaps, never the read), landings on downbeats.

**No second line-up.** (Decision revised in build: a fresh bill of bosses
wearing borrowed chassis was scraps-and-new-names — not worth a campaign.)
Instead the campaign ITERATES: **the five titans learned to dance.** Each
keeps its soul and gains the grammar subset that extends it — RUSTHOOK the
scrapyard **gate** (+ slotted lanes), PISTONKAISER the **wave** (its
drumline, marched deck-wide) + the surge, VULTURE the **crossfire** (rails,
THE TRAP, the lattice) and **THE X**, JUGGERNAUT closing walls (**row
gates + the donut's rim**), and GOLIATH — the king teaches — **THE
ROUTINE**, the wave as procession, the donut, and once in a blazing night
the **duckdonut**. Vocabulary is act-gated (`GRAMMAR_ACT_MIN`): an EASY
bout stays the fight it always was; the hard tiers meet the whole grammar.
`volley` remains the one blockable attack (the parry law is FF1's soul and
stays); everything else is read-and-move.
**SHIPPED (first pass)**: `campaign/grammar.ts` (the ported shapes + laws:
never-twice, VERB damping, THE FLOOR MANAGER's parkOf/evictsPark, all
seeded — one 32-bit number on the raid wire rebuilds the identical move on
every client), the telegraph kit (gate/donut/X/rail/lane + THE ROUTINE's
marks, quarter lines and falling blocks, octagon-masked), CampaignSystem's
grammar path (windows so a cascade's later reads open as earlier steps
fire; per-shape strikes; head-judged routine commitment), and the per-boss
subsets above. Headless: `npm run check:grammar`. Boss-side ANIMATION
language for the new moves (bespoke gestures per shape) is the next pass.

Raid escalation carries over unchanged for the classic kinds (solo-target
→ two marks → whole squad, DECREE-style shared bearings, the resurrection
beat for the finale); grammar moves are squad-wide by RAVE RAID's own law —
one chart, every deck.

---

## 5 · Character models & customization — the mecha chameleon

The FF1 skins system (preset avatars + hue sliders) retires. FF2's fighter:

### 5.1 The blank

One **bland humanoid mannequin** — matte, colourless, primer-grey — sized
honestly to the hitbox volumes (`config.ts` `BODY_IK` + `Hitbox` spheres):
thin waist, wide shoulders, the silhouette everyone reads in a fight.
Everyone starts identical and unpainted, and everyone sees you exactly as
you've built yourself. (FF1's `boxer.ts` head/torso/gloves IK solve is the
skeleton; the mannequin is a new procedural skin over the same rig, so
netcode, hitboxes and the pose bus don't move.)

**Two pieces, one moving part.** The body is a SINGLE loft — neck,
shoulders, chest, waist, hips, taper — planted at the hips and leaned
along the spine; the HEAD is a bare egg that floats free above it and is
the only piece that moves on its own. Chest and pelvis were once separate
lofts the IK placed independently, which meant the waist opened and shut
as you leaned, and the neck rode on the head, dragging itself through the
shoulders whenever you looked behind you. Neither seam can reappear,
because neither joint exists: there is nothing to come apart, and only
the head has to be animated. The hitboxes are untouched — `solveTorso`
still solves the chest and pelvis POINTS for the BODY_IK spheres, and the
one surface runs inside them.

### 5.2 The shop — shapes, never colour

Coins (earned per game — fights, raids, **and songs**: finishing a RAVE
set banks the same flat `CURRENCY.perGame`) buy **attachments**: shoulder
pads, hats, jewelry, plates, antennae — models that bolt to the rig and
**never affect the hitbox** (purely visual, parented to bones, excluded
from collision). Everything in the shop is sold *uncoloured* — the same
primer grey as the body. FF1's wallet/shop/locker plumbing
(`wallet.ts`, `customization.ts`, owned-lists, try-before-buy preview)
carries over; the catalogue changes from skins to attachments.

### 5.3 The paint — the important part

> **Now specced in full in [`docs/paint.md`](docs/paint.md)** — buying
> individual stripes and splotches, the paint bay's verbs, the packed
> `Look` model, per-part canvas baking, how every other player sees your
> painting (sync, validation, fail-soft), moderation, and the four-phase
> build order. The sketch below is the original outline it grew from.

Colour is bought as **stripes**: paint items you place *minutely* on your
own body and attachments from the locker — position, angle, length, width,
hue — layer over layer, removable, editable, **persistent across games and
added to over time**. The goal stated in the brief is the spec: *you can
make cool art and it looks cool* — a mecha chameleon you keep painting for
months.

Tech sketch:

- A stripe is data: `{ id, surface (body part / attachment id), uv anchor,
  angle, length, width, hue, layer }`. Your whole look is an ordered list
  of stripes + attachment set — small JSON, stored with the profile,
  synced to peers through the existing cosmetics channel
  (`mesh.cosmetics` already carries per-peer loadouts).
- Rendered as decals into a **per-part paint texture** baked once per
  change (canvas → texture per body part, exactly the kit both games
  use for panels), so a heavily-painted fighter costs the same at runtime
  as a blank one.
- The locker's paint mode is a panel-kit tool: your mannequin on the
  plinth, a stripe in hand, ray places it, grips nudge it — RAVE RAID's
  colour-wheel ghost-button trick supplies the hue picker.
- Placement bounds per surface so stripes can't float; layer order is
  yours to reorder; REMOVE is always free (paint is never consumed —
  bought stripes go back in the locker).

Moderation note for later: player-authored patterns are user content;
the report path (`reports` collection) must cover "report this paint job."

### 5.4 One identity across modes

The mannequin + paint + attachments render identically on the club floor,
on a duel platform, on a raid arc and on a RAVE ring (the RAVE dancer rig
and the boxer rig both solve from head+hands, so the mannequin skins both).
Name, hue fallback, wallet, XP, rank: one profile everywhere.

---

## 6 · New environments — beautiful first

**Out:** papercraft low-poly (`makePaper` flat-shading rule). **In:** the
most beautiful thing we can imagine, **darker**, then optimized to hit
frame rate on next-gen headsets — and only then scaled back with tricks
(never designed down up front).

The craft standard is already in-house: RAVE RAID's club (every edge
carries thickness, colour lives in light, baked to a handful of draws) and
THE VOID (vast darkness given shape by light, four depth layers, the
mirror trick, ~48 draws). That discipline, aimed at outdoor spaces.

### 6.1 Desert 2.0 — same soul, new night

The FF1 desert's *story* carries over exactly — **the leaning signpost,
the sun-bleached skull, the broken fence, the tumbleweeds, the vultures,
the dust devils, the mesas** — every landmark from `src/arena/desert/`
survives, rebuilt beautiful:

- **Darker**: golden-hour dying into night. A low blood-orange band on one
  horizon, deep violet above, early stars. The arena is the brightest
  thing for miles (pillar 3: fighters lit like a show).
- Real materials instead of paper: wind-carved rock strata on the mesas,
  specular glints on the skull, rusted enamel on the sign (lit by its own
  buzzing lamp), long soft shadows from the horizon light.
- Atmosphere: heat-haze shimmer at the horizon band, dust motes in the
  arena light cone, tumbleweeds catching rim-light as they roll.
- Perf ceiling from day one: authored in layers like THE VOID (near set
  dressing / mid mesas / far silhouette band / sky dome), merged static,
  instanced repeats, light baked into vertex colour or emissive where it
  can be — so "scale back" later means dropping layer detail, not gutting
  the look.

The factory and salt flats get the same pass in later sessions; new venues
(the club itself is an environment) follow the same layered recipe.

### 6.2 The bar

Every graphical aspect aims for the ceiling on next-gen hardware
(Quest 3-class and up): full-rate render scale, foveation as a lever not a
crutch, no post stack (both games prove bloom-by-sprites), draw-call
budgets set per scene up front (venue ≤ ~80, arena ≤ ~60) so beauty is
built inside a budget rather than trimmed after.

---

## 7 · RAVE RAID as a mode

RAVE RAID folds in whole, as **RAVE** on the center panel and on the bell:

- The set itself ports as-is: the choreography stack (already shared —
  §4), THE VOID set, the GOOPLIATH-on-stage (both repos carry the same
  vendored gel boss — FF2 keeps **one** copy under `src/goopliath/`, and
  `styles.ts` there still carries FF1's five fighting styles alongside the
  dance stances, proof they were always the same machine), the record box
  and decks (`audio/tracks.ts` + `music.ts`, 26 measured masters), grades,
  bots, THE RISE.
- Its dancers wear **your mannequin + paint** (§5.4). The couture rave
  mannequin retires with the FF1 skins; hue stays as the seat-fallback.
- Its world board stays its own (`raveraid-bc866` Firestore, the ratchet
  rules) — separate but equal, exactly like the stats page.
- Songs pay coins into the one wallet (§5.2) — this is where "earn
  currency by doing songs" lands.
- The TOUR (its campaign) parks initially — FF2's campaign is the titan
  line-up; the tour returns later as RAVE's own tab if we want it.
- THE CIRCUIT / THE STEP: the dark door pattern comes to the FF2 venue
  (§3.3); whether it leads to the movement course or something new is an
  open call.

Repo mechanics: port modules from `dance` into `src/rave/` here with
their file identities intact (config blocks merged into FF2's `config.ts`
style: one documented tunables file per game area).

---

## 8 · Discord & link joins

Today: RAVE RAID joins rooms from `?room=CODE&name=YOU` URLs; FF1 has
5-digit codes typed on an in-VR keypad and a read-only Discord TV in the
pub (server-side bot already polls a channel).

FF2 makes the link the front door:

1. **Every hosted room mints a link**: `https://<host>/?join=CODE` (one
   scheme across 1v1/2v2/FFA/raid/rave — the code already carries its
   format server-side). Booting with `?join=` skips the menu, connects,
   and offers ENTER straight into the room — RAVE RAID's
   `autoJoinFromUrl` generalised. The lobby shows the link as a QR +
   short code; COPY LINK on desktop.
2. **Discord invites**: the room server's existing Discord bot grows a
   write path — HOST from the club can post the invite (game, format,
   seats open, the link) to the configured channel; the bell's countdown
   can post "3 touched in, 1 seat left". Clicking the link on a phone
   shows a landing page ("open in your headset"); in the headset browser
   it joins.
3. Later: Discord Rich Presence via the packaged app, and slash-commands
   (`/firefight host 2v2`) minting rooms from Discord itself.

---

## 9 · stats.html — the web leaderboard

**Shipped in this repo now**: `public/stats.html` — a standalone page
(no SDK, Firestore REST, read-only) served at `/stats.html` on any of the
hosting targets.

- **FIRE FIGHT first**: RANKED (live season computed from the FF1 season
  clock) · XP · AIM · 2V2 · FFA, plus the run boards GAUNTLET / RAID /
  GOOPLIATH (squad rows, difficulty + HC badges, the same dedup law as
  the in-game board: easy never ranks, best row per squad per feat).
- **RAVE RAID separate but equal**: its own top-level tab in its own
  neon, every chart × difficulty, top 100, S/A/B/C/F grades.
- Reads FF1's `players`/`run*` collections and RAVE RAID's `scores`
  ratchet board directly; when FF2 gets its own Firestore project the
  page gains an FF2 board the same way.

---

## 10 · Build order

Each phase is shippable; nothing waits on everything.

1. **Foundation** *(this session)* — FF1 engine seeded, builds green;
   `stats.html`; this document. Firebase auto-deploy parked so this repo
   can't overwrite FF1's live site until FF2 has its own project.
2. **The wrap** — port `panel.ts`/`pointer.ts`/`safety.ts` from `dance`,
   build the ArcRig, move the first screens (BATTLE + ARCADE) onto the
   three-panel wrap. Old menu retires screen by screen.
   *(v1 shipped: the kit lives at `src/ui/kit/`, and `src/menu/wrap.ts`
   stands three kit panels on the arc as drop-in `MenuPanel`s — BATTLE
   with all its faces, ARCADE, and the house panel. Still legacy: the
   modals — campaign line-up, arcade lobby, locker, shop, settings,
   gazette — the rear leaderboard, the name keyboard, and the pointer
   visuals; `pointer.ts`/`safety.ts` port when those screens move.)*
3. **The mannequin** — new procedural blank over the existing rig +
   hitboxes; FF1 skins retired behind it; attachments shop v1.
   *(v2 shipped: THE BLANK is the ONLY body — the FF1 animal chassis
   (~2,100 lines) and their icons are deleted outright, AVATAR_SKINS is
   one entry, every stored or remote skin id resolves to the blank, and
   the AVATARS shelf is gone from both locker and store. The blank got
   its slender pass — visual trunk/hips run inside the hitbox spheres
   like FF1's SHADOW precedent, and the under-hip bulb became a clean
   closing taper (the hitbox never bulged: it ends at the BODY_IK pelvis
   sphere, and now the body looks like it). The menus centre the avatar:
   the right wing is YOU — name plate up top, YOUR BLANK as the primary
   CTA — THE PODIUM stands your dressed blank on a slowly turning plinth
   beside it whenever the lobby is up, and the locker's COLOUR tab keeps
   only the gauntlet neon, with "THE BLANK TAKES NO DYE" written where
   the armour sliders were. Polish pass v3: the body is rebuilt as ONE smooth
   loft per piece — no crossing primitives at neck or shoulders, no seam
   bands, a single uniform material — and it starts ALL WHITE or ALL
   BLACK ('blank'/'onyx' skin ids, the base pick on the locker's COLOUR
   tab, synced over the existing skin wire). Below the hips the loft is
   monotonic: hips, then only narrower, closing at a rounded tip — the
   silhouette finally agrees with the hitbox, which always ended at the
   pelvis sphere. Still to come: the attachments shop.)*
4. **The paint** — stripe data model, per-part bake, locker paint mode,
   cosmetics sync. (The moment "lasting through games" works, ship it.)
5. **The venue + THE BELL** — new club on RAVE RAID's club architecture,
   merged room server, bell-launch for 1v1/2v2/FFA first.
   *(Opened: RAVE RAID's club VENUE is ported whole into `src/club/` —
   build.ts, config, materials, merge, the arcade + step ref registries,
   a palette shim carrying the disco magenta/cyan and per-guest hue
   helper — compiling clean against FF2's kit fonts and glow, with the
   foyer left behind (FF2 has its own lobby). `club-preview.html` walks
   it for screenshots. Next: presence + teleport systems, then the
   bell.)*
6. **Audience ground + the crowd** — watchers travel with the squad,
   audience terraces in the arenas, voice bubble, hands-up roar wire,
   sourced crowd beds.
7. **RAVE mode** — port the set, decks, records; mannequin on the ring;
   coins per song; bell learns RAVE SET.
8. **Campaign 2** — move-grammar port (telegraphs/setlist/floor manager),
   new titan line-up, the on-beat titan, raid cut.
9. **Desert 2.0** — the dusk rebuild, then the venue exterior, then the
   rest of the environments.
   *(First pass shipped: golden hour dying into night — deep violet-navy
   overhead with 420 early stars thickening away from a blood-orange
   horizon band, a swollen dying sun in an ember halo, the whole palette
   a step darker and richer with bone and dust left pale to catch the
   light, and the papercraft flat-shading retired: the default desert
   material is smooth matte clay, dunes at higher vertex density so the
   dusk light rolls instead of snapping facet to facet. Every landmark
   kept: the sign, the skull, the fence, the tumbleweeds, the mesas, the
   vultures, the dust devils. Next passes: real material variation on
   the mesas, the lit sign lamp, heat-haze at the horizon, and the same
   treatment for the salt flats and factory.)*
10. **Links & Discord** — `?join=` everywhere, QR on the lobby, bot write
    path.

Session-zero decisions still open (flagged, not blocking): FF2's own
Firebase project + hosting target; whether FF2 ships as an update to the
FF1 store listing or a new one; the new titan roster; what's behind the
dark door.

---

## 11 · What this repo contains right now

- The complete FIRE FIGHT 1 engine and game, renamed FF2, building green
  (`npm install && npm run build`) — see `FOUNDATION.md` for its own docs.
  Left out of the seed: FF1's OST zip, voice-line WAV masters and gazette
  archive (history, not engine).
- `public/stats.html` — the web leaderboard (§9).
- This document.
