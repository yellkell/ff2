/**
 * publish-gazette.mjs — files the finished edition.
 *
 * Usage:  node scripts/publish-gazette.mjs <article.json>
 *
 * Takes Sheriff Cole Ironside's finished article (written by the scheduled
 * Claude task from the ladder brief) and:
 *   1. writes it to Firestore `gazette/latest` with a bumped edition number
 *      and a publish timestamp — the lobby reads this and lights the red dot;
 *   2. rolls `gazette/_snapshot` forward to the CURRENT standings, so the
 *      next `ladder-brief.mjs` run diffs against today, not last week.
 *
 * The article JSON must have: headline, subhead, body, mood. Optional:
 * byline (defaults to Sheriff Cole Ironside), dateline (auto-built if absent).
 *
 * WRITES AS AN ADMIN, and has to. `gazette/latest` is what every player reads
 * on the lobby wall, so the security rules make it read-only to clients —
 * `allow write: if false` — and no web API key will get past that, by design.
 * The front page is not a thing a player gets to edit.
 *
 * So this script authenticates with a SERVICE ACCOUNT, which the Admin SDK
 * runs under and which the rules do not apply to. Point it at one with either:
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json   (a file), or
 *   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'  (the JSON
 *                                                    itself — for CI secrets)
 *
 * Generate one in the Firebase console under Project settings → Service
 * accounts → Generate new private key. Never commit it.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'flappy-ff9f6';

/** Resolve a service account from either supported source, or explain what's
 *  missing rather than failing with a bare PERMISSION_DENIED at the write. */
function credentials() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) {
    try {
      return cert(JSON.parse(inline));
    } catch {
      console.error('FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON.');
      process.exit(1);
    }
  }
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) {
    try {
      return cert(JSON.parse(readFileSync(path, 'utf8')));
    } catch {
      console.error(`GOOGLE_APPLICATION_CREDENTIALS points at ${path}, which could not be read as JSON.`);
      process.exit(1);
    }
  }
  console.error(
    [
      'No service account. The gazette is admin-written by design — the rules make',
      'gazette/latest read-only to clients. Set FIREBASE_SERVICE_ACCOUNT (the JSON)',
      'or GOOGLE_APPLICATION_CREDENTIALS (a path to it). See docs/gasket-gazette.md.',
    ].join('\n'),
  );
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/publish-gazette.mjs <article.json>');
  process.exit(1);
}

const article = JSON.parse(readFileSync(file, 'utf8'));
for (const field of ['headline', 'body']) {
  if (!article[field] || typeof article[field] !== 'string') {
    console.error(`article is missing a string "${field}"`);
    process.exit(1);
  }
}
// THE VOICE's sections (docs/gazette-voice.md §5): a WANTED poster, the
// Sheriff's NOTICE and the WEATHER line. Optional, but checked when present
// so the page never has to guess — sizes match what the lobby lays out.
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const wanted =
  article.wanted && typeof article.wanted === 'object'
    ? { name: str(article.wanted.name, 24), crime: str(article.wanted.crime, 80), reward: str(article.wanted.reward, 40) }
    : null;
if (wanted && !wanted.name) {
  console.error('wanted poster needs a name');
  process.exit(1);
}
const notice = str(article.notice, 160);
const weather = str(article.weather, 90);
if (article.mood && /\s/.test(String(article.mood).trim())) {
  console.error('mood must be ONE word');
  process.exit(1);
}
if (/\b(ELO|XP|players?|gamers?|the game|servers?)\b/i.test(article.body)) {
  console.error('the body breaks the fourth wall (ELO/XP/player/game/server) — see docs/gazette-voice.md §3');
  process.exit(1);
}

const db = getFirestore(
  getApps().length ? getApps()[0] : initializeApp({ credential: credentials(), projectId: PROJECT_ID }),
);

// Bump the edition off whatever's currently live.
const latestSnap = await db.doc('gazette/latest').get();
const edition = ((latestSnap.exists && latestSnap.data().edition) || 0) + 1;

const today = new Date();
// Just the date — the page template already prints "GASKET TERRITORY" in the
// masthead, so the dateline strip stays short.
const dateline =
  article.dateline ||
  today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

await db.doc('gazette/latest').set({
  edition,
  dateline,
  headline: article.headline,
  subhead: article.subhead ?? '',
  body: article.body,
  byline: article.byline ?? 'Sheriff Cole Ironside',
  mood: article.mood ?? '',
  wanted,
  notice,
  weather,
  publishedAt: FieldValue.serverTimestamp(),
});

// Archive a copy to the repo (gazette-archive/) — Firestore only keeps `latest`,
// so this is the permanent record of every edition. Committed by the gazette task.
{
  const n = String(edition).padStart(3, '0');
  mkdirSync('gazette-archive', { recursive: true });
  const record = {
    edition,
    dateline,
    headline: article.headline,
    subhead: article.subhead ?? '',
    body: article.body,
    byline: article.byline ?? 'Sheriff Cole Ironside',
    mood: article.mood ?? '',
    wanted,
    notice,
    weather,
  };
  writeFileSync(`gazette-archive/no-${n}.json`, JSON.stringify(record, null, 2) + '\n');
  const extras =
    (wanted ? `\n\n> **WANTED — ${wanted.name}.** ${wanted.crime} Reward: ${wanted.reward}.` : '') +
    (notice ? `\n\n> **NOTICE.** ${notice}` : '') +
    (weather ? `\n\n_Weather: ${weather}_` : '');
  const md = `# The Gasket Gazette — No. ${edition}\n\n**${dateline}** · _${record.mood}_\n\n## ${record.headline}\n\n*${record.subhead}*\n\n${record.body}\n\n— ${record.byline}${extras}\n`;
  writeFileSync(`gazette-archive/no-${n}.md`, md);
}

// Roll the snapshot forward to today's standings for tomorrow's diff.
const playersSnap = await db.collection('players').orderBy('xp', 'desc').limit(80).get();
const standings = playersSnap.docs.map((d) => {
  const x = d.data();
  return {
    uid: d.id,
    name: x.name ?? '???',
    xp: x.xp ?? 0,
    elo: x.elo ?? 1000,
    score: x.score ?? 0,
    duo: x.duo ?? 0,
    ffa: x.ffa ?? 0,
  };
});
await db.doc('gazette/_snapshot').set({
  edition,
  capturedAt: FieldValue.serverTimestamp(),
  players: standings,
});

console.log(`Filed edition No. ${edition} — "${article.headline}" (${standings.length} players snapshotted).`);
// Firestore's gRPC channel keeps the event loop alive; exit explicitly.
process.exit(0);
