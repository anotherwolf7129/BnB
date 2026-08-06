import type { Stats } from './types.js';

export type Strength = 'SPEED' | 'POWER' | 'COUNT' | 'NORMAL';

export interface CharacterDef {
  id: string;
  /** Korean name as it appears in Nexon's 도감. */
  ko: string;
  /** Romanisation used in the English client / community. */
  en: string;
  strength: Strength;
  base: Stats;
  max: Stats;
  /** Palette used by the procedural renderer. */
  color: string;
  accent: string;
  /** [COMMUNITY] 로두마니 fears water and drowns faster. */
  drownMultiplier?: number;
}

/**
 * [OFFICIAL] Straight from Nexon's 도감. Three stats: 개수 (simultaneous
 * balloons), 물줄기 (jet length), 속도 (speed). This table is the whole
 * character-balance layer.
 *
 * The 럭셔리 / 슈퍼 tiers were the game's paid power creep; community "올노"
 * rules ban them and restrict play to 배찌 and 우니. We ship the 12 basic
 * characters only.
 */
export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: 'bazzi',
    ko: '배찌',
    en: 'Bazzi',
    strength: 'SPEED',
    base: { count: 1, range: 1, speed: 5 },
    max: { count: 6, range: 7, speed: 9 },
    color: '#f2c14e',
    accent: '#e2622b',
  },
  {
    id: 'dao',
    ko: '다오',
    en: 'Dao',
    strength: 'NORMAL',
    base: { count: 1, range: 1, speed: 5 },
    max: { count: 10, range: 7, speed: 7 },
    color: '#6fb3e0',
    accent: '#2c5f8a',
  },
  {
    id: 'diziny',
    ko: '디지니',
    en: 'Diziny',
    strength: 'NORMAL',
    base: { count: 2, range: 1, speed: 4 },
    max: { count: 7, range: 9, speed: 8 },
    color: '#c88ce0',
    accent: '#6d3d8a',
  },
  {
    id: 'moss',
    ko: '모스',
    en: 'Moss',
    strength: 'SPEED',
    base: { count: 1, range: 1, speed: 5 },
    max: { count: 8, range: 5, speed: 8 },
    color: '#8fd16a',
    accent: '#3f7a2c',
  },
  {
    id: 'uni',
    ko: '우니',
    en: 'Uni',
    strength: 'POWER',
    base: { count: 1, range: 2, speed: 5 },
    max: { count: 6, range: 7, speed: 8 },
    color: '#f28fb1',
    accent: '#a83b62',
  },
  {
    id: 'etti',
    ko: '에띠',
    en: 'Etti',
    strength: 'COUNT',
    base: { count: 1, range: 1, speed: 4 },
    max: { count: 10, range: 8, speed: 8 },
    color: '#f5f0d8',
    accent: '#b09a5a',
  },
  {
    id: 'marid',
    ko: '마리드',
    en: 'Marid',
    strength: 'COUNT',
    base: { count: 2, range: 1, speed: 4 },
    max: { count: 9, range: 6, speed: 8 },
    color: '#7ad6cf',
    accent: '#2b6f6a',
  },
  {
    id: 'kephi',
    ko: '케피',
    en: 'Kephi',
    strength: 'POWER',
    base: { count: 1, range: 2, speed: 4 },
    max: { count: 9, range: 8, speed: 8 },
    color: '#e0834a',
    accent: '#8a4520',
  },
  {
    id: 'su',
    ko: '수',
    en: 'Su',
    strength: 'SPEED',
    base: { count: 2, range: 1, speed: 6 },
    max: { count: 9, range: 7, speed: 10 },
    color: '#b7c9f2',
    accent: '#43549e',
  },
  {
    id: 'huu',
    ko: '후우',
    en: 'Huu',
    strength: 'COUNT',
    base: { count: 3, range: 1, speed: 5 },
    max: { count: 9, range: 7, speed: 10 },
    color: '#d8d2c4',
    accent: '#6f6455',
  },
  {
    id: 'rei',
    ko: '레이',
    en: 'Rei',
    strength: 'SPEED',
    base: { count: 2, range: 1, speed: 6 },
    max: { count: 9, range: 7, speed: 10 },
    color: '#f0a6c8',
    accent: '#9c3b6b',
  },
  {
    id: 'lucy',
    ko: '루시',
    en: 'Lucy',
    strength: 'SPEED',
    base: { count: 2, range: 1, speed: 6 },
    max: { count: 9, range: 7, speed: 10 },
    color: '#ffe08a',
    accent: '#c48b1f',
  },
];

/**
 * [COMMUNITY] 로두마니 is not in the basic 도감 roster but is the canonical
 * exception to the uniform drown timer, so we keep the definition available.
 */
export const RODUMANI: CharacterDef = {
  id: 'rodumani',
  ko: '로두마니',
  en: 'Rodumani',
  strength: 'NORMAL',
  base: { count: 1, range: 1, speed: 5 },
  max: { count: 8, range: 7, speed: 8 },
  color: '#9aa7b0',
  accent: '#3d474f',
  drownMultiplier: 0.6,
};

const BY_ID = new Map<string, CharacterDef>();
for (const c of CHARACTERS) BY_ID.set(c.id, c);
BY_ID.set(RODUMANI.id, RODUMANI);

export function getCharacter(id: string): CharacterDef {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`unknown character: ${id}`);
  return c;
}

/**
 * The AI rosters from 협공배틀. Each entry maps an enemy name to the tier
 * range it can be played at, and to the basic character whose stat line it
 * borrows. [COMMUNITY]
 */
export interface EnemyDef {
  id: string;
  ko: string;
  en: string;
  minTier: number;
  maxTier: number;
  /** Battle-point unlock cost; 0 means available from the start. */
  unlockCost: number;
  /** Stat line borrowed from a basic character. */
  statsFrom: string;
}

export interface EnemyTeam {
  id: string;
  ko: string;
  en: string;
  difficulty: 'Easy' | 'Normal' | 'Hard';
  members: EnemyDef[];
}

/** [COMMUNITY] Three teams; you cannot mix teams within a match. */
export const ENEMY_TEAMS: readonly EnemyTeam[] = [
  {
    id: 'nightmare',
    ko: '나이트메어',
    en: 'Nightmare',
    difficulty: 'Normal',
    members: [
      { id: 'jomkang', ko: '좀깡', en: 'Jomkang', minTier: 1, maxTier: 2, unlockCost: 0, statsFrom: 'bazzi' },
      { id: 'goril', ko: '고릴', en: 'Goril', minTier: 1, maxTier: 3, unlockCost: 0, statsFrom: 'kephi' },
      { id: 'kongkong', ko: '콩콩', en: 'Kongkong', minTier: 2, maxTier: 4, unlockCost: 500, statsFrom: 'marid' },
      { id: 'ghost', ko: '고스트', en: 'Ghost', minTier: 3, maxTier: 5, unlockCost: 500, statsFrom: 'diziny' },
    ],
  },
  {
    id: 'topgirls',
    ko: '탑걸스',
    en: 'Top Girls',
    difficulty: 'Easy',
    members: [
      { id: 'tuto', ko: '튜토', en: 'Tuto', minTier: 1, maxTier: 1, unlockCost: 0, statsFrom: 'dao' },
      { id: 'pinky', ko: '핑키', en: 'Pinky', minTier: 1, maxTier: 2, unlockCost: 30, statsFrom: 'uni' },
      { id: 'jin', ko: '진', en: 'Jin', minTier: 1, maxTier: 3, unlockCost: 200, statsFrom: 'rei' },
      { id: 'reina', ko: '레이나', en: 'Reina', minTier: 2, maxTier: 4, unlockCost: 500, statsFrom: 'lucy' },
    ],
  },
  {
    id: 'topguys',
    ko: '탑가이즈',
    en: 'Top Guys',
    difficulty: 'Hard',
    members: [
      { id: 'shy', ko: '샤이', en: 'Shy', minTier: 1, maxTier: 3, unlockCost: 0, statsFrom: 'moss' },
      { id: 'jun', ko: '준', en: 'Jun', minTier: 2, maxTier: 4, unlockCost: 400, statsFrom: 'su' },
      { id: 'indie', ko: '인디', en: 'Indie', minTier: 3, maxTier: 5, unlockCost: 600, statsFrom: 'huu' },
      { id: 'koon', ko: '쿤', en: 'Koon', minTier: 4, maxTier: 6, unlockCost: 1000, statsFrom: 'etti' },
    ],
  },
];

/**
 * Pick the enemy roster for a difficulty tier.
 *
 * [COMMUNITY] You cannot mix teams within a match, each character defaults to
 * its maximum difficulty, and it can be dialled *down* by up to two steps —
 * so the members available at a given tier are exactly those whose range
 * covers it under that rule.
 */
export function pickEnemyTeamFor(tier: number): EnemyTeam {
  if (tier <= 2) return ENEMY_TEAMS.find((t) => t.id === 'topgirls')!;
  if (tier <= 4) return ENEMY_TEAMS.find((t) => t.id === 'nightmare')!;
  return ENEMY_TEAMS.find((t) => t.id === 'topguys')!;
}

export function pickEnemies(tier: number, count: number): EnemyDef[] {
  const team = pickEnemyTeamFor(tier);
  const eligible = team.members.filter(
    (m) => tier <= m.maxTier && tier >= Math.max(m.minTier, m.maxTier - 2),
  );
  const pool = eligible.length > 0 ? eligible : team.members;
  const out: EnemyDef[] = [];
  for (let i = 0; i < count; i++) out.push(pool[i % pool.length]);
  return out;
}
