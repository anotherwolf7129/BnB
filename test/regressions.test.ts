import { describe, expect, it } from 'vitest';
import {
  CONVEYOR_SPEED_PPS,
  DT,
  FUSE_SECONDS,
  ITEM_PLANE_WINDOWS,
  MATCH_SECONDS_NORMAL,
  TILE,
  tileCenterX,
} from '../src/sim/constants.js';
import { REMOTE_CHARGES } from '../src/sim/constants.js';
import { GameType, GroundKind, ItemId, PlayerState } from '../src/sim/types.js';
import { World } from '../src/sim/world.js';
import { makeWorld } from './helpers.js';

describe('regressions', () => {
  it('a balloon kicked across the map still burns its fuse', () => {
    // The fuse used to tick only while the balloon was at rest, so a kicked
    // balloon — or one riding a belt — never detonated at all.
    const world = makeWorld(1);
    world.clearBlocks();
    const p = world.players[0];
    world.applyPickup(p, ItemId.SHOES);
    world.placeAt(p, 1, 6);
    const b = world.placeBalloon(p)!;
    const before = b.fuse;
    b.moveDir = 1;
    world.advance(0.5);
    expect(b.fuse).toBeLessThan(before - 0.4);
  });

  it('a balloon left on a conveyor eventually detonates', () => {
    const world = makeWorld(1, { mapId: 'factory' });
    world.clearBlocks();
    const p = world.players[0];
    // Factory row 2 is a belt lane.
    const belt = world.conveyorAt(3, 2);
    expect(belt).not.toBeNull();
    world.placeAt(p, 3, 2);
    world.placeBalloon(p);
    world.advance(FUSE_SECONDS + 0.5);
    expect(world.balloons.length).toBe(0);
  });

  it('a conveyor carries a player who is standing still', () => {
    const world = makeWorld(1, { mapId: 'factory' });
    world.clearBlocks();
    const p = world.players[0];
    world.placeAt(p, 3, 2);
    const startX = p.pos.x;
    world.advance(0.5);
    // Row 2's left half runs right.
    expect(p.pos.x).toBeGreaterThan(startX + CONVEYOR_SPEED_PPS * 0.4);
  });

  it('a conveyor leaves players alone on maps without belts', () => {
    const world = makeWorld(1, { mapId: 'patrit' });
    world.clearBlocks();
    const p = world.players[0];
    world.placeAt(p, 7, 6);
    const { x, y } = { ...p.pos };
    world.advance(0.5);
    expect(p.pos.x).toBe(x);
    expect(p.pos.y).toBe(y);
  });

  it('the glove throws the balloon you are standing on instead of failing to stack', () => {
    const world = makeWorld(1);
    world.clearBlocks();
    const p = world.players[0];
    world.applyPickup(p, ItemId.GLOVE);
    world.placeAt(p, 4, 6);
    p.facing = 1;
    const b = world.placeBalloon(p)!;
    expect(world.balloons.length).toBe(1);

    // Pressing place again on the same tile throws rather than no-opping.
    p.input.place = true;
    world.step();
    expect(b.throwTo ?? b.tile).not.toEqual({ c: 4, r: 6 });
    expect(world.balloons.length).toBe(1);
  });

  it('detonating a remote bomb does not cost a second charge', () => {
    const world = makeWorld(1);
    world.clearBlocks();
    const p = world.players[0];
    p.inventory.set(ItemId.REMOTE, REMOTE_CHARGES);
    world.refreshSlots(p);
    world.selectItem(p, ItemId.REMOTE);
    world.placeAt(p, 4, 6);

    world.useSelectedItem(p); // place
    expect(p.inventory.get(ItemId.REMOTE)).toBe(REMOTE_CHARGES - 1);
    expect(world.balloons.length).toBe(1);

    world.useSelectedItem(p); // detonate — free
    expect(p.inventory.get(ItemId.REMOTE)).toBe(REMOTE_CHARGES - 1);
    expect(world.balloons.length).toBe(0);
  });

  it('spending the last remote charge still leaves a way to set the bomb off', () => {
    const world = makeWorld(1);
    world.clearBlocks();
    const p = world.players[0];
    p.inventory.set(ItemId.REMOTE, 1);
    world.refreshSlots(p);
    world.selectItem(p, ItemId.REMOTE);
    world.placeAt(p, 4, 6);

    world.useSelectedItem(p);
    expect(p.inventory.get(ItemId.REMOTE)).toBeUndefined();
    expect(world.balloons.length).toBe(1);
    // The slot survives as long as the bomb is on the field.
    expect(p.slots).toContain(ItemId.REMOTE);

    world.selectItem(p, ItemId.REMOTE);
    world.useSelectedItem(p);
    expect(world.balloons.length).toBe(0);
    expect(p.slots).not.toContain(ItemId.REMOTE);
  });

  it('a potion dissolves the bond you are standing in', () => {
    const world = makeWorld(1);
    world.clearBlocks();
    const p = world.players[0];
    world.placeAt(p, 4, 6);
    const g = world.groundAt(4, 6);
    g.kind = GroundKind.BOND;
    world.advance(DT * 2);
    expect(p.onBond).toBe(true);

    p.inventory.set(ItemId.POTION, 1);
    world.refreshSlots(p);
    world.selectItem(p, ItemId.POTION);
    world.useSelectedItem(p);
    world.advance(DT * 2);
    expect(world.groundAt(4, 6).kind).toBe(GroundKind.NONE);
    expect(p.onBond).toBe(false);
  });

  it('a bubbled time-bomb carrier gives the bomb up rather than holding two', () => {
    const world = makeWorld(2, { gameType: GameType.TIMEBOMB, teams: [0, 1] });
    world.clearBlocks();
    const [a, b] = world.players;
    a.hasBomb = true;
    a.bombTimer = 5;
    world.trapPlayer(a, b.id);
    expect(a.hasBomb).toBe(false);
    world.rescue(a, a.id);
    expect(a.hasBomb).toBe(false);
  });

  it('a short match does not fire every stale item-plane pass on tick one', () => {
    const world = new World({
      gameType: GameType.NORMAL,
      players: [{ name: 'P0', team: 0, characterId: 'bazzi', aiTier: null }],
      mapId: 'patrit',
      seed: 7,
      matchSeconds: 45,
    });
    world.begin();
    world.clearBlocks();
    world.advance(1);
    const drops = world.ground.filter((g) => g.kind === GroundKind.ITEM).length;
    expect(drops).toBe(0);
  });

  it('the standard 3:00 match still flies every documented plane window', () => {
    const world = new World({
      gameType: GameType.NORMAL,
      players: [{ name: 'P0', team: 0, characterId: 'bazzi', aiTier: null }],
      mapId: 'patrit',
      seed: 7,
      matchSeconds: MATCH_SECONDS_NORMAL,
    });
    world.begin();
    world.clearBlocks();
    let passes = 0;
    for (let i = 0; i < MATCH_SECONDS_NORMAL / DT; i++) {
      world.step();
      passes += world.events.filter((e) => e.type === 'itemPlane').length;
    }
    expect(passes).toBe(ITEM_PLANE_WINDOWS.length);
  });

  it('killing an enemy captain credits every teammate it wipes out', () => {
    const world = makeWorld(4, { gameType: GameType.CAPTAIN, teams: [0, 0, 1, 1] });
    world.clearBlocks();
    const killer = world.players[0];
    const captain = world.players[2];
    captain.isCaptain = true;
    world.players[3].isCaptain = false;

    world.killPlayer(captain, killer.id);
    expect(world.players[3].state).toBe(PlayerState.DEAD);
    // One for the captain, one for the teammate that went down with them.
    expect(killer.kills).toBe(2);
  });

  it('respawn finds somewhere to stand even with every spawn occupied', () => {
    const world = makeWorld(2, { gameType: GameType.RESPAWN, teams: [0, 1] });
    world.clearBlocks();
    const p = world.players[0];
    // Park a balloon on every spawn so none of them is free.
    const owner = world.players[1];
    owner.stats.count = 99;
    for (const s of world.map.spawns) {
      world.placeAt(owner, s.c, s.r);
      world.placeBalloon(owner);
    }
    world.killPlayer(p, 1);
    world.advance(4);
    expect(p.state).toBe(PlayerState.ALIVE);
    expect(world.solid(p.logicalTile.c, p.logicalTile.r)).toBe(false);
  });

  it('a needle clears the record of who bubbled you', () => {
    const world = makeWorld(2, { teams: [0, 1] });
    world.clearBlocks();
    const [p, enemy] = world.players;
    p.inventory.set(ItemId.NEEDLE, 1);
    world.refreshSlots(p);
    world.trapPlayer(p, enemy.id);
    expect(p.bubbledBy).toBe(enemy.id);
    world.selectItem(p, ItemId.NEEDLE);
    world.useSelectedItem(p);
    expect(p.state).toBe(PlayerState.ALIVE);
    expect(p.bubbledBy).toBeNull();
  });

  it('a straddling player is still carried by the belt under their feet', () => {
    const world = makeWorld(1, { mapId: 'desert' });
    world.clearBlocks();
    const p = world.players[0];
    // Desert row 3 runs left.
    world.placeAt(p, 8, 3);
    p.pos.x = tileCenterX(8) + TILE * 0.4;
    const startX = p.pos.x;
    world.advance(0.3);
    expect(p.pos.x).toBeLessThan(startX);
  });
});
