import type { CharacterLook } from '../sim/characters.js';
import type { DirIndex } from '../sim/constants.js';

/**
 * Procedural character figures.
 *
 * Everyone in Crazy Arcade is a big head on a small body, so that is what this
 * draws: legs, torso, arms, an oversized head, then whatever headgear and face
 * the character is described with. Nothing here is a sprite sheet — a
 * character is a `CharacterLook`, and adding one is a data change.
 *
 * All geometry is authored in a nominal space where the figure is ~34 units
 * tall and (0, 0) is its centre, then scaled to whatever the caller wants.
 * That way the same code draws the 40px in-game figure and the menu portrait.
 */
export interface FigureOptions {
  look: CharacterLook;
  x: number;
  y: number;
  /** 1 renders at the in-game size (roughly one 40px tile tall). */
  scale?: number;
  facing?: DirIndex;
  /** Advances while the character walks; drives the leg and bob cycle. */
  walk?: number;
  /** Team colour, painted on the boots so teams read at a glance. */
  team?: string;
}

const HEAD_Y = -7;
const HEAD_R = 10.5;

export function drawFigure(ctx: CanvasRenderingContext2D, opts: FigureOptions): void {
  const { look, x, y } = opts;
  const scale = opts.scale ?? 1;
  const facing = opts.facing ?? 2;
  const walk = opts.walk ?? 0;
  const team = opts.team;

  // Facing left is facing right, mirrored. Everything below only has to know
  // about "front", "back" and "side".
  const side = facing === 1 || facing === 3;
  const back = facing === 0;
  const mirror = facing === 3 ? -1 : 1;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * mirror, scale);
  ctx.lineJoin = 'round';

  const swing = Math.sin(walk * Math.PI * 2);
  const bob = Math.abs(Math.sin(walk * Math.PI * 2)) * 0.9;
  ctx.translate(0, -bob);

  const wide = look.build === 'chubby';
  const small = look.build === 'small';
  const bodyW = wide ? 11.5 : small ? 8 : 9.5;
  const bodyH = small ? 10 : 12;
  const bodyTop = small ? 3 : 2;

  drawLegs(ctx, look, swing, bodyW, team);
  drawTorso(ctx, look, bodyW, bodyH, bodyTop, side, back);
  drawArms(ctx, look, swing, bodyW, bodyTop, side);
  drawHead(ctx, look, side, back, facing);

  ctx.restore();
}

// ---------------------------------------------------------------------------

function drawLegs(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  swing: number,
  bodyW: number,
  team: string | undefined,
): void {
  const footY = 14.5;
  const spread = bodyW * 0.48;
  for (const s of [-1, 1]) {
    const lift = s === 1 ? swing : -swing;
    ctx.fillStyle = look.trim;
    ellipse(ctx, s * spread + lift * 1.4, footY - Math.max(0, lift) * 1.6, 3.4, 2.3);
    ctx.fill();
    if (team) {
      // A thin team-coloured sole: readable in a scrum, invisible otherwise.
      ctx.fillStyle = team;
      ellipse(ctx, s * spread + lift * 1.4, footY - Math.max(0, lift) * 1.6 + 1.4, 3.2, 1);
      ctx.fill();
    }
  }
}

function drawTorso(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  bodyW: number,
  bodyH: number,
  bodyTop: number,
  side: boolean,
  back: boolean,
): void {
  const w = side ? bodyW * 0.86 : bodyW;

  ctx.fillStyle = look.suit;
  ctx.strokeStyle = shade(look.trim, -0.1);
  ctx.lineWidth = 1.2;
  roundedRect(ctx, -w, bodyTop, w * 2, bodyH, w * 0.75);
  ctx.fill();
  ctx.stroke();

  switch (look.outfit) {
    case 'pinafore': {
      // 마리드: white blouse under a pink pinafore with shoulder straps.
      ctx.fillStyle = look.trim;
      roundedRect(ctx, -w * 0.82, bodyTop + bodyH * 0.34, w * 1.64, bodyH * 0.66, 2.5);
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = look.trim;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * w * 0.45, bodyTop + 0.5);
        ctx.lineTo(s * w * 0.6, bodyTop + bodyH * 0.4);
        ctx.stroke();
      }
      break;
    }
    case 'tank': {
      // 모스: white sleeveless top over a darker undershirt.
      ctx.fillStyle = '#fdfdfd';
      roundedRect(ctx, -w * 0.72, bodyTop + 0.5, w * 1.44, bodyH * 0.72, 2.5);
      ctx.fill();
      break;
    }
    case 'belt':
    case 'starBelt': {
      ctx.fillStyle = look.trim;
      ctx.fillRect(-w * 0.95, bodyTop + bodyH * 0.55, w * 1.9, 2.6);
      ctx.fillStyle = look.outfit === 'starBelt' ? '#ffd54f' : shade(look.trim, 0.35);
      if (look.outfit === 'starBelt') {
        // 디지니 is never without the star buckle.
        star(ctx, 0, bodyTop + bodyH * 0.55 + 1.3, 2.5);
        ctx.fill();
      } else {
        ctx.fillRect(-1.6, bodyTop + bodyH * 0.55 + 0.3, 3.2, 2);
      }
      break;
    }
    case 'coat': {
      ctx.fillStyle = shade(look.suit, -0.18);
      roundedRect(ctx, -w, bodyTop + bodyH * 0.18, w * 2, bodyH * 0.82, w * 0.5);
      ctx.fill();
      ctx.strokeStyle = look.trim;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, bodyTop + bodyH * 0.18);
      ctx.lineTo(0, bodyTop + bodyH);
      ctx.stroke();
      break;
    }
    default:
      break;
  }

  if (!back && !side) {
    // A soft belly highlight; it is what stops the torso reading as a brick.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ellipse(ctx, -w * 0.3, bodyTop + bodyH * 0.35, w * 0.34, bodyH * 0.24);
    ctx.fill();
  }
}

function drawArms(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  swing: number,
  bodyW: number,
  bodyTop: number,
  side: boolean,
): void {
  const y = bodyTop + 4.5;
  if (side) {
    // Only the near arm is visible from the side.
    ctx.fillStyle = look.skin;
    ellipse(ctx, bodyW * 0.55, y - swing * 1.8, 2.6, 3.1);
    ctx.fill();
    return;
  }
  for (const s of [-1, 1]) {
    const lift = s === 1 ? -swing : swing;
    ctx.fillStyle = look.skin;
    ellipse(ctx, s * (bodyW + 1.6), y + lift * 1.6, 2.6, 3.2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Heads
// ---------------------------------------------------------------------------

function drawHead(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  side: boolean,
  back: boolean,
  facing: DirIndex,
): void {
  const r = look.build === 'small' ? HEAD_R * 0.92 : HEAD_R;

  // Anything that sits behind the head goes down first.
  switch (look.head) {
    case 'hood':
      hoodEars(ctx, look, r, side);
      break;
    case 'catHelmet':
      catEars(ctx, look, r);
      break;
    case 'pigtails':
      pigtails(ctx, look, r);
      break;
    default:
      break;
  }

  ctx.fillStyle = look.skin;
  ctx.strokeStyle = shade(look.skin, -0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, HEAD_Y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  switch (look.head) {
    case 'hood':
      // The hood covers everything except an oval face opening.
      ctx.fillStyle = look.suit;
      ctx.beginPath();
      ctx.arc(0, HEAD_Y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade(look.trim, -0.05);
      ctx.stroke();
      if (!back) {
        ctx.fillStyle = look.skin;
        ellipse(ctx, side ? r * 0.22 : 0, HEAD_Y + r * 0.12, r * 0.66, r * 0.7);
        ctx.fill();
      }
      break;

    case 'helmet':
      ctx.fillStyle = look.suit;
      ctx.beginPath();
      ctx.arc(0, HEAD_Y, r, Math.PI, Math.PI * 2);
      ctx.lineTo(r, HEAD_Y + r * 0.16);
      ctx.lineTo(-r, HEAD_Y + r * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(look.trim, 0.1);
      ctx.fillRect(-r, HEAD_Y + r * 0.06, r * 2, 1.8);
      // A small fin, so the helmet is not just a bowl.
      ctx.fillStyle = look.trim;
      ctx.beginPath();
      ctx.moveTo(-0.9, HEAD_Y - r);
      ctx.lineTo(0.9, HEAD_Y - r);
      ctx.lineTo(0, HEAD_Y - r - 3.2);
      ctx.closePath();
      ctx.fill();
      break;

    case 'catHelmet':
      ctx.fillStyle = look.suit;
      ctx.beginPath();
      ctx.arc(0, HEAD_Y, r, Math.PI, Math.PI * 2);
      ctx.lineTo(r, HEAD_Y + r * 0.1);
      ctx.lineTo(-r, HEAD_Y + r * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(look.trim, 0);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      break;

    case 'bob':
      // A 5:5 parted bob: two panels down the sides, straight fringe.
      ctx.fillStyle = look.hair;
      ctx.beginPath();
      ctx.arc(0, HEAD_Y, r, Math.PI * 0.95, Math.PI * 2.05);
      ctx.lineTo(r * 0.98, HEAD_Y + r * 0.72);
      ctx.lineTo(r * 0.55, HEAD_Y + r * 0.62);
      ctx.lineTo(r * 0.5, HEAD_Y - r * 0.15);
      ctx.lineTo(-r * 0.5, HEAD_Y - r * 0.15);
      ctx.lineTo(-r * 0.55, HEAD_Y + r * 0.62);
      ctx.lineTo(-r * 0.98, HEAD_Y + r * 0.72);
      ctx.closePath();
      ctx.fill();
      break;

    case 'onion':
      // 에띠's rounded "onion" hair, a bulb sat on top of the head.
      ctx.fillStyle = look.hair;
      ellipse(ctx, 0, HEAD_Y - r * 0.52, r * 0.95, r * 0.66);
      ctx.fill();
      ellipse(ctx, 0, HEAD_Y - r * 0.98, r * 0.42, r * 0.4);
      ctx.fill();
      break;

    case 'spiky':
      ctx.fillStyle = look.hair;
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, HEAD_Y - r * 0.18);
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const px = -r * 0.95 + t * r * 1.9;
        ctx.lineTo(px + r * 0.12, HEAD_Y - r * (0.85 + (i % 2) * 0.28));
        ctx.lineTo(px + r * 0.24, HEAD_Y - r * 0.3);
      }
      ctx.lineTo(r * 0.95, HEAD_Y - r * 0.18);
      ctx.closePath();
      ctx.fill();
      break;

    case 'pigtails':
      ctx.fillStyle = look.hair;
      ctx.beginPath();
      ctx.arc(0, HEAD_Y, r, Math.PI * 1.02, Math.PI * 1.98);
      ctx.closePath();
      ctx.fill();
      break;

    case 'crown':
      ctx.fillStyle = look.trim;
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, HEAD_Y - r * 0.55);
      ctx.lineTo(-r * 0.8, HEAD_Y - r * 1.15);
      ctx.lineTo(-r * 0.35, HEAD_Y - r * 0.8);
      ctx.lineTo(0, HEAD_Y - r * 1.35);
      ctx.lineTo(r * 0.35, HEAD_Y - r * 0.8);
      ctx.lineTo(r * 0.8, HEAD_Y - r * 1.15);
      ctx.lineTo(r * 0.8, HEAD_Y - r * 0.55);
      ctx.closePath();
      ctx.fill();
      break;

    case 'santaHat':
      ctx.fillStyle = look.suit;
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, HEAD_Y - r * 0.35);
      ctx.quadraticCurveTo(-r * 0.3, HEAD_Y - r * 1.8, r * 0.95, HEAD_Y - r * 1.1);
      ctx.lineTo(r * 0.95, HEAD_Y - r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = look.trim;
      ctx.fillRect(-r * 0.98, HEAD_Y - r * 0.5, r * 1.96, 2.4);
      ctx.beginPath();
      ctx.arc(r * 0.98, HEAD_Y - r * 1.1, 2, 0, Math.PI * 2);
      ctx.fill();
      break;

    default:
      break;
  }

  if (!back) drawFace(ctx, look, r, side, facing);
}

function hoodEars(ctx: CanvasRenderingContext2D, look: CharacterLook, r: number, side: boolean): void {
  // 배찌's two long ears, swept back off the hood.
  ctx.fillStyle = look.suit;
  ctx.strokeStyle = shade(look.trim, -0.05);
  ctx.lineWidth = 1;
  const pairs: number[] = side ? [-1] : [-1, 1];
  for (const s of pairs) {
    ctx.save();
    ctx.translate(s * r * 0.55, HEAD_Y - r * 0.5);
    ctx.rotate(s * 0.5);
    ellipse(ctx, 0, -r * 0.75, r * 0.3, r * 0.95);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function catEars(ctx: CanvasRenderingContext2D, look: CharacterLook, r: number): void {
  ctx.fillStyle = look.suit;
  ctx.strokeStyle = shade(look.trim, 0);
  ctx.lineWidth = 1;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * r * 0.28, HEAD_Y - r * 0.78);
    ctx.lineTo(s * r * 0.62, HEAD_Y - r * 1.65);
    ctx.lineTo(s * r * 0.92, HEAD_Y - r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function pigtails(ctx: CanvasRenderingContext2D, look: CharacterLook, r: number): void {
  ctx.fillStyle = look.hair;
  for (const s of [-1, 1]) {
    ellipse(ctx, s * r * 1.05, HEAD_Y - r * 0.1, r * 0.34, r * 0.5);
    ctx.fill();
  }
  ctx.fillStyle = look.trim;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * r * 0.85, HEAD_Y - r * 0.35, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------

function drawFace(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  r: number,
  side: boolean,
  facing: DirIndex,
): void {
  const cy = HEAD_Y + r * 0.16;
  // Facing sideways slides both eyes toward the leading edge.
  const shift = side ? r * 0.3 : 0;
  const gap = side ? r * 0.2 : r * 0.36;

  if (look.eyes === 'sleepy') {
    // 배찌 and 마리드 both wear the permanently half-shut look.
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const ex = shift + s * gap;
      if (side && s === -1) continue;
      ctx.beginPath();
      ctx.arc(ex, cy, r * 0.2, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else if (look.eyes === 'beady') {
    ctx.fillStyle = '#2b2b2b';
    for (const s of [-1, 1]) {
      if (side && s === -1) continue;
      ctx.beginPath();
      ctx.arc(shift + s * gap, cy, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Wide eyes: white with a pupil that tracks the facing.
    const look1 = facing === 1 ? 0.9 : facing === 3 ? 0.9 : 0;
    for (const s of [-1, 1]) {
      if (side && s === -1) continue;
      const ex = shift + s * gap;
      ctx.fillStyle = '#fff';
      ellipse(ctx, ex, cy, r * 0.24, r * 0.29);
      ctx.fill();
      ctx.fillStyle = '#1b1b1b';
      ctx.beginPath();
      ctx.arc(ex + look1 * r * 0.09, cy + r * 0.03, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (look.eyes === 'glasses') {
    // 에띠 is the only one in the roster who wears them.
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1.1;
    for (const s of [-1, 1]) {
      if (side && s === -1) continue;
      ctx.beginPath();
      ctx.arc(shift + s * gap, cy, r * 0.32, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (!side) {
      ctx.beginPath();
      ctx.moveTo(-gap + r * 0.32, cy);
      ctx.lineTo(gap - r * 0.32, cy);
      ctx.stroke();
    }
  }

  // Mouth.
  ctx.strokeStyle = '#a05a4a';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(shift, cy + r * 0.42, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Cheeks: small, but they are most of what makes the faces read as cute.
  ctx.fillStyle = 'rgba(233,120,130,0.45)';
  for (const s of [-1, 1]) {
    if (side && s === -1) continue;
    ellipse(ctx, shift + s * (gap + r * 0.3), cy + r * 0.3, r * 0.16, r * 0.1);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Lighten (positive) or darken (negative) a #rrggbb colour. */
export function shade(hex: string, amount: number): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const ch = (v: string): number => {
    const n = parseInt(v, 16);
    const out = amount >= 0 ? n + (255 - n) * amount : n * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  const to = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${to(ch(m[1]))}${to(ch(m[2]))}${to(ch(m[3]))}`;
}
