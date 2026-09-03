# The Gasket Gazette

A daily, AI-written in-world newspaper. **Sheriff Cole Ironside** — a tin-star
lawman of the frontier town of **Gasket**, who despises the metal "Clankers"
(the players) wrecking his peace, and who is secretly a Clanker himself in
furious denial — reads the ladder each day and files an editorial. It lands in
the lobby behind a small round paper button above the right-hand panel; the
button wears a **red notification dot** until you've read the latest edition.

**The voice lives in [`gazette-voice.md`](gazette-voice.md)** — who Cole is,
how he sounds, what he never does, his dictionary (the game's words →
Gasket's), the shape of an edition and two worked examples. The daily
command (`.claude/commands/daily-gazette.md`, in this repo now) writes
from it.

Since THE VOICE phase an edition also carries three sections the lobby
page lays out under the byline: a **WANTED** poster for the top climber
(`{ name, crime, reward }`), the Sheriff's one-line **NOTICE**, and the
**WEATHER** (it is always dusk). The wire report grew each fighter's
**gear** (the shapes bolted on, already in Cole's words) and **pad** (the
deck they stand on, by material) beside their paint colours — and learned
the paint's format-2 wire, which it had been rejecting since the body
merged (every painted fighter read as blank for a while).

## How it fits together

```
 scheduled Claude task (daily)
   └─ /daily-gazette  (.claude/commands/daily-gazette.md)
        1. node scripts/ladder-brief.mjs    → reads Firestore `players`,
           diffs `gazette/_snapshot`, pulls the RAID WIRE (`runRaid` +
           `runGoopliath` clears since the last edition — victories only, the
           game never records a beaten squad), prints a JSON "wire report"
           (climbers + busiest only — never who fell; the paper won't punch down).
           Since THE PAINT (docs/paint.md P4) each row also carries the
           player's `tone` + most-used paint `colours`, so Cole can describe
           a champion by their war paint ("the EMBER-and-CYAN machine")
        2. Claude writes the editorial in Sheriff Cole Ironside's voice
        3. node scripts/publish-gazette.mjs → writes `gazette/latest`
           (edition bumped, publish timestamp) + rolls `_snapshot` forward

 game client (lobby)
   └─ src/net/gazette.ts   reads `gazette/latest`, tracks unread vs a
                           localStorage "seen edition"
   └─ src/menu/menu.ts     the round paper button (red dot) + the front page
   └─ src/systems/MenuSystem.ts  opens/closes it, marks read, refreshes
```

Because delivery is a **live Firestore doc** (not a committed file), a new
edition appears the next time a player lands in the lobby — no rebuild/redeploy
— which is what lets the button show the "new edition" dot.

## Firestore data

- `gazette/latest` — the live edition the game reads:
  `{ edition, dateline, headline, subhead, body, byline, mood, wanted?,
  notice?, weather?, publishedAt }`.
- `gazette/_snapshot` — internal generator state: the ladder standings as of
  the last published edition, used to compute "what changed" for the next one.

### Credentials

The two halves of the task authenticate differently, and deliberately so.

**`ladder-brief.mjs` reads, and needs nothing.** Everything it touches is
world-readable under the shipped rules: `players`, `gazette/_snapshot`, and the
two raid boards. It runs on the public web config.

**`publish-gazette.mjs` writes, and needs a service account.** `gazette/latest`
is what every player reads off the lobby wall, so the rules make it read-only
to clients (`allow write: if false`) — a web API key will not get past that,
which is the point. The publisher uses the Admin SDK instead, which service
accounts run under and the rules do not apply to.

Point it at a key with either:

```bash
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account", ...}'
```

or

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

Generate one in the Firebase console under **Project settings → Service
accounts → Generate new private key**. It is a real credential — never commit
it, and prefer the env var over a file on a shared machine.

### The rules it relies on

Shipped in `firestore.rules`; nothing extra to add.

```
// The paper reads the ladder to write the editorial. World-readable.
match /players/{uid} { allow read: if true; }

// The edition the game reads + the generator's snapshot state.
// Admin-written, client-read-only.
match /gazette/{doc} {
  allow read: if true;
  allow write: if false;
}

// The raid wire — the boards the editorial reports on. World-readable;
// a player may only write their OWN row, and only to improve it.
match /boards/{board}/rows/{uid} { allow read: if true; ... }
```

(Hackathon-grade, matching the existing `lobbies` / `arcadeRooms` rules —
tighten with App Check before a big public release.)

> **Heads up:** as of writing, a plain unauthenticated read of `players`
> returns `permission-denied` from outside the deployed client, so the
> `players` read rule above isn't open yet — add it (or the wire-report step
> will fail with that error). The Firebase web API key in the scripts is a
> public identifier, not a secret (the same one shipped in
> `src/net/firebaseConfig.ts`); access is governed entirely by these rules.

## Setting up the daily schedule

The article generation is meant to run as a **Claude scheduled task** (Claude
Code on the web). This repo ships everything the task needs; you wire the
schedule itself in the Claude Code web app:

1. Create a scheduled session/trigger on this repository (branch
   `claude/fire-fight-ui-gameplay-1zrr9b`, or wherever this lands).
2. Set it to run roughly once a day.
3. Set the prompt to: **`/daily-gazette`**
4. Make sure the environment's **network policy allows outbound HTTPS to
   Firebase/Google APIs** (the scripts read and write Firestore).

That's it — each run reads the ladder, writes the day's edition, and the dot
lights up for every player.

## Running it by hand

```
node scripts/ladder-brief.mjs            # see today's wire report
# ...write /tmp/gazette.json in Cole's voice...
node scripts/publish-gazette.mjs /tmp/gazette.json
```
