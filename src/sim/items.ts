import {
  DRILL_CHARGES,
  REMOTE_CHARGES,
  TRAP_CHARGES,
} from './constants.js';
import { ItemId } from './types.js';

export enum ItemCategory {
  STAT_UP = 'statUp',
  STAT_DOWN = 'statDown',
  UTILITY = 'utility',
  SHOP = 'shop',
}

export interface ItemDef {
  id: ItemId;
  ko: string;
  en: string;
  category: ItemCategory;
  /** Held in a numbered slot and triggered with Ctrl, rather than eaten on pickup. */
  usable: boolean;
  /** Charges granted per pickup. */
  charges: number;
  color: string;
  glyph: string;
  desc: string;
}

function def(
  id: ItemId,
  ko: string,
  en: string,
  category: ItemCategory,
  color: string,
  glyph: string,
  desc: string,
  usable = false,
  charges = 1,
): ItemDef {
  return { id, ko, en, category, usable, charges, color, glyph, desc };
}

export const ITEMS: Record<ItemId, ItemDef> = {
  // --- stat-up ------------------------------------------------------------
  [ItemId.BUBBLE]: def(ItemId.BUBBLE, '물풍선', 'Bubble', ItemCategory.STAT_UP, '#4fc3f7', '●', '+1 simultaneous balloon'),
  [ItemId.FLUID]: def(ItemId.FLUID, '액체', 'Fluid', ItemCategory.STAT_UP, '#29b6f6', '≈', '+1 jet length'),
  [ItemId.ULTRA]: def(ItemId.ULTRA, '울트라 물풍선', 'Ultra', ItemCategory.STAT_UP, '#8e44ad', '☠', 'Jet length jumps straight to your maximum'),
  [ItemId.ROLLER]: def(ItemId.ROLLER, '롤러 스케이트', 'Roller Skate', ItemCategory.STAT_UP, '#ffb300', '»', '+1 speed'),
  [ItemId.RED_DEVIL]: def(ItemId.RED_DEVIL, '붉은 악마', 'Red Devil', ItemCategory.STAT_UP, '#e53935', '♦', 'Speed to max, and you can push balloons'),
  [ItemId.SKATE]: def(ItemId.SKATE, '스케이트', 'Skate', ItemCategory.STAT_UP, '#80deea', '❄', 'Speed to max, no push'),
  [ItemId.GLOVE]: def(ItemId.GLOVE, '장갑', 'Glove', ItemCategory.STAT_UP, '#ffcc80', '✋', 'Throw placed balloons'),
  [ItemId.SHOES]: def(ItemId.SHOES, '신발', 'Shoes', ItemCategory.STAT_UP, '#a1887f', '👟', 'Push placed balloons and heart blocks'),
  [ItemId.SUPERMAN]: def(ItemId.SUPERMAN, '슈퍼맨', 'Superman', ItemCategory.STAT_UP, '#ffd54f', '★', 'All stats to max temporarily; cancels when a jet hits you'),

  // --- stat-down and traps ------------------------------------------------
  [ItemId.GREEN_DEVIL]: def(ItemId.GREEN_DEVIL, '초록 악마', 'Green Devil', ItemCategory.STAT_DOWN, '#43a047', '☹', 'Spits out one item you ate; that stat -1'),
  [ItemId.DEVIL]: def(ItemId.DEVIL, '보라 악마', 'Devil', ItemCategory.STAT_DOWN, '#7e57c2', '✖', 'Curse: inverted controls, or forced balloon placement'),
  [ItemId.PUSHPIN]: def(ItemId.PUSHPIN, '압정', 'Push-Pin', ItemCategory.STAT_DOWN, '#bdbdbd', '⊥', 'Placed on your tile; any balloon touching it bursts', true, 1),
  [ItemId.BANANA]: def(ItemId.BANANA, '바나나 껍질', 'Banana Peel', ItemCategory.STAT_DOWN, '#fdd835', '~', 'Whoever steps on it slides until an obstacle stops them', true, 3),
  [ItemId.TRAP]: def(ItemId.TRAP, '트랩', 'Trap', ItemCategory.STAT_DOWN, '#6d4c41', '▤', 'Placed between two solid blocks; bubbles anyone passing. Water cannot clear it', true, TRAP_CHARGES),
  [ItemId.BOND]: def(ItemId.BOND, '본드', 'Bond', ItemCategory.STAT_DOWN, '#f5f5dc', '░', 'Floor glue; drops the victim below turtle speed', true, 2),

  // --- utility ------------------------------------------------------------
  [ItemId.GHOST]: def(ItemId.GHOST, '유령', 'Ghost', ItemCategory.UTILITY, '#e0e0e0', '👻', 'Near-invisible to enemies for a while'),
  [ItemId.DISGUISE]: def(ItemId.DISGUISE, '위장도구', 'Disguise', ItemCategory.UTILITY, '#90a4ae', '?', "Temporarily wear the enemy team's colour"),
  [ItemId.DRILL]: def(ItemId.DRILL, '드릴', 'Drill', ItemCategory.UTILITY, '#78909c', '⛏', 'Break the block directly in front of you', true, DRILL_CHARGES),
  [ItemId.OXYGEN]: def(ItemId.OXYGEN, '산소통', 'Oxygen Tank', ItemCategory.UTILITY, '#4dd0e1', '⌷', 'Extends your drown timer — but eating it destroys a held needle', true, 1),
  [ItemId.MOONWALK]: def(ItemId.MOONWALK, '문워크', 'Moonwalk', ItemCategory.UTILITY, '#9575cd', '↺', 'You walk backwards. Cleared by a potion'),
  [ItemId.GOLDEN_DEVIL]: def(ItemId.GOLDEN_DEVIL, '금빛 악마', 'Golden Devil', ItemCategory.UTILITY, '#ffd700', '✦', 'Drops every enemy to speed 1'),

  // --- shop / loadout -----------------------------------------------------
  [ItemId.NEEDLE]: def(ItemId.NEEDLE, '바늘', 'Needle', ItemCategory.SHOP, '#eceff1', '✚', 'Escape a bubble instantly', true, 1),
  [ItemId.SHIELD]: def(ItemId.SHIELD, '실드', 'Shield', ItemCategory.SHOP, '#64b5f6', '◇', 'Temporary total invulnerability; jet hits shorten it', true, 1),
  [ItemId.POTION]: def(ItemId.POTION, '물약', 'Potion', ItemCategory.SHOP, '#ba68c8', '⚗', 'Clears curse, bond and moonwalk', true, 1),
  [ItemId.SPRING]: def(ItemId.SPRING, '스프링', 'Spring', ItemCategory.SHOP, '#aed581', '⌇', 'Hop over an obstacle, up to 3 tiles', true, 3),
  [ItemId.SANSAM]: def(ItemId.SANSAM, '파워산삼', 'Power Ginseng', ItemCategory.SHOP, '#8d6e63', '⚘', 'Sharp temporary stat boost — not to max', true, 1),
  [ItemId.SENSOR]: def(ItemId.SENSOR, '센서', 'Sensor', ItemCategory.SHOP, '#4db6ac', '⊹', 'Pre-visualise jet blast areas', true, 1),
  [ItemId.DART]: def(ItemId.DART, '다트', 'Dart', ItemCategory.SHOP, '#ef5350', '➶', 'Detonate a balloon remotely from range', true, 3),
  [ItemId.REMOTE]: def(ItemId.REMOTE, '무선 물폭탄', 'Remote Bomb', ItemCategory.SHOP, '#ff7043', '◎', 'Bomb detonated on demand; does not count against your balloon limit', true, REMOTE_CHARGES),
};

export function itemDef(id: ItemId): ItemDef {
  return ITEMS[id];
}

/** Items that live in a numbered slot rather than being eaten immediately. */
export function isUsable(id: ItemId): boolean {
  return ITEMS[id].usable;
}

/**
 * [COMMUNITY] Ruleset cultures. Which shop items are permitted defines the
 * whole format. Since there is no monetisation here, these are presets for
 * the pre-match loadout — and the loadout is as much a difficulty dial as
 * the AI tier is.
 */
export interface LoadoutPreset {
  id: string;
  ko: string;
  en: string;
  desc: string;
  items: { item: ItemId; count: number }[];
}

export const LOADOUT_PRESETS: readonly LoadoutPreset[] = [
  {
    id: 'noshop',
    ko: '노샵',
    en: 'No Shop',
    desc: 'One bubble is one death unless a teammate saves you. The purest skill format.',
    items: [],
  },
  {
    id: 'basic',
    ko: '기샵',
    en: 'Basic Shop',
    desc: 'Shield x2 plus a needle is, in practice, about four lives.',
    items: [
      { item: ItemId.NEEDLE, count: 1 },
      { item: ItemId.SHIELD, count: 2 },
      { item: ItemId.POTION, count: 1 },
      { item: ItemId.SPRING, count: 3 },
      { item: ItemId.SANSAM, count: 1 },
      { item: ItemId.SENSOR, count: 1 },
    ],
  },
  {
    id: 'full',
    ko: '풀샵',
    en: 'Full Shop',
    desc: 'Everything, including darts and remote bombs.',
    items: [
      { item: ItemId.NEEDLE, count: 2 },
      { item: ItemId.SHIELD, count: 3 },
      { item: ItemId.POTION, count: 2 },
      { item: ItemId.SPRING, count: 3 },
      { item: ItemId.SANSAM, count: 2 },
      { item: ItemId.SENSOR, count: 1 },
      { item: ItemId.DART, count: 3 },
      { item: ItemId.REMOTE, count: 3 },
    ],
  },
  {
    id: 'allnone',
    ko: '올노',
    en: 'All-None',
    desc: 'No shop items, no pets, no power-up kits. Uni and Bazzi only.',
    items: [],
  },
];

export function getPreset(id: string): LoadoutPreset {
  const p = LOADOUT_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown loadout preset: ${id}`);
  return p;
}
