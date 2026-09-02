/**
 * PRESENCE — who is about, and which room they are in.
 *
 * The social area's heartbeat. One document per player, rewritten as you move
 * between the menu, the club, the pub, the arena and a rave set, so that any
 * face of the app can answer "is anyone around?" before you commit to walking
 * through a door into an empty room. That question was previously unanswerable
 * without joining, which is exactly the wrong order.
 *
 * This is DELIBERATELY COARSE. It is a foyer sign, not a tracker: your name,
 * the room you are in, and when you last checked in. Where you are STANDING —
 * pose, hands, voice — never comes near Firestore; that rides the relay and
 * peer-to-peer WebRTC at 10 Hz, and putting it here would be both ruinous per
 * document read and far too slow to look like a person moving.
 *
 * BEATING costs one write a minute per player, and the read the club does is
 * one query. Both are bounded and both are cheap, which is the only reason
 * presence belongs in Firestore at all.
 *
 * LEAVING is best-effort. A headset that crashes, sleeps or walks out of wifi
 * range never gets to say goodbye, so a stale record must expire on its own:
 * every write carries `expiresAt`, a Firestore TTL policy on that field sweeps
 * the document, and readers additionally ignore anything past its expiry so a
 * ghost never appears even in the minutes before the sweep catches up.
 */

import { cloud, cloudUid } from './firebase.js';

/** The places a player can be. Mirrored in firestore.rules — adding one here
 *  without adding it there means every write from that room is denied. */
export type Where = 'menu' | 'club' | 'pub' | 'arena' | 'rave';

/** How often a present player re-stamps their record. */
const BEAT_MS = 45_000;
/** How long a record stays good. Comfortably more than two beats, so one
 *  missed write on a flaky connection doesn't blink you out of the room. */
const TTL_MS = 150_000;
/** A roster older than this refetches when something asks again. */
const ROSTER_TTL_MS = 20_000;

export interface Present {
  uid: string;
  name: string;
  where: Where;
  /** Packed look/gear, so the club can show a recognisable silhouette in a
   *  list without a second fetch of the full player document. */
  look: string;
  /** Wall-clock ms of their last beat. */
  at: number;
  isMe: boolean;
}

/** Bumped whenever the roster changes — menus repaint when it moves. */
export const presence = { dirty: 0, state: 'idle' as 'idle' | 'loading' | 'ready' | 'off' };

let roster: Present[] = [];
let fetchedAt = 0;
let beating = 0;
let mine: { name: string; where: Where; look: string } | null = null;

/** Everyone currently checked in, freshest first. Synchronous — paint from it. */
export function presentPlayers(): Present[] {
  return roster;
}

/** How many are in a given room right now. */
export function headcount(where: Where): number {
  return roster.filter((p) => p.where === where).length;
}

/* ── checking in ──────────────────────────────────────────────────────── */

async function beat(): Promise<void> {
  if (!mine) return;
  const c = await cloud();
  if (!c) return;
  try {
    const { doc, setDoc } = c.fs;
    const now = Date.now();
    await setDoc(doc(c.db, 'presence', c.uid), {
      name: mine.name.slice(0, 16),
      where: mine.where,
      look: mine.look.slice(0, 128),
      at: now,
      expiresAt: now + TTL_MS,
    });
  } catch {
    // A missed beat is survivable — the next one is 45 seconds away and the
    // TTL is generous enough to ride out a few. Nothing to tell the player.
  }
}

/**
 * Announce that you are in a room, and keep saying so until you enter another
 * one or call `leave()`. Safe to call on every room change; re-entering the
 * room you are already in just updates the stamp.
 */
export function enter(where: Where, name: string, look = ''): void {
  const changed = !mine || mine.where !== where || mine.name !== name || mine.look !== look;
  mine = { name, where, look };
  if (!changed && beating) return;

  void beat();
  if (!beating) {
    beating = setInterval(() => void beat(), BEAT_MS) as unknown as number;
  }
}

/**
 * Stand down — stop beating and remove the record. Best effort by nature: a
 * headset that crashes never reaches this, which is what the TTL is for.
 */
export function leave(): void {
  if (beating) {
    clearInterval(beating);
    beating = 0;
  }
  mine = null;
  void (async () => {
    const c = await cloud();
    if (!c) return;
    try {
      await c.fs.deleteDoc(c.fs.doc(c.db, 'presence', c.uid));
    } catch {
      /* the TTL will get it */
    }
  })();
}

// A tab closing is the common case for "left without saying so", and the
// browser gives us one last synchronous moment to try. It often doesn't make
// it out — that is fine, the TTL is the real answer — but when it does the
// room updates immediately instead of a couple of minutes later.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (mine) leave();
  });
}

/* ── reading the room ─────────────────────────────────────────────────── */

/**
 * Refresh the roster. Cheap to call repeatedly — a fetch inside the TTL is a
 * no-op. Records past their expiry are dropped on read, so a ghost never shows
 * even in the window before Firestore's own sweep catches up.
 */
export async function fetchPresence(force = false): Promise<void> {
  if (!force && presence.state === 'ready' && Date.now() - fetchedAt < ROSTER_TTL_MS) return;
  if (presence.state === 'loading') return;

  presence.state = 'loading';
  presence.dirty++;

  const c = await cloud();
  if (!c) {
    presence.state = 'off';
    roster = [];
    fetchedAt = Date.now();
    presence.dirty++;
    return;
  }

  try {
    const { collection, getDocs, limit, orderBy, query, where: whereFn } = c.fs;
    const now = Date.now();
    const snap = await getDocs(
      query(
        collection(c.db, 'presence'),
        whereFn('expiresAt', '>', now),
        orderBy('expiresAt', 'desc'),
        limit(200),
      ),
    );
    const me = cloudUid();
    roster = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        uid: d.id,
        name: typeof data.name === 'string' ? data.name : '—',
        where: (typeof data.where === 'string' ? data.where : 'menu') as Where,
        look: typeof data.look === 'string' ? data.look : '',
        at: typeof data.at === 'number' ? data.at : 0,
        isMe: d.id === me,
      };
    });
    presence.state = 'ready';
  } catch {
    presence.state = 'off';
    roster = [];
  }
  fetchedAt = Date.now();
  presence.dirty++;
}
