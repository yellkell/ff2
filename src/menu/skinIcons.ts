/**
 * Procedural emblems for the shop / locker tiles — so a skin reads as a picture,
 * not just a word. Avatars get an animal silhouette (the metallic-animal head
 * each skin's name comes from) and the KNIGHT a heraldic shield; platforms get
 * a little octagon pad swatch painted in their colours. All drawn into a canvas
 * 2D context, sized around a centre (cx, cy) and radius r.
 */

import type { PlatformSkin } from '../avatar/skins.js';
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
  const fill = skin.slab !== undefined ? skin.slab : skin.neon;
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
  ctx.fillStyle = hex(fill);
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.strokeStyle = hex(skin.neon);
  ctx.shadowColor = hex(skin.neon);
  ctx.shadowBlur = r * 0.5;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // The XD pad wears its grin even at thumbnail size.
  if (skin.id === 'xdface') {
    ctx.fillStyle = '#f4f6fb';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(r * 0.7)}px system-ui, sans-serif`;
    ctx.fillText('XD', cx, cy + r * 0.04);
  }
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
  // SYNTHWAVE wears its neon deck grid (clipped to the pad outline).
  if (skin.id === 'synthwave') {
    ctx.save();
    ctx.clip(); // the octagon path is still current
    ctx.strokeStyle = hex(skin.neon);
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      const o = i * r * 0.36;
      ctx.moveTo(cx - r, cy + o);
      ctx.lineTo(cx + r, cy + o);
      ctx.moveTo(cx + o, cy - r);
      ctx.lineTo(cx + o, cy + r);
    }
    ctx.stroke();
    ctx.restore();
  }
  // The VOLT pad wears its lightning bolt.
  if (skin.id === 'volt') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(0.35);
    ctx.beginPath();
    ctx.moveTo(r * 0.14, -r * 0.62);
    ctx.lineTo(-r * 0.2, r * 0.03);
    ctx.lineTo(r * 0.02, r * 0.03);
    ctx.lineTo(-r * 0.14, r * 0.62);
    ctx.lineTo(r * 0.2, -r * 0.09);
    ctx.lineTo(-r * 0.02, -r * 0.09);
    ctx.closePath();
    ctx.fillStyle = hex(skin.neon);
    ctx.fill();
    ctx.restore();
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
