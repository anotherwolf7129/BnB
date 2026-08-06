import {
  CHAR_HALF,
  COMMIT_EPSILON,
  GRID_COLS,
  GRID_ROWS,
  TILE,
  WORLD_H,
  WORLD_W,
  tileCenterX,
  tileCenterY,
} from './constants.js';
import type { Vec2 } from './types.js';

export type SolidFn = (c: number, r: number) => boolean;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function tileOf(x: number, y: number): { c: number; r: number } {
  return {
    c: clamp(Math.floor(x / TILE), 0, GRID_COLS - 1),
    r: clamp(Math.floor(y / TILE), 0, GRID_ROWS - 1),
  };
}

/** Axis-aligned overlap test between two square entities. */
export function overlaps(a: Vec2, b: Vec2, half: number): boolean {
  return Math.abs(a.x - b.x) < half * 2 && Math.abs(a.y - b.y) < half * 2;
}

/**
 * Does a character box centred at `pos` still intersect the tile whose centre
 * is `tileCenter`? This is a wider test than `overlaps`, and it has to be:
 * a balloon becomes solid again only once the character's *box* has cleared
 * its tile, not merely once their centres are apart. Using the narrower test
 * wedges a character inside the balloon they just placed.
 */
export function boxOverlapsTile(pos: Vec2, tileCenter: Vec2, half = CHAR_HALF): boolean {
  return (
    Math.abs(pos.x - tileCenter.x) < TILE / 2 + half &&
    Math.abs(pos.y - tileCenter.y) < TILE / 2 + half
  );
}

/** Does a character box centred at (x,y) intersect any solid tile? */
export function boxBlocked(x: number, y: number, solid: SolidFn, half = CHAR_HALF): boolean {
  if (x - half < 0 || y - half < 0 || x + half > WORLD_W || y + half > WORLD_H) return true;
  const c0 = Math.floor((x - half) / TILE);
  const c1 = Math.floor((x + half) / TILE);
  const r0 = Math.floor((y - half) / TILE);
  const r1 = Math.floor((y + half) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (solid(c, r)) return true;
    }
  }
  return false;
}

/**
 * The first solid tile along the leading edge of a box at (x, y) moving in
 * (sx, sy). This has to be sampled at the *attempted* position, not the
 * current one, or a character stopped just short of a wall reports its own
 * tile as the blocker — which quietly breaks pushing and kicking.
 */
function leadingSolid(
  x: number,
  y: number,
  sx: number,
  sy: number,
  solid: SolidFn,
  half: number,
): { c: number; r: number } | null {
  if (sx !== 0) {
    const c = Math.floor((x + Math.sign(sx) * half) / TILE);
    const r0 = Math.floor((y - half) / TILE);
    const r1 = Math.floor((y + half) / TILE);
    for (let r = r0; r <= r1; r++) if (solid(c, r)) return { c, r };
  }
  if (sy !== 0) {
    const r = Math.floor((y + Math.sign(sy) * half) / TILE);
    const c0 = Math.floor((x - half) / TILE);
    const c1 = Math.floor((x + half) / TILE);
    for (let c = c0; c <= c1; c++) if (solid(c, r)) return { c, r };
  }
  return null;
}

export interface MoveResult {
  moved: boolean;
  /** Set when the character was stopped head-on by a solid tile. */
  blockedC: number;
  blockedR: number;
  blocked: boolean;
}

/**
 * Axis-separated movement with a corner assist.
 *
 * There is deliberately **no** auto-centring on the perpendicular axis:
 * auto-centring would destroy straddling, and straddling is the skill
 * ceiling of the game. Instead, when a character is stopped head-on we
 * nudge them toward the nearest lane centre only if that actually frees
 * the path — which is what lets you round a corner without pixel-perfect
 * alignment, while still letting you park on a boundary line.
 */
export function moveWithCollision(
  pos: Vec2,
  dx: number,
  dy: number,
  solid: SolidFn,
  half = CHAR_HALF,
): MoveResult {
  const res: MoveResult = { moved: false, blocked: false, blockedC: -1, blockedR: -1 };

  if (dx !== 0) {
    const nx = pos.x + dx;
    if (!boxBlocked(nx, pos.y, solid, half)) {
      pos.x = nx;
      res.moved = true;
    } else {
      res.blocked = true;
      const t = leadingSolid(nx, pos.y, dx, 0, solid, half);
      if (t) {
        res.blockedC = t.c;
        res.blockedR = t.r;
      }
      // Corner assist: slide toward the nearest row centre if that opens the way.
      const row = clamp(Math.floor(pos.y / TILE), 0, GRID_ROWS - 1);
      const targetY = tileCenterY(row);
      const delta = targetY - pos.y;
      if (Math.abs(delta) > 0.5 && !boxBlocked(nx, targetY, solid, half)) {
        const stepY = clamp(delta, -Math.abs(dx), Math.abs(dx));
        if (!boxBlocked(pos.x, pos.y + stepY, solid, half)) {
          pos.y += stepY;
          res.moved = true;
        }
      }
    }
  }

  if (dy !== 0) {
    const ny = pos.y + dy;
    if (!boxBlocked(pos.x, ny, solid, half)) {
      pos.y = ny;
      res.moved = true;
    } else {
      res.blocked = true;
      const t = leadingSolid(pos.x, ny, 0, dy, solid, half);
      if (t) {
        res.blockedC = t.c;
        res.blockedR = t.r;
      }
      const col = clamp(Math.floor(pos.x / TILE), 0, GRID_COLS - 1);
      const targetX = tileCenterX(col);
      const delta = targetX - pos.x;
      if (Math.abs(delta) > 0.5 && !boxBlocked(targetX, ny, solid, half)) {
        const stepX = clamp(delta, -Math.abs(dy), Math.abs(dy));
        if (!boxBlocked(pos.x + stepX, pos.y, solid, half)) {
          pos.x += stepX;
          res.moved = true;
        }
      }
    }
  }

  return res;
}

/**
 * Straddling (걸치기).
 *
 * The logical tile is the authoritative tile for damage and for balloon
 * placement, and it only commits to a new tile once the character has moved
 * *meaningfully* into it. Park on a boundary line and your logical tile stays
 * behind — which is how a straddling player stands visually inside a water
 * jet and survives it.
 *
 * Returns true if the logical tile changed this call.
 */
export function commitLogicalTile(pos: Vec2, logical: { c: number; r: number }): boolean {
  const c = clamp(Math.floor(pos.x / TILE), 0, GRID_COLS - 1);
  const r = clamp(Math.floor(pos.y / TILE), 0, GRID_ROWS - 1);
  if (c === logical.c && r === logical.r) return false;

  const dx = Math.abs(pos.x - tileCenterX(c));
  const dy = Math.abs(pos.y - tileCenterY(r));
  if (dx <= COMMIT_EPSILON && dy <= COMMIT_EPSILON) {
    logical.c = c;
    logical.r = r;
    return true;
  }

  // Safety valve: never let the logical tile drift more than one tile away
  // (can happen after a spring hop or a respawn).
  if (Math.abs(c - logical.c) > 1 || Math.abs(r - logical.r) > 1) {
    logical.c = c;
    logical.r = r;
    return true;
  }
  return false;
}

/** True when the character is sitting on a tile boundary rather than inside a tile. */
export function isStraddling(pos: Vec2, logical: { c: number; r: number }): boolean {
  const c = clamp(Math.floor(pos.x / TILE), 0, GRID_COLS - 1);
  const r = clamp(Math.floor(pos.y / TILE), 0, GRID_ROWS - 1);
  return c !== logical.c || r !== logical.r;
}
