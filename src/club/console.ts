/**
 * THE CONSOLE — the club floor's A-button menu (DESIGN.md §3.1).
 *
 * One kit panel, summoned at the wrist like RAVE RAID's social desk, with
 * TWO TABS along the top:
 *
 *   FIGHT — start FIRE FIGHT matches and raids from the floor:
 *           1V1 · 2V2 · FFA · TITAN RAID.
 *   RAVE  — the record shelf: RAVE RAID's raid-charted songs and the
 *           difficulty chips.
 *
 * Either way, the CTA is the same verb: CALL THE BALL. Everything in this
 * club launches via DISCO BALLS — pick a fight or pick a record, press
 * CALL, and a mirror ball is winched down out of the ceiling carrying
 * your call; whoever touches in rides along when it hits zero (fighters
 * to the platforms, everyone else to the audience ground — the club
 * itself contains no arena, ever).
 *
 * This module is the console's FACE and local state only: tab, picked
 * game, picked record, difficulty, list scroll. The ids it paints are
 * namespaced `club:*`; consoleClick() handles every local pick itself and
 * returns false for `club:call`, which belongs to the ball system (the
 * relay-owned drop/countdown/deal — next on this phase).
 */

import { KIT, type PanelButton } from '../ui/kit/panel.js';
import { font } from '../ui/kit/fonts.js';
import { RAID_RECORDS } from './records.js';

export type ConsoleTab = 'fight' | 'rave';
export type FightCall = '1v1' | '2v2' | 'ffa' | 'raid';

export const DIFF_LABELS = ['EASY', 'NORMAL', 'HARD', 'EXPERT'] as const;

/** Everything the console remembers between repaints. */
export const consoleState = {
  tab: 'fight' as ConsoleTab,
  game: '1v1' as FightCall,
  song: RAID_RECORDS[0]?.id ?? '',
  diff: 1,
  scroll: 0,
  /** Bumped on every local pick — hosts repaint when it moves. */
  version: 0,
};

/** Canvas geometry (one portrait panel, RAVE RAID desk proportions). */
export const CONSOLE_W = 768;
export const CONSOLE_H = 1216;
const X = 64;
const WIDE = CONSOLE_W - X * 2;
const LIST_Y = 400;
const ROW_H = 74;
const VISIBLE_ROWS = 7;

export interface ConsoleFace {
  title: string;
  body: (g: CanvasRenderingContext2D) => void;
  buttons: PanelButton[];
}

const FIGHTS: Array<{ id: FightCall; label: string; sub: string }> = [
  { id: '1v1', label: '1V1', sub: 'the duel' },
  { id: '2v2', label: '2V2', sub: 'tag brawl' },
  { id: 'ffa', label: 'FFA', sub: 'last one up' },
  { id: 'raid', label: 'TITAN RAID', sub: 'the gauntlet, together' },
];

function tabs(): PanelButton[] {
  const w = (WIDE - 24) / 2;
  return [
    { id: 'club:tab-fight', label: 'FIGHT', x: X, y: 128, w, h: 84, small: true, selected: consoleState.tab === 'fight' },
    { id: 'club:tab-rave', label: 'RAVE', x: X + w + 24, y: 128, w, h: 84, small: true, selected: consoleState.tab === 'rave' },
  ];
}

function callButton(sub: string): PanelButton {
  return {
    id: 'club:call',
    label: 'CALL THE BALL',
    sub,
    x: X, y: CONSOLE_H - 190, w: WIDE, h: 128,
    primary: true,
  };
}

function fightFace(): ConsoleFace {
  const buttons: PanelButton[] = [...tabs()];
  const colW = (WIDE - 24) / 2;
  FIGHTS.forEach((f, i) => {
    buttons.push({
      id: `club:game-${f.id}`,
      label: f.label,
      sub: f.sub,
      x: X + (i % 2) * (colW + 24),
      y: 300 + Math.floor(i / 2) * 168,
      w: colW,
      h: 144,
      selected: consoleState.game === f.id,
    });
  });
  const picked = FIGHTS.find((f) => f.id === consoleState.game)!;
  buttons.push(callButton(`${picked.label} — touch the ball to ride along`));
  return {
    title: 'THE FLOOR',
    body: (g) => {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = font(500, 26);
      g.fillStyle = KIT.faint;
      g.fillText('a mirror ball comes down — the floor never closes', CONSOLE_W / 2, 254);
      g.fillText('fighters drop to the platforms, everyone else to the rail', CONSOLE_W / 2, 700);
    },
    buttons,
  };
}

function raveFace(): ConsoleFace {
  const buttons: PanelButton[] = [...tabs()];
  // Difficulty chips.
  const chipW = (WIDE - 3 * 16) / 4;
  DIFF_LABELS.forEach((d, i) => {
    buttons.push({
      id: `club:diff-${i}`,
      label: d,
      x: X + i * (chipW + 16),
      y: 250,
      w: chipW,
      h: 72,
      small: true,
      px: 22,
      selected: consoleState.diff === i,
    });
  });
  // The record shelf: ghost rows, painted by the body on the kit's hover clock.
  const start = consoleState.scroll;
  const rows = RAID_RECORDS.slice(start, start + VISIBLE_ROWS);
  rows.forEach((r, i) => {
    buttons.push({
      id: `club:song-${r.id}`,
      label: r.title,
      ghost: true,
      x: X, y: LIST_Y + i * ROW_H, w: WIDE, h: ROW_H - 8,
    });
  });
  if (start > 0) buttons.push({ id: 'club:songs-up', label: '▲', x: CONSOLE_W - 118, y: LIST_Y - 66, w: 56, h: 52, small: true, px: 22 });
  if (start + VISIBLE_ROWS < RAID_RECORDS.length)
    buttons.push({ id: 'club:songs-down', label: '▼', x: CONSOLE_W - 118, y: LIST_Y + VISIBLE_ROWS * ROW_H + 10, w: 56, h: 52, small: true, px: 22 });
  const picked = RAID_RECORDS.find((r) => r.id === consoleState.song);
  buttons.push(callButton(picked ? `♪ ${picked.title} · ${DIFF_LABELS[consoleState.diff]}` : 'pick a record'));
  return {
    title: 'THE FLOOR',
    body: (g) => {
      g.textBaseline = 'middle';
      g.font = font(500, 24);
      g.fillStyle = KIT.faint;
      g.textAlign = 'left';
      g.fillText('THE RECORD SHELF', X, LIST_Y - 40);
      // The rows themselves (ghost buttons hit-test; we paint).
      rows.forEach((r, i) => {
        const y = LIST_Y + i * ROW_H;
        const on = r.id === consoleState.song;
        g.fillStyle = on ? 'rgba(255,42,213,0.14)' : 'rgba(255,255,255,0.035)';
        g.beginPath();
        g.roundRect(X, y, WIDE, ROW_H - 8, 14);
        g.fill();
        if (on) {
          g.strokeStyle = 'rgba(255,42,213,0.85)';
          g.lineWidth = 2;
          g.stroke();
        }
        g.fillStyle = on ? KIT.text : KIT.dim;
        g.font = font(600, 28);
        g.textAlign = 'left';
        g.fillText(r.title, X + 26, y + (ROW_H - 8) / 2, WIDE - 170);
        g.font = font(500, 21);
        g.fillStyle = KIT.faint;
        g.textAlign = 'right';
        g.fillText(`${Math.round(r.bpm)} BPM`, X + WIDE - 22, y + (ROW_H - 8) / 2);
      });
      g.textAlign = 'center';
    },
    buttons,
  };
}

/** The console's current face — hosts hand this to a kit Panel's paint(). */
export function consoleFace(): ConsoleFace {
  return consoleState.tab === 'fight' ? fightFace() : raveFace();
}

/**
 * Handle a pressed console id. Local picks (tabs, games, records, chips,
 * scroll) are settled here and bump `version`; returns true when handled.
 * `club:call` returns false — the BALL system owns the drop.
 */
export function consoleClick(id: string): boolean {
  const done = (): boolean => {
    consoleState.version += 1;
    return true;
  };
  if (id === 'club:tab-fight') return (consoleState.tab = 'fight'), done();
  if (id === 'club:tab-rave') return (consoleState.tab = 'rave'), done();
  if (id.startsWith('club:game-')) return (consoleState.game = id.slice(10) as FightCall), done();
  if (id.startsWith('club:diff-')) return (consoleState.diff = Number(id.slice(10)) || 0), done();
  if (id.startsWith('club:song-')) return (consoleState.song = id.slice(10)), done();
  if (id === 'club:songs-up') return (consoleState.scroll = Math.max(0, consoleState.scroll - VISIBLE_ROWS)), done();
  if (id === 'club:songs-down')
    return (consoleState.scroll = Math.min(RAID_RECORDS.length - VISIBLE_ROWS, consoleState.scroll + VISIBLE_ROWS)), done();
  return false;
}
