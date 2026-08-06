import { describe, expect, it } from 'vitest';
import { ITEM_PLANE_WINDOWS, MATCH_SECONDS_NORMAL } from '../src/sim/constants.js';
import { LOADOUT_PRESETS, itemDef } from '../src/sim/items.js';
import { GRID_COLS, GRID_ROWS } from '../src/sim/constants.js';
import { loadMap, MAPS } from '../src/sim/maps.js';
import { computeRank } from '../src/sim/rank.js';
import { CurseKind, GroundKind, ItemId, TileKind } from '../src/sim/types.js';
import { makeWorld } from './helpers.js';

describe('stat items', () => {
  it('raises a stat by one, never past the character ceiling', () => {
    const world = makeWorld(1, { characterId: 'uni' }); // 1→6 count
    const p = world.players[0];
    for (let i = 0; i < 20; i++) world.applyPickup(p, ItemId.BUBBLE);
    expect(p.stats.count).toBe(p.statsMax.count);
  });

  it('울트라 jumps jet length straight to the maximum', () => {
    const world = makeWorld(1, { characterId: 'diziny' }); // range 1→9
    const p = world.players[0];
    world.applyPickup(p, ItemId.ULTRA);
    expect(p.stats.range).toBe(9);
  });

  it('붉은 악마 grants max speed and the push ability; 스케이트 only the speed', () => {
    const a = makeWorld(1);
    world_applyRedDevil(a);
    const b = makeWorld(1);
    b.applyPickup(b.players[0], ItemId.SKATE);
    expect(b.players[0].stats.speed).toBe(b.players[0].statsMax.speed);
    expect(b.players[0].canPush).toBe(false);
  });

  it('초록 악마 spits out an eaten item and drops that stat', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    world.applyPickup(p, ItemId.BUBBLE);
    world.applyPickup(p, ItemId.BUBBLE);
    const before = p.stats.count;
    world.applyPickup(p, ItemId.GREEN_DEVIL);
    expect(p.stats.count).toBe(before - 1);
  });

  it('초록 악마 does nothing when you have eaten nothing', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    const before = { ...p.stats };
    world.applyPickup(p, ItemId.GREEN_DEVIL);
    expect(p.stats).toEqual(before);
  });

  it('보라 악마 curses you, and the potion clears it', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    world.applyPickup(p, ItemId.DEVIL);
    expect(p.curse).not.toBe(CurseKind.NONE);

    p.inventory.set(ItemId.POTION, 1);
    world.selectItem(p, ItemId.POTION);
    world.useSelectedItem(p);
    expect(p.curse).toBe(CurseKind.NONE);
  });

  it('슈퍼맨 lifts every stat to the maximum while it lasts', () => {
    const world = makeWorld(1, { characterId: 'etti' });
    const p = world.players[0];
    world.applyPickup(p, ItemId.SUPERMAN);
    expect(world.effectiveCount(p)).toBe(p.statsMax.count);
    expect(world.effectiveRange(p)).toBe(p.statsMax.range);
    expect(world.effectiveSpeed(p)).toBe(p.statsMax.speed);
  });

  it('금빛 악마 drops every enemy to speed 1', () => {
    const world = makeWorld(3, { teams: [0, 1, 1] });
    world.applyPickup(world.players[0], ItemId.GOLDEN_DEVIL);
    expect(world.players[1].stats.speed).toBe(1);
    expect(world.players[2].stats.speed).toBe(1);
    expect(world.players[0].stats.speed).toBeGreaterThan(1);
  });
});

function world_applyRedDevil(w: ReturnType<typeof makeWorld>): void {
  const p = w.players[0];
  w.applyPickup(p, ItemId.RED_DEVIL);
  expect(p.stats.speed).toBe(p.statsMax.speed);
  expect(p.canPush).toBe(true);
}

describe('placeable items', () => {
  it('a trap may only be placed between two immovable blocks', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    p.inventory.set(ItemId.TRAP, 2);
    world.selectItem(p, ItemId.TRAP);

    world.placeAt(p, 4, 4); // open floor
    world.useSelectedItem(p);
    expect(world.groundAt(4, 4).kind).toBe(GroundKind.NONE);
    expect(p.inventory.get(ItemId.TRAP)).toBe(2);

    world.setTile(3, 4, TileKind.BLOCK_HARD);
    world.setTile(5, 4, TileKind.BLOCK_HARD);
    world.useSelectedItem(p);
    expect(world.groundAt(4, 4).kind).toBe(GroundKind.TRAP);
    expect(p.inventory.get(ItemId.TRAP)).toBe(1);
  });

  it('a banana peel sends whoever steps on it sliding', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    world.placeAt(p, 3, 10);
    p.facing = 1;
    const g = world.groundAt(4, 10);
    g.kind = GroundKind.BANANA;

    p.input.right = true;
    world.advance(0.4);
    p.input.right = false;
    world.advance(0.5);
    expect(p.pos.x).toBeGreaterThan((6 + 0.5) * 40);
  });

  it('the drill breaks the block directly in front of you', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    world.placeAt(p, 4, 4);
    world.setTile(5, 4, TileKind.BLOCK_SOFT);
    p.facing = 1;
    p.inventory.set(ItemId.DRILL, 3);
    world.selectItem(p, ItemId.DRILL);
    world.useSelectedItem(p);
    expect(world.tileAt(5, 4)).toBe(TileKind.EMPTY);
    expect(p.inventory.get(ItemId.DRILL)).toBe(2);
  });

  it('the remote bomb ignores the balloon limit and fires on demand', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    p.stats.count = 1;
    world.placeAt(p, 4, 4);
    world.placeBalloon(p);
    expect(world.placeBalloon(p)).toBeNull(); // at the limit

    world.placeAt(p, 6, 4);
    p.inventory.set(ItemId.REMOTE, 3);
    world.selectItem(p, ItemId.REMOTE);
    world.useSelectedItem(p);
    expect(world.balloons.filter((b) => b.remote).length).toBe(1);

    world.placeAt(p, 10, 10);
    world.useSelectedItem(p); // second press detonates
    expect(world.balloons.filter((b) => b.remote).length).toBe(0);
  });

  it('the spring hops over an obstacle and lands beyond it', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    world.placeAt(p, 4, 4);
    world.setTile(5, 4, TileKind.BLOCK_HARD);
    p.facing = 1;
    p.inventory.set(ItemId.SPRING, 3);
    world.selectItem(p, ItemId.SPRING);
    world.useSelectedItem(p);
    world.advance(0.5);
    expect(p.logicalTile.c).toBe(6);
  });

  it('the dart detonates a balloon from range', () => {
    const world = makeWorld(2, { teams: [0, 1] });
    const shooter = world.players[0];
    const other = world.players[1];
    world.placeAt(other, 10, 12);
    world.placeBalloon(other);

    world.placeAt(shooter, 4, 12);
    shooter.facing = 1;
    shooter.inventory.set(ItemId.DART, 3);
    world.selectItem(shooter, ItemId.DART);
    world.useSelectedItem(shooter);
    expect(world.balloons.length).toBe(0);
  });
});

describe('balloon manipulation', () => {
  it('신발 lets you push a placed balloon along until it hits something', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    world.applyPickup(p, ItemId.SHOES);
    expect(p.canPush).toBe(true);

    world.placeAt(p, 3, 12);
    const b = world.placeBalloon(p)!;
    world.placeAt(p, 2, 12);
    p.facing = 1;
    p.input.right = true;
    world.advance(0.4);
    expect(b.tile.c).toBeGreaterThan(3);
  });

  it('장갑 throws a placed balloon over obstacles', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    world.applyPickup(p, ItemId.GLOVE);
    world.placeAt(p, 3, 12);
    world.placeBalloon(p);
    p.facing = 1;
    expect(world.throwHeldBalloon(p)).toBe(true);
    world.advance(0.5);
    expect(world.balloons[0].tile.c).toBeGreaterThan(3);
  });

  it('a pushed balloon bursts on contact with a push-pin', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    world.applyPickup(p, ItemId.SHOES);
    world.groundAt(6, 12).kind = GroundKind.PUSHPIN;

    world.placeAt(p, 3, 12);
    world.placeBalloon(p);
    world.placeAt(p, 2, 12);
    p.facing = 1;
    p.input.right = true;
    world.advance(1.0);
    expect(world.balloons.length).toBe(0);
  });

  it('붉은 악마 also lets you push the heart blocks', () => {
    const world = makeWorld(1, { keepBlocks: true });
    const p = world.players[0];
    world.applyPickup(p, ItemId.RED_DEVIL);
    // Patrit's heart blocks sit at (3,1) and (11,1).
    expect(world.tileAt(3, 1)).toBe(TileKind.BLOCK_PUSHABLE);
    world.setTile(3, 2, TileKind.EMPTY);
    world.setTile(3, 0, TileKind.EMPTY);
    world.placeAt(p, 3, 0);
    p.facing = 2;
    p.input.down = true;
    world.advance(1.0);
    expect(world.tileAt(3, 2)).toBe(TileKind.BLOCK_PUSHABLE);
  });
});

describe('the item plane', () => {
  it('fires on the documented remaining-clock windows and not before', () => {
    const world = makeWorld(1);
    expect(ITEM_PLANE_WINDOWS[0]).toBe(119);

    // Nothing until one minute has elapsed.
    world.clock = MATCH_SECONDS_NORMAL;
    world.advance(30);
    expect(world.events.filter((e) => e.type === 'itemPlane').length).toBe(0);

    let passes = 0;
    for (let i = 0; i < 60 * 175; i++) {
      world.step();
      passes += world.events.filter((e) => e.type === 'itemPlane').length;
    }
    expect(passes).toBe(ITEM_PLANE_WINDOWS.length);
  });

  it('does not fly on the ghost maps', () => {
    const world = makeWorld(1, { mapId: 'graveyard' });
    let passes = 0;
    for (let i = 0; i < 60 * 175; i++) {
      world.step();
      passes += world.events.filter((e) => e.type === 'itemPlane').length;
    }
    expect(passes).toBe(0);
  });
});

describe('maps and presets', () => {
  it('every map is the right shape and has all eight spawns', () => {
    for (const def of MAPS) {
      const loaded = loadMap(def);
      expect(loaded.tiles.length).toBe(GRID_COLS * GRID_ROWS);
      expect(loaded.spawns.length).toBe(8);
      for (const s of loaded.spawns) expect(loaded.tiles[s.r * GRID_COLS + s.c]).toBe(TileKind.EMPTY);
    }
  });

  it('every spawn has at least two escape routes', () => {
    for (const def of MAPS) {
      const loaded = loadMap(def);
      for (const s of loaded.spawns) {
        let open = 0;
        for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
          const c = s.c + dc;
          const r = s.r + dr;
          if (c < 0 || r < 0 || c >= GRID_COLS || r >= GRID_ROWS) continue;
          if (loaded.tiles[r * GRID_COLS + c] === TileKind.EMPTY) open++;
        }
        expect(open).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('only the camp map carries spikes, and it is closed to the AI', () => {
    for (const def of MAPS) {
      const loaded = loadMap(def);
      const hasSpikes = [...loaded.tiles].some((t) => t === TileKind.SPIKE);
      if (hasSpikes) expect(def.aiAllowed).toBe(false);
    }
  });

  it('물풍선 and 액체 appear on every map', () => {
    for (const def of MAPS) {
      const ids = def.itemPool.map(([id]) => id);
      expect(ids).toContain(ItemId.BUBBLE);
      expect(ids).toContain(ItemId.FLUID);
    }
  });

  it('노샵 and 올노 carry nothing; 기샵 is roughly four lives', () => {
    const byId = Object.fromEntries(LOADOUT_PRESETS.map((p) => [p.id, p]));
    expect(byId.noshop.items.length).toBe(0);
    expect(byId.allnone.items.length).toBe(0);
    const basic = Object.fromEntries(byId.basic.items.map((i) => [i.item, i.count]));
    expect(basic[ItemId.SHIELD]).toBe(2);
    expect(basic[ItemId.NEEDLE]).toBe(1);
  });

  it('every item has a definition', () => {
    for (const id of Object.values(ItemId)) {
      expect(itemDef(id).ko.length).toBeGreaterThan(0);
    }
  });
});

describe('rank scoring', () => {
  it('rewards restraint, speed and survival — the inverted item incentive', () => {
    const base = {
      kills: 4,
      saves: 2,
      died: false,
      enemyTier: 6,
      clearTime: 70,
      itemsUsed: 0,
      won: true,
    };
    const clean = computeRank(base);
    const spendy = computeRank({ ...base, itemsUsed: 12 });
    expect(clean.score).toBeGreaterThan(spendy.score);

    const slow = computeRank({ ...base, clearTime: 170 });
    expect(slow.score).toBeLessThan(clean.score);
  });

  it('withholds SS when every enemy was ★2 or lower', () => {
    const r = computeRank({
      kills: 8,
      saves: 4,
      died: false,
      enemyTier: 2,
      clearTime: 40,
      itemsUsed: 0,
      won: true,
    });
    expect(r.grade).not.toBe('SS');
  });
});
