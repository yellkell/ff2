/**
 * Procedural emblems for the shop / locker tiles — so a skin reads as a picture,
 * not just a word. Avatars get an animal silhouette (the metallic-animal head
 * each skin's name comes from) and the KNIGHT a heraldic shield; platforms get
 * a little octagon pad swatch painted in their colours. All drawn into a canvas
 * 2D context, sized around a centre (cx, cy) and radius r.
 */

import type { PlatformSkin } from '../avatar/skins.js';
import type { DeckStyle } from '../arena/decks.js';
import type { GearDef } from '../avatar/gear.js';

function hex(n: number): string {
  return `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
}

/** The avatar emblem for a skin id, filled in `color`. */
export function drawAvatarIcon(ctx: CanvasRenderingContext2D, id: string, cx: number, cy: number, r: number, color: string): void {
  void id; // one body in town — every avatar tile draws THE BLANK's bust
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  drawBust(ctx, cx, cy, r);
  ctx.restore();
}

/** THE BLANK's tile: a tailor's-dummy bust — featureless egg head over wide
 *  shoulders pinching to the thin waist. Deliberately the plainest icon on
 *  the shelf: the mannequin's whole pitch is what ISN'T there yet. */
function drawBust(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const x = (u: number): number => cx + u * r;
  const y = (v: number): number => cy + v * r;
  // Egg head.
  ctx.beginPath();
  ctx.ellipse(x(0), y(-0.62), r * 0.34, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  // Shoulders → waist, one closed sweep.
  ctx.beginPath();
  ctx.moveTo(x(-0.95), y(0.12)); // left shoulder point
  ctx.quadraticCurveTo(x(-0.98), y(-0.18), x(-0.55), y(-0.2)); // deltoid
  ctx.quadraticCurveTo(x(0), y(-0.34), x(0.55), y(-0.2)); // clavicle line
  ctx.quadraticCurveTo(x(0.98), y(-0.18), x(0.95), y(0.12)); // right deltoid
  ctx.quadraticCurveTo(x(0.6), y(0.5), x(0.34), y(1.0)); // taper in
  ctx.lineTo(x(-0.34), y(1.0)); // the thin waist
  ctx.quadraticCurveTo(x(-0.6), y(0.5), x(-0.95), y(0.12));
  ctx.closePath();
  ctx.fill();
}









/** A platform's emblem: a little octagon pad in its colours (slab fill if it has
 *  a premium tint, else the neon), rimmed in the neon. */
export function drawPlatformIcon(ctx: CanvasRenderingContext2D, skin: PlatformSkin, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  // The deck's MATERIAL as a swatch: boards, stone, glass, gold — the same
  // thing the tile is selling, at thumbnail size.
  ctx.save();
  ctx.clip();
  drawDeckSwatch(ctx, skin.deck, cx, cy, r);
  ctx.restore();
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.strokeStyle = hex(skin.neon);
  ctx.shadowColor = hex(skin.neon);
  ctx.shadowBlur = r * 0.5;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // BLAZING wears its flame — the same leaning-tongue silhouette as the
  // leaderboard's blazing feat marker: an outer tongue in the pad's neon and
  // a hot amber core.
  if (skin.id === 'blazing') {
    const tongue = (h: number, colour: string): void => {
      const w = h * 0.62;
      const by = cy + r * 0.62; // flame base, tip reaching up
      ctx.beginPath();
      ctx.moveTo(cx, by);
      ctx.bezierCurveTo(cx - w * 0.55, by - h * 0.12, cx - w * 0.42, by - h * 0.55, cx - w * 0.1, by - h * 0.62);
      ctx.bezierCurveTo(cx - w * 0.28, by - h * 0.8, cx + w * 0.02, by - h * 0.9, cx + w * 0.08, by - h);
      ctx.bezierCurveTo(cx + w * 0.42, by - h * 0.68, cx + w * 0.55, by - h * 0.3, cx, by);
      ctx.closePath();
      ctx.fillStyle = colour;
      ctx.fill();
    };
    tongue(r * 1.3, hex(skin.neon));
    tongue(r * 0.72, '#ffb000');
  }
  // TIDEBREAKER wears GOOPLIATH's gel drop, dark-rimmed so it pops off the
  // bottle-green deck.
  if (skin.id === 'tidebreaker') {
    const d = r * 0.72;
    ctx.beginPath();
    ctx.moveTo(cx, cy - d);
    ctx.quadraticCurveTo(cx + 0.95 * d, cy + 0.1 * d, cx + 0.55 * d, cy + 0.55 * d);
    ctx.quadraticCurveTo(cx, cy + 0.98 * d, cx - 0.55 * d, cy + 0.55 * d);
    ctx.quadraticCurveTo(cx - 0.95 * d, cy + 0.1 * d, cx, cy - d);
    ctx.closePath();
    ctx.fillStyle = hex(skin.neon);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.strokeStyle = 'rgba(6,20,12,0.8)';
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A GEAR tile's glyph: the slot's silhouette (a head, a torso, a fist) in
 * dim steel with the piece itself drawn over it in the tile's brass — the
 * shape you're buying, where it goes.
 */
export function drawGearIcon(ctx: CanvasRenderingContext2D, def: GearDef, cx: number, cy: number, r: number, color: string): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const dim = 'rgba(150,150,170,0.55)';
  const line = Math.max(2, r * 0.14);
  if (def.slot === 'head') {
    ctx.fillStyle = dim;
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.1, r * 0.5, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = line;
    ctx.beginPath();
    switch (def.id) {
      case 'crest':
        ctx.moveTo(cx - r * 0.4, cy - r * 0.35);
        ctx.quadraticCurveTo(cx, cy - r * 1.15, cx + r * 0.45, cy - r * 0.3);
        ctx.stroke();
        break;
      case 'antennae':
        for (const s of [-1, 1]) {
          ctx.moveTo(cx + s * r * 0.3, cy - r * 0.4);
          ctx.lineTo(cx + s * r * 0.62, cy - r * 1.05);
        }
        ctx.stroke();
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(cx + s * r * 0.62, cy - r * 1.05, line * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'horns':
        for (const s of [-1, 1]) {
          ctx.moveTo(cx + s * r * 0.35, cy - r * 0.35);
          ctx.quadraticCurveTo(cx + s * r * 0.95, cy - r * 0.5, cx + s * r * 0.75, cy - r * 1.05);
        }
        ctx.stroke();
        break;
      case 'halo':
        ctx.ellipse(cx, cy - r * 0.85, r * 0.55, r * 0.16, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'mohawk':
        for (let i = -2; i <= 2; i++) {
          const x = cx + i * r * 0.18;
          ctx.moveTo(x - r * 0.08, cy - r * 0.45);
          ctx.lineTo(x, cy - r * 0.95 + Math.abs(i) * r * 0.12);
          ctx.lineTo(x + r * 0.08, cy - r * 0.45);
        }
        ctx.fill();
        break;
      default: // visorband
        ctx.moveTo(cx - r * 0.55, cy - r * 0.05);
        ctx.lineTo(cx + r * 0.55, cy - r * 0.05);
        ctx.stroke();
    }
  } else if (def.slot === 'body') {
    ctx.fillStyle = dim;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.62, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.62, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.32, cy + r * 0.75);
    ctx.lineTo(cx - r * 0.32, cy + r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = line;
    ctx.beginPath();
    switch (def.id) {
      case 'pauldrons':
        for (const s of [-1, 1]) ctx.ellipse(cx + s * r * 0.58, cy - r * 0.5, r * 0.26, r * 0.18, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        break;
      case 'chestplate':
        ctx.moveTo(cx - r * 0.3, cy - r * 0.35);
        ctx.lineTo(cx + r * 0.3, cy - r * 0.35);
        ctx.lineTo(cx + r * 0.22, cy + r * 0.15);
        ctx.lineTo(cx, cy + r * 0.3);
        ctx.lineTo(cx - r * 0.22, cy + r * 0.15);
        ctx.closePath();
        ctx.fill();
        break;
      case 'collar':
        ctx.ellipse(cx, cy - r * 0.6, r * 0.42, r * 0.14, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'ridge':
        for (let i = 0; i < 5; i++) {
          ctx.moveTo(cx, cy - r * 0.45 + i * r * 0.26);
          ctx.lineTo(cx + r * 0.16, cy - r * 0.36 + i * r * 0.26);
        }
        ctx.stroke();
        break;
      case 'belt':
        ctx.moveTo(cx - r * 0.42, cy + r * 0.32);
        ctx.lineTo(cx + r * 0.42, cy + r * 0.32);
        ctx.stroke();
        ctx.fillRect(cx - r * 0.09, cy + r * 0.22, r * 0.18, r * 0.2);
        break;
      default: // epaulettes
        for (const s of [-1, 1]) ctx.fillRect(cx + s * r * 0.62 - r * 0.2, cy - r * 0.66, r * 0.4, r * 0.14);
    }
  } else {
    // A fist from above: the palm block and four fingers.
    ctx.fillStyle = dim;
    ctx.beginPath();
    ctx.roundRect(cx - r * 0.42, cy - r * 0.2, r * 0.84, r * 0.7, r * 0.12);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.roundRect(cx - r * 0.4 + i * r * 0.21, cy - r * 0.55, r * 0.17, r * 0.4, r * 0.06);
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = line;
    ctx.beginPath();
    switch (def.id) {
      case 'cuffs':
        ctx.moveTo(cx - r * 0.5, cy + r * 0.55);
        ctx.lineTo(cx + r * 0.5, cy + r * 0.55);
        ctx.stroke();
        break;
      case 'knuckles':
        for (let i = 0; i < 4; i++) {
          const x = cx - r * 0.31 + i * r * 0.21;
          ctx.moveTo(x - r * 0.07, cy - r * 0.5);
          ctx.lineTo(x, cy - r * 0.85);
          ctx.lineTo(x + r * 0.07, cy - r * 0.5);
        }
        ctx.fill();
        break;
      default: // gauntlets
        ctx.fillRect(cx - r * 0.34, cy - r * 0.08, r * 0.68, r * 0.42);
    }
  }
  ctx.restore();
}

/** A thumbnail of a deck material (arena/decks.ts), drawn inside the pad's
 *  clipped octagon: plank seams for the woods, grout for slate, veins for
 *  marble, a gloss arc for glass and ice, leaf squares for gold. */
function drawDeckSwatch(ctx: CanvasRenderingContext2D, deck: DeckStyle, cx: number, cy: number, r: number): void {
  const fill = (c: string): void => {
    ctx.fillStyle = c;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  const boards = (base: string, seam: string, grain: string): void => {
    fill(base);
    ctx.strokeStyle = seam;
    ctx.lineWidth = Math.max(1, r * 0.06);
    for (let i = -3; i <= 3; i++) {
      const x = cx + i * r * 0.32;
      ctx.beginPath();
      ctx.moveTo(x, cy - r);
      ctx.lineTo(x, cy + r);
      ctx.stroke();
    }
    ctx.strokeStyle = grain;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    for (let i = -6; i <= 6; i++) {
      const x = cx + i * r * 0.16 + r * 0.05;
      ctx.beginPath();
      ctx.moveTo(x, cy - r);
      ctx.bezierCurveTo(x + r * 0.05, cy - r * 0.3, x - r * 0.05, cy + r * 0.3, x, cy + r);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  switch (deck) {
    case 'oak':
      boards('#a8783f', '#5a3a1c', '#7c5528');
      break;
    case 'charred':
      boards('#2a2320', '#0c0908', '#3d332c');
      ctx.strokeStyle = '#ff5a1a';
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy + r * 0.2);
      ctx.lineTo(cx - r * 0.2, cy - r * 0.1);
      ctx.lineTo(cx + r * 0.1, cy + r * 0.3);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    case 'ash':
      boards('#d9d3c6', '#9a9182', '#bdb5a4');
      break;
    case 'redwood':
      boards('#8e3a26', '#4a1a10', '#6a2a1a');
      break;
    case 'walnut':
      boards('#54372a', '#2a1a12', '#3e2a1e');
      break;
    case 'slate': {
      fill('#6d7079');
      ctx.strokeStyle = '#2e3036';
      ctx.lineWidth = Math.max(1.5, r * 0.09);
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(cx + i * r * 0.36, cy - r);
        ctx.lineTo(cx + i * r * 0.36, cy + r);
        ctx.moveTo(cx - r, cy + i * r * 0.36);
        ctx.lineTo(cx + r, cy + i * r * 0.36);
        ctx.stroke();
      }
      break;
    }
    case 'marble':
      fill('#ece9e2');
      ctx.strokeStyle = '#8d8a90';
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r * 0.4);
      ctx.bezierCurveTo(cx - r * 0.3, cy - r * 0.6, cx, cy + r * 0.2, cx + r, cy + r * 0.1);
      ctx.moveTo(cx - r * 0.6, cy + r);
      ctx.bezierCurveTo(cx - r * 0.2, cy + r * 0.4, cx + r * 0.3, cy + r * 0.6, cx + r * 0.4, cy - r);
      ctx.stroke();
      break;
    case 'obsidian':
      fill('#141419');
      ctx.strokeStyle = 'rgba(200,210,255,0.45)';
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy + r * 0.3, r * 0.9, -Math.PI * 0.55, -Math.PI * 0.1);
      ctx.stroke();
      break;
    case 'frost':
      fill('#cfe3ea');
      ctx.strokeStyle = 'rgba(70,110,140,0.6)';
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.8, cy + r * 0.5);
      ctx.lineTo(cx - r * 0.1, cy - r * 0.1);
      ctx.lineTo(cx + r * 0.7, cy - r * 0.6);
      ctx.moveTo(cx - r * 0.1, cy - r * 0.1);
      ctx.lineTo(cx + r * 0.3, cy + r * 0.8);
      ctx.stroke();
      break;
    case 'jade':
      fill('#3f8a5f');
      ctx.strokeStyle = 'rgba(200,255,220,0.5)';
      ctx.lineWidth = Math.max(1.5, r * 0.12);
      ctx.beginPath();
      ctx.arc(cx + r * 0.2, cy - r * 0.2, r * 0.6, Math.PI * 0.6, Math.PI * 1.5);
      ctx.stroke();
      break;
    case 'bullion': {
      fill('#e2b34a');
      ctx.strokeStyle = 'rgba(120,80,10,0.5)';
      ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * r * 0.5, cy - r);
        ctx.lineTo(cx + i * r * 0.5, cy + r);
        ctx.moveTo(cx - r, cy + i * r * 0.5);
        ctx.lineTo(cx + r, cy + i * r * 0.5);
        ctx.stroke();
      }
      break;
    }
    case 'lacquer':
      fill('#7a1418');
      ctx.strokeStyle = '#e8b652';
      ctx.lineWidth = Math.max(1.5, r * 0.08);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'tide':
      fill('#16402c');
      ctx.strokeStyle = 'rgba(90,255,122,0.35)';
      ctx.lineWidth = Math.max(1, r * 0.06);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy + r * 0.2, r * (0.3 + i * 0.25), Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      break;
  }
}
