/**
 * THE RECORD BOX, as data — RAVE RAID's 26 measured masters carried over
 * as metadata only (id, title, measured BPM, length, roles). The audio
 * files themselves arrive with the RAVE mode port (DESIGN.md §7); until
 * then the club's console and THE BALL's countdown plate can already
 * name every record on the shelf.
 */

export interface RecordMeta {
  id: string;
  title: string;
  /** Measured tempo (onset-flux autocorrelation, from the master). */
  bpm: number;
  seconds: number;
  /** Where RAVE RAID shelved it: 'raid' records are the charted sets. */
  roles: string[];
}

export const RECORDS: RecordMeta[] = [
  { id: 'sakupened', title: 'SAKUPENED', bpm: 133.964, seconds: 154.02, roles: ['raid'] },
  { id: 'combat', title: 'COMBAT', bpm: 135.0, seconds: 186.67, roles: ['raid'] },
  { id: 'discoball', title: 'DISCO BALL', bpm: 109.965, seconds: 126.62, roles: ['raid'] },
  { id: 'loop', title: 'LOOP', bpm: 150.0, seconds: 225.6, roles: ['raid'] },
  { id: 'capture', title: 'CAPTURE', bpm: 117.0, seconds: 225.64, roles: ['raid'] },
  { id: 'morning', title: 'MORNING', bpm: 96.665, seconds: 112.65, roles: ['raid'] },
  { id: 'money', title: 'MONEY', bpm: 97.994, seconds: 173.88, roles: ['raid'] },
  { id: 'target', title: 'TARGET', bpm: 91.0, seconds: 253.19, roles: ['raid'] },
  { id: 'breakcore', title: 'BREAKCORE', bpm: 174.0, seconds: 130.61, roles: ['raid'] },
  { id: 'dynasty', title: 'DYNASTY', bpm: 155.0, seconds: 139.2, roles: ['raid'] },
  { id: 'spread', title: 'SPREAD', bpm: 150.0, seconds: 244.81, roles: ['raid'] },
  { id: 'unity', title: 'UNITY', bpm: 117.0, seconds: 299.49, roles: ['raid'] },
  { id: 'assemble', title: 'ASSEMBLE', bpm: 125.0, seconds: 263.04, roles: ['raid'] },
  { id: 'infection', title: 'INFECTION', bpm: 138.0, seconds: 222.61, roles: ['raid'] },
  { id: 'giveit', title: 'GIVE IT TO ME', bpm: 112.0, seconds: 240.01, roles: ['raid'] },
  { id: 'fusion', title: 'FUSION', bpm: 122.0, seconds: 90.67, roles: ['raid'] },
  { id: 'braineater', title: 'BRAIN EATER', bpm: 149.959, seconds: 95.74, roles: ['raid'] },
  { id: 'credits', title: 'CREDITS', bpm: 70.0, seconds: 154.03, roles: ['credits'] },
  { id: 'chill', title: 'CHILL', bpm: 125.001, seconds: 232.32, roles: ['club'] },
  { id: 'futurevibe', title: 'FUTURE VIBE', bpm: 93.984, seconds: 147.54, roles: ['raid', 'club'] },
  { id: 'defense', title: 'DEFENSE', bpm: 125.996, seconds: 287.62, roles: ['raid'] },
  { id: 'awakening', title: 'AWAKENING', bpm: 165.0, seconds: 245.82, roles: ['raid'] },
  { id: 'swag', title: 'SWAG', bpm: 91.974, seconds: 127.01, roles: ['lobby'] },
  { id: 'eclipse', title: 'ECLIPSE', bpm: 70.0, seconds: 154.03, roles: ['lobby'] },
];

/** The raid-charted shelf — what a disco ball can carry. */
export const RAID_RECORDS: RecordMeta[] = RECORDS.filter((r) => r.roles.includes('raid'));

export function trackById(id: string): RecordMeta | undefined {
  return RECORDS.find((r) => r.id === id);
}
