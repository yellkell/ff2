/**
 * THE BRIDGE — the one seam between the rave and whatever is hosting it.
 *
 * The rave runs in two places: on its own page (rave/main.ts), and inside
 * FIRE FIGHT 2's arena world, mounted in-session (rave/experience.ts). Its
 * board carries a FIRE FIGHT door either way, and this is how the door
 * finds out where it leads. Standalone, nothing is installed and the door
 * falls back to a page hop; in the arena the host installs a handler and
 * the door is a curtain, not a browser.
 */

export const raveBridge: {
  /** Back to the arena's lobby, in-session. Absent on the standalone page. */
  leaveToArena?: () => void;
} = {};
