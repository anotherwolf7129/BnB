import { GRID_COLS, GRID_ROWS } from './constants.js';
import { ItemId, TileKind, type TileRef } from './types.js';

/**
 * Maps are authored as ASCII so new ones are cheap to add.
 *
 *   .   EMPTY
 *   o   BLOCK_SOFT       destructible, may hide an item
 *   h   BLOCK_PUSHABLE   destructible and pushable (the heart-patterned blocks)
 *   #   BLOCK_HARD       indestructible scenery (조형물)
 *   ^   SPIKE (가시)     a balloon on or beside it detonates immediately
 *   0-7 spawn point (walkable)
 */
export interface MapDef {
  id: string;
  ko: string;
  en: string;
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
  theme: { floorA: string; floorB: string; wall: string; soft: string; push: string };
}

/** [COMMUNITY] 물풍선 and 액체 appear on every map. */
const UNIVERSAL: (readonly [ItemId, number])[] = [
  [ItemId.BUBBLE, 30],
  [ItemId.FLUID, 26],
  [ItemId.ROLLER, 16],
];

/**
 * Patrit 14 in spirit: wide, symmetric, mostly soft blocks, a central
 * structure and four pillars, so no spawn holds a positional advantage.
 * The community's most-played map precisely because it is fair.
 */
const PATRIT: MapDef = {
  id: 'patrit',
  ko: '파티라 14',
  en: 'Patrit 14',
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

/**
 * Camp. Carries SPIKE tiles, and is therefore excluded from AI battles —
 * exactly as the original excluded it from 협공배틀, because the AI would
 * place balloons on spikes and blow itself up.
 */
const CAMP: MapDef = {
  id: 'camp',
  ko: '캠프',
  en: 'Camp',
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

/** [COMMUNITY] Ghost map: the item plane does not fly here. */
const GRAVEYARD: MapDef = {
  id: 'graveyard',
  ko: '공동묘지',
  en: 'Graveyard',
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

export const MAPS: readonly MapDef[] = [PATRIT, CAMP, GRAVEYARD];

export function getMap(id: string): MapDef {
  const m = MAPS.find((x) => x.id === id);
  if (!m) throw new Error(`unknown map: ${id}`);
  return m;
}

export interface LoadedMap {
  def: MapDef;
  tiles: Uint8Array;
  spawns: TileRef[];
}

const CHAR_TO_KIND: Record<string, TileKind> = {
  '.': TileKind.EMPTY,
  o: TileKind.BLOCK_SOFT,
  h: TileKind.BLOCK_PUSHABLE,
  '#': TileKind.BLOCK_HARD,
  '^': TileKind.SPIKE,
};

export function loadMap(def: MapDef): LoadedMap {
  if (def.rows.length !== GRID_ROWS) {
    throw new Error(`map ${def.id}: expected ${GRID_ROWS} rows, got ${def.rows.length}`);
  }
  const tiles = new Uint8Array(GRID_COLS * GRID_ROWS);
  const spawns: TileRef[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row = def.rows[r];
    if (row.length !== GRID_COLS) {
      throw new Error(`map ${def.id} row ${r}: expected ${GRID_COLS} cols, got ${row.length}`);
    }
    for (let c = 0; c < GRID_COLS; c++) {
      const ch = row[c];
      if (ch >= '0' && ch <= '9') {
        tiles[r * GRID_COLS + c] = TileKind.EMPTY;
        spawns[Number(ch)] = { c, r };
        continue;
      }
      const kind = CHAR_TO_KIND[ch];
      if (kind === undefined) throw new Error(`map ${def.id}: unknown tile char '${ch}' at ${c},${r}`);
      tiles[r * GRID_COLS + c] = kind;
    }
  }
  for (let i = 0; i < spawns.length; i++) {
    if (!spawns[i]) throw new Error(`map ${def.id}: spawn ${i} missing`);
  }
  return { def, tiles, spawns };
}
