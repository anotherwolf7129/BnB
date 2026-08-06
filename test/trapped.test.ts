import { describe, expect, it } from 'vitest';
import { DROWN_SECONDS, tileCenterX, tileCenterY } from '../src/sim/constants.js';
import { ItemId, PlayerState } from '../src/sim/types.js';
import { makeWorld } from './helpers.js';

/**
 * The trapped state is the game's most distinctive system, and it is
 * explicitly *not* "you died".
 */
describe('trapped state', () => {
  it('bubbles rather than kills, and blocks balloon placement', () => {
    const world = makeWorld(2);
    const victim = world.players[0];
    world.placeAt(victim, 4, 4);
    world.trapPlayer(victim, 1);

    expect(victim.state).toBe(PlayerState.TRAPPED);
    expect(world.placeBalloon(victim)).toBeNull();
  });

  it('a teammate frees you on contact, and gets credited with the save', () => {
    const world = makeWorld(3, { teams: [0, 0, 1] });
    const victim = world.players[0];
    const mate = world.players[1];
    world.placeAt(victim, 4, 4);
    world.placeAt(mate, 4, 4);
    world.trapPlayer(victim, 2);

    world.step();
    expect(victim.state).toBe(PlayerState.ALIVE);
    expect(mate.saves).toBe(1);
    expect(victim.deaths).toBe(0);
  });

  it('an enemy pops the bubble and takes the kill', () => {
    const world = makeWorld(3, { teams: [0, 0, 1] });
    const victim = world.players[0];
    const enemy = world.players[2];
    world.placeAt(victim, 4, 4);
    world.placeAt(enemy, 4, 4);
    world.trapPlayer(victim, 2);

    world.step();
    expect(victim.state).toBe(PlayerState.DEAD);
    expect(enemy.kills).toBe(1);
  });

  it('drowning denies the opponent a kill', () => {
    // Documented as a real reason not to take the oxygen tank.
    const world = makeWorld(3, { teams: [0, 0, 1] });
    const victim = world.players[0];
    const enemy = world.players[2];
    world.placeAt(victim, 2, 2);
    world.placeAt(enemy, 12, 10);
    world.trapPlayer(victim, enemy.id);

    world.advance(DROWN_SECONDS + 0.2);
    expect(victim.state).toBe(PlayerState.DEAD);
    expect(victim.deaths).toBe(1);
    expect(enemy.kills).toBe(0);
  });

  it('the needle escapes instantly, and only from inside a bubble', () => {
    const world = makeWorld(2);
    const p = world.players[0];
    p.inventory.set(ItemId.NEEDLE, 1);

    // Not trapped: the needle must not be consumed.
    world.useSelectedItem(p);
    expect(p.inventory.get(ItemId.NEEDLE)).toBe(1);

    world.trapPlayer(p, 1);
    world.useSelectedItem(p);
    expect(p.state).toBe(PlayerState.ALIVE);
    expect(p.inventory.get(ItemId.NEEDLE)).toBeUndefined();
  });

  it('the oxygen tank extends the drown timer and destroys a held needle', () => {
    const world = makeWorld(2);
    const p = world.players[0];
    p.inventory.set(ItemId.NEEDLE, 1);

    world.applyPickup(p, ItemId.OXYGEN);
    expect(p.inventory.has(ItemId.NEEDLE)).toBe(false);

    world.trapPlayer(p, 1);
    expect(p.drownTime).toBeGreaterThan(DROWN_SECONDS);
  });

  it('a shield absorbs the hit entirely but is shortened by it', () => {
    const world = makeWorld(2);
    const p = world.players[0];
    p.inventory.set(ItemId.SHIELD, 1);
    world.useSelectedItem(p);
    const before = p.shieldUntil;

    world.trapPlayer(p, 1);
    expect(p.state).toBe(PlayerState.ALIVE);
    expect(p.shieldUntil).toBeLessThan(before);
  });

  it('superman is cancelled by a jet rather than absorbing it', () => {
    const world = makeWorld(2);
    const p = world.players[0];
    world.applyPickup(p, ItemId.SUPERMAN);
    expect(p.supermanUntil).toBeGreaterThan(0);

    world.trapPlayer(p, 1);
    expect(p.supermanUntil).toBe(0);
    expect(p.state).toBe(PlayerState.TRAPPED);
  });

  it('a bubbled character can still move, but barely', () => {
    const world = makeWorld(2);
    const p = world.players[0];
    world.placeAt(p, 4, 4);
    world.trapPlayer(p, 1);

    const startX = p.pos.x;
    p.input.right = true;
    world.advance(0.5);
    const moved = p.pos.x - startX;
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(12);
  });

  it('2v1 cross-line pin: two attackers can corner one defender', () => {
    // A horizontal line and a vertical line into a corner leaves no escape.
    const world = makeWorld(3, { teams: [0, 1, 1] });
    const victim = world.players[0];
    const a = world.players[1];
    const b = world.players[2];

    world.placeAt(victim, 0, 0); // corner
    for (const [c, r] of [[1, 0], [2, 0]] as const) {
      world.placeAt(a, c, r);
      a.stats.count = 4;
      world.placeBalloon(a);
    }
    for (const [c, r] of [[0, 1], [0, 2]] as const) {
      world.placeAt(b, c, r);
      b.stats.count = 4;
      world.placeBalloon(b);
    }
    world.placeAt(a, 12, 12);
    world.placeAt(b, 12, 10);

    world.advance(3.0);
    expect(victim.state).not.toBe(PlayerState.ALIVE);
  });

  it('keeps a freed character briefly invulnerable so they are not instantly re-bubbled', () => {
    const world = makeWorld(3, { teams: [0, 0, 1] });
    const victim = world.players[0];
    const mate = world.players[1];
    victim.pos = { x: tileCenterX(4), y: tileCenterY(4) };
    mate.pos = { x: tileCenterX(4), y: tileCenterY(4) };
    world.trapPlayer(victim, 2);
    world.step();
    expect(victim.state).toBe(PlayerState.ALIVE);

    world.trapPlayer(victim, 2);
    expect(victim.state).toBe(PlayerState.ALIVE);
  });
});
