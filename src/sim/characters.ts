import type { Stats } from './types.js';

export type Strength = 'SPEED' | 'POWER' | 'COUNT' | 'NORMAL';

/**
 * How a character is drawn. The renderer builds every figure out of the same
 * parts — head, headgear, torso, outfit, arms, legs — so a character is a
 * description rather than a sprite sheet.
 *
 * The descriptions follow the character art as documented by the Korean
 * community: 배찌's eared hood and permanently half-shut eyes, 다오's blue
 * helmet and belt, 디지니's cat-eared helmet and star buckle, 마리드's parted
 * bob over a pink pinafore, 에띠 as the only one in glasses, 케피 as the
 * round one, 모스 in a white sleeveless top.
 */
export interface CharacterLook {
  /** Face and hands. */
  skin: string;
  /** Main garment. */
  suit: string;
  /** Trim, cuffs, boots. */
  trim: string;
  /** Hair, where any shows. */
  hair: string;
  head: 'hood' | 'helmet' | 'catHelmet' | 'bob' | 'pigtails' | 'onion' | 'spiky' | 'crown' | 'santaHat';
  build: 'normal' | 'small' | 'chubby';
  eyes: 'sleepy' | 'wide' | 'beady' | 'glasses';
  /** Optional garment detail layered over the torso. */
  outfit?: 'pinafore' | 'tank' | 'belt' | 'starBelt' | 'coat';
}

export interface CharacterDef {
  id: string;
  /** Korean name as it appears in Nexon's 도감. */
  ko: string;
  /** Romanisation used in the English client / community. */
  en: string;
  strength: Strength;
  base: Stats;
  max: Stats;
  /** Headline palette, used for menu text and the HUD. */
  color: string;
  accent: string;
  look: CharacterLook;
  /** [COMMUNITY] 로두마니 fears water and drowns faster. */
  drownMultiplier?: number;
  /** Not in the default eight — offered by 랜덤 in the original. */
  bonus?: boolean;
}

/**
 * [OFFICIAL] Straight from Nexon's 도감. Three stats: 개수 (simultaneous
 * balloons), 물줄기 (jet length), 속도 (speed). This table is the whole
 * character-balance layer.
 *
 * The roster is the eight default characters — 배찌, 다오, 디지니, 모스, 우니,
 * 에띠, 마리드, 케피 — plus the two that the original only handed out through
 * 랜덤, 로두마니 and 산타. The 럭셔리 / 슈퍼 tiers were the game's paid power
 * creep; community "올노" rules ban them outright, so we do not ship them.
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
    look: {
      skin: '#ffe0b8',
      suit: '#f2c14e',
      trim: '#e2622b',
      hair: '#e2622b',
      head: 'hood',
      build: 'normal',
      eyes: 'sleepy',
    },
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
    look: {
      skin: '#ffe0b8',
      suit: '#6fb3e0',
      trim: '#2c5f8a',
      hair: '#3b2a1c',
      head: 'helmet',
      build: 'normal',
      eyes: 'wide',
      outfit: 'belt',
    },
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
    look: {
      skin: '#ffe0b8',
      suit: '#c88ce0',
      trim: '#6d3d8a',
      hair: '#4a2c60',
      head: 'catHelmet',
      build: 'normal',
      eyes: 'wide',
      outfit: 'starBelt',
    },
  },
  {
    id: 'mos',
    ko: '모스',
    en: 'Mos',
    strength: 'SPEED',
    base: { count: 1, range: 1, speed: 5 },
    max: { count: 8, range: 5, speed: 8 },
    color: '#8fd16a',
    accent: '#3f7a2c',
    look: {
      skin: '#ffdcae',
      suit: '#8fd16a',
      trim: '#3f7a2c',
      hair: '#2f2a24',
      head: 'spiky',
      build: 'normal',
      eyes: 'beady',
      outfit: 'tank',
    },
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
    look: {
      skin: '#ffe4c4',
      suit: '#f28fb1',
      trim: '#a83b62',
      hair: '#5b3a2b',
      head: 'pigtails',
      build: 'small',
      eyes: 'wide',
    },
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
    look: {
      skin: '#ffe4c4',
      suit: '#f5f0d8',
      trim: '#b09a5a',
      hair: '#c9a227',
      head: 'onion',
      build: 'normal',
      eyes: 'glasses',
      outfit: 'coat',
    },
  },
  {
    id: 'marid',
    ko: '마리드',
    en: 'Marid',
    strength: 'COUNT',
    base: { count: 2, range: 1, speed: 4 },
    max: { count: 9, range: 6, speed: 8 },
    color: '#f6a8c0',
    accent: '#b04a6e',
    look: {
      skin: '#ffe4c4',
      suit: '#fdfdfd',
      trim: '#b04a6e',
      hair: '#6b4423',
      head: 'bob',
      build: 'normal',
      eyes: 'sleepy',
      outfit: 'pinafore',
    },
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
    look: {
      skin: '#ffd9a8',
      suit: '#e0834a',
      trim: '#8a4520',
      hair: '#6b3a17',
      head: 'spiky',
      build: 'chubby',
      eyes: 'beady',
      outfit: 'belt',
    },
  },
  {
    id: 'rodumani',
    ko: '로두마니',
    en: 'Lodumani',
    strength: 'NORMAL',
    base: { count: 1, range: 1, speed: 5 },
    max: { count: 8, range: 7, speed: 8 },
    color: '#9aa7b0',
    accent: '#3d474f',
    look: {
      skin: '#b8c2c9',
      suit: '#57616b',
      trim: '#c9a227',
      hair: '#2b3238',
      head: 'crown',
      build: 'chubby',
      eyes: 'beady',
      outfit: 'coat',
    },
    // [COMMUNITY] 로두마니 fears water and drowns faster.
    drownMultiplier: 0.6,
    bonus: true,
  },
  {
    id: 'santa',
    ko: '산타',
    en: 'Santa',
    strength: 'COUNT',
    base: { count: 2, range: 1, speed: 4 },
    max: { count: 9, range: 7, speed: 7 },
    color: '#e05a5a',
    accent: '#8c2f2f',
    look: {
      skin: '#ffdcae',
      suit: '#e05a5a',
      trim: '#fdfdfd',
      hair: '#fdfdfd',
      head: 'santaHat',
      build: 'chubby',
      eyes: 'wide',
      outfit: 'belt',
    },
    bonus: true,
  },
];

/** Kept as a named export: 로두마니 is the canonical drown-timer exception. */
export const RODUMANI: CharacterDef = CHARACTERS.find((c) => c.id === 'rodumani')!;

const BY_ID = new Map<string, CharacterDef>();
for (const c of CHARACTERS) BY_ID.set(c.id, c);

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
      { id: 'jin', ko: '진', en: 'Jin', minTier: 1, maxTier: 3, unlockCost: 200, statsFrom: 'marid' },
      { id: 'reina', ko: '레이나', en: 'Reina', minTier: 2, maxTier: 4, unlockCost: 500, statsFrom: 'etti' },
    ],
  },
  {
    id: 'topguys',
    ko: '탑가이즈',
    en: 'Top Guys',
    difficulty: 'Hard',
    members: [
      { id: 'shy', ko: '샤이', en: 'Shy', minTier: 1, maxTier: 3, unlockCost: 0, statsFrom: 'mos' },
      { id: 'jun', ko: '준', en: 'Jun', minTier: 2, maxTier: 4, unlockCost: 400, statsFrom: 'dao' },
      { id: 'indie', ko: '인디', en: 'Indie', minTier: 3, maxTier: 5, unlockCost: 600, statsFrom: 'diziny' },
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
