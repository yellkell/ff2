/**
 * ROOMS — every lobby in the app, in one collection.
 *
 * Five collections grew apart on the old project doing very nearly the same
 * job: `lobbies` (1v1 quick match), `privateLobbies` (1v1 behind a code),
 * `rankedRooms` (the 1v1 server browser), `arcadeRooms` (2v2, FFA and raid)
 * and `privateRooms` (the same mesh behind a code). They had the same document
 * shape and — read firestore.rules on the old project — literally identical
 * security rules, copied five times. What actually differed between them was
 * two facts: what kind of bout it is, and whether it is listed publicly.
 *
 * So: one collection, and those two facts are FIELDS.
 *
 *     rooms/{roomId}
 *       mode        'duel' | 'ranked' | 'arcade' | 'raid' | 'rave' | 'pub'
 *       visibility  'public' | 'private'
 *
 * A PRIVATE room's document id IS its five-digit code, which is what makes
 * "type the code your mate read out" a single direct fetch rather than a
 * query. A PUBLIC room gets a generated id and is found by querying.
 *
 * WHY THIS IS WORTH THE CHURN: a bug fixed in one of the five never reached
 * the other four. Ghost reaping, clock-skew correction and ICE-candidate
 * buffering were each fixed in one or two of them and left broken in the rest
 * — the August '26 "quick match is dead" outage was ghosts filling the scan
 * window in exactly one collection. One collection means one place to fix it.
 *
 * EXPIRY IS NOT OPTIONAL. Every room carries `expiresAt`, and the rules refuse
 * a write without it, because the failure mode of a leaked room is not "a bit
 * of clutter" — a scan reads only the first `limit()` documents, so enough
 * ghosts sorting ahead of the live rooms means nobody ever pairs again. A
 * Firestore TTL policy on the field sweeps them; readers ignore anything past
 * its expiry so a ghost is invisible even before the sweep runs.
 */

import { cloud } from './firebase.js';
import type { Cloud } from './firebase.js';

/** What kind of bout a room is for. Mirrored in firestore.rules. */
export type RoomMode = 'duel' | 'ranked' | 'arcade' | 'raid' | 'rave' | 'pub';

/** Listed in the browser, or reachable only by its code. */
export type RoomVisibility = 'public' | 'private';

/**
 * How long a room stays good without a heartbeat. Generous next to the beat
 * interval so one missed write on a flaky headset doesn't evict a live host
 * mid-handshake.
 */
export const ROOM_TTL_MS = 90_000;

/** A private room outlives a public one — a code gets read out over voice
 *  chat, typed wrong, typed again. It should still be there. */
export const PRIVATE_TTL_MS = 10 * 60 * 1000;

/** How often a host re-stamps a room it is holding open. */
export const BEAT_MS = 20_000;

export interface RoomDoc {
  mode: RoomMode;
  visibility: RoomVisibility;
  /** The host's uid. */
  host: string;
  /** Display name of the host, for the room browser. */
  hostName?: string;
  /** Free seats remaining, for the browser's "2/4" column. */
  seats?: number;
  taken?: number;
  /** Mode-specific extras — difficulty, track, map. Never used for matching
   *  logic here; the caller reads what it put in. */
  meta?: Record<string, unknown>;
  /** Still accepting joiners? A claimed duel flips this false. */
  open?: boolean;
  at: number;
  expiresAt: number;
}

/** A room as read back, with its id. */
export interface Room extends RoomDoc {
  id: string;
}

/* ── addressing ───────────────────────────────────────────────────────── */

/** The rooms collection. */
export function roomsCol(c: Cloud) {
  return c.fs.collection(c.db, 'rooms');
}

/** One room by id. For a private room, the id is the code. */
export function roomRef(c: Cloud, id: string) {
  return c.fs.doc(c.db, 'rooms', id);
}

/**
 * The signalling path for one pair of peers inside a room. Both halves of a
 * handshake write here — `pair` is a stable key both sides can compute (seat
 * numbers for the mesh, 'duel' for a 1v1) so neither has to be told it.
 */
export function sigRef(c: Cloud, roomId: string, pair: string) {
  return c.fs.doc(c.db, 'rooms', roomId, 'sig', pair);
}

/** ICE candidates for one side of one pair. `side` keeps the two directions
 *  apart so a peer never tries to add its own candidates. */
export function candidatesCol(c: Cloud, roomId: string, pair: string, side: 'caller' | 'callee') {
  return c.fs.collection(c.db, 'rooms', roomId, 'sig', pair, side);
}

/* ── the stamps every write needs ─────────────────────────────────────── */

/**
 * The two fields the rules insist on, in one place so no write site can
 * forget them. `private` rooms get the longer lease.
 */
export function stamps(visibility: RoomVisibility, now = Date.now()) {
  return {
    at: now,
    expiresAt: now + (visibility === 'private' ? PRIVATE_TTL_MS : ROOM_TTL_MS),
  };
}

/** Is this room still alive, by its own clock? Readers apply this so a ghost
 *  is invisible in the window before Firestore's TTL sweep catches up. */
export function alive(data: Partial<RoomDoc> | undefined, now = Date.now()): boolean {
  return typeof data?.expiresAt === 'number' && data.expiresAt > now;
}

/* ── opening and holding a room ───────────────────────────────────────── */

/**
 * Open a public room and return its id. The caller heartbeats it with
 * `hold()` and closes it with `close()`.
 */
export async function host(mode: RoomMode, doc: Partial<RoomDoc> = {}): Promise<string | null> {
  const c = await cloud();
  if (!c) return null;
  try {
    const ref = c.fs.doc(roomsCol(c));
    await c.fs.setDoc(ref, {
      open: true,
      ...doc,
      mode,
      visibility: 'public',
      host: c.uid,
      ...stamps('public'),
    });
    return ref.id;
  } catch {
    return null;
  }
}

/**
 * Claim a five-digit code for a private room. Runs in a transaction so two
 * headsets picking the same code at the same moment cannot both win it —
 * one creates, the other sees the collision and tries another number.
 *
 * Returns the code it actually took, or null if it could not find a free one.
 */
export async function hostPrivate(mode: RoomMode, doc: Partial<RoomDoc> = {}, tries = 8): Promise<string | null> {
  const c = await cloud();
  if (!c) return null;
  const { runTransaction } = c.fs;

  for (let i = 0; i < tries; i++) {
    const code = String(Math.floor(10000 + Math.random() * 90000));
    try {
      const ok = await runTransaction(c.db, async (tx) => {
        const ref = roomRef(c, code);
        const snap = await tx.get(ref);
        // A code whose room has expired is free to take again — otherwise the
        // pool of five-digit codes would only ever shrink.
        if (snap.exists() && alive(snap.data() as RoomDoc)) return false;
        tx.set(ref, {
          open: true,
          ...doc,
          mode,
          visibility: 'private',
          host: c.uid,
          ...stamps('private'),
        });
        return true;
      });
      if (ok) return code;
    } catch {
      // A transaction can fail on contention alone; that is what the loop is
      // for. A hard failure (no network) fails every try and falls out below.
    }
  }
  return null;
}

/** Fetch one room by id — the "type the code" path. Null if it never existed
 *  or has expired. */
export async function findRoom(id: string): Promise<Room | null> {
  const c = await cloud();
  if (!c) return null;
  try {
    const snap = await c.fs.getDoc(roomRef(c, id));
    if (!snap.exists()) return null;
    const data = snap.data() as RoomDoc;
    if (!alive(data)) return null;
    return { id: snap.id, ...data };
  } catch {
    return null;
  }
}

/**
 * List open public rooms of one mode, freshest lease first. The `expiresAt`
 * filter does double duty: it hides ghosts, and because it orders the scan it
 * also guarantees the live rooms are the ones inside the `limit()` window —
 * which is precisely the failure the old per-collection scans hit.
 *
 * Needs the composite index in firestore.indexes.json.
 */
export async function listRooms(mode: RoomMode, max = 20): Promise<Room[]> {
  const c = await cloud();
  if (!c) return [];
  try {
    const { getDocs, limit, orderBy, query, where } = c.fs;
    const snap = await getDocs(
      query(
        roomsCol(c),
        where('mode', '==', mode),
        where('visibility', '==', 'public'),
        where('expiresAt', '>', Date.now()),
        orderBy('expiresAt', 'desc'),
        limit(max),
      ),
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as RoomDoc) }));
  } catch {
    return [];
  }
}

/**
 * Keep a room alive. Returns a stop function; call it when the room closes.
 * A host that stops beating is swept, which is the whole ghost story.
 */
export function hold(id: string, visibility: RoomVisibility): () => void {
  const timer = setInterval(() => {
    void (async () => {
      const c = await cloud();
      if (!c) return;
      try {
        await c.fs.updateDoc(roomRef(c, id), stamps(visibility));
      } catch {
        /* a missed beat is survivable — the TTL is several beats long */
      }
    })();
  }, BEAT_MS);
  return () => clearInterval(timer);
}

/** Shut a room down. Best effort — a crashed host never gets here, which is
 *  what `expiresAt` is for. */
export async function close(id: string): Promise<void> {
  const c = await cloud();
  if (!c) return;
  try {
    await c.fs.deleteDoc(roomRef(c, id));
  } catch {
    /* the TTL will get it */
  }
}
