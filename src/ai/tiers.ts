import { ItemId } from '../sim/types.js';

/**
 * The 협공배틀 difficulty ladder.
 *
 * The original expressed difficulty as a discrete internal character level,
 * and the community documented each level as a *behavioural* tier rather than
 * as stat inflation. That is the single most useful artifact for building
 * this AI, so the tiers are reproduced literally:
 *
 *   ★1 lv3    Ultra-Easy  Appears not to understand the rules. Picks items
 *                         up but cannot use them.
 *   ★2 lv10   Easy        Understands the basics and can use items. Dodges
 *                         well *at first*, then starts walking into blast
 *                         tiles and eventually kills itself.
 *   ★3 lv43               Between ★2 and ★4.
 *   ★4 lv52   Normal      Always recognises blast tiles, indefinitely. You
 *                         cannot beat it by baiting — you must enclose it.
 *   ★5 lv109  Hard        ★4 plus it carries and uses 바늘 and 실드.
 *   ★6 lv163  Extreme     ★5 plus 스프링 — it hops your containment walls.
 */
export type Lookahead = 'own' | 'own1' | 'fullNoChains' | 'fullChains' | 'fullChainsPredict';
export type SelfTrapCheck = 'none' | 'weak' | 'on';

export interface TierParams {
  tier: number;
  /** Internal character level from the original. */
  level: number;
  name: string;
  reactionMs: number;
  safetyMargin: number;
  lookahead: Lookahead;
  /** The mechanically faithful reproduction of ★2's documented decay. */
  dodgeDecay: boolean;
  predictionNoise: number;
  selfTrapCheck: SelfTrapCheck;
  engagementRange: number;
  rescueWeight: number;
  rescuePathSafety: boolean;
  statCapMultiplier: number;
  /** ★1 picks items up but never uses them. */
  usesItems: boolean;
  ownedItems: { item: ItemId; count: number }[];
  /** Anti-frustration: how many of this tier may engage the player at once. */
  maxEngaging: number;
}

export const TIERS: Record<number, TierParams> = {
  1: {
    tier: 1,
    level: 3,
    name: 'Ultra-Easy',
    reactionMs: 600,
    safetyMargin: 0.0,
    lookahead: 'own',
    dodgeDecay: false,
    predictionNoise: 3.0,
    selfTrapCheck: 'none',
    engagementRange: 2,
    rescueWeight: 0.0,
    rescuePathSafety: false,
    statCapMultiplier: 0.4,
    usesItems: false,
    ownedItems: [],
    maxEngaging: 2,
  },
  2: {
    tier: 2,
    level: 10,
    name: 'Easy',
    reactionMs: 400,
    safetyMargin: 0.4,
    lookahead: 'own1',
    dodgeDecay: true,
    predictionNoise: 2.0,
    selfTrapCheck: 'weak',
    engagementRange: 3,
    rescueWeight: 0.3,
    rescuePathSafety: false,
    statCapMultiplier: 0.6,
    usesItems: true,
    ownedItems: [],
    maxEngaging: 2,
  },
  3: {
    tier: 3,
    level: 43,
    name: 'Moderate',
    reactionMs: 300,
    safetyMargin: 0.5,
    lookahead: 'fullNoChains',
    dodgeDecay: false,
    predictionNoise: 1.2,
    selfTrapCheck: 'on',
    engagementRange: 4,
    rescueWeight: 0.6,
    rescuePathSafety: false,
    statCapMultiplier: 0.75,
    usesItems: true,
    ownedItems: [],
    maxEngaging: 2,
  },
  4: {
    tier: 4,
    level: 52,
    name: 'Normal',
    reactionMs: 220,
    safetyMargin: 0.6,
    lookahead: 'fullChains',
    dodgeDecay: false,
    predictionNoise: 0.7,
    selfTrapCheck: 'on',
    engagementRange: 5,
    rescueWeight: 0.8,
    rescuePathSafety: false,
    statCapMultiplier: 0.85,
    usesItems: true,
    ownedItems: [],
    maxEngaging: 8,
  },
  5: {
    tier: 5,
    level: 109,
    name: 'Hard',
    reactionMs: 160,
    safetyMargin: 0.7,
    lookahead: 'fullChains',
    dodgeDecay: false,
    predictionNoise: 0.4,
    selfTrapCheck: 'on',
    engagementRange: 6,
    rescueWeight: 1.0,
    rescuePathSafety: true,
    statCapMultiplier: 1.0,
    usesItems: true,
    ownedItems: [
      { item: ItemId.NEEDLE, count: 1 },
      { item: ItemId.SHIELD, count: 2 },
    ],
    maxEngaging: 8,
  },
  6: {
    tier: 6,
    level: 163,
    name: 'Extreme',
    reactionMs: 120,
    safetyMargin: 0.8,
    lookahead: 'fullChainsPredict',
    dodgeDecay: false,
    predictionNoise: 0.2,
    selfTrapCheck: 'on',
    engagementRange: 7,
    rescueWeight: 1.0,
    rescuePathSafety: true,
    statCapMultiplier: 1.0,
    usesItems: true,
    ownedItems: [
      { item: ItemId.NEEDLE, count: 1 },
      { item: ItemId.SHIELD, count: 2 },
      { item: ItemId.SPRING, count: 3 },
    ],
    maxEngaging: 8,
  },
};

export function tierParams(tier: number): TierParams {
  return TIERS[Math.max(1, Math.min(6, Math.round(tier)))];
}

/**
 * "Dodges balloons well at first, but after some time starts walking into
 * blast tiles." Implemented literally: after 45 seconds, ramp the probability
 * of ignoring the danger map from 0 toward ~35%. The charm is that it looks
 * like the AI is getting tired, so this must not read as random flailing —
 * it only ever suppresses the *dodge*, never the rest of the behaviour.
 */
export const DODGE_DECAY_START = 45;
export const DODGE_DECAY_RAMP = 60;
export const DODGE_DECAY_MAX = 0.35;

export function dodgeDecayChance(params: TierParams, elapsed: number): number {
  if (!params.dodgeDecay) return 0;
  if (elapsed <= DODGE_DECAY_START) return 0;
  const t = Math.min(1, (elapsed - DODGE_DECAY_START) / DODGE_DECAY_RAMP);
  return t * DODGE_DECAY_MAX;
}
