import { DIRS, GRID_COLS, GRID_ROWS, JET_SECONDS, TILE, inBounds, tileIndex } from '../sim/constants.js';
import { TileKind, isDestructible, type TileRef } from '../sim/types.js';
import type { World } from '../sim/world.js';
import type { Lookahead } from './tiers.js';

export const TILE_COUNT = GRID_COLS * GRID_ROWS;

export interface DangerOptions {
  /** Resolve chain detonations before propagating. */
  resolveChains: boolean;
  /** Mark tiles that a soon-to-be-cleared soft block is currently shielding. */
  predictBlockClears: boolean;
}

/**
 * The core primitive: for every tile, the earliest time at which a jet will
 * cover it. Infinity means safe.
 *
 * Two subtleties make the AI feel right, and both are tier-gated:
 *
 *  1. Chains are resolved *before* propagating. Otherwise the AI walks into a
 *     tile that is "safe from balloon A" but gets hit early because A chains
 *     into B. Human players make this mistake; ★4 and up should not.
 *  2. Tiles behind a soft block are marked "will become dangerous", because a
 *     balloon that clears a block this tick opens a firing lane next tick.
 */
export function buildDangerMap(world: World, opts: DangerOptions): Float32Array {
  const danger = new Float32Array(TILE_COUNT).fill(Infinity);
  const balloons = world.balloons.filter((b) => !b.throwFrom);

  const eff = new Map<number, number>();
  for (const b of balloons) {
    // A remote bomb has no fuse — it detonates on its owner's command, so it
    // contributes no predictable timing.
    eff.set(b.id, b.remote ? Infinity : Math.max(0, b.fuse));
  }

  if (opts.resolveChains && balloons.length > 1) {
    const jetCache = new Map<number, ReturnType<World['jetTiles']>>();
    for (const b of balloons) jetCache.set(b.id, world.jetTiles(b.tile, b.range));
    for (let iter = 0; iter < balloons.length; iter++) {
      let changed = false;
      for (const b of balloons) {
        const t = eff.get(b.id)!;
        if (!Number.isFinite(t)) continue;
        for (const tile of jetCache.get(b.id)!) {
          for (const other of balloons) {
            if (other.id === b.id) continue;
            if (other.tile.c !== tile.c || other.tile.r !== tile.r) continue;
            if (eff.get(other.id)! > t) {
              eff.set(other.id, t);
              changed = true;
            }
          }
        }
      }
      if (!changed) break;
    }
  }

  for (const b of balloons) {
    const t = eff.get(b.id)!;
    if (!Number.isFinite(t)) continue;
    const i0 = tileIndex(b.tile.c, b.tile.r);
    if (t < danger[i0]) danger[i0] = t;

    for (const d of DIRS) {
      for (let i = 1; i <= b.range; i++) {
        const c = b.tile.c + d.c * i;
        const r = b.tile.r + d.r * i;
        if (!inBounds(c, r)) break;
        const kind = world.tileAt(c, r);
        if (kind === TileKind.BLOCK_HARD) break;
        const idx = tileIndex(c, r);
        if (t < danger[idx]) danger[idx] = t;
        if (isDestructible(kind)) {
          if (opts.predictBlockClears) {
            // The block stops this jet, but it is about to stop existing.
            // Anything sheltering behind it is living on borrowed time.
            markBehind(world, danger, c, r, d, b.range - i, t + JET_SECONDS);
          }
          break;
        }
      }
    }
  }

  // A jet already on the field is lethal right now.
  for (const j of world.jets) {
    for (const t of j.tiles) danger[tileIndex(t.c, t.r)] = 0;
  }

  return danger;
}

function markBehind(
  world: World,
  danger: Float32Array,
  fromC: number,
  fromR: number,
  d: { c: number; r: number },
  remaining: number,
  when: number,
): void {
  for (let i = 1; i <= remaining; i++) {
    const c = fromC + d.c * i;
    const r = fromR + d.r * i;
    if (!inBounds(c, r)) return;
    const kind = world.tileAt(c, r);
    if (kind === TileKind.BLOCK_HARD) return;
    const idx = tileIndex(c, r);
    if (when < danger[idx]) danger[idx] = when;
    if (isDestructible(kind)) return;
  }
}

/**
 * Low tiers do not see the whole board. ★1 knows only about the tile it is
 * standing on, ★2 about its immediate neighbourhood.
 */
export function maskDanger(danger: Float32Array, from: TileRef, mode: Lookahead): Float32Array {
  if (mode !== 'own' && mode !== 'own1') return danger;
  const radius = mode === 'own' ? 0 : 1;
  const out = new Float32Array(TILE_COUNT).fill(Infinity);
  for (let r = from.r - radius; r <= from.r + radius; r++) {
    for (let c = from.c - radius; c <= from.c + radius; c++) {
      if (!inBounds(c, r)) continue;
      if (Math.abs(c - from.c) + Math.abs(r - from.r) > radius) continue;
      const i = tileIndex(c, r);
      out[i] = danger[i];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pathfinding
// ---------------------------------------------------------------------------

export interface BfsResult {
  dist: Int32Array;
  parent: Int32Array;
  /** Seconds of travel to reach each tile at the searcher's speed. */
  eta: Float32Array;
}

const NEIGHBOUR_BUF = new Int32Array(4);

/**
 * Breadth-first search across walkable tiles, tracking arrival time from the
 * searcher's own speed. When a danger map is supplied, a tile is only
 * expanded if we would arrive with `margin` seconds to spare — which is
 * exactly the "valid refuge" test, applied to the whole path rather than just
 * the destination.
 */
export function bfs(
  world: World,
  start: TileRef,
  pixelsPerSecond: number,
  danger?: Float32Array,
  margin = 0,
  passable?: (c: number, r: number) => boolean,
): BfsResult {
  const dist = new Int32Array(TILE_COUNT).fill(-1);
  const parent = new Int32Array(TILE_COUNT).fill(-1);
  const eta = new Float32Array(TILE_COUNT).fill(Infinity);
  const perTile = TILE / Math.max(1, pixelsPerSecond);

  const startIdx = tileIndex(start.c, start.r);
  dist[startIdx] = 0;
  eta[startIdx] = 0;
  const queue: number[] = [startIdx];
  let head = 0;

  const walkable = passable ?? ((c: number, r: number) => !world.solid(c, r));

  while (head < queue.length) {
    const cur = queue[head++];
    const cc = cur % GRID_COLS;
    const cr = (cur - cc) / GRID_COLS;
    const nextEta = eta[cur] + perTile;

    NEIGHBOUR_BUF[0] = cr > 0 ? cur - GRID_COLS : -1;
    NEIGHBOUR_BUF[1] = cc < GRID_COLS - 1 ? cur + 1 : -1;
    NEIGHBOUR_BUF[2] = cr < GRID_ROWS - 1 ? cur + GRID_COLS : -1;
    NEIGHBOUR_BUF[3] = cc > 0 ? cur - 1 : -1;

    for (let k = 0; k < 4; k++) {
      const n = NEIGHBOUR_BUF[k];
      if (n < 0 || dist[n] !== -1) continue;
      const nc = n % GRID_COLS;
      const nr = (n - nc) / GRID_COLS;
      if (!walkable(nc, nr)) continue;
      if (danger && nextEta + margin >= danger[n]) continue;
      dist[n] = dist[cur] + 1;
      eta[n] = nextEta;
      parent[n] = cur;
      queue.push(n);
    }
  }

  return { dist, parent, eta };
}

/** First step of the shortest path from `start` to `target`, or null. */
export function firstStep(result: BfsResult, start: TileRef, targetIdx: number): TileRef | null {
  if (result.dist[targetIdx] < 0) return null;
  const startIdx = tileIndex(start.c, start.r);
  let cur = targetIdx;
  if (cur === startIdx) return null;
  while (result.parent[cur] !== startIdx) {
    cur = result.parent[cur];
    if (cur < 0) return null;
  }
  const c = cur % GRID_COLS;
  return { c, r: (cur - c) / GRID_COLS };
}
