import { describe, expect, it } from 'vitest';
import { FUSE_SECONDS, GRID_COLS, GRID_ROWS } from '../src/sim/constants.js';
import { GroundKind, TileKind } from '../src/sim/types.js';
import type { World } from '../src/sim/world.js';
import { makeWorld } from './helpers.js';

describe('water jets', () => {
  it('emits a cross of waterRange tiles in each cardinal direction', () => {
    const world = makeWorld(1);
    const tiles = world.jetTiles({ c: 4, r: 4 }, 3);
    // Origin plus 3 tiles in each of 4 directions.
    expect(tiles.length).toBe(1 + 4 * 3);
    expect(tiles.some((t) => t.c === 7 && t.r === 4)).toBe(true);
    expect(tiles.some((t) => t.c === 1 && t.r === 4)).toBe(true);
  });

  it('destroys one soft block per direction and then stops', () => {
    const world = makeWorld(1);
    world.setTile(9, 2, TileKind.BLOCK_SOFT);
    world.setTile(10, 2, TileKind.BLOCK_SOFT);

    const tiles = world.jetTiles({ c: 7, r: 2 }, 4);
    const right = tiles.filter((t) => t.dir === 1);
    expect(right.map((t) => t.c)).toEqual([8, 9]);

    const p = world.players[0];
    world.placeAt(p, 7, 2);
    p.stats.range = 4;
    const b = world.placeBalloon(p)!;
    world.explode(b);

    expect(world.tileAt(9, 2)).toBe(TileKind.EMPTY);
    expect(world.tileAt(10, 2)).toBe(TileKind.BLOCK_SOFT);
  });

  it('is stopped by hard blocks without destroying them', () => {
    const world = makeWorld(1);
    // Patrit's central structure sits at columns 6-8, rows 5-7.
    expect(world.tileAt(7, 5)).toBe(TileKind.BLOCK_HARD);
    const tiles = world.jetTiles({ c: 7, r: 3 }, 4);
    const down = tiles.filter((t) => t.dir === 2);
    expect(down.map((t) => t.r)).toEqual([4]);
    expect(world.tileAt(7, 5)).toBe(TileKind.BLOCK_HARD);
  });

  it('chains: a live balloon caught in a jet detonates immediately', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    p.stats.count = 3;
    p.stats.range = 2;

    world.placeAt(p, 2, 2);
    world.placeBalloon(p);
    world.placeAt(p, 4, 2);
    const later = world.placeBalloon(p)!;
    later.fuse = FUSE_SECONDS * 2; // deliberately much later

    world.placeAt(p, 2, 10);
    world.advance(FUSE_SECONDS + 0.05);

    // Both are gone: the first burst set off the second even though its own
    // fuse had seconds left.
    expect(world.balloons.length).toBe(0);
  });

  it('a straight line bursts near-simultaneously; a crooked one staggers', () => {
    const straight = makeWorld(1);
    {
      const p = straight.players[0];
      p.stats.count = 3;
      p.stats.range = 1;
      straight.placeAt(p, 2, 2);
      straight.placeBalloon(p);
      straight.placeAt(p, 3, 2);
      straight.placeBalloon(p);
      straight.placeAt(p, 4, 2);
      straight.placeBalloon(p);
      straight.placeAt(p, 2, 10);
      // Stagger the fuses as if placed a beat apart.
      straight.balloons[1].fuse += 0.5;
      straight.balloons[2].fuse += 1.0;
      straight.advance(FUSE_SECONDS + 0.05);
      expect(straight.balloons.length).toBe(0);
    }

    const crooked = makeWorld(1);
    {
      const p = crooked.players[0];
      p.stats.count = 3;
      p.stats.range = 1;
      crooked.placeAt(p, 2, 2);
      crooked.placeBalloon(p);
      crooked.placeAt(p, 4, 3);
      crooked.placeBalloon(p);
      crooked.placeAt(p, 6, 4);
      crooked.placeBalloon(p);
      crooked.placeAt(p, 2, 10);
      crooked.balloons[1].fuse += 0.5;
      crooked.balloons[2].fuse += 1.0;
      crooked.advance(FUSE_SECONDS + 0.05);
      // No chain: the later two are still ticking.
      expect(crooked.balloons.length).toBe(2);
    }
  });

  it('clears floor items and bond, but never a trap', () => {
    const world = makeWorld(1);
    const item = world.groundAt(4, 2);
    item.kind = GroundKind.ITEM;
    item.item = 'bubble' as never;
    const bond = world.groundAt(5, 2);
    bond.kind = GroundKind.BOND;
    const trap = world.groundAt(6, 2);
    trap.kind = GroundKind.TRAP;

    const p = world.players[0];
    world.placeAt(p, 3, 2);
    p.stats.range = 4;
    const b = world.placeBalloon(p)!;
    world.placeAt(p, 3, 10);
    world.explode(b);

    expect(world.groundAt(4, 2).kind).toBe(GroundKind.NONE);
    expect(world.groundAt(5, 2).kind).toBe(GroundKind.NONE);
    // Water cannot remove a trap at all — that is what makes it area denial.
    expect(world.groundAt(6, 2).kind).toBe(GroundKind.TRAP);
  });

  it('a balloon placed on a spike detonates immediately', () => {
    const world = makeWorld(1, { mapId: 'camp' });
    const p = world.players[0];
    const spike = findTile(world, TileKind.SPIKE);
    world.placeAt(p, spike.c, spike.r);
    const b = world.placeBalloon(p)!;
    expect(b.fuse).toBeLessThan(0.1);
  });

  it('a balloon placed on an ordinary tile next to a spike keeps its full fuse', () => {
    const world = makeWorld(1, { mapId: 'camp' });
    world.clearBlocks();
    const p = world.players[0];
    const spike = findTile(world, TileKind.SPIKE);
    // Every walkable neighbour of a spike must behave like any other floor.
    const neighbours = [
      { c: spike.c - 1, r: spike.r },
      { c: spike.c + 1, r: spike.r },
      { c: spike.c, r: spike.r - 1 },
      { c: spike.c, r: spike.r + 1 },
    ].filter((t) => world.tileAt(t.c, t.r) === TileKind.EMPTY);
    expect(neighbours.length).toBeGreaterThan(0);

    for (const t of neighbours) {
      world.placeAt(p, t.c, t.r);
      p.liveBalloons = 0;
      const b = world.placeBalloon(p)!;
      expect(b.fuse).toBe(FUSE_SECONDS);
      world.explode(b);
    }
  });
});

function findTile(world: World, kind: TileKind): { c: number; r: number } {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (world.tileAt(c, r) === kind) return { c, r };
    }
  }
  throw new Error(`no ${kind} tile on this map`);
}
