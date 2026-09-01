/**
 * ladder-brief.mjs — the Gasket Gazette's "wire report".
 *
 * Reads the live ladder (Firestore `players`) and the snapshot left by the
 * LAST published edition (`newspaper/_snapshot`), works out what changed since
 * — who fought, who climbed, who slid, who's new in town — and prints a
 * compact JSON brief to stdout.
 *
 * It writes NOTHING. The scheduled Claude task pipes this brief into Sheriff
 * Cole Ironside's pen; `publish-gazette.mjs` then files the finished edition
 * AND rolls the snapshot forward. Run: `node scripts/ladder-brief.mjs`.
 *
 * The ladder only stores running totals (no per-match log), so "games played"
 * is inferred from the XP delta — every bout, win or lose, banks ~25 XP
 * (see src/config.ts PROGRESSION), so gamesApprox = round(ΔXP / 25).
 */

import { initializeApp } from 'firebase/app';
import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, where } from 'firebase/firestore';

// Public web config (an identifier, not a secret — same as src/net/firebaseConfig.ts).
const firebaseConfig = {
  apiKey: 'AIzaSyA0NYO_w6uU0Fcc6nuVPitRQaGW3B6518E',
  authDomain: 'arfi-b68f9.firebaseapp.com',
  projectId: 'arfi-b68f9',
  storageBucket: 'arfi-b68f9.firebasestorage.app',
  messagingSenderId: '188374608574',
  appId: '1:188374608574:web:108250406138b5a5988cef',
};

const XP_PER_GAME = 25; // PROGRESSION.matchPlay — a bout banks ~25 XP win or lose
const ACTIVE_WINDOW_MS = 26 * 60 * 60 * 1000; // "fought recently" — a touch over a day

// THE PAINT's palette NAMES, index-parallel to src/config.ts PAINT.colourNames
// (this script is plain node and can't import the TS config — keep in step).
const PAINT_NAMES = [
  'BONE WHITE', 'JET BLACK', 'OXBLOOD', 'RUST', 'BRASS', 'OLIVE DRAB', 'NAVY', 'UMBER',
  'AMBER', 'EMBER', 'HOT MAGENTA', 'CYAN', 'VIOLET', 'LIME', 'TEAL', 'PINK',
  'ICE BLUE', 'VOLT YELLOW', 'MINT', 'SIGNAL RED',
  'GOLD LEAF', 'PEARL', 'VOID BLACK', 'CHROME',
];

/**
 * A player's painting as WORDS: decode their packed look (base64; one format
 * byte, then 8 bytes per placed unit — byte 1 of each unit is the palette
 * index; see docs/paint.md §3) into its most-used colour names, heaviest
 * first. Anything malformed → [] — an unpainted or unreadable body simply
 * has no colours to report.
 */
function paintColours(wire, max = 3) {
  if (typeof wire !== 'string' || wire.length === 0 || wire.length > 1024) return [];
  let bytes;
  try {
    bytes = Buffer.from(wire, 'base64');
  } catch {
    return [];
  }
  // Wire format 1 (chest + pelvis parts) or 2 (one body) — the colour byte
  // sits in the same place in both (docs/paint.md §3).
  if (bytes.length < 9 || (bytes.length - 1) % 8 !== 0 || (bytes[0] !== 1 && bytes[0] !== 2)) return [];
  const tally = new Map();
  for (let o = 1; o + 8 <= bytes.length; o += 8) {
    const c = bytes[o + 1];
    if (c < PAINT_NAMES.length) tally.set(c, (tally.get(c) ?? 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([c]) => PAINT_NAMES[c]);
}

// GEAR (src/avatar/gear.ts) and the DECKS (src/avatar/skins.ts) in Gasket's
// own words — the ids ride the player doc; keep these in step with the game.
const GEAR_WORDS = {
  crest: 'a CREST bolted nose to nape',
  antennae: 'twin ANTENNAE off the temples',
  horns: 'a bull\'s pair of HORNS',
  halo: 'a HALO, floating on nothing',
  mohawk: 'a MOHAWK of spikes',
  visorband: 'a VISOR BAND across the eyes',
  pauldrons: 'PAULDRONS on both shoulders',
  chestplate: 'a CHESTPLATE over the heart',
  collar: 'a COLLAR under the head',
  ridge: 'a RIDGE down the spine',
  belt: 'a BELT, buckled',
  epaulettes: 'EPAULETTES with a boss',
  cuffs: 'CUFFS at the wrists',
  knuckles: 'KNUCKLE spikes',
  gauntlets: 'GAUNTLETS over the fists',
};
const PAD_WORDS = {
  ember: 'SMOULDER (charred oak)',
  azure: 'AZURE (pale ash)',
  inferno: 'INFERNO (redwood)',
  walnut: 'WALNUT',
  slate: 'SLATE flagstones',
  marble: 'MARBLE',
  frost: 'FROST (river ice)',
  obsidian: 'OBSIDIAN (black glass)',
  jade: 'JADE',
  bullion: 'BULLION (gold leaf)',
  champion: 'the CHAMPION deck (crimson lacquer, gold inlay)',
  tidebreaker: 'the TIDEBREAKER deck (wet green stone)',
  blazing: 'the BLAZING deck (scorched boards)',
};

/** A player's worn gear (comma ids) as Cole's words, in slot order. */
function gearWords(wire) {
  if (typeof wire !== 'string' || wire.length > 48) return [];
  return wire.split(',').map((id) => GEAR_WORDS[id.trim()]).filter(Boolean);
}

const db = getFirestore(initializeApp(firebaseConfig));

/** Read the top players by cumulative XP, with the fields the paper cares about. */
async function readPlayers() {
  const snap = await getDocs(query(collection(db, 'players'), orderBy('xp', 'desc'), limit(50)));
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      uid: d.id,
      name: x.name ?? '???',
      xp: x.xp ?? 0,
      elo: x.elo ?? 1000,
      score: x.score ?? 0,
      duo: x.duo ?? 0,
      ffa: x.ffa ?? 0,
      look: x.look ?? '',
      tone: x.tone ?? 'blank',
      gear: x.gear ?? '',
      pad: x.pad ?? '',
      updatedAt: x.updatedAt?.toMillis?.() ?? 0,
    };
  });
}

/** The standings captured when the last edition was filed (or null on day one). */
async function readSnapshot() {
  const snap = await getDoc(doc(db, 'newspaper', '_snapshot'));
  if (!snap.exists()) return null;
  const data = snap.data();
  const byUid = {};
  for (const p of data.players ?? []) byUid[p.uid] = p;
  // Previous XP-rank, for climb/slide detection.
  const prevRank = {};
  [...(data.players ?? [])].sort((a, b) => b.xp - a.xp).forEach((p, i) => (prevRank[p.uid] = i + 1));
  return { byUid, prevRank, capturedAt: data.capturedAt ?? null, edition: data.edition ?? 0 };
}

/**
 * RAIDS since the last edition: squads that marched out of town and FELLED the
 * titans (`runRaid`) or the gel-beast GOOPLIATH (`runGoopliath`). Only
 * VICTORIOUS runs are ever recorded — the game posts a run when the last boss
 * falls, so a squad that got beaten leaves no wire at all. The brief therefore
 * carries triumphs only, which suits the paper's never-punch-down rule.
 *
 * Each doc: names[] (the whole squad, 2–5 callsigns), difficulty
 * (normal|hard|blazing — easy never posts), hardcore (titan raids only: no
 * healing between bosses), at (server clock when it fell).
 */
async function readRaids(sinceMs) {
  const cutoff = new Date(sinceMs);
  const pull = async (col, kind) => {
    try {
      // Range + orderBy on the SAME field — a single-field query, no composite
      // index needed on these collections.
      const snap = await getDocs(
        query(collection(db, col), where('at', '>', cutoff), orderBy('at', 'desc'), limit(20)),
      );
      return snap.docs.map((d) => {
        const x = d.data();
        const at = x.at?.toMillis?.() ?? 0;
        return {
          kind, // 'titans' — the five-machine gauntlet; 'goopliath' — the gel-beast
          squad: Array.isArray(x.names) ? x.names.map(String) : [],
          squadSize: Array.isArray(x.names) ? x.names.length : 0,
          difficulty: x.difficulty ?? 'normal',
          hardcore: !!x.hardcore,
          when: at ? new Date(at).toISOString() : null,
          hoursAgo: at ? Math.round((Date.now() - at) / 3_600_000) : null,
        };
      });
    } catch {
      return []; // a missing collection or closed rule starves this feed only
    }
  };
  const [titans, goop] = await Promise.all([pull('runRaid', 'titans'), pull('runGoopliath', 'goopliath')]);
  return [...titans, ...goop].sort((a, b) => (b.when ?? '').localeCompare(a.when ?? ''));
}

const players = await readPlayers();
const prev = await readSnapshot();
const now = Date.now();
// Raids since the last edition — or, on day one, the last ~day.
const raidsSince = prev?.capturedAt?.toMillis?.() ?? now - ACTIVE_WINDOW_MS;
const raids = await readRaids(raidsSince);

const rows = players.map((p, i) => {
  const before = prev?.byUid[p.uid];
  const xpDelta = before ? p.xp - before.xp : 0;
  const games = Math.max(0, Math.round(xpDelta / XP_PER_GAME));
  const prevRank = prev?.prevRank[p.uid] ?? null;
  return {
    rank: i + 1,
    name: p.name,
    xp: p.xp,
    elo: p.elo,
    score: p.score,
    // POINTS, not win/match counts: the 2v2 + FFA boards bank +11 per win and
    // +1 just for turning up, so these are running point totals.
    duoPoints: p.duo,
    ffaPoints: p.ffa,
    isNew: !before, // not in the last edition's snapshot — new to the ladder
    xpGained: xpDelta,
    gamesApprox: games,
    scoreGained: before ? p.score - before.score : 0,
    duoGained: before ? p.duo - before.duo : 0,
    ffaGained: before ? p.ffa - before.ffa : 0,
    // Climbs ONLY — we never surface who slid down the board. The paper does
    // not punch down at players who dropped a place; null = no climb to note.
    rankChange: prevRank && prevRank > i + 1 ? prevRank - (i + 1) : null,
    activeRecently: p.updatedAt > 0 && now - p.updatedAt < ACTIVE_WINDOW_MS,
    // THE PAINT: what this Clanker's iron actually looks like — base tone
    // plus their most-used paint colours (empty = still factory blank).
    tone: p.tone === 'onyx' ? 'onyx black' : 'bone white',
    colours: paintColours(p.look),
    // THE IRONMONGERY + THE DECK: what they bolted on, what they stand on.
    gear: gearWords(p.gear),
    pad: PAD_WORDS[p.pad] ?? '',
  };
});

const movers = rows.filter((r) => r.gamesApprox > 0 || r.activeRecently);
const totalGames = rows.reduce((s, r) => s + r.gamesApprox, 0);
// Climbers only — the paper celebrates who rose, never who slid.
const climbers = rows.filter((r) => (r.rankChange ?? 0) > 0).sort((a, b) => b.rankChange - a.rankChange);
const busiest = [...rows].sort((a, b) => b.gamesApprox - a.gamesApprox).filter((r) => r.gamesApprox > 0);

const brief = {
  date: new Date(now).toISOString().slice(0, 10),
  weekday: new Date(now).toLocaleDateString('en-US', { weekday: 'long' }),
  edition: (prev?.edition ?? 0) + 1,
  firstEdition: !prev,
  // Read this before quoting any number: the boards are scored in POINTS, not
  // bouts. Don't turn a point total into a match count.
  legend: {
    note: 'xp, score, elo, duoPoints and ffaPoints are POINT totals and ratings — NOT counts of matches played or won. The ONLY measure of how many bouts a player fought is gamesApprox (per player) and summary.totalGamesApprox (overall), and even those are estimates inferred from XP gained. Never describe a score/xp/elo/points figure as a number of matches, wins or bouts.',
    xp: 'cumulative experience points across every mode (drives the rank ladder) — points, not a match count',
    score: 'ranked 1v1 board POINTS (+20 per real win, +2 per bot win) — not a win or match tally',
    elo: 'hidden skill RATING, everyone starts at 1000 — a rating, not a count',
    duoPoints: '2v2 board POINTS (+11 per win, +1 per game) — not a win count',
    ffaPoints: 'FFA board POINTS (+11 per win, +1 per game) — not a win count',
    gamesApprox: 'ESTIMATED bouts fought since the last edition (round(xpGained / 25)) — THIS is the matches-played figure',
    raids:
      'squads that marched OUT of town and FELLED the wild machines since the last edition — kind "titans" is the five-boss raid (RUSTHOOK → GOLIATH), kind "goopliath" is the gel-beast. VICTORIES ONLY: beaten squads are never recorded, so no raid in this list failed. hardcore = no healing between titans; difficulty is normal/hard/blazing. Name the squad callsigns together — a raid is one deed by the whole posse.',
    gear: "each player's GEAR — the shapes bolted onto the body, already in Cole's words ('a CREST bolted nose to nape'). Empty = bare iron. Cole calls it ironmongery; it's vanity, never a score.",
    pad: "the DECK each player fights on, by material ('WALNUT', 'SLATE flagstones', 'BULLION (gold leaf)'). Empty = the house boards. The CHAMPION, TIDEBREAKER and BLAZING decks are EARNED, never bought — worth a line when someone stands on one.",
    colours:
      "each player's PAINT: `tone` is their body's base (bone white or onyx black) and `colours` their most-used paint colours, heaviest first. An empty colours list means a factory-blank body — unpainted iron, nobody's made it theirs yet. Cole can describe a champion by their war paint ('the EMBER-and-CYAN machine', 'that GOLD LEAF dandy'); colours are decoration the players chose, never a score.",
  },
  // Cole's favourite kind of day: nobody threw a single iron ball — and no
  // war party went monster-hunting in the wastes either.
  nobodyFought: totalGames === 0 && movers.length === 0 && raids.length === 0,
  // The raid wire: every squad that felled the titans or the tide since the
  // last edition, newest first.
  raids,
  summary: {
    activePlayers: movers.length,
    totalGamesApprox: totalGames,
    raidsCleared: raids.length,
    newcomers: rows.filter((r) => r.isNew).map((r) => r.name),
    topClimber: climbers[0] ?? null,
    busiest: busiest[0] ?? null,
    leader: rows[0] ?? null,
  },
  standings: rows.slice(0, 12),
};

process.stdout.write(JSON.stringify(brief, null, 2) + '\n');
// Firestore's gRPC channel keeps the event loop alive; exit explicitly.
process.exit(0);
