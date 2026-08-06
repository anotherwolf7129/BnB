/**
 * Rank scoring, modelled on 협공배틀's D-through-SS grade.
 *
 * [COMMUNITY] The original graded on kill count, save count, whether you
 * died, opponent character and difficulty, clear time, and — notably —
 * the *number of shop items used*, where more usage meant a higher rank.
 * That was a monetisation nudge.
 *
 * [DESIGN] There is nothing to sell here, so the item incentive is inverted:
 * fewer items used scores better. Everything else keeps its direction —
 * faster clears, more saves, no deaths, tougher enemies.
 */
export interface RankInput {
  kills: number;
  saves: number;
  died: boolean;
  /** Highest enemy tier faced, 1-6. */
  enemyTier: number;
  /** Seconds elapsed when the match ended. */
  clearTime: number;
  itemsUsed: number;
  won: boolean;
}

export type Grade = 'D' | 'C' | 'B' | 'A' | 'S' | 'SS';

export interface RankResult {
  grade: Grade;
  score: number;
  breakdown: { label: string; value: number }[];
}

/** [COMMUNITY] Exceeding 1:30 drops the rank substantially. */
export const PAR_CLEAR_SECONDS = 90;

const GRADE_COLORS: Record<Grade, string> = {
  D: '#9575cd',
  C: '#a1887f',
  B: '#b0bec5',
  A: '#ffd54f',
  S: '#4fc3f7',
  SS: '#ff8a65',
};

export function gradeColor(g: Grade): string {
  return GRADE_COLORS[g];
}

export function computeRank(input: RankInput): RankResult {
  const tierWeight = 0.55 + 0.27 * (input.enemyTier - 1);
  const breakdown: { label: string; value: number }[] = [];

  const killScore = Math.round(input.kills * 11 * tierWeight);
  breakdown.push({ label: `Kills x${input.kills} (★${input.enemyTier})`, value: killScore });

  const saveScore = input.saves * 8;
  if (saveScore) breakdown.push({ label: `Saves x${input.saves}`, value: saveScore });

  const survivalScore = input.died ? 0 : 25;
  breakdown.push({ label: input.died ? 'Died' : 'No deaths', value: survivalScore });

  let timeScore: number;
  if (input.clearTime <= PAR_CLEAR_SECONDS) {
    timeScore = Math.round((1 - input.clearTime / PAR_CLEAR_SECONDS) * 30);
  } else {
    timeScore = -Math.round(Math.min(40, ((input.clearTime - PAR_CLEAR_SECONDS) / 30) * 20));
  }
  breakdown.push({ label: `Clear time ${formatTime(input.clearTime)}`, value: timeScore });

  // The inverted incentive: restraint is rewarded.
  const itemScore = input.itemsUsed === 0 ? 15 : -input.itemsUsed * 4;
  breakdown.push({
    label: input.itemsUsed === 0 ? 'No items used' : `Items used x${input.itemsUsed}`,
    value: itemScore,
  });

  const winScore = input.won ? 20 : -20;
  breakdown.push({ label: input.won ? 'Victory' : 'Defeat', value: winScore });

  const score = killScore + saveScore + survivalScore + timeScore + itemScore + winScore;

  let grade: Grade = 'D';
  if (score >= 120) grade = 'SS';
  else if (score >= 95) grade = 'S';
  else if (score >= 72) grade = 'A';
  else if (score >= 50) grade = 'B';
  else if (score >= 28) grade = 'C';

  // [COMMUNITY] SS was impossible when every enemy was ★2 or lower.
  if (grade === 'SS' && input.enemyTier <= 2) grade = 'S';

  return { grade, score, breakdown };
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
