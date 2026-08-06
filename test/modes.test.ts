import { describe, expect, it } from 'vitest';
import {
  RESPAWN_SECONDS,
  TIMEBOMB_ASSIGN_DELAY,
  TIMEBOMB_SECONDS,
  tileCenterX,
  tileCenterY,
} from '../src/sim/constants.js';
import { GameType, PlayerState } from '../src/sim/types.js';
import { makeWorld } from './helpers.js';

describe('부활대전 — respawn deathmatch', () => {
  it('respawns the dead after a countdown, and scores on kills', () => {
    const world = makeWorld(2, { gameType: GameType.RESPAWN });
    const victim = world.players[0];
    const killer = world.players[1];
    world.placeAt(victim, 3, 3);
    world.placeAt(killer, 11, 9);

    world.trapPlayer(victim, killer.id);
    world.killPlayer(victim, killer.id);
    expect(victim.state).toBe(PlayerState.DEAD);
    expect(killer.kills).toBe(1);

    world.advance(RESPAWN_SECONDS + 0.2);
    expect(victim.state).toBe(PlayerState.ALIVE);
  });

  it('breaks a kill tie on the death count', () => {
    const world = makeWorld(2, { gameType: GameType.RESPAWN });
    world.players[0].kills = 3;
    world.players[0].deaths = 5;
    world.players[1].kills = 3;
    world.players[1].deaths = 2;
    world.clock = 0.01;
    world.step();
    expect(world.result?.winningTeam).toBe(1);
  });
});

describe('고슴도치 — hedgehog', () => {
  it('turns the dead into a hedgehog rather than removing them', () => {
    const world = makeWorld(3, { gameType: GameType.HEDGEHOG, teams: [0, 0, 1] });
    const victim = world.players[0];
    world.killPlayer(victim, 2);
    expect(victim.state).toBe(PlayerState.HEDGEHOG);
  });

  it('a hedgehog frees bubbles indiscriminately, enemies included', () => {
    const world = makeWorld(3, { gameType: GameType.HEDGEHOG, teams: [0, 0, 1] });
    const hog = world.players[0];
    const enemy = world.players[2];
    world.killPlayer(hog, 2);

    hog.pos = { x: tileCenterX(5), y: tileCenterY(5) };
    enemy.pos = { x: tileCenterX(5), y: tileCenterY(5) };
    enemy.logicalTile = { c: 5, r: 5 };
    world.trapPlayer(enemy, 1);

    world.step();
    expect(enemy.state).toBe(PlayerState.ALIVE);
  });

  it('a hedgehog detonates a balloon on contact', () => {
    const world = makeWorld(3, { gameType: GameType.HEDGEHOG, teams: [0, 0, 1] });
    const hog = world.players[0];
    const other = world.players[1];
    world.placeAt(other, 5, 5);
    world.placeBalloon(other);
    expect(world.balloons.length).toBe(1);

    world.killPlayer(hog, 2);
    hog.pos = { x: tileCenterX(5), y: tileCenterY(5) };
    world.step();
    expect(world.balloons.length).toBe(0);
  });

  it('a hedgehog hit by a jet is stunned and inert', () => {
    const world = makeWorld(3, { gameType: GameType.HEDGEHOG, teams: [0, 0, 1] });
    const hog = world.players[0];
    world.killPlayer(hog, 2);
    world.placeAt(hog, 5, 5);

    const bomber = world.players[2];
    world.placeAt(bomber, 5, 8);
    bomber.stats.range = 3;
    const b = world.placeBalloon(bomber)!;
    world.placeAt(bomber, 12, 12);
    world.explode(b);
    world.step();

    expect(hog.hedgehogStun).toBeGreaterThan(0);
  });
});

describe('대장잡기 — capture the captain', () => {
  it('assigns one captain per team', () => {
    const world = makeWorld(4, { gameType: GameType.CAPTAIN, teams: [0, 0, 1, 1] });
    expect(world.players.filter((p) => p.team === 0 && p.isCaptain).length).toBe(1);
    expect(world.players.filter((p) => p.team === 1 && p.isCaptain).length).toBe(1);
  });

  it('killing the enemy captain wipes their entire team', () => {
    const world = makeWorld(4, { gameType: GameType.CAPTAIN, teams: [0, 0, 1, 1] });
    const captain = world.players.find((p) => p.team === 1 && p.isCaptain)!;
    const killer = world.players[0];

    world.killPlayer(captain, killer.id);
    expect(world.aliveOnTeam(1)).toBe(0);
    world.step();
    expect(world.result?.winningTeam).toBe(0);
  });

  it('the player who took the captain leads the next round', () => {
    const world = makeWorld(4, { gameType: GameType.CAPTAIN, teams: [0, 0, 1, 1] });
    const captain = world.players.find((p) => p.team === 1 && p.isCaptain)!;
    world.killPlayer(captain, 1);
    expect(world.nextCaptain).toBe(1);
  });
});

describe('시한폭탄 — time bomb', () => {
  it('designates a carrier, locks their speed to max, and detonates 5x5', () => {
    const world = makeWorld(2, { gameType: GameType.TIMEBOMB, teams: [0, 1] });
    world.advance(TIMEBOMB_ASSIGN_DELAY + 0.1);
    const carrier = world.players.find((p) => p.hasBomb);
    expect(carrier).toBeDefined();
    expect(world.effectiveSpeed(carrier!)).toBe(carrier!.statsMax.speed);

    world.placeAt(carrier!, 7, 10);
    world.advance(TIMEBOMB_SECONDS + 0.1);
    expect(carrier!.hasBomb).toBe(false);
    const jet = world.jets[world.jets.length - 1];
    expect(jet).toBeDefined();
    // 5x5 centred on the carrier, minus whatever the map blocks.
    expect(jet.tiles.length).toBeGreaterThan(15);
    expect(jet.tiles.length).toBeLessThanOrEqual(25);
  });

  it('passes the bomb on contact and resets the timer', () => {
    const world = makeWorld(2, { gameType: GameType.TIMEBOMB, teams: [0, 1] });
    world.advance(TIMEBOMB_ASSIGN_DELAY + 0.1);
    const carrier = world.players.find((p) => p.hasBomb)!;
    const other = world.players.find((p) => !p.hasBomb)!;

    world.advance(1.5);
    expect(carrier.bombTimer).toBeLessThan(TIMEBOMB_SECONDS);

    world.placeAt(carrier, 4, 4);
    world.placeAt(other, 4, 4);
    world.step();

    expect(other.hasBomb).toBe(true);
    expect(carrier.hasBomb).toBe(false);
    expect(other.bombTimer).toBeCloseTo(TIMEBOMB_SECONDS, 1);
  });
});

describe('일반모드 — base PVP', () => {
  it('ends when one team is wiped out', () => {
    const world = makeWorld(2, { teams: [0, 1] });
    world.killPlayer(world.players[1], 0);
    world.step();
    expect(world.result?.winningTeam).toBe(0);
  });

  it('ends on the clock with the most survivors', () => {
    const world = makeWorld(3, { teams: [0, 0, 1] });
    world.clock = 0.01;
    world.step();
    expect(world.result?.winningTeam).toBe(0);
    expect(world.result?.reason).toContain('survivors');
  });
});
