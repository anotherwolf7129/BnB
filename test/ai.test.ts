import { describe, expect, it } from 'vitest';
import { AIDirector } from '../src/ai/controller.js';
import { buildDangerMap } from '../src/ai/danger.js';
import { DODGE_DECAY_START, dodgeDecayChance, tierParams } from '../src/ai/tiers.js';
import { FUSE_SECONDS, tileIndex } from '../src/sim/constants.js';
import { ItemId, PlayerState } from '../src/sim/types.js';
import { makeWorld } from './helpers.js';

describe('danger map', () => {
  it('marks every tile a jet will cover with the time until it lands', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    p.stats.range = 3;
    world.placeAt(p, 7, 2);
    world.placeBalloon(p);

    const danger = buildDangerMap(world, { resolveChains: true, predictBlockClears: false });
    expect(danger[tileIndex(7, 2)]).toBeCloseTo(FUSE_SECONDS, 2);
    expect(danger[tileIndex(10, 2)]).toBeCloseTo(FUSE_SECONDS, 2);
    expect(danger[tileIndex(11, 2)]).toBe(Infinity);
  });

  it('resolves chains before propagating, so a late balloon inherits the early fuse', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    p.stats.count = 2;
    p.stats.range = 2;
    world.placeAt(p, 2, 2);
    world.placeBalloon(p);
    world.placeAt(p, 4, 2);
    const later = world.placeBalloon(p)!;
    later.fuse = 10;

    const naive = buildDangerMap(world, { resolveChains: false, predictBlockClears: false });
    // Without chain resolution, tiles that only the late balloon covers look
    // like they are ten seconds away.
    expect(naive[tileIndex(6, 2)]).toBeCloseTo(10, 2);

    const resolved = buildDangerMap(world, { resolveChains: true, predictBlockClears: false });
    expect(resolved[tileIndex(6, 2)]).toBeCloseTo(FUSE_SECONDS, 1);
  });

  it('★6 also marks tiles that a soon-to-break block is currently shielding', () => {
    const world = makeWorld(1, { keepBlocks: true });
    world.clearBlocks();
    world.setTile(9, 2, 1); // BLOCK_SOFT
    const p = world.players[0];
    p.stats.range = 4;
    world.placeAt(p, 7, 2);
    world.placeBalloon(p);

    const plain = buildDangerMap(world, { resolveChains: true, predictBlockClears: false });
    expect(plain[tileIndex(10, 2)]).toBe(Infinity);

    const predictive = buildDangerMap(world, { resolveChains: true, predictBlockClears: true });
    expect(predictive[tileIndex(10, 2)]).toBeLessThan(Infinity);
  });
});

describe('difficulty ladder', () => {
  it('matches the documented internal levels', () => {
    expect(tierParams(1).level).toBe(3);
    expect(tierParams(2).level).toBe(10);
    expect(tierParams(3).level).toBe(43);
    expect(tierParams(4).level).toBe(52);
    expect(tierParams(5).level).toBe(109);
    expect(tierParams(6).level).toBe(163);
  });

  it('★1 picks items up but never uses them', () => {
    expect(tierParams(1).usesItems).toBe(false);
    expect(tierParams(2).usesItems).toBe(true);
  });

  it('★5 carries needle and shield; ★6 adds spring', () => {
    const five = tierParams(5).ownedItems.map((i) => i.item);
    expect(five).toContain(ItemId.NEEDLE);
    expect(five).toContain(ItemId.SHIELD);
    expect(five).not.toContain(ItemId.SPRING);

    const six = tierParams(6).ownedItems.map((i) => i.item);
    expect(six).toContain(ItemId.SPRING);
  });

  it('only ★2 gets tired — dodge decay ramps in after 45 seconds', () => {
    const two = tierParams(2);
    expect(dodgeDecayChance(two, DODGE_DECAY_START - 1)).toBe(0);
    expect(dodgeDecayChance(two, DODGE_DECAY_START + 30)).toBeGreaterThan(0);
    expect(dodgeDecayChance(tierParams(4), 200)).toBe(0);
  });

  it('rescue is baitable below ★5 and guarded at ★5 and up', () => {
    expect(tierParams(4).rescuePathSafety).toBe(false);
    expect(tierParams(5).rescuePathSafety).toBe(true);
  });

  it('low tiers have lower stat ceilings', () => {
    const world = makeWorld(2, { aiTiers: [null, 1] });
    new AIDirector(world, 1);
    expect(world.players[1].statsMax.count).toBeLessThan(world.players[0].statsMax.count);
  });
});

describe('AI behaviour', () => {
  it('★4 flees a balloon dropped next to it and survives', () => {
    const world = makeWorld(2, { teams: [0, 1], aiTiers: [null, 4] });
    const director = new AIDirector(world, 7);
    const ai = world.players[1];
    const human = world.players[0];

    world.placeAt(ai, 7, 10);
    world.placeAt(human, 6, 10);
    human.stats.range = 3;
    world.placeBalloon(human);
    world.placeAt(human, 1, 1);

    for (let i = 0; i < 240; i++) {
      director.update();
      world.step();
    }
    expect(ai.state).toBe(PlayerState.ALIVE);
  });

  it('★1 walks into its own blast because it has no self-trap check', () => {
    expect(tierParams(1).selfTrapCheck).toBe('none');
    expect(tierParams(4).selfTrapCheck).toBe('on');
  });

  it('an AI will not place a balloon on or beside a spike', () => {
    // This is the bug that got Camp excluded from 협공배틀 in the original.
    const world = makeWorld(2, { teams: [0, 1], aiTiers: [null, 4], mapId: 'camp' });
    const director = new AIDirector(world, 3);
    const ai = world.players[1];
    world.placeAt(ai, 2, 1); // directly above a spike

    for (let i = 0; i < 60; i++) {
      director.update();
      world.step();
      const onSpikeTile = world.balloons.some(
        (b) => b.ownerId === ai.id && b.tile.c === 2 && b.tile.r === 2,
      );
      expect(onSpikeTile).toBe(false);
    }
  });

  it('AI teammates come to rescue a bubbled ally', () => {
    const world = makeWorld(3, { teams: [0, 1, 1], aiTiers: [null, 4, 4] });
    const director = new AIDirector(world, 11);
    const trappedAlly = world.players[1];
    const rescuer = world.players[2];

    world.placeAt(trappedAlly, 7, 10);
    world.placeAt(rescuer, 10, 10);
    world.trapPlayer(trappedAlly, 0);
    trappedAlly.drownTime = 20; // plenty of time to be reached

    let rescued = false;
    for (let i = 0; i < 400 && !rescued; i++) {
      director.update();
      world.step();
      if (trappedAlly.state === PlayerState.ALIVE) rescued = true;
    }
    expect(rescued).toBe(true);
    expect(rescuer.saves).toBeGreaterThan(0);
  });

  it('a full 1v3 match runs to completion without stalling', () => {
    const world = makeWorld(4, { teams: [0, 1, 1, 1], aiTiers: [null, 4, 4, 4], keepBlocks: true });
    const director = new AIDirector(world, 5);
    for (let i = 0; i < 60 * 200; i++) {
      director.update();
      world.step();
      if (world.result) break;
    }
    expect(world.result).not.toBeNull();
  });
});
