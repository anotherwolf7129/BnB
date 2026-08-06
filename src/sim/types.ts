import type { DirIndex } from './constants.js';

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

export enum TileKind {
  EMPTY = 0,
  /** [COMMUNITY] Destructible by a water jet. May hide an item. */
  BLOCK_SOFT = 1,
  /** [COMMUNITY] Destructible *and* pushable with 신발 / 붉은 악마. */
  BLOCK_PUSHABLE = 2,
  /** [COMMUNITY] Indestructible scenery (조형물). Blocks jets. */
  BLOCK_HARD = 3,
  /** [COMMUNITY] Camp-map hazard. A balloon on or beside it detonates at once. */
  SPIKE = 4,
}

export function isBlock(k: TileKind): boolean {
  return k === TileKind.BLOCK_SOFT || k === TileKind.BLOCK_PUSHABLE || k === TileKind.BLOCK_HARD;
}
export function isDestructible(k: TileKind): boolean {
  return k === TileKind.BLOCK_SOFT || k === TileKind.BLOCK_PUSHABLE;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export enum ItemId {
  // stat-up
  BUBBLE = 'bubble', // 물풍선  +1 simultaneous balloon
  FLUID = 'fluid', // 액체    +1 jet length
  ULTRA = 'ultra', // 울트라  jet length straight to max
  ROLLER = 'roller', // 롤러 스케이트 +1 speed
  RED_DEVIL = 'redDevil', // 붉은 악마 speed to max + push
  SKATE = 'skate', // 스케이트 speed to max, no push
  GLOVE = 'glove', // 장갑    throw balloons
  SHOES = 'shoes', // 신발    push balloons
  SUPERMAN = 'superman', // 슈퍼맨  all stats to max temporarily

  // stat-down / trap
  GREEN_DEVIL = 'greenDevil', // 초록 악마
  DEVIL = 'devil', // 마귀 / 보라 악마
  PUSHPIN = 'pushpin', // 압정
  BANANA = 'banana', // 바나나 껍질
  TRAP = 'trap', // 트랩
  BOND = 'bond', // 본드

  // utility
  GHOST = 'ghost', // 유령
  DISGUISE = 'disguise', // 위장도구
  DRILL = 'drill', // 드릴
  OXYGEN = 'oxygen', // 산소통
  MOONWALK = 'moonwalk', // 문워크
  GOLDEN_DEVIL = 'goldenDevil', // 금빛 악마 (협공배틀 only)

  // shop / loadout
  NEEDLE = 'needle', // 바늘
  SHIELD = 'shield', // 실드
  POTION = 'potion', // 물약
  SPRING = 'spring', // 스프링
  SANSAM = 'sansam', // 파워산삼
  SENSOR = 'sensor', // 센서
  DART = 'dart', // 다트
  REMOTE = 'remote', // 무선 물폭탄
}

/** Floor-layer objects that are not pickups. */
export enum GroundKind {
  NONE = 0,
  ITEM = 1,
  BANANA = 2,
  BOND = 3,
  PUSHPIN = 4,
  TRAP = 5,
}

export interface Ground {
  kind: GroundKind;
  /** Only meaningful when kind === ITEM. */
  item?: ItemId;
  /** Owner of a placed trap/banana/pushpin, for kill credit. */
  ownerId?: number;
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export enum PlayerState {
  ALIVE = 'alive',
  TRAPPED = 'trapped',
  DEAD = 'dead',
  /** 고슴도치 only: dead players stay on the map as a walking spike. */
  HEDGEHOG = 'hedgehog',
}

export enum CurseKind {
  NONE = 0,
  /** [COMMUNITY] 보라 악마: inverted controls. */
  INVERTED = 1,
  /** [COMMUNITY] 보라 악마: forced involuntary balloon placement. */
  FORCED_PLACE = 2,
}

export interface Stats {
  /** 개수 — simultaneous balloons. */
  count: number;
  /** 물줄기 — jet length in tiles. */
  range: number;
  /** 속도 — integer speed stat. */
  speed: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface TileRef {
  c: number;
  r: number;
}

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** Space. */
  place: boolean;
  /** Ctrl — use the selected inventory slot. */
  use: boolean;
  /** Number keys 1..n; -1 leaves the selection unchanged. */
  selectSlot: number;
}

export function emptyInput(): PlayerInput {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    place: false,
    use: false,
    selectSlot: -1,
  };
}

export interface Player {
  id: number;
  name: string;
  team: number;
  characterId: string;
  /** null for the human, otherwise the AI tier 1..6. */
  aiTier: number | null;

  pos: Vec2;
  /** Authoritative tile for damage and placement — see straddling. */
  logicalTile: TileRef;
  facing: DirIndex;
  state: PlayerState;

  stats: Stats;
  statsMax: Stats;
  statsBase: Stats;

  /** Live balloons this player currently owns on the field. */
  liveBalloons: number;

  // --- trapped state ---
  trappedFor: number;
  drownTime: number;
  /** Who bubbled us — used for kill credit when an enemy pops the bubble. */
  bubbledBy: number | null;

  // --- timers and effects ---
  invulnUntil: number;
  shieldUntil: number;
  supermanUntil: number;
  ghostUntil: number;
  disguiseUntil: number;
  sansamUntil: number;
  sensorUntil: number;
  moonwalkUntil: number;
  curse: CurseKind;
  curseUntil: number;
  curseTimer: number;
  onBond: boolean;
  /** Set while sliding on a banana peel. */
  slideDir: DirIndex | null;
  /** Set while hopping with 스프링. */
  springFrom: Vec2 | null;
  springTo: Vec2 | null;
  springT: number;
  /** Landing delay after dismounting a vehicle — the basis of 내림킬. */
  landingDelay: number;
  respawnIn: number;
  hedgehogStun: number;
  superHedgehog: boolean;

  // --- abilities ---
  canPush: boolean;
  canThrow: boolean;

  // --- inventory ---
  inventory: Map<ItemId, number>;
  slots: ItemId[];
  selectedSlot: number;
  /** Stat items eaten so far, so 초록 악마 has something to spit out. */
  eaten: ItemId[];

  // --- mode flags ---
  isCaptain: boolean;
  hasBomb: boolean;
  bombTimer: number;
  bombCooldown: number;

  // --- scoring ---
  kills: number;
  deaths: number;
  saves: number;
  itemsUsed: number;

  /** Latest input, written by the input source each tick. */
  input: PlayerInput;
  prevInput: PlayerInput;
}

// ---------------------------------------------------------------------------
// Balloons and jets
// ---------------------------------------------------------------------------

export interface Balloon {
  id: number;
  ownerId: number;
  tile: TileRef;
  pos: Vec2;
  range: number;
  fuse: number;
  /** 무선 물폭탄 does not tick down and does not count against the limit. */
  remote: boolean;
  /** Set once the balloon is queued to explode this tick. */
  detonating: boolean;
  /** Sliding after a kick, or arcing after a throw. */
  moveDir: DirIndex | null;
  throwT: number;
  throwFrom: Vec2 | null;
  throwTo: TileRef | null;
  /** Players currently allowed to walk off this balloon. */
  passThrough: Set<number>;
}

export interface JetTile {
  c: number;
  r: number;
  /** Which arm of the cross, for rendering. */
  dir: DirIndex | null;
  tip: boolean;
}

export interface Jet {
  tiles: JetTile[];
  ownerId: number;
  life: number;
  /** Centre tile, for rendering the burst. */
  origin: TileRef;
}

// ---------------------------------------------------------------------------
// Match configuration
// ---------------------------------------------------------------------------

export enum GameType {
  NORMAL = 'normal', // 일반모드
  RESPAWN = 'respawn', // 부활대전
  HEDGEHOG = 'hedgehog', // 고슴도치
  CAPTAIN = 'captain', // 대장잡기
  TIMEBOMB = 'timebomb', // 시한폭탄
}

export interface LoadoutEntry {
  item: ItemId;
  count: number;
}

export interface PlayerConfig {
  name: string;
  team: number;
  characterId: string;
  /** null = human input, 1..6 = AI tier. */
  aiTier: number | null;
  loadout?: LoadoutEntry[];
}

export interface MatchConfig {
  gameType: GameType;
  players: PlayerConfig[];
  mapId: string;
  seed: number;
  /** Overrides the game type's default clock. */
  matchSeconds?: number;
  /** [COMMUNITY] The item plane does not appear on the ghost maps. */
  itemPlane?: boolean;
}

export enum MatchPhase {
  COUNTDOWN = 'countdown',
  PLAYING = 'playing',
  OVER = 'over',
}

export interface MatchResult {
  winningTeam: number | null;
  reason: string;
}

// ---------------------------------------------------------------------------
// Events — the renderer and audio layer read these, the sim never renders.
// ---------------------------------------------------------------------------

export type GameEvent =
  | { type: 'place'; playerId: number; tile: TileRef }
  | { type: 'explode'; tile: TileRef; ownerId: number }
  | { type: 'blockBreak'; tile: TileRef }
  | { type: 'trapped'; playerId: number; byId: number }
  | { type: 'rescue'; playerId: number; byId: number }
  | { type: 'death'; playerId: number; byId: number | null }
  | { type: 'pickup'; playerId: number; item: ItemId }
  | { type: 'useItem'; playerId: number; item: ItemId }
  | { type: 'itemPlane'; drops: number }
  | { type: 'bombPass'; from: number; to: number }
  | { type: 'matchOver'; result: MatchResult };
