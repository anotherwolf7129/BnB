import { describe, expect, it } from 'vitest';
import { AIDirector } from '../src/ai/controller.js';
import { DT, GRID_COLS, GRID_ROWS, tileIndex } from '../src/sim/constants.js';
import { MAPS, loadMap } from '../src/sim/maps.js';
import { MatchPhase, PlayerState, TileKind, isBlock } from '../src/sim/types.js';
import { makeWorld } from './helpers.js';

describe('map roster', () => {
  it('covers the themed lands of the 마을 overworld', () => {
    const lands = new Set(MAPS.map((m) => m.land));
    for (const land of [
      '패트릿',
      '빌리지',
      '포레스트',
      '비치',
      '바다',
      '데저트',
      '아이스',
      '캠프',
      '공동묘지',
      '던전',
      '팩토리',
      '캔디',
      '스페이스',
      '로두마니 성',
    ]) {
      expect(lands.has(land), `missing land ${land}`).toBe(true);
    }
  });

  it('every map has unique ids and loads at the right dimensions', () => {
    expect(new Set(MAPS.map((m) => m.id)).size).toBe(MAPS.length);
    for (const def of MAPS) {
      const loaded = loadMap(def);
      expect(loaded.tiles.length).toBe(GRID_COLS * GRID_ROWS);
      expect(loaded.spawns.length).toBe(8);
      for (const s of loaded.spawns) {
        expect(loaded.tiles[tileIndex(s.c, s.r)]).toBe(TileKind.EMPTY);
      }
    }
  });

  it('every spawn can reach every other spawn once the soft blocks are gone', () => {
    for (const def of MAPS) {
      const world = makeWorld(1, { mapId: def.id });
      world.clearBlocks();
      const start = world.map.spawns[0];
      const seen = new Set<number>([tileIndex(start.c, start.r)]);
      const queue = [start];
      while (queue.length) {
        const { c, r } = queue.shift()!;
        for (const [dc, dr] of [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ]) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= GRID_COLS || nr >= GRID_ROWS) continue;
          const idx = tileIndex(nc, nr);
          if (seen.has(idx) || isBlock(world.tileAt(nc, nr))) continue;
          seen.add(idx);
          queue.push({ c: nc, r: nr });
        }
      }
      for (const s of world.map.spawns) {
        expect(seen.has(tileIndex(s.c, s.r)), `${def.id}: spawn ${s.c},${s.r} is cut off`).toBe(true);
      }
    }
  });

  it('leaves no pocket of floor walled off by indestructible scenery', () => {
    // An unreachable pocket silently swallows item-plane drops.
    for (const def of MAPS) {
      const world = makeWorld(1, { mapId: def.id });
      world.clearBlocks();
      let reachable = 0;
      let floor = 0;
      const seen = new Set<number>();
      const start = world.map.spawns[0];
      const queue = [start];
      seen.add(tileIndex(start.c, start.r));
      while (queue.length) {
        const { c, r } = queue.shift()!;
        reachable++;
        for (const [dc, dr] of [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ]) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= GRID_COLS || nr >= GRID_ROWS) continue;
          const idx = tileIndex(nc, nr);
          if (seen.has(idx) || isBlock(world.tileAt(nc, nr))) continue;
          seen.add(idx);
          queue.push({ c: nc, r: nr });
        }
      }
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) if (!isBlock(world.tileAt(c, r))) floor++;
      }
      expect(reachable, `${def.id} has walled-off floor`).toBe(floor);
    }
  });

  it('only the maps that advertise belts actually carry them', () => {
    const withBelts = MAPS.filter((m) => loadMap(m).conveyor.some((v) => v !== 0)).map((m) => m.id);
    expect(withBelts.sort()).toEqual(['desert', 'factory', 'ice']);
    // A belt tile is floor, never scenery.
    for (const def of MAPS) {
      const loaded = loadMap(def);
      loaded.conveyor.forEach((v, i) => {
        if (v !== 0) expect(loaded.tiles[i]).toBe(TileKind.EMPTY);
      });
    }
  });

  it('a COM match on every map runs without the AI blowing itself up at once', () => {
    for (const def of MAPS) {
      const world = makeWorld(4, {
        mapId: def.id,
        teams: [0, 1, 1, 1],
        aiTiers: [4, 4, 4, 4],
        keepBlocks: true,
      });
      const director = new AIDirector(world, 99);
      for (let i = 0; i < 12 / DT && world.phase === MatchPhase.PLAYING; i++) {
        director.update();
        world.step();
      }
      // Twelve seconds in, at least most of the field should still be up.
      const alive = world.players.filter((p) => p.state !== PlayerState.DEAD).length;
      expect(alive, `${def.id}: only ${alive} of 4 survived the opening`).toBeGreaterThanOrEqual(3);
    }
  });

  it('only Camp carries spikes, and the item plane skips the ghost maps', () => {
    const withSpikes = MAPS.filter((m) =>
      loadMap(m).tiles.some((t) => t === TileKind.SPIKE),
    ).map((m) => m.id);
    expect(withSpikes).toEqual(['camp']);
    expect(MAPS.filter((m) => !m.itemPlane).map((m) => m.id).sort()).toEqual([
      'dungeon',
      'graveyard',
    ]);
  });
});
