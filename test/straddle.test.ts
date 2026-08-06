import { describe, expect, it } from 'vitest';
import { COMMIT_EPSILON, TILE, tileCenterX, tileCenterY } from '../src/sim/constants.js';
import { commitLogicalTile, isStraddling } from '../src/sim/movement.js';
import { PlayerState } from '../src/sim/types.js';
import { makeWorld } from './helpers.js';

/**
 * 걸치기 / 슬라이딩. The whole skill ceiling of the game rests on the logical
 * tile lagging behind the drawn position.
 */
describe('straddling', () => {
  it('does not commit to a new tile until the character moves meaningfully into it', () => {
    const logical = { c: 5, r: 5 };
    const pos = { x: tileCenterX(5), y: tileCenterY(5) };

    // Just across the boundary: visually in tile 6, logically still in 5.
    pos.x = 6 * TILE + 2;
    expect(commitLogicalTile(pos, logical)).toBe(false);
    expect(logical).toEqual({ c: 5, r: 5 });
    expect(isStraddling(pos, logical)).toBe(true);

    // Far enough in to commit.
    pos.x = tileCenterX(6) - COMMIT_EPSILON + 1;
    expect(commitLogicalTile(pos, logical)).toBe(true);
    expect(logical).toEqual({ c: 6, r: 5 });
    expect(isStraddling(pos, logical)).toBe(false);
  });

  it('lets a straddling character stand visually inside a jet and survive it', () => {
    const world = makeWorld(2);
    const victim = world.players[0];
    const bomber = world.players[1];

    // Victim is physically in column 6 but has not committed to it.
    world.placeAt(victim, 5, 2);
    victim.pos.x = 6 * TILE + 2;
    expect(isStraddling(victim.pos, victim.logicalTile)).toBe(true);

    // A jet that covers column 6 but not column 5.
    world.placeAt(bomber, 8, 2);
    bomber.stats.range = 2;
    const balloon = world.placeBalloon(bomber)!;
    world.placeAt(bomber, 8, 11); // get the bomber clear of its own jet
    world.explode(balloon);

    const covered = world.jets[0].tiles.some((t) => t.c === 6 && t.r === 2);
    expect(covered).toBe(true);

    world.advance(0.1);
    expect(victim.state).toBe(PlayerState.ALIVE);
  });

  it('hits the same character once they have committed to the covered tile', () => {
    const world = makeWorld(2);
    const victim = world.players[0];
    const bomber = world.players[1];

    world.placeAt(victim, 6, 2);
    world.placeAt(bomber, 8, 2);
    bomber.stats.range = 2;
    const balloon = world.placeBalloon(bomber)!;
    world.placeAt(bomber, 8, 11);
    world.explode(balloon);

    world.advance(0.1);
    expect(victim.state).toBe(PlayerState.TRAPPED);
  });

  it('picks items up by physical position even while straddling', () => {
    // Damage resolves on the logical tile, pickups on the physical one. That
    // asymmetry is what lets high-level players farm items from safety.
    const world = makeWorld(1);
    const p = world.players[0];
    world.placeAt(p, 5, 2);
    p.pos.x = 6 * TILE + 2;

    const g = world.groundAt(6, 2);
    g.kind = 1; // GroundKind.ITEM
    g.item = 'bubble' as never;

    p.input.right = true;
    world.step();
    expect(p.stats.count).toBeGreaterThan(p.statsBase.count);
  });
});
