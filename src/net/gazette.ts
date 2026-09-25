/**
 * THE GASKET GAZETTE — the daily paper of Gasket Cove, the beach township
 * where the metal "Clankers" come to scrap in a ring of tiki torches at
 * sundown. Written by its sheriff, Cole Ironside: a tin-star lawman who
 * despises the Clankers tearing up his sand (and who is, of course, a
 * Clanker himself — the salt air gets into his knee; he just won't admit
 * it). A scheduled Claude task reads the ladder every day, works out who
 * scrapped and who rose, and writes Cole's editorial in character,
 * dropping it into Firestore at `gazette/latest`.
 *
 * This module is the lobby's reader: it pulls the latest edition, and tracks
 * whether THIS player has read it yet so the lobby's paper button can wear a
 * red notification dot until they do. Rides the same Firestore project as
 * matchmaking + the leaderboard; loads firebase lazily like leaderboard.ts so
 * offline lobby players never pay for the bundle. Needs a Firestore rule
 * opening the `gazette` collection for read (the scheduled task writes it).
 */

import { FIREBASE_ENABLED, cloud, type Cloud } from './firebase.js';

export interface GazetteArticle {
  /** Monotonic edition number — drives the unread dot. */
  edition: number;
  /** "TUESDAY, JUNE 23" etc. (older editions carry a "GASKET TERRITORY —"
   *  prefix, which the page strips). */
  dateline: string;
  headline: string;
  subhead: string;
  /** The body copy; paragraphs split on blank lines. */
  body: string;
  byline: string;
  /** A one-word mood Cole's in today (e.g. OUTRAGE, GLEE) — stamped on the page. */
  mood: string;
  /** THE VOICE's sections (docs/gazette-voice.md §5): a WANTED poster for
   *  the top climber, the Sheriff's one-line NOTICE, and the WEATHER (it is
   *  always sundown on the cove). Older editions carry none — the page just ends at the byline. */
  wanted: { name: string; crime: string; reward: string } | null;
  notice: string;
  weather: string;
}

/**
 * THE WELCOME EDITION — the paper a newcomer finds on the wall, written
 * into the build rather than filed by the presses, so it is there before
 * the first daily lands and stays there whenever the presses are quiet
 * (no edition filed yet, or a headset with no cloud). Cole's voice, under
 * the voice's rules (docs/gazette-voice.md): it translates everything the
 * beach does into the cove's words, punches nobody down, and carries one
 * tin tell. Edition 0, so the first filed daily is still No. 1.
 */
export const WELCOME_EDITION: GazetteArticle = {
  edition: 0,
  dateline: 'ON THE BOARDWALK, ANY SUNDOWN',
  headline: 'WASHED UP? THIS OFFICE HAS SOME NOTES',
  subhead: 'A word of welcome to whoever just came in on the tide, from the man who has to live here.',
  body: [
    'You have washed up on the boardwalk, and Gasket Cove, through this office, notes your arrival. This was a quiet beach once. Then the metal came down from the old flats inland to do what it calls scrapping, and this office followed it, because somebody has to write it down.',
    'The sand inside the tiki torches is where the Clankers settle things: a scrap if it is personal, a pair scrap if it is social, a beach brawl if four of them cannot agree on who to hit. They stand on their decks and throw fire at one another until somebody is knocked off, and then they do it again. The roll is chalked on the board outside this office. Every one of them reads it before breakfast and claims not to.',
    'Out past the point, the titans come up out of the surf. RUSTHOOK, PISTONKAISER, VULTURE, JUGGERNAUT, and GOLIATH, who is the king of them; and GOOPLIATH, who is the tide, and not to be confused with the other one. Squads go out at sundown to beach one and come back round the point making the noise they make, holding up the time on the harbour clock like it means something. It does, to them.',
    'Up the beach there is a party round the bonfires, with glowsticks, and past that a place with a mirror ball. I do not go in. I am told the bell in there calls the scraps now too, which means the trouble has a bar.',
    'Paint yourself if you must; it keeps the salt off. Bolt what you like to your skull. The locker is by the terrace. The township will describe it accurately and without approval.',
    'Welcome to Gasket Cove. Keep your fire in the torch ring and out of the sea. My knuckles have gone a shade of orange overnight, which the doctor says is the sunset.',
  ].join('\n\n'),
  byline: 'Sheriff Cole Ironside',
  mood: 'WARY',
  wanted: { name: 'THE NEWCOMER', crime: 'Washing up. It always starts with washing up.', reward: '5 iron-dollars, on account' },
  notice: 'The boardwalk is not a place to scrap. Fights inside the torches, titans past the point, dancing up the beach, swimming at your own risk.',
  weather: 'Sundown. It was sundown when you washed up and it will be sundown when you leave.',
};

const SEEN_KEY = 'gg-seen-edition';
const WELCOME_KEY = 'gg-welcome-read';

function welcomeRead(): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    return false;
  }
}

/** Live gazette state the lobby reads each redraw. */
export const gazette = {
  article: null as GazetteArticle | null,
  status: FIREBASE_ENABLED ? 'loading…' : 'gazette offline',
  /** True while the latest edition is newer than the one this reader has seen. */
  unread: false,
  /**
   * A first visit reads the WELCOME EDITION whatever the presses have filed:
   * decided once, at boot, so the page does not swap out from under a
   * newcomer the moment the daily lands. From the next boot on, the daily
   * is the front page and the welcome only stands in when there is none.
   */
  welcomeFirst: !welcomeRead(),
};

/** The page on the wall right now: the daily, or the WELCOME EDITION —
 *  on a first visit, or whenever the presses have nothing filed. */
export function frontPage(): GazetteArticle | null {
  if (gazette.welcomeFirst) return WELCOME_EDITION;
  return gazette.article ?? (gazette.status === 'loading…' ? null : WELCOME_EDITION);
}

function seenEdition(): number {
  try {
    return parseInt(localStorage.getItem(SEEN_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * The shared connection (net/firebase.ts). The paper is world-readable, so this
 * would work without a sign-in — but sharing the one app and the one uid keeps
 * a single connection for the whole session rather than a second one just to
 * read the front page.
 */
async function firestore(): Promise<Cloud | null> {
  const c = await cloud();
  if (!c) gazette.status = 'gazette offline';
  return c;
}

/** A string field off the doc, capped — the page lays these out at fixed sizes. */
function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function readWanted(v: unknown): GazetteArticle['wanted'] {
  if (!v || typeof v !== 'object') return null;
  const w = v as Record<string, unknown>;
  const name = str(w.name, 24);
  if (!name) return null;
  return { name, crime: str(w.crime, 80), reward: str(w.reward, 40) };
}

let lastFetch = -Infinity;

/** Pull the latest edition (throttled — `force` bypasses the cooldown). */
export async function refreshGazette(force = false): Promise<void> {
  if (!force && performance.now() - lastFetch < 60_000) return;
  lastFetch = performance.now();
  const h = await firestore();
  if (!h) return;
  try {
    const snap = await h.fs.getDoc(h.fs.doc(h.db, 'gazette', 'latest'));
    if (!snap.exists()) {
      gazette.status = 'the presses are quiet';
      return;
    }
    const d = snap.data();
    gazette.article = {
      edition: (d.edition as number) ?? 0,
      dateline: (d.dateline as string) ?? '',
      headline: (d.headline as string) ?? '',
      subhead: (d.subhead as string) ?? '',
      body: (d.body as string) ?? '',
      byline: (d.byline as string) ?? 'Sheriff Cole Ironside',
      mood: (d.mood as string) ?? '',
      wanted: readWanted(d.wanted),
      notice: str(d.notice, 160),
      weather: str(d.weather, 90),
    };
    gazette.unread = gazette.article.edition > seenEdition();
    gazette.status = '';
  } catch {
    gazette.status = 'gazette unreachable';
  }
}

/** Pull the latest edition once at boot. */
export function initGazette(): void {
  void refreshGazette(true);
}

/** Mark the current edition read — clears the lobby button's red dot. */
export function markGazetteRead(): void {
  // The welcome counts as read the first time the paper is looked at; it
  // keeps the wall for the rest of THIS visit (welcomeFirst is a boot-time
  // decision) and the daily takes over from the next.
  try {
    localStorage.setItem(WELCOME_KEY, '1');
  } catch {
    /* storage unavailable — the newcomer gets welcomed again next boot */
  }
  if (!gazette.article) return;
  try {
    localStorage.setItem(SEEN_KEY, String(gazette.article.edition));
  } catch {
    /* storage unavailable — the dot just stays until next boot */
  }
  gazette.unread = false;
}
