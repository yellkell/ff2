Write and publish today's edition of The Gasket Gazette.

Read `docs/gazette-voice.md` first — every line of the edition is written in
Sheriff Cole Ironside's voice, under its rules (never name who fell; never
break the fourth wall; translate every game term; one tin tell; the page's
length). Then:

1. Run `node scripts/ladder-brief.mjs` and read the wire report it prints:
   climbers and the busiest (never fallers), the raid wire (titans felled
   since the last edition, squads, clock times), new names in town, and for
   each fighter their `tone`, most-used paint `colours`, worn `gear` and the
   `pad` they stand on — in Gasket's own words already.
2. Write the edition as ONE JSON object to `/tmp/gazette.json` with exactly
   these fields: `headline`, `subhead`, `body`, `mood`, `wanted`
   (`{ name, crime, reward }`), `notice`, `weather`. Sizes: headline under 60
   characters; body 180–320 words in 3–5 blank-line-separated paragraphs;
   `wanted.crime` under 80 characters; `notice` under 160; `weather` one line.
   The lede is the wire's biggest change; the raid wire is paragraph two if
   there is one; the town's paint, ironmongery and decks are paragraph three;
   the grumble and the tin tell close it. A quiet wire still gets an edition
   (see the voice doc's second example) and a `wanted` for the top of the roll.
3. Run `node scripts/publish-gazette.mjs /tmp/gazette.json`. It validates the
   fields, bumps the edition number, writes `gazette/latest` (the lobby's
   red dot lights for every player), rolls `gazette/_snapshot` forward and
   archives a copy under `gazette-archive/`.
4. Commit the archive file it wrote with the message
   `Gazette No. <edition>: <headline>` and push.

Never publish a draft that names a fighter who fell, uses ELO/XP/rank/
"player"/"game", or ends with Cole admitting what he is.
