import { GRID_COLS, GRID_ROWS, type DirIndex } from './constants.js';
import { ItemId, TileKind, type TileRef } from './types.js';

/**
 * Maps are authored as ASCII so new ones are cheap to add.
 *
 *   .   EMPTY
 *   o   BLOCK_SOFT       destructible, may hide an item
 *   h   BLOCK_PUSHABLE   destructible and pushable (the heart-patterned blocks)
 *   #   BLOCK_HARD       indestructible scenery (조형물)
 *   ^   SPIKE (가시)     a balloon resting *on* it bursts at once
 *   > < A V              conveyor belt (컨베이어 벨트) running right/left/up/down
 *   0-7 spawn point (walkable)
 *
 * The roster follows the map list on the Korean community wiki: the themed
 * lands of the 마을 overworld — 빌리지, 포레스트, 비치, 바다, 데저트, 아이스,
 * 캠프, 공동묘지, 던전, 팩토리, 캔디, 스페이스, 로두마니 성 — plus 패트릿,
 * which is not a land at all but is where nearly everyone actually plays.
 *
 * Layouts are our own reconstructions in the game's 15x13 grid. What is taken
 * from the source is each land's *character*: which hazards it carries, which
 * items drop there, and whether the item plane flies.
 */
export interface MapDef {
  id: string;
  ko: string;
  en: string;
  /** Which land of the 마을 overworld this map belongs to. */
  land: string;
  rows: string[];
  /**
   * [COMMUNITY] Which item pool is available is per map. 물풍선 and 액체
   * appear everywhere; 바늘, 산소통, 다트 etc. only on specific maps.
   */
  itemPool: (readonly [ItemId, number])[];
  /** [COMMUNITY] The item plane does not appear on the ghost maps. */
  itemPlane: boolean;
  /** [COMMUNITY] Camp is excluded from 협공배틀 — the AI suicides on spikes. */
  aiAllowed: boolean;
  /** Backdrop tint for the renderer. */
  theme: {
    floorA: string;
    floorB: string;
    wall: string;
    soft: string;
    push: string;
    /** Belt plating, for maps that carry conveyors. */
    belt?: string;
  };
}

/** [COMMUNITY] 물풍선 and 액체 appear on every map. */
const UNIVERSAL: (readonly [ItemId, number])[] = [
  [ItemId.BUBBLE, 30],
  [ItemId.FLUID, 26],
  [ItemId.ROLLER, 16],
];

// ---------------------------------------------------------------------------
// 패트릿 — Patrit
// ---------------------------------------------------------------------------

/**
 * Patrit 14: wide, symmetric, mostly soft blocks, a central structure and four
 * pillars, so no spawn holds a positional advantage. The community's
 * most-played map precisely because it is fair.
 */
const PATRIT: MapDef = {
  id: 'patrit',
  ko: '패트릿 14',
  en: 'Patrit 14',
  land: '패트릿',
  rows: [
    '0.oooo.4.oooo.1',
    '..ohooo.oooho..',
    'ooooooooooooooo',
    'ooo#ooooooo#ooo',
    'ohoooooooooooho',
    '.ooooo###ooooo.',
    '6.oooo###oooo.7',
    '.ooooo###ooooo.',
    'ohoooooooooooho',
    'ooo#ooooooo#ooo',
    'ooooooooooooooo',
    '..ohooo.oooho..',
    '2.oooo.5.oooo.3',
  ],
  itemPool: [
    ...UNIVERSAL,
    [ItemId.ULTRA, 5],
    [ItemId.RED_DEVIL, 5],
    [ItemId.SHOES, 6],
    [ItemId.GLOVE, 5],
    [ItemId.NEEDLE, 6],
    [ItemId.OXYGEN, 5],
    [ItemId.GREEN_DEVIL, 6],
    [ItemId.DEVIL, 5],
    [ItemId.BANANA, 5],
    [ItemId.SUPERMAN, 2],
    [ItemId.GHOST, 3],
    [ItemId.DRILL, 4],
  ],
  itemPlane: true,
  aiAllowed: true,
  theme: { floorA: '#2f7fb5', floorB: '#2a72a4', wall: '#4a3527', soft: '#c8925a', push: '#d4627f' },
};

// ---------------------------------------------------------------------------
// 빌리지 — Village
// ---------------------------------------------------------------------------

/** The 마을 itself: the first land anyone plays, dense and forgiving. */
const VILLAGE: MapDef = {
  id: 'village',
  ko: '빌리지',
  en: 'Village',
  land: '빌리지',
  rows: [
    '0.oooo.4.oooo.1',
    '..ooo#ooo#ooo..',
    'ooooooohooooooo',
    'oo#ooooooooo#oo',
    'oohoo#ooo#oohoo',
    '.ooooo#o#ooooo.',
    '6.ooo#o.o#ooo.7',
    '.ooooo#o#ooooo.',
    'oohoo#ooo#oohoo',
    'oo#ooooooooo#oo',
    'ooooooohooooooo',
    '..ooo#ooo#ooo..',
    '2.oooo.5.oooo.3',
  ],
  itemPool: [
    ...UNIVERSAL,
    [ItemId.ULTRA, 4],
    [ItemId.SHOES, 6],
    [ItemId.GLOVE, 5],
    [ItemId.NEEDLE, 5],
    [ItemId.GREEN_DEVIL, 6],
    [ItemId.DEVIL, 5],
    [ItemId.BANANA, 5],
  ],
  itemPlane: true,
  aiAllowed: true,
  theme: { floorA: '#67a94f', floorB: '#5e9f47', wall: '#7a5334', soft: '#d0a05e', push: '#dd6f8c' },
};

// ---------------------------------------------------------------------------
// 포레스트 — Forest
// ---------------------------------------------------------------------------

/** [COMMUNITY] Forest 07 is the popular one, and the home of 몬스터 모드. */
const FOREST: MapDef = {
  id: 'forest',
  ko: '포레스트 07',
  en: 'Forest 07',
  land: '포레스트',
  rows: [
    '0.oooo.4.oooo.1',
    '..oo#ooooo#oo..',
    'oohooooooooohoo',
    'oooo#ooooo#oooo',
    'oooooo#o#oooooo',
    '.oooo#ooo#oooo.',
    '6.ooo#o.o#ooo.7',
    '.oooo#ooo#oooo.',
    'oooooo#o#oooooo',
    'oooo#ooooo#oooo',
    'oohooooooooohoo',
    '..oo#ooooo#oo..',
    '2.oooo.5.oooo.3',
  ],
  itemPool: [
    ...UNIVERSAL,
    [ItemId.ULTRA, 5],
    [ItemId.RED_DEVIL, 4],
    [ItemId.SHOES, 5],
    [ItemId.GLOVE, 4],
    [ItemId.NEEDLE, 5],
    [ItemId.OXYGEN, 4],
    [ItemId.GREEN_DEVIL, 6],
    [ItemId.DEVIL, 5],
    [ItemId.BANANA, 6],
    [ItemId.DRILL, 4],
  ],
  itemPlane: true,
  aiAllowed: true,
  theme: { floorA: '#3f7d3a', floorB: '#387134', wall: '#4d3a24', soft: '#9c7040', push: '#c65f7a' },
};

// ---------------------------------------------------------------------------
// 비치 — Beach
// ---------------------------------------------------------------------------

/** Wide open sand under parasols. Fast, and very hard to hide on. */
const BEACH: MapDef = {
  id: 'beach',
  ko: '비치',
  en: 'Beach',
  land: '비치',
  rows: [
    '0.oooo.4.oooo.1',
    '..o#ooooooo#o..',
    'oooooohohoooooo',
    'oo#ooooooooo#oo',
    'ooooo#ooo#ooooo',
    '.ooooooooooooo.',
    '6.ooo#o#o#ooo.7',
    '.ooooooooooooo.',
    'ooooo#ooo#ooooo',
    'oo#ooooooooo#oo',
    'oooooohohoooooo',
    '..o#ooooooo#o..',
    '2.oooo.5.oooo.3',
  ],
  itemPool: [
    ...UNIVERSAL,
    [ItemId.ULTRA, 4],
    [ItemId.SKATE, 6],
    [ItemId.SHOES, 5],
    [ItemId.GLOVE, 5],
    [ItemId.OXYGEN, 7],
    [ItemId.GREEN_DEVIL, 5],
    [ItemId.DEVIL, 4],
    [ItemId.BANANA, 6],
    [ItemId.SUPERMAN, 2],
  ],
  itemPlane: true,
  aiAllowed: true,
  theme: { floorA: '#e8cf95', floorB: '#dfc389', wall: '#8d6b45', soft: '#c99a5c', push: '#e0708c' },
};

// ---------------------------------------------------------------------------
// 바다 — Sea
// ---------------------------------------------------------------------------

/** Reef walls in concentric rings; the lanes between them are the whole map. */
const SEA: MapDef = {
  id: 'sea',
  ko: '바다',
  en: 'Sea',
  land: '바다',
  rows: [
    '0.oooo.4.oooo.1',
    '..ooooo#ooooo..',
    'oo#ooooooooo#oo',
    'oohooo###ooohoo',
    'ooooo#ooo#ooooo',
    '.oo#ooooooo#oo.',
    '6.ooooo.ooooo.7',
    '.oo#ooooooo#oo.',
    'ooooo#ooo#ooooo',
    'oohooo###ooohoo',
    'oo#ooooooooo#oo',
    '..ooooo#ooooo..',
    '2.oooo.5.oooo.3',
  ],
  itemPool: [
    ...UNIVERSAL,
    [ItemId.ULTRA, 4],
    [ItemId.SKATE, 5],
    [ItemId.GLOVE, 5],
    [ItemId.NEEDLE, 4],
    [ItemId.OXYGEN, 9],
    [ItemId.GREEN_DEVIL, 5],
    [ItemId.DEVIL, 5],
    [ItemId.GHOST, 4],
  ],
  itemPlane: true,
  aiAllowed: true,
  theme: { floorA: '#1f6f96', floorB: '#1b6387', wall: '#3f5f63', soft: '#b98a55', push: '#d4627f' },
};

// ---------------------------------------------------------------------------
// 데저트 — Desert
// ---------------------------------------------------------------------------

/**
 * [COMMUNITY] 베거이 사막. Desert 04-06 carry conveyor belts; here they are two
 * long counter-running lanes, so crossing the map is much easier one way than
 * the other.
 */
const DESERT: MapDef = {
  id: 'desert',
  ko: '데저트 05',
  en: 'Desert 05',
  land: '데저트',
  rows: [
    '0.oooo.4.oooo.1',
    '..ooo#ooo#ooo..',
    'ooooooooooooooo',
    '.oo<<<<<<<<<oo.',
    'ooooo#ooo#ooooo',
    '.ooooooooooooo.',
    '6.ooo#o.o#ooo.7',
    '.ooooooooooooo.',
    'ooooo#ooo#ooooo',
    '.oo>>>>>>>>>oo.',
    'ooooooooooooooo',
    '..ooo#ooo#ooo..',
    '2.oooo.5.oooo.3',
  ],
  itemPool: [
    ...UNIVERSAL,
    [ItemId.ULTRA, 5],
    [ItemId.RED_DEVIL, 5],
    [ItemId.SHOES, 5],
    [ItemId.GLOVE, 4],
    [ItemId.OXYGEN, 6],
    [ItemId.GREEN_DEVIL, 6],
    [ItemId.DEVIL, 5],
    [ItemId.BOND, 5],
    [ItemId.MOONWALK, 4],
  ],
  itemPlane: true,
  aiAllowed: true,
  theme: {
    floorA: '#e6c88d',
    floorB: '#dcbc80',
    wall: '#5f4220',
    soft: '#c08343',
    push: '#d4627f',
    belt: '#6b4f2c',
  },
};

// ---------------------------------------------------------------------------
// 아이스 — Ice
// ---------------------------------------------------------------------------

/**
 * [COMMUNITY] 아이스리온 랜드. Ice 01 and 07 carry conveyor belts and drop
 * skates. Both belt columns run inward, which funnels everyone into the middle
 * lane whether they meant to go there or not.
 */
const ICE: MapDef = {
  id: 'ice',
  ko: '아이스 01',
  en: 'Ice 01',
  land: '아이스',
  rows: [
    '0.oooo.4.oooo.1',
    '..oVoooooooVo..',
    'oo#VoooooooV#oo',
    'oooVhooooohVooo',
    'oo#VoooooooV#oo',
    '.ooVo#ooo#oVoo.',
    '6.ooo#o.o#ooo.7',
    '.ooAo#ooo#oAoo.',
    'oo#AoooooooA#oo',
    'oooAhooooohAooo',
    'oo#AoooooooA#oo',
    '..oAoooooooAo..',
    '2.oooo.5.oooo.3',
  ],
  itemPool: [
    ...UNIVERSAL,
    [ItemId.ULTRA, 4],
    [ItemId.SKATE, 9],
    [ItemId.SHOES, 5],
    [ItemId.GLOVE, 4],
    [ItemId.NEEDLE, 4],
    [ItemId.GREEN_DEVIL, 5],
    [ItemId.DEVIL, 5],
    [ItemId.BANANA, 5],
  ],
  itemPlane: true,
  aiAllowed: true,
  theme: {
    floorA: '#cfe8f3',
    floorB: '#c1dfec',
    wall: '#3d5f73',
    soft: '#7fb0cd',
    push: '#d98aa8',
    belt: '#5b8299',
  },
};

// ---------------------------------------------------------------------------
// 캠프 — Camp
// ---------------------------------------------------------------------------

/**
 * Camp. Carries SPIKE tiles, which is why the original excluded it from
 * 협공배틀: the AI would put a balloon down on a spike and blow itself up.
 */
const CAMP: MapDef = {
  id: 'camp',
  ko: '캠프 07',
  en: 'Camp 07',
  land: '캠프',
  rows: [
    '0.oooo.4.oooo.1',
    '..oooo.o.oooo..',
    'oo^ooooooooo^oo',
    'oo#ooo###ooo#oo',
    'ooooo^o.o^ooooo',
    '.oooooo#oooooo.',
    '6.o^ooo.ooo^o.7',
    '.oooooo#oooooo.',
    'ooooo^o.o^ooooo',
    'oo#ooo###ooo#oo',
    'oo^ooooooooo^oo',
    '..oooo.o.oooo..',
    '2.oooo.5.oooo.3',
  ],
  itemPool: [
    ...UNIVERSAL,
    [ItemId.ULTRA, 4],
    [ItemId.SKATE, 5],
    [ItemId.SHOES, 5],
    [ItemId.TRAP, 5],
    [ItemId.BOND, 5],
    [ItemId.PUSHPIN, 4],
    [ItemId.GREEN_DEVIL, 5],
    [ItemId.DEVIL, 4],
    [ItemId.MOONWALK, 3],
  ],
  itemPlane: true,
  aiAllowed: false,
  theme: { floorA: '#4c7a3c', floorB: '#457036', wall: '#5b4a33', soft: '#a8763f', push: '#c25f6e' },
};

// ---------------------------------------------------------------------------
// 공동묘지 — Cemetery
// ---------------------------------------------------------------------------

/** [COMMUNITY] Ghost map: the item plane does not fly here. */
const GRAVEYARD: MapDef = {
  id: 'graveyard',
  ko: '공동묘지',
  en: 'Cemetery',
  land: '공동묘지',
  rows: [
    '0.oooo.4.oooo.1',
    '..#ooooooooo#..',
    'ooooohooohooooo',
    'oo#ooooooooo#oo',
    'oooo#ooooo#oooo',
    '.ooooo#o#ooooo.',
    '6.ohooo.oooho.7',
    '.ooooo#o#ooooo.',
    'oooo#ooooo#oooo',
    'oo#ooooooooo#oo',
    'ooooohooohooooo',
    '..#ooooooooo#..',
    '2.oooo.5.oooo.3',
  ],
  itemPool: [
    ...UNIVERSAL,
    [ItemId.ULTRA, 6],
    [ItemId.RED_DEVIL, 4],
    [ItemId.GLOVE, 5],
    [ItemId.NEEDLE, 7],
    [ItemId.OXYGEN, 6],
    [ItemId.GHOST, 8],
    [ItemId.GREEN_DEVIL, 6],
    [ItemId.DEVIL, 6],
    [ItemId.BANANA, 4],
  ],
  itemPlane: false,
  aiAllowed: true,
  theme: { floorA: '#3b3550', floorB: '#352f49', wall: '#282334', soft: '#6b6386', push: '#9b5f86' },
};

// ---------------------------------------------------------------------------
// 던전 — Dungeon
// ---------------------------------------------------------------------------

/**
 * [COMMUNITY] The dungeon the cemetery kids found. A pillar grid rather than a
 * clearing: sightlines are short and a single balloon seals a corridor.
 * A ghost map, so no item plane.
 */
const DUNGEON: MapDef = {
  id: 'dungeon',
  ko: '던전',
  en: 'Dungeon',
  land: '던전',
  rows: [
    '0.oooo.4.oooo.1',
    '..o#o#ooo#o#o..',
    'ooooooooooooooo',
    'o#o#o#o#o#o#o#o',
    'ooooooooooooooo',
    '.o#o#o#o#o#o#o.',
    '6.ooooo.ooooo.7',
    '.o#o#o#o#o#o#o.',
    'ooooooooooooooo',
    'o#o#o#o#o#o#o#o',
    'ooooooooooooooo',
    '..o#o#ooo#o#o..',
    '2.oooo.5.oooo.3',
  ],
  itemPool: [
    ...UNIVERSAL,
    [ItemId.ULTRA, 6],
    [ItemId.GLOVE, 6],
    [ItemId.NEEDLE, 6],
    [ItemId.OXYGEN, 5],
    [ItemId.GHOST, 6],
    [ItemId.GREEN_DEVIL, 6],
    [ItemId.DEVIL, 6],
    [ItemId.TRAP, 6],
    [ItemId.DRILL, 5],
  ],
  itemPlane: false,
  aiAllowed: true,
  theme: { floorA: '#3a3a44', floorB: '#33333d', wall: '#1f1f27', soft: '#7b6a52', push: '#a05a76' },
};

// ---------------------------------------------------------------------------
// 팩토리 — Factory
// ---------------------------------------------------------------------------

/**
 * [COMMUNITY] Factory 00, 01 and 11 run conveyor belts. Four short belts here,
 * paired so each end of the map has one lane in and one lane out.
 */
const FACTORY: MapDef = {
  id: 'factory',
  ko: '팩토리 01',
  en: 'Factory 01',
  land: '팩토리',
  rows: [
    '0.oooo.4.oooo.1',
    '..oo#ooooo#oo..',
    'o>>>>>>o<<<<<<o',
    'oo#ooooooooo#oo',
    'oooo#o#o#o#oooo',
    '.oooo#ooo#oooo.',
    '6.ooo#o.o#ooo.7',
    '.oooo#ooo#oooo.',
    'oooo#o#o#o#oooo',
    'oo#ooooooooo#oo',
    'o<<<<<<o>>>>>>o',
    '..oo#ooooo#oo..',
    '2.oooo.5.oooo.3',
  ],
  itemPool: [
    ...UNIVERSAL,
    [ItemId.ULTRA, 5],
    [ItemId.RED_DEVIL, 5],
    [ItemId.SHOES, 6],
    [ItemId.GLOVE, 5],
    [ItemId.GREEN_DEVIL, 6],
    [ItemId.DEVIL, 5],
    [ItemId.PUSHPIN, 5],
    [ItemId.BOND, 4],
    [ItemId.DRILL, 5],
  ],
  itemPlane: true,
  aiAllowed: true,
  theme: {
    floorA: '#66707a',
    floorB: '#5d666f',
    wall: '#3b424a',
    soft: '#a2793f',
    push: '#cf6480',
    belt: '#41484f',
  },
};

// ---------------------------------------------------------------------------
// 캔디 — Candy
// ---------------------------------------------------------------------------

/** Heart blocks everywhere, so shoes and the red devil are worth far more. */
const CANDY: MapDef = {
  id: 'candy',
  ko: '캔디',
  en: 'Candy',
  land: '캔디',
  rows: [
    '0.ohho.4.ohho.1',
    '..hoooooooooh..',
    'ohooo#ooo#oooho',
    'ooohooooooohooo',
    'oh#ooohohooo#ho',
    '.oooohooohoooo.',
    '6.ooo#o.o#ooo.7',
    '.oooohooohoooo.',
    'oh#ooohohooo#ho',
    'ooohooooooohooo',
    'ohooo#ooo#oooho',
    '..hoooooooooh..',
    '2.ohho.5.ohho.3',
  ],
  itemPool: [
    ...UNIVERSAL,
    [ItemId.ULTRA, 4],
    [ItemId.RED_DEVIL, 7],
    [ItemId.SHOES, 9],
    [ItemId.GLOVE, 5],
    [ItemId.GREEN_DEVIL, 6],
    [ItemId.DEVIL, 5],
    [ItemId.BANANA, 6],
    [ItemId.SUPERMAN, 2],
  ],
  itemPlane: true,
  aiAllowed: true,
  theme: { floorA: '#f3b7d4', floorB: '#eaabca', wall: '#8b5a72', soft: '#f0d38a', push: '#e8557f' },
};

// ---------------------------------------------------------------------------
// 스페이스 — Space
// ---------------------------------------------------------------------------

/** Thin catwalks over a lot of nothing. Long sightlines, few refuges. */
const SPACE: MapDef = {
  id: 'space',
  ko: '스페이스',
  en: 'Space',
  land: '스페이스',
  rows: [
    '0.oooo.4.oooo.1',
    '..ooooooooooo..',
    'ooo#ooooooo#ooo',
    'oooo.ooooo.oooo',
    'oo#oo#o#o#oo#oo',
    '.ooooo.o.ooooo.',
    '6.oo#o###o#oo.7',
    '.ooooo.o.ooooo.',
    'oo#oo#o#o#oo#oo',
    'oooo.ooooo.oooo',
    'ooo#ooooooo#ooo',
    '..ooooooooooo..',
    '2.oooo.5.oooo.3',
  ],
  itemPool: [
    ...UNIVERSAL,
    [ItemId.ULTRA, 7],
    [ItemId.RED_DEVIL, 5],
    [ItemId.GLOVE, 6],
    [ItemId.NEEDLE, 5],
    [ItemId.GHOST, 5],
    [ItemId.GREEN_DEVIL, 6],
    [ItemId.DEVIL, 6],
    [ItemId.SUPERMAN, 3],
  ],
  itemPlane: true,
  aiAllowed: true,
  theme: { floorA: '#2a2c46', floorB: '#24263d', wall: '#4c5170', soft: '#7f7fa8', push: '#b062a8' },
};

// ---------------------------------------------------------------------------
// 로두마니 성 — Lodumani Castle
// ---------------------------------------------------------------------------

/**
 * The castle keep. The throne room in the middle is walled in stone with a
 * single soft gate top and bottom — whoever breaks one owns the centre.
 */
const LODUMANI: MapDef = {
  id: 'lodumani',
  ko: '로두마니 성',
  en: 'Lodumani Castle',
  land: '로두마니 성',
  rows: [
    '0.oooo.4.oooo.1',
    '..o#ooooooo#o..',
    'oo#ooooooooo#oo',
    'ooooo##o##ooooo',
    'oohoo#ooo#oohoo',
    '.oooo#o.o#oooo.',
    '6.ooo#o.o#ooo.7',
    '.oooo#o.o#oooo.',
    'oohoo#ooo#oohoo',
    'ooooo##o##ooooo',
    'oo#ooooooooo#oo',
    '..o#ooooooo#o..',
    '2.oooo.5.oooo.3',
  ],
  itemPool: [
    ...UNIVERSAL,
    [ItemId.ULTRA, 5],
    [ItemId.RED_DEVIL, 5],
    [ItemId.SHOES, 5],
    [ItemId.GLOVE, 5],
    [ItemId.NEEDLE, 6],
    [ItemId.OXYGEN, 5],
    [ItemId.GHOST, 4],
    [ItemId.GREEN_DEVIL, 6],
    [ItemId.DEVIL, 6],
    [ItemId.TRAP, 5],
    [ItemId.SUPERMAN, 2],
  ],
  itemPlane: true,
  aiAllowed: true,
  theme: { floorA: '#5a4a63', floorB: '#52435a', wall: '#6e6a74', soft: '#9b7a4f', push: '#c05a86' },
};

export const MAPS: readonly MapDef[] = [
  PATRIT,
  VILLAGE,
  FOREST,
  BEACH,
  SEA,
  DESERT,
  ICE,
  CAMP,
  GRAVEYARD,
  DUNGEON,
  FACTORY,
  CANDY,
  SPACE,
  LODUMANI,
];

export function getMap(id: string): MapDef {
  const m = MAPS.find((x) => x.id === id);
  if (!m) throw new Error(`unknown map: ${id}`);
  return m;
}

export interface LoadedMap {
  def: MapDef;
  tiles: Uint8Array;
  /** 0 = no belt, otherwise DirIndex + 1. */
  conveyor: Uint8Array;
  spawns: TileRef[];
}

const CHAR_TO_KIND: Record<string, TileKind> = {
  '.': TileKind.EMPTY,
  o: TileKind.BLOCK_SOFT,
  h: TileKind.BLOCK_PUSHABLE,
  '#': TileKind.BLOCK_HARD,
  '^': TileKind.SPIKE,
};

const CHAR_TO_BELT: Record<string, DirIndex> = {
  A: 0,
  '>': 1,
  V: 2,
  '<': 3,
};

export function loadMap(def: MapDef): LoadedMap {
  if (def.rows.length !== GRID_ROWS) {
    throw new Error(`map ${def.id}: expected ${GRID_ROWS} rows, got ${def.rows.length}`);
  }
  const tiles = new Uint8Array(GRID_COLS * GRID_ROWS);
  const conveyor = new Uint8Array(GRID_COLS * GRID_ROWS);
  const spawns: TileRef[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row = def.rows[r];
    if (row.length !== GRID_COLS) {
      throw new Error(`map ${def.id} row ${r}: expected ${GRID_COLS} cols, got ${row.length}`);
    }
    for (let c = 0; c < GRID_COLS; c++) {
      const ch = row[c];
      const i = r * GRID_COLS + c;
      if (ch >= '0' && ch <= '9') {
        tiles[i] = TileKind.EMPTY;
        spawns[Number(ch)] = { c, r };
        continue;
      }
      const belt = CHAR_TO_BELT[ch];
      if (belt !== undefined) {
        tiles[i] = TileKind.EMPTY;
        conveyor[i] = belt + 1;
        continue;
      }
      const kind = CHAR_TO_KIND[ch];
      if (kind === undefined) throw new Error(`map ${def.id}: unknown tile char '${ch}' at ${c},${r}`);
      tiles[i] = kind;
    }
  }
  for (let i = 0; i < spawns.length; i++) {
    if (!spawns[i]) throw new Error(`map ${def.id}: spawn ${i} missing`);
  }
  return { def, tiles, conveyor, spawns };
}
