# THE PAINT — how a blank becomes yours

The design of FF2's paint system (DESIGN.md §5.3, expanded): buying
individual stripes and splotches of colour, placing them minutely on your
own body, and carrying the result — your personal painting — into every
game, in front of every player, for as long as you keep adding to it.

The pillar it serves: **the paint is the endgame**. Cosmetic progression
is a canvas, not a catalogue. Everyone owns the same body (THE BLANK, all
white or all black); nobody can buy a look, only the materials to make
one. Two fighters with the same wallet history should still be
unmistakable at ten yards.

---

## 1 · What you buy

The shop sells **paint units**, individually, for coins (the one wallet —
fights, raids and rave sets all feed it):

| Item | What it is | Placement freedom |
| --- | --- | --- |
| **STRIPE** | A straight band of one colour | position · angle · length · width |
| **SPLOTCH** | An organic splat of one colour (each unit rolls one of ~8 splat silhouettes when placed; re-placing re-rolls) | position · angle · scale |

- **Colour is the product.** Units are sold per colour: a rack of hues,
  cheap earth-and-primary tones first, hotter neons a tier up, and a
  short top shelf (metallic gold leaf, pearl white for onyx bodies, void
  black for white bodies) priced like the XD pad — flexes, not power.
- **You own counts, not licences**: buy three RED stripes, place three
  red stripes. **Removing a placed unit returns it to the locker
  intact** — paint is never consumed, so experimenting is free once
  you own the materials. (The brief's law: place AND remove, from your
  locker, minutely.)
- Pricing sketch (tune in `config.ts` `PAINT` block): basic hue stripe
  ≈ 20 coins (two games), splotch ≈ 30, neon tier ×2, top shelf ×10.
  A first paint job (5–8 units) lands around a session of play — the
  wardrobe grows over weeks, which is the point ("lasting through
  games and added to over time").
- The tutorial's graduation gift gains one free stripe in the contrast
  tone (black stripe on a white body, white on onyx) so every player
  has touched the paint bay once.

## 2 · Where you paint — THE PAINT BAY

A locker face (later: a room of its own in the new venue, your mannequin
on a plinth). Your body stands live in front of you; the tray beside it
holds your owned, unplaced units grouped by colour.

The verbs, all controller-native:

1. **Take** — point at a unit in the tray, trigger: it rides your ray as
   a ghost stripe.
2. **Place** — sweep the ray over your body; the ghost wraps the surface
   at the hit point, live. Trigger drops it.
3. **Adjust while held** (this is the "minutely"): thumbstick **twist**
   (x) rotates, thumbstick **y** scales length (stripes) or size
   (splotches), **grip held** switches the y-axis to width. Haptic tick
   at snap angles (0°/45°/90°) with free placement between.
4. **Pick back up** — point at a placed unit, hold trigger a beat: it
   pops back onto the ray (its slot in the layer order remembered until
   dropped elsewhere).
5. **Return** — B with a unit held sends it back to the tray.
6. **Layers** — newest sits on top; two placed units pointed at in turn
   swap layers via a SWAP chip on the tray panel. (Full reorder UI can
   wait; swap covers the real cases.)

The bay runs on the panel kit for its tray/chips and the existing ray +
trigger grammar — no new input machinery.

## 3 · The look, as data

One look = the base tone + an ordered list of placed units:

```ts
interface PlacedPaint {
  kind: 'stripe' | 'splotch';
  colour: number;   // index into the sold palette (not a free RGB)
  variant: number;  // splotch silhouette roll; stripes: end-cap style
  part: 'head' | 'chest' | 'pelvis' | 'gloveL' | 'gloveR';
  u: number; v: number;   // anchor in that part's unwrap, quantized /255
  angle: number;          // /255 over 2π
  len: number; wid: number; // /255 over that part's allowed range
}
interface Look {
  base: 'blank' | 'onyx';
  paint: PlacedPaint[];   // capped: 64 units
}
```

Packed, one unit is **8 bytes**; a maxed look is ~520 bytes — smaller
than one pose packet burst. Caps and quantization are the moderation and
netcode story in one move: every field is clamped by construction, a
look can't be oversized, and the same bytes render the same everywhere.

Persistence: localStorage is the source of truth (like every FF pref).
Mirrored to the player's Firestore doc (`look`, base64) so the profile
card — and later stats.html and the gazette — can show the painting
behind the name.

## 4 · How it renders

The blank's lofts get a **cylindrical unwrap** (ring index → v, segment
→ u — the loft builder already iterates exactly those), and each body
part gets a **paint canvas** (head 256², chest 512×512, pelvis 256²,
gloves 128²):

1. Start from the base tone fill.
2. Draw each placed unit oldest-first: stripes as rotated rounded bands,
   splotches as their seeded blob paths; anything crossing the u-seam
   draws twice, offset ±1, so wraps are seamless.
3. Upload once as the part material's `map`.

A repaint happens **only when the look changes** — placing in the bay,
or a rival's look arriving. At runtime a painted fighter costs exactly
what a blank costs: same meshes, one static texture per part. (This is
the panel kit's repaint-key discipline applied to bodies.)

Onyx bodies keep their sheen: paint draws into the same map, and the
darker base simply reads through unpainted texels.

## 5 · How other players see it

The rule: **anywhere your body renders, your painting renders.**

- **Live rooms** — the packed look rides the channels that already carry
  cosmetics: the 1v1 `iam` message, `mesh.cosmetics` for 2v2/FFA/raid
  squads, and the pub/club hello. ~half a KB on reliable channels, sent
  once per join (and once on change while in a social room — repainting
  mid-duel is not a thing; the bay is a lobby/club activity).
- **On receive**: validate (cap count, clamp every field, unknown
  colour/variant → drop the unit, malformed look → bare base tone),
  then bake that player's part canvases once. A 24-head club joining
  costs 24 bakes on entry — canvas work measured in milliseconds,
  amortized by the join flow, never per-frame.
- **Spectators** at the pit see fighters through the same room stream —
  nothing extra to build; the look came in with the fighter.
- **Late data beats no data**: a fighter whose look hasn't arrived yet
  renders as their base tone and repaints the moment it lands — the
  same fail-soft law as every FF net feature.
- **Offline/bots**: bots stay factory-blank. That's flavour: unpainted
  means nobody's home.

## 6 · Moderation

Free placement can draw things we don't want in a room:

- The existing **report** path (create-only `reports` collection) gains
  a REPORT PAINT subject carrying the reported player's packed look —
  evidence included by construction, 520 bytes.
- The pub/club safety console's mute/block list gains **HIDE PAINT**:
  strictly local, renders that player (or everyone: one global toggle in
  settings) as bare base tone. Total defence, zero server work.
- The palette being an index (no free RGB) and units being solid single
  shapes keeps the offensive-drawing surface small but not zero — the
  local hide is the honest backstop, same philosophy as FF1's
  mute/block.

## 7 · Build order

1. **P1 — the canvas**: loft UVs + per-part paint canvases + the bake;
   `Look` model + localStorage; a dev-seeded look renders on your own
   body, the mirror and the podium. *(No UI yet — prove the pipeline.)*
   **SHIPPED**: `src/avatar/paint.ts` (Look + validation + bake +
   `__ff2.paint` dev verbs), the `PAINT` config block (24-colour
   append-only palette, 64-unit cap, per-part canvas sizes), seam-safe
   cylindrical UVs on the mannequin lofts (paint surfaces exempted from
   the static-merge collapse), and the bake wired into applyOwnSkins for
   your body, the mirror and the podium. Two real bugs found and fixed
   on the way: the loft's triangles wound INWARD (the game had been
   rendering the body's interior — the paint proved it), and paint
   surfaces had to be kept out of collapseStatic or they fused into one
   untagged batch.
2. **P2 — the bay**: tray panel, take/place/adjust/pick-up/return verbs,
   layer swap; shop sells stripes+splotches in the first two colour
   tiers; the graduation stripe.
   **SHIPPED** (layer swap deferred): THE PAINT BAY opens from the YOU
   wing — a kit modal (`src/menu/paintbay.ts`) beside the locker mirror
   with THE TRAY (owned counts) and THE RACK (base + neon racks priced
   off the PAINT config, wallet-debited). The body itself is the
   canvas: MenuSystem raycasts the mirror's paint surfaces — a held
   unit ghost-previews under the ray (throttled bakes), trigger places,
   the thumbstick twists and sizes (grip switches to width), pointing
   at placed paint and squeezing lifts it back into the hand, B returns
   it to the tray, and closing the bay never strands a held unit. The
   tutorial's graduation now grants the contrast stripe. Headless bay
   verbs on `__ff2.paint` + `__ff2.bayClick` walk the whole
   buy→take→place→lift→return loop in CI.
3. **P3 — the room sees you**: pack/validate/sync over `iam` +
   `mesh.cosmetics` + pub hello; bake-on-join; hide-paint toggles;
   report-paint.
   **SHIPPED**: the 8-byte wire form (`packLook`/`unpackLook` in
   avatar/paint.ts — base64 over every JSON channel, byte-stable under
   quantization, every received unit re-clamped through cleanUnit and
   anything malformed failing soft to the bare base tone). The look now
   rides all three cosmetics channels: the duel's `iam`, the mesh `iam`
   (2v2 / FFA / raid squads, stored per seat in `mesh.cosmetics`), and
   the club hello (kept on the server's player record so late joiners get
   it in welcome/join; a mid-visit repaint fans out as a relayed `LOOK`
   event). Bake-on-join everywhere a body renders: OpponentSystem bakes
   rivals/squadmates alongside their skins (bots stay factory-blank),
   PubPlayerSystem bakes each punter at spawn and on `LOOK`, and your own
   pit body carries your look into the club fight hall. Moderation both
   ways: a HIDE ALL PAINT breaker in settings, per-punter PAINT (bare
   their body) and REPORT (their packed look filed to the `reports`
   collection as evidence, `subject: 'paint'`) switches on the club
   safety console — all local, all instant via version-keyed rebakes.
   Headless: `npm run check:paint` (tools/paint-wire-check.mjs) proves the
   wire's roundtrip + fail-soft AND runs a real two-client room against
   the local pub relay: painted hello → roster → baked-on-join → LOOK
   repaint mid-visit.
4. **P4 — the record**: Firestore mirror, profile card rendering, the
   gazette learning to describe a champion's colours.
   **SHIPPED**: the player doc mirrors `look` (the packed wire string) +
   `tone`, written by `syncLookMirror` only when they actually change
   (seeded from the boot read so an unchanged look never re-writes; a
   look painted offline catches up at boot). The leaderboard rows carry
   both back down, and the PROFILE card now renders **the painting
   behind the name**: `paintBanner` bakes the front of the most-painted
   part flat — the same drawUnit pipeline the body wears — under a
   legibility scrim; an unpainted fighter keeps the clean card. The look
   also became WORDS: the palette gained index-parallel `colourNames`
   (BONE WHITE … CHROME), `paintColourNames` ranks a look's most-used
   colours, the gazette's wire report (scripts/ladder-brief.mjs) now
   carries every player's `tone` + `colours` so Cole can write "the
   EMBER-and-CYAN machine", and stats.html rows wear paint chips decoded
   from the same doc field. Probed in `npm run check:paint`'s record
   stage (colour words + banner render both tones + no-banner-when-bare).
