/**
 * The club's slice of RAVE RAID's palette, carried over with the venue
 * (FF2's own config.ts PALETTE speaks hazard-amber industrial; the club
 * keeps the disco language it was built in — magenta and cyan are the
 * PARTY's colours, never danger's, exactly as the RR palette law says).
 */

export const PALETTE = {
  magenta: 0xff2ad5,
  cyan: 0x4fb7ff,
};

/** Hue (0..1) → RGB int at a given HSL-ish lightness — RR's helper, used
 *  by the club for per-guest tints. */
export function hueToColor(hue: number, light = 0.55): number {
  const h = (((hue % 1) + 1) % 1) * 6;
  const l = Math.max(0.2, Math.min(0.9, light));
  const c = (1 - Math.abs(2 * l - 1)) * 1;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 1) [r, g, b] = [c, x, 0];
  else if (h < 2) [r, g, b] = [x, c, 0];
  else if (h < 3) [r, g, b] = [0, c, x];
  else if (h < 4) [r, g, b] = [0, x, c];
  else if (h < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255);
}
