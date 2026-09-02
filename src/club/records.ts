/**
 * THE RECORD BOX, as data — the shelf the club's console and THE BALL's
 * countdown plate read.
 *
 * It is DERIVED, not copied. The masters live with the rave (rave/audio/
 * tracks.ts: id, title, measured tempo, downbeat, length, loudness, roles,
 * and the audio itself), and this is the metadata slice of that same list.
 * It used to be a hand-copied table from before RAVE RAID was in the repo;
 * a hand copy of a list that is edited whenever a record is added is a list
 * that drifts, and the shelf naming a song the decks cannot play is the
 * exact bug that costs an evening to find.
 */

import { TRACKS } from '../rave/audio/tracks.js';

export interface RecordMeta {
  id: string;
  title: string;
  /** Measured tempo (onset-flux autocorrelation, from the master). */
  bpm: number;
  seconds: number;
  /** Where RAVE RAID shelved it: 'raid' records are the charted sets. */
  roles: string[];
}

export const RECORDS: RecordMeta[] = TRACKS.map((t) => ({
  id: t.id,
  title: t.title,
  bpm: t.bpm,
  seconds: t.seconds,
  roles: [...t.roles],
}));

/** The charted sets — what a caller may actually put on. */
export const RAID_RECORDS: RecordMeta[] = RECORDS.filter((r) => r.roles.includes('raid'));

export function trackById(id: string): RecordMeta | undefined {
  return RECORDS.find((r) => r.id === id);
}
