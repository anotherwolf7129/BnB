/**
 * Every tunable in the simulation lives here.
 *
 * Tags follow the spec's source legend:
 *   [OFFICIAL]  from Nexon's own documentation
 *   [COMMUNITY] from long-lived Korean player documentation
 *   [DESIGN]    our own proposal
 *   [VERIFY]    genuinely unknown, needs measurement against the live game
 */

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

/** [VERIFY] Exact original tile dimensions. 15x13 matches the classic proportions. */
export const GRID_COLS = 15;
export const GRID_ROWS = 13;

/** [DESIGN] Logical pixel size of one tile. The renderer scales from this. */
export const TILE = 40;

export const WORLD_W = GRID_COLS * TILE;
export const WORLD_H = GRID_ROWS * TILE;

// ---------------------------------------------------------------------------
// Timestep
// ---------------------------------------------------------------------------

/** [DESIGN] Simulation runs at a fixed 60 Hz, fully decoupled from render. */
export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

/** [DESIGN] AI thinks at 10 Hz. Cheap, and the latency reads as human. */
export const AI_TICK_HZ = 10;

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

/**
 * [DESIGN] Speed stat -> pixels/second. Speed 1 is about 1 tile/s, speed 10
 * about 4.15 tiles/s.
 * [VERIFY] Real tiles/second for each speed value 1-10.
 */
export function speedToPixelsPerSecond(speed: number): number {
  return 40 + 14 * (speed - 1);
}

/**
 * Straddling (걸치기). The logical tile only commits once the character's
 * centre is within this many pixels of the new tile's centre. Until then the
 * character keeps its previous logical tile, which is what makes it possible
 * to stand visually inside a water jet and survive it.
 *
 * [DESIGN] 0.34 * TILE leaves a ~6px band past each boundary where you are
 * visually in the new tile but logically still in the old one.
 */
export const COMMIT_EPSILON = 0.34 * TILE;

/** [DESIGN] Half-extent of the character's collision box. Deliberately small. */
export const CHAR_HALF = 0.32 * TILE;

/** [DESIGN] How far we will nudge a character sideways to slip past a corner. */
export const CORNER_ASSIST = 0.45 * TILE;

/** [VERIFY] Movement speed while bubbled. Documented only as "extremely slow". */
export const TRAPPED_SPEED_PPS = 14;

/** [COMMUNITY] 본드 drops you below turtle speed. */
export const BOND_SPEED_PPS = 20;

/** [COMMUNITY] Banana peel slide speed. */
export const SLIDE_SPEED_PPS = 260;

/**
 * [COMMUNITY] 컨베이어 벨트. Desert, Ice and Factory run belts across the floor;
 * anything standing on one is carried along whether it wants to be or not.
 * Slow enough to walk against, fast enough to ruin a dodge.
 */
export const CONVEYOR_SPEED_PPS = 62;

// ---------------------------------------------------------------------------
// Balloons and jets
// ---------------------------------------------------------------------------

/** [VERIFY] Balloon fuse duration. ~2.5s is the spec's starting value. */
export const FUSE_SECONDS = 2.5;

/** [DESIGN] The last stretch of the fuse plays the "swell" tell players read. */
export const FUSE_SWELL_SECONDS = 0.6;

/** [DESIGN] How long a jet tile stays lethal (and on screen). */
export const JET_SECONDS = 0.45;

/** [COMMUNITY] A pushed or thrown balloon slides until it hits an obstacle. */
export const KICK_SPEED_PPS = 220;

/** [COMMUNITY] 장갑 throws a balloon this many tiles. */
export const THROW_TILES = 3;
export const THROW_SECONDS = 0.4;

// ---------------------------------------------------------------------------
// Trapped state
// ---------------------------------------------------------------------------

/** [VERIFY] Drown duration. ~5s is the spec's starting value. */
export const DROWN_SECONDS = 5;

/** [COMMUNITY] 로두마니 fears water and drowns faster. [VERIFY] by how much. */
export const RODUMANI_DROWN_MULTIPLIER = 0.6;

/** [COMMUNITY] 산소통 extends the drown timer. */
export const OXYGEN_BONUS_SECONDS = 4;

/** [DESIGN] Grace window after being freed, so you are not instantly re-bubbled. */
export const RESCUE_INVULN_SECONDS = 1.0;

// ---------------------------------------------------------------------------
// Match clocks
// ---------------------------------------------------------------------------

/** [DESIGN inference] The item-plane windows imply a 3:00 일반모드 match. */
export const MATCH_SECONDS_NORMAL = 180;

/** [COMMUNITY] 부활대전 runs shorter. */
export const MATCH_SECONDS_RESPAWN = 120;

/** [COMMUNITY] Respawn delay after death in 부활대전. */
export const RESPAWN_SECONDS = 3;

/**
 * [COMMUNITY] The item plane's drop windows, expressed as seconds *remaining*.
 * Added in 2003; first pass only after one minute has elapsed.
 */
export const ITEM_PLANE_WINDOWS = [119, 96, 74, 51, 29, 7];
export const ITEM_PLANE_MAX_DROPS = 2;
/** The plane never flies during the first minute, whatever the match length. */
export const ITEM_PLANE_FIRST_PASS_DELAY = 60;

// ---------------------------------------------------------------------------
// Game type specifics
// ---------------------------------------------------------------------------

/** [COMMUNITY] 시한폭탄: 5 second timer, resets on pass. */
export const TIMEBOMB_SECONDS = 5;
/** [COMMUNITY] 시한폭탄: blast is a 5x5 area centred on the carrier. */
export const TIMEBOMB_RADIUS = 2;
/** [DESIGN] Delay before the first carrier is designated, and between rounds. */
export const TIMEBOMB_ASSIGN_DELAY = 3;
/** [DESIGN] Passing needs a brief cooldown or the bomb ping-pongs on contact. */
export const TIMEBOMB_PASS_COOLDOWN = 0.5;

/** [COMMUNITY] Hedgehogs hit by a jet are stunned and inert for a while. */
export const HEDGEHOG_STUN_SECONDS = 3;
/** [DESIGN] Hedgehogs move at a fixed brisk pace; 슈퍼 도치 raises it. */
export const HEDGEHOG_SPEED_PPS = 110;
export const SUPER_HEDGEHOG_SPEED_PPS = 165;

// ---------------------------------------------------------------------------
// Item / effect durations
// ---------------------------------------------------------------------------

/** [COMMUNITY] 슈퍼맨: all stats to max temporarily, cancels on being hit. */
export const SUPERMAN_SECONDS = 15;
/** [COMMUNITY] 유령: near-invisibility to enemies. */
export const GHOST_SECONDS = 12;
/** [COMMUNITY] 위장도구: wear the enemy team's colour. */
export const DISGUISE_SECONDS = 15;
/** [COMMUNITY] 마귀/보라 악마 curse, cleared by 물약. */
export const CURSE_SECONDS = 10;
/** [COMMUNITY] 문워크, cleared by 물약. */
export const MOONWALK_SECONDS = 12;
/** [DESIGN] How often the forced-placement curse makes you drop a balloon. */
export const CURSE_FORCED_PLACE_INTERVAL = 1.2;

/** [VERIFY] 실드 duration, and how much a jet hit reduces it. */
export const SHIELD_SECONDS = 8;
export const SHIELD_HIT_PENALTY_SECONDS = 3;
/** [DESIGN] Cooldown after 실드 so the player can read the AI's tell. */
export const SHIELD_AI_COOLDOWN = 6;

/** [VERIFY] 파워산삼 exact delta. Documented only as "sharp rise, not to max". */
export const SANSAM_SECONDS = 15;
export const SUPER_SANSAM_SECONDS = 30;
export const SANSAM_BONUS = 2;

/** [COMMUNITY] 스프링 hops up to 3 tiles, 1 charge per wall crossed. */
export const SPRING_MAX_TILES = 3;
export const SPRING_SECONDS = 0.35;

/** [COMMUNITY] 드릴 breaks the block in front of you. 3 per pickup. */
export const DRILL_CHARGES = 3;
/** [COMMUNITY] 트랩: 2 per pickup. */
export const TRAP_CHARGES = 2;
/** [COMMUNITY] 무선 물폭탄: 3 per pickup. */
export const REMOTE_CHARGES = 3;
/** [COMMUNITY] 다트: detonate a balloon remotely from range. */
export const DART_RANGE_TILES = 8;

/** [COMMUNITY] 산소통 picked up after 바늘 destroys the needle. */
export const OXYGEN_DESTROYS_NEEDLE = true;

/** [COMMUNITY] 초록 악마 spits out one random eaten item, that stat -1. */
export const GREEN_DEVIL_PENALTY = 1;

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

/** [VERIFY] Dismount landing delay. This is what makes 내림킬 possible. */
export const DISMOUNT_DELAY_SECONDS = 0.8;

// ---------------------------------------------------------------------------
// Block drops
// ---------------------------------------------------------------------------

/** [VERIFY] Block -> item drop probability, and per-map item pools. */
export const BLOCK_DROP_CHANCE = 0.34;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export const DIRS = [
  { c: 0, r: -1 }, // 0 up
  { c: 1, r: 0 }, // 1 right
  { c: 0, r: 1 }, // 2 down
  { c: -1, r: 0 }, // 3 left
] as const;

export type DirIndex = 0 | 1 | 2 | 3;

export function tileCenterX(c: number): number {
  return c * TILE + TILE / 2;
}
export function tileCenterY(r: number): number {
  return r * TILE + TILE / 2;
}
export function tileIndex(c: number, r: number): number {
  return r * GRID_COLS + c;
}
export function inBounds(c: number, r: number): boolean {
  return c >= 0 && c < GRID_COLS && r >= 0 && r < GRID_ROWS;
}
