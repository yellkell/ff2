/**
 * THE CASTER — the headset's side of THE CHANNEL (server/tv.mjs).
 *
 * The headset RUNNING a bout opens a channel on the room server's /tv
 * relay and pushes a small top-down frame a few times a second while the
 * bout stands; when it ends it signs off with the result. Viewers on
 * public/stats.html's TV tab see what it sends, and the Discord bot calls
 * the match LIVE once it has held for a few seconds.
 *
 * Everything here is best-effort and silent: no relay, no channel, no
 * complaints — the bout never waits on television. BroadcastSystem drives
 * it; nothing else needs to know it exists.
 */

import { tvServerUrl } from '../config.js';

export interface CastMeta {
  kind: '1v1' | '2v2' | 'ffa' | 'raid' | 'solo';
  /** The card: "YELL vs ROOK", "THE SQUAD vs RUSTHOOK". */
  title: string;
  names: string[];
}

/** How long a lost socket waits before trying again while a bout casts. */
const RETRY_MS = 5000;

let ws: WebSocket | null = null;
let live = false;
let meta: CastMeta | null = null;
let metaSent = '';
let retryAt = 0;
let onAir = '';

function connect(): void {
  if (ws || performance.now() < retryAt) return;
  let url: string;
  try {
    url = tvServerUrl();
  } catch {
    return;
  }
  try {
    const sock = new WebSocket(url);
    ws = sock;
    sock.onopen = () => {
      metaSent = '';
      pushMeta();
    };
    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { t?: string; id?: string };
        if (msg.t === 'on-air' && typeof msg.id === 'string') onAir = msg.id;
      } catch {
        /* not ours */
      }
    };
    sock.onerror = () => {
      /* onclose follows */
    };
    sock.onclose = () => {
      if (ws === sock) ws = null;
      onAir = '';
      retryAt = performance.now() + RETRY_MS;
    };
  } catch {
    ws = null;
    retryAt = performance.now() + RETRY_MS;
  }
}

function pushMeta(): void {
  if (!ws || ws.readyState !== WebSocket.OPEN || !meta) return;
  const key = JSON.stringify(meta);
  if (key === metaSent) return;
  metaSent = key;
  ws.send(JSON.stringify({ t: 'cast', ...meta }));
}

export const tvCast = {
  /** The channel id the relay gave us ('' until it answers) — probes read it. */
  get channel(): string {
    return onAir;
  },
  /** A bout is being cast. */
  get live(): boolean {
    return live;
  },

  /** Go on air (or re-title: names arrive late over the wire). */
  open(m: CastMeta): void {
    meta = m;
    live = true;
    connect();
    pushMeta();
  },

  /** One frame. Dropped (not queued) when the relay is not there yet. */
  frame(f: Record<string, unknown>): void {
    if (!live) return;
    if (!ws) connect();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    pushMeta();
    ws.send(JSON.stringify({ t: 'f', f }));
  },

  /**
   * One PICTURE (base64 JPEG, net/tvVideo.ts). Dropped rather than queued,
   * and dropped hardest of all: a video frame is worth nothing late, and a
   * socket with a backlog is a socket about to cost the bout frame time.
   * The pose frame still goes every tick, so dropping these only costs the
   * viewer the picture, never the broadcast.
   */
  video(d: string): void {
    if (!live || !d) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 64 * 1024) return;
    ws.send(JSON.stringify({ t: 'v', d }));
  },

  /**
   * A picture of THE CLUB FLOOR, sent without opening a channel.
   *
   * The club is not a match: it has no card, no result and no place in the
   * guide, and the relay already describes it to viewers out of the poses
   * the floor is sending anyway. This only replaces the DRAWING of it with
   * a render, so it needs the socket and nothing else — no `cast`, no
   * `end`, and no effect on what the guide says is on air.
   */
  clubVideo(d: string): void {
    if (!d) return;
    if (!ws) connect();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 64 * 1024) return;
    ws.send(JSON.stringify({ t: 'cv', d }));
  },

  /** Sign off with a result line ("ROOK 3–1", "GOLIATH fell"). */
  end(result: string): void {
    if (!live) return;
    live = false;
    meta = null;
    metaSent = '';
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'end', result: result.slice(0, 200) }));
    onAir = '';
  },

  /** Drop the socket (leaving the arena page). */
  close(): void {
    this.end('');
    try {
      ws?.close();
    } catch {
      /* already gone */
    }
    ws = null;
  },
};
