import { GameType, type MatchConfig, type PlayerConfig } from '../src/sim/types.js';
import { World } from '../src/sim/world.js';

export interface Opts {
  gameType?: GameType;
  /** Team id per player, in order. Defaults to free-for-all. */
  teams?: number[];
  aiTiers?: (number | null)[];
  mapId?: string;
  seed?: number;
  keepBlocks?: boolean;
  characterId?: string;
}

/** A world with the countdown skipped and (by default) no soft blocks. */
export function makeWorld(count: number, opts: Opts = {}): World {
  const players: PlayerConfig[] = [];
  for (let i = 0; i < count; i++) {
    players.push({
      name: `P${i}`,
      team: opts.teams?.[i] ?? i,
      characterId: opts.characterId ?? 'bazzi',
      aiTier: opts.aiTiers?.[i] ?? null,
    });
  }
  const cfg: MatchConfig = {
    gameType: opts.gameType ?? GameType.NORMAL,
    players,
    mapId: opts.mapId ?? 'patrit',
    seed: opts.seed ?? 12345,
  };
  const world = new World(cfg);
  world.begin();
  if (!opts.keepBlocks) world.clearBlocks();
  return world;
}
