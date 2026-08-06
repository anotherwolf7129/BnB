import { describe, expect, it } from 'vitest';
import { AIDirector } from '../src/ai/controller.js';
import { PlayerState } from '../src/sim/types.js';
import { makeWorld } from './helpers.js';

/**
 * Regression guard for the class of bug that made every AI blow itself up in
 * its own spawn corner: a character must always be able to walk off the
 * balloon it just placed.
 */
describe('full matches', () => {
  it('AI do not kill themselves in the opening seconds', () => {
    for (const tier of [2, 4, 6]) {
      for (const seed of [1, 2, 3, 4]) {
        const world = makeWorld(4, {
          teams: [0, 1, 1, 1],
          aiTiers: [null, tier, tier, tier],
          keepBlocks: true,
          seed,
        });
        const director = new AIDirector(world, seed);
        for (let i = 0; i < 60 * 20; i++) {
          director.update();
          world.step();
        }
        const selfKilled = world.players
          .slice(1)
          .filter((p) => p.state === PlayerState.DEAD && p.deaths > 0).length;
        expect(selfKilled, `tier ${tier} seed ${seed}`).toBe(0);
      }
    }
  });

  it('a character can always step off the balloon it just placed', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    world.placeAt(p, 5, 10);
    world.placeBalloon(p);

    p.input.right = true;
    world.advance(0.8);
    expect(p.logicalTile.c).toBeGreaterThan(5);
  });

  it('but cannot walk back through it once clear', () => {
    const world = makeWorld(1);
    const p = world.players[0];
    world.placeAt(p, 5, 10);
    world.placeBalloon(p);

    p.input.right = true;
    world.advance(1.0);
    p.input.right = false;
    p.input.left = true;
    world.advance(1.0);
    expect(p.logicalTile.c).toBeGreaterThan(5);
  });
});
