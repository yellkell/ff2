/**
 * THE ARCADE LOBBY (MENUS 3) — the room browser and the squad room, on the
 * panel kit. One modal, two faces, for all three networked modes.
 *
 * THE BROWSER lists the open rooms: who is holding the door, how full they
 * are, what stakes they have set — and a WATCH chip on every row, because
 * the terrace is open whether or not there is a seat going (DESIGN §3.2).
 *
 * THE SQUAD ROOM is the room you are actually in: a seat per fighter with
 * the callsign that claimed it, the host's breakers where the host can
 * reach them, the invite code if the room has one, and the line that says
 * what everyone is waiting for.
 *
 * Rows and seats are ghost buttons the body paints — a seat is a piece of
 * status, not a control, and a browser row carries three different things
 * you can hit.
 */

import { KIT, type PanelButton } from '../ui/kit/panel.js';
import { font } from '../ui/kit/fonts.js';
import { app } from './appState.js';
import { mesh } from '../net/mesh.js';
import { DIFFICULTY, DIFFICULTY_ORDER, type ArcadeMode } from '../config.js';
import { difficultyUnlocked } from '../campaign/campaignState.js';

export const LOBBY_W = 896;
export const LOBBY_H = 896;

const M = 64;
const INNER = LOBBY_W - M * 2;
const ROW_Y0 = 156;
const ROW_H = 92;
const ROW_GAP = 14;
const WATCH_W = 132;
const GOOP_GREEN = '#36e05a';

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

export interface LobbyFace {
  title: string;
  body: (g: CanvasRenderingContext2D, hover: string | null) => void;
  buttons: PanelButton[];
}

const TITLE: Record<ArcadeMode, string> = { '1v1': '1V1', '2v2': '2V2', ffa: 'FFA', raid: 'TITAN RAID' };

/** A sub-face's name, right-aligned in the title band (the wrap's crumb). */
function crumb(text: string): (g: CanvasRenderingContext2D) => void {
  return (g) => {
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.font = font(600, 24);
    g.letterSpacing = '3px';
    g.fillStyle = KIT.faint;
    g.fillText(text, LOBBY_W - M, 78);
    g.letterSpacing = '0px';
  };
}

export function lobbyFace(): LobbyFace {
  const mode = app.lobbyMode ?? 'raid';
  return app.lobbyView === 'lobby' ? squadRoom(mode) : browser(mode);
}

/* ── THE BROWSER ──────────────────────────────────────────────────────── */

function browser(mode: ArcadeMode): LobbyFace {
  const rooms = app.lobbyRooms.slice(0, 4);
  const buttons: PanelButton[] = [];
  rooms.forEach((room, i) => {
    const y = ROW_Y0 + i * (ROW_H + ROW_GAP);
    // The row joins as a FIGHTER (when there is a seat); the chip at its
    // end takes a place on the terrace instead.
    buttons.push({
      id: `lobby-join-${room.id}`,
      label: '',
      ghost: true,
      x: M,
      y,
      w: INNER - WATCH_W - 12,
      h: ROW_H,
      disabled: room.count >= room.cap,
    });
    buttons.push({
      id: `lobby-watch-${room.id}`,
      label: 'WATCH',
      x: M + INNER - WATCH_W,
      y: y + 14,
      w: WATCH_W,
      h: ROW_H - 28,
      small: true,
      px: 20,
    });
  });

  const footY = LOBBY_H - 220;
  if (mode === 'raid') {
    buttons.push({ id: 'lobby-host', label: 'HOST A RAID', sub: 'put your squad up', x: M, y: footY, w: INNER, h: 96, primary: true });
  } else {
    const half = (INNER - 20) / 2;
    buttons.push(
      { id: 'lobby-host', label: 'MAKE LOBBY', sub: 'open the door', x: M, y: footY, w: half, h: 96, primary: true },
      { id: 'lobby-vsbots', label: 'VS BOTS', sub: 'no waiting', x: M + half + 20, y: footY, w: half, h: 96 },
    );
  }
  buttons.push({ id: 'lobby-close', label: 'CLOSE', x: LOBBY_W / 2 - 130, y: LOBBY_H - 104, w: 260, h: 80, small: true });

  return {
    title: TITLE[mode],
    buttons,
    body: (g, hover) => {
      crumb('OPEN ROOMS')(g);
      if (rooms.length === 0) {
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = font(500, 26);
        g.fillStyle = KIT.faint;
        g.fillText(
          mode === 'raid' ? 'no open raids — raise your own squad' : 'no open lobbies — make your own',
          LOBBY_W / 2,
          ROW_Y0 + 90,
        );
        return;
      }
      rooms.forEach((room, i) => {
        const y = ROW_Y0 + i * (ROW_H + ROW_GAP);
        const full = room.count >= room.cap;
        const hot = hover === `lobby-join-${room.id}` && !full;
        g.beginPath();
        g.roundRect(M, y, INNER - WATCH_W - 12, ROW_H, 16);
        g.fillStyle = hot ? KIT.plateHover : KIT.plate;
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = hot ? KIT.lineHover : KIT.line;
        g.stroke();
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.font = font(700, 30);
        g.fillStyle = full ? KIT.dim : KIT.textHi;
        g.fillText(mode === 'raid' ? `${room.host}'S RAID` : `${room.host}'S LOBBY`, M + 26, y + ROW_H / 2 - 12, INNER - WATCH_W - 220);
        // The stakes, small, under the name.
        const tags: Array<[string, string]> = [];
        if (room.goopliath) tags.push(['GOOPLIATH', GOOP_GREEN]);
        if (room.hardcore) tags.push(['HARDCORE', KIT.danger]);
        g.font = font(700, 18);
        tags.forEach(([tag, colour], t) => {
          g.fillStyle = colour;
          g.fillText(tag, M + 26 + t * 140, y + ROW_H / 2 + 22);
        });
        if (tags.length === 0) {
          g.fillStyle = KIT.faint;
          g.font = font(500, 19);
          g.fillText(full ? 'full — but the terrace is open' : 'open — step in', M + 26, y + ROW_H / 2 + 22);
        }
        g.textAlign = 'right';
        g.font = font(700, 30);
        g.fillStyle = full ? KIT.danger : KIT.accent;
        g.fillText(`${room.count}/${room.cap}`, M + INNER - WATCH_W - 40, y + ROW_H / 2);
      });
    },
  };
}

/* ── THE SQUAD ROOM ───────────────────────────────────────────────────── */

const SEAT_Y0 = 156;
const DIFF_Y = 470;
const BREAKER_Y = 560;
const BREAKER_H = 76;

function squadRoom(mode: ArcadeMode): LobbyFace {
  const host = mesh.isHost();
  const cap = mesh.capacity || 4;
  const raid = mode === 'raid';
  const seatH = cap > 4 ? 58 : 66;
  const seatGap = 10;
  const count = mesh.occupants.slice(0, cap).filter(Boolean).length;
  const full = count >= cap;
  const shortStart = mode === 'ffa' || raid;
  const shortReady = shortStart && count >= 2 && !full;

  const buttons: PanelButton[] = [];
  if (raid) {
    // The run's damage: the host picks, the squad watches it land.
    const chipW = (INNER - 3 * 12) / 4;
    DIFFICULTY_ORDER.forEach((tier, i) => {
      buttons.push({
        id: `raiddiff-${tier}`,
        label: DIFFICULTY[tier].label,
        x: M + i * (chipW + 12),
        y: DIFF_Y,
        w: chipW,
        h: 62,
        small: true,
        px: 20,
        selected: mesh.raidDifficulty === tier,
        disabled: !host || !difficultyUnlocked(tier),
        tone: mesh.raidDifficulty === tier ? css(DIFFICULTY[tier].accent) : undefined,
      });
    });
    buttons.push(
      {
        id: 'lobby-hardcore',
        label: 'HARDCORE',
        sub: 'no healing between titans',
        x: M, y: BREAKER_Y, w: (INNER - 20) / 2, h: BREAKER_H,
        small: true,
        selected: mesh.raidHardcore,
        tone: mesh.raidHardcore ? KIT.danger : undefined,
        disabled: !host,
      },
      {
        id: 'lobby-goopliath',
        label: 'FIGHT GOOPLIATH',
        sub: 'the tide, not the titans',
        x: M + (INNER - 20) / 2 + 20, y: BREAKER_Y, w: (INNER - 20) / 2, h: BREAKER_H,
        small: true,
        selected: mesh.raidGoopliath,
        tone: mesh.raidGoopliath ? GOOP_GREEN : undefined,
        disabled: !host,
      },
    );
  }

  if (shortReady && host) {
    buttons.push(
      { id: 'lobby-start', label: 'START NOW', x: M, y: LOBBY_H - 200, w: (INNER - 20) / 2, h: 92, primary: true },
      { id: 'lobby-leave', label: 'LEAVE', x: M + (INNER - 20) / 2 + 20, y: LOBBY_H - 200, w: (INNER - 20) / 2, h: 92, small: true, tone: KIT.danger },
    );
  } else {
    buttons.push({ id: 'lobby-leave', label: 'LEAVE', x: LOBBY_W / 2 - 150, y: LOBBY_H - 200, w: 300, h: 92, small: true, tone: KIT.danger });
  }

  return {
    title: TITLE[mode],
    buttons,
    body: (g) => {
      crumb(mesh.watching ? 'ON THE TERRACE' : 'YOUR SQUAD')(g);
      // The seats.
      for (let seat = 0; seat < cap; seat++) {
        const y = SEAT_Y0 + seat * (seatH + seatGap);
        const taken = !!mesh.occupants[seat];
        const isMe = mesh.joined && seat === mesh.mySeat;
        g.beginPath();
        g.roundRect(M, y, INNER, seatH, 14);
        g.fillStyle = isMe ? KIT.accentFaint : taken ? KIT.plate : 'rgba(255,255,255,0.02)';
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = isMe ? KIT.accent : taken ? KIT.line : 'rgba(255,255,255,0.05)';
        g.stroke();
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.font = font(700, 27);
        g.fillStyle = taken ? KIT.textHi : KIT.disabled;
        g.fillText(taken ? mesh.names[seat] || `PLAYER ${seat + 1}` : 'open seat…', M + 26, y + seatH / 2);
        g.textAlign = 'right';
        g.font = font(700, 19);
        const tag = mode === '2v2' ? (seat < 2 ? 'TEAM A' : 'TEAM B') : null;
        if (seat === 0 && taken) {
          g.fillStyle = KIT.accent;
          g.fillText(tag ? `HOST · ${tag}` : 'HOST', M + INNER - 26, y + seatH / 2);
        } else if (tag) {
          g.fillStyle = seat < 2 ? KIT.info : KIT.warn;
          g.fillText(tag, M + INNER - 26, y + seatH / 2);
        }
      }

      if (raid) {
        g.textAlign = 'left';
        g.font = font(700, 20);
        g.letterSpacing = '3px';
        g.fillStyle = KIT.faint;
        g.fillText('DIFFICULTY', M, DIFF_Y - 26);
        g.letterSpacing = '0px';
      }

      // The invite code, kept up for the whole lobby so a host can read it out.
      g.textAlign = 'center';
      if (app.privateCode) {
        g.font = font(600, 20);
        g.letterSpacing = '3px';
        g.fillStyle = KIT.faint;
        g.fillText('INVITE CODE', LOBBY_W / 2, LOBBY_H - 300);
        g.font = font(700, 46);
        g.fillStyle = KIT.info;
        g.fillText(app.privateCode.split('').join(' '), LOBBY_W / 2, LOBBY_H - 254);
        g.letterSpacing = '0px';
      }

      // What everyone is waiting for.
      const noun = raid ? 'raiders' : 'players';
      const launch = raid ? 'launches the raid' : 'starts the brawl';
      g.font = font(full ? 700 : 500, full ? 28 : 24);
      g.fillStyle = full ? KIT.accent : KIT.dim;
      g.fillText(
        full
          ? 'ROOM FULL — LAUNCHING…'
          : shortStart
            ? `${count} / ${cap} ${noun} — start at 2, a full room ${launch}`
            : `${count} / ${cap} ${noun} — a full room ${launch}`,
        LOBBY_W / 2,
        LOBBY_H - 232,
      );
    },
  };
}
