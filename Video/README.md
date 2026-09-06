# The trailer

A FIRE FIGHT 2 trailer cut to `Anticipation.m4a`, early-twomad style:
beat-synced hard cuts, zoom punches, Impact captions, emoji, deep-fried
freeze frames, chromatic aberration, bass-boost windows, a vine-boom
formula and the game's own announcer. Every frame of footage is the real
game, rendered headless with the GPU on and driven through its dev hooks.

Two cuts, one pile of footage:

| | edit | output |
| --- | --- | --- |
| the master | `edit/timeline.mjs` | `out/trailer.mp4` — 1:10, 1280x720 |
| the short | `edit/timeline-vertical.mjs` | `out/short.mp4` — 0:34, 1080x1920 |
| DID YOU KNOW | `edit/timeline-dyk.mjs` | `out/dyk.mp4` — 1:04, 1280x720 |
| DID YOU KNOW, the short | `edit/timeline-dyk-vertical.mjs` | `out/dyk-short.mp4` — 0:53, 1080x1920 |

The short is for Shorts / TikTok / Reels. It starts the music at 20.04 s,
which is both a downbeat on the master's grid and where the track steps up
into its loudest stretch, so its own grid is just `V(n) = n · BEAT`.

DID YOU KNOW is three facts in the same voice and on the same grid: the
club hosts everything (press Ⓐ on the floor and the desk comes up; the
RAVE tab picks a song, the FIGHT tab a fight or a TITAN RAID with its
tier and HARDCORE; HOST drops the disco ball, friends touch in, START deals
everyone across together), people can WATCH (the terrace, the WATCH chip,
fighters never hear the crowd's words), and raids (five seats, code + QR +
Discord, giant titans, GOLIATH's second life). Its footage comes from
`capture2.mjs` (a 2v2 ball, eight watchers put on the flats' terraces
through `mesh.watchers`, the raid lobby's browser and squad room drawn from
faked `app.lobbyRooms` / `mesh` state) and `capture3.mjs` (the desk itself:
the right Ⓐ tap that raises it, the song list and `song:discoball`,
`tier:blazing` and `raidhc`, each hosted, and the raid deal into the pit).
The desk is driven through `__gdr.menu.press`; a solo ball is called from
it and dealt with `__gdr.club.go()`.

Making it turned up two things in the game, both fixed in `src/`: terrace
watchers were full fighter bodies solved against the arena's floor plane,
so on the raised bank their heads floated a step above their shoulders and
their gloves hung along world axes; they are now CROWD FIGURES
(`arena/desert/crowdFigure.ts`): the rave's own groupie — the slender neon
dancer from `rave/game/avatars.ts` — one neon each, head from the wire,
hands that rise with the roar so the glowsticks go up and "hands up" is
something the fighters can see.

## Pipeline

```bash
npm run dev                         # vite (the scripts default to :5174 — set PREVIEW_BASE otherwise)
node Video/capture.mjs              # all clips → Video/cap/<clip>/f*.jpg + stamps.json
node Video/capture.mjs raid rave    # or just some
node Video/sfx.mjs                  # synthesised SFX → Video/sfx/*.wav
node Video/audio.mjs                # music + sfx per the timeline → Video/edit/mix.wav
node Video/stills.mjs 3.2 20.2      # eyeball single frames of the edit → Video/stills/
node Video/render.mjs               # compositor → ffmpeg → Video/out/trailer.mp4
```

The DID YOU KNOW footage and cut:

```bash
node Video/capture2.mjs disco raidlobby        # add --probe for framing stills instead
node Video/capture3.mjs                        # the desk: Ⓐ, the song, the tier + HARDCORE
node Video/audio.mjs --tl ./edit/timeline-dyk.mjs --out mix-dyk.wav
node Video/render.mjs --tl ./timeline-dyk.mjs --mix Video/edit/mix-dyk.wav --out Video/out/dyk.mp4
node Video/audio.mjs --tl ./edit/timeline-dyk-vertical.mjs --out mix-dyk-vertical.wav
node Video/render.mjs --tl ./timeline-dyk-vertical.mjs --w 1080 --h 1920 --mix Video/edit/mix-dyk-vertical.wav --out Video/out/dyk-short.mp4
```

The short runs the same scripts with the vertical edit passed in:

```bash
node Video/audio.mjs --tl ./edit/timeline-vertical.mjs --out mix-vertical.wav
node Video/stills.mjs --tl ./timeline-vertical.mjs --w 1080 --h 1920 --tag v 0.5 12.0
node Video/render.mjs --tl ./timeline-vertical.mjs --w 1080 --h 1920 --mix Video/edit/mix-vertical.wav --out Video/out/short.mp4
```

`MUSIC=path` overrides the track for `audio.mjs` (default is the Downloads copy).

## The pieces

- `lib.mjs` — launch headless Chromium with the GPU (`--use-angle=d3d11`, else
  it's SwiftShader at 8 fps), enter the game, hide the IWER emulator's
  furniture, and record the app canvas with the CDP screencast (59 fps, JPEG).
  Camera flights write the emulated headset pose; controller punches go
  through the real fireball input path.
- `capture.mjs` — the shot list. Faked crowds ride the game's own state:
  club members pushed into `net.members` + `clubPoses`, a 24-seat rave with
  painted `humans` and streamed `remotePoses`, a five-raider GOLIATH raid
  with `mesh.occupants` + `opponents` poses + `ballCommands` throws.
- `edit/timeline.mjs` — THE EDIT: shots, captions, punches, flashes, SFX
  events, boost windows, all on the beat grid `B(n) = 4.80 + n·0.47625`.
- `edit/compositor.html` — renders any time `t` of the edit to a canvas
  (zoom about a focus point, shake, chroma split, deep-fry through a 320x180
  crush, hue strobe, glitch slices, grain, vignette, the neon logo card).
  Resolution and edit come from the URL, so one compositor serves both cuts.
  A shot's `fit` decides how 16:9 footage sits in a 9:16 frame: `cover`
  fills and crops (with `pan`), `band` letterboxes over a blurred copy of
  itself and hands the captions the space above and below.
- `render.mjs` / `audio.mjs` / `stills.mjs` — drivers.
- `flashes.mjs`, `cuts.mjs` — footage analysis helpers (hit flashes, scene
  changes) used to place cuts.

## Gotchas learned the hard way

- The emulator's `controlMode` must be `'programmatic'` or the dev UI
  rewrites the headset and controller poses every frame and nothing you set
  sticks. Buttons need `setButtonValueImmediate`, not `updateButtonValue`.
- The game canvas lives inside IWER's container, not `#scene-container`;
  hide everything that isn't an ancestor of `IWER_DEVICE.appCanvas`.
- Frame timestamps are not `index / 60`: the arena load stalls the first
  second of a clip. Always place cuts by `stamps.json`, never by frame count.
- Solo titans get SCRAPPED partway through the orbit clips; the fight clips
  and the raid are where the bosses stay alive.
- `raid_low` and the tail of every camera flight carry heavy motion blur.
  For a still-legible frame (a freeze, a title beat) use a clip where the
  camera is slow: the boss intros, `raid_sky`, `rave_top`.
- **Do not edit anything under the vite root while a capture records.** A
  change to any file in vite's module graph (a timeline the compositor page
  once imported counts) broadcasts a full-reload to every connected page;
  the reload attempt ends the game page's XR session and the landing comes
  back over a game still running underneath, so the clip is a neon logo
  and an ENTER VR button. `lib.mjs` now refuses the `vite-hmr` socket on
  capture pages, but the rule still stands.
- A solo disco ball arms a 15 s deal timer that has been seen firing early
  in a scripted flow; `capture2.mjs` stretches that one `setTimeout` while
  the ball is filmed and deals with START. The lobby browser's live watch
  overwrites `app.lobbyRooms`, so the fake rooms are re-asserted on an
  interval while the browser is on screen.
- In the 9:16 cut a cover crop keeps only the middle third of the frame's
  width, so it only suits centre-composed shots. Captions stay above 0.79
  of the height, since TikTok and Reels paint their own UI over the bottom
  fifth.
