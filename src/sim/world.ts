import {
  BLOCK_DROP_CHANCE,
  BOND_SPEED_PPS,
  CHAR_HALF,
  CURSE_FORCED_PLACE_INTERVAL,
  CURSE_SECONDS,
  DART_RANGE_TILES,
  DISGUISE_SECONDS,
  DIRS,
  DROWN_SECONDS,
  DT,
  FUSE_SECONDS,
  GHOST_SECONDS,
  GRID_COLS,
  GRID_ROWS,
  HEDGEHOG_SPEED_PPS,
  HEDGEHOG_STUN_SECONDS,
  ITEM_PLANE_MAX_DROPS,
  ITEM_PLANE_WINDOWS,
  JET_SECONDS,
  KICK_SPEED_PPS,
  MATCH_SECONDS_NORMAL,
  MATCH_SECONDS_RESPAWN,
  MOONWALK_SECONDS,
  OXYGEN_BONUS_SECONDS,
  OXYGEN_DESTROYS_NEEDLE,
  RESCUE_INVULN_SECONDS,
  RESPAWN_SECONDS,
  SANSAM_BONUS,
  SANSAM_SECONDS,
  SHIELD_HIT_PENALTY_SECONDS,
  SHIELD_SECONDS,
  SLIDE_SPEED_PPS,
  SPRING_MAX_TILES,
  SPRING_SECONDS,
  SUPERMAN_SECONDS,
  SUPER_HEDGEHOG_SPEED_PPS,
  THROW_SECONDS,
  THROW_TILES,
  TIMEBOMB_ASSIGN_DELAY,
  TIMEBOMB_PASS_COOLDOWN,
  TIMEBOMB_RADIUS,
  TIMEBOMB_SECONDS,
  TRAPPED_SPEED_PPS,
  inBounds,
  speedToPixelsPerSecond,
  tileCenterX,
  tileCenterY,
  tileIndex,
  type DirIndex,
} from './constants.js';
import { getCharacter } from './characters.js';
import { isUsable, itemDef } from './items.js';
import { getMap, loadMap, type LoadedMap } from './maps.js';
import {
  boxOverlapsTile,
  commitLogicalTile,
  moveWithCollision,
  overlaps,
  tileOf,
  type SolidFn,
} from './movement.js';
import { Rng } from './rng.js';
import {
  CurseKind,
  GameType,
  GroundKind,
  ItemId,
  MatchPhase,
  PlayerState,
  TileKind,
  emptyInput,
  isBlock,
  isDestructible,
  type Balloon,
  type GameEvent,
  type Ground,
  type Jet,
  type JetTile,
  type MatchConfig,
  type MatchResult,
  type Player,
  type TileRef,
} from './types.js';

/** Canonical order of the numbered inventory slots. */
export const SLOT_ORDER: readonly ItemId[] = [
  ItemId.NEEDLE,
  ItemId.SHIELD,
  ItemId.POTION,
  ItemId.SPRING,
  ItemId.SANSAM,
  ItemId.SENSOR,
  ItemId.DART,
  ItemId.REMOTE,
  ItemId.BANANA,
  ItemId.TRAP,
  ItemId.PUSHPIN,
  ItemId.BOND,
  ItemId.DRILL,
  ItemId.OXYGEN,
];

/** Spawn assignment order: the first two players get opposite corners. */
const SPAWN_ORDER = [0, 3, 1, 2, 4, 5, 6, 7];

const TEAM_COLORS = ['#e64c4c', '#4c7ae6', '#4ce67a', '#e6c94c', '#b04ce6', '#4ce6d8', '#e6844c', '#9aa5b1'];

export function teamColor(team: number): string {
  return TEAM_COLORS[team % TEAM_COLORS.length];
}

export class World {
  readonly cfg: MatchConfig;
  readonly map: LoadedMap;
  readonly tiles: Uint8Array;
  readonly ground: Ground[];
  readonly players: Player[] = [];
  readonly balloons: Balloon[] = [];
  readonly jets: Jet[] = [];
  readonly rng: Rng;

  time = 0;
  clock: number;
  phase: MatchPhase = MatchPhase.COUNTDOWN;
  countdown = 3;
  result: MatchResult | null = null;
  events: GameEvent[] = [];

  /** [COMMUNITY] 대장잡기: the player who killed the captain leads next round. */
  nextCaptain: number | null = null;

  private nextBalloonId = 1;
  private planeFired: boolean[];
  private timebombAssignIn = TIMEBOMB_ASSIGN_DELAY;
  private itemPlaneEnabled: boolean;

  constructor(cfg: MatchConfig) {
    this.cfg = cfg;
    this.rng = new Rng(cfg.seed);
    const def = getMap(cfg.mapId);
    this.map = loadMap(def);
    this.tiles = this.map.tiles.slice();
    this.ground = new Array(GRID_COLS * GRID_ROWS);
    for (let i = 0; i < this.ground.length; i++) this.ground[i] = { kind: GroundKind.NONE };

    this.clock =
      cfg.matchSeconds ??
      (cfg.gameType === GameType.RESPAWN ? MATCH_SECONDS_RESPAWN : MATCH_SECONDS_NORMAL);
    this.itemPlaneEnabled = (cfg.itemPlane ?? def.itemPlane) && def.itemPlane;
    this.planeFired = ITEM_PLANE_WINDOWS.map(() => false);

    cfg.players.forEach((pc, i) => this.players.push(this.makePlayer(pc, i)));

    if (cfg.gameType === GameType.CAPTAIN) this.assignCaptains();
  }

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  private makePlayer(pc: MatchConfig['players'][number], index: number): Player {
    const ch = getCharacter(pc.characterId);
    const spawnIdx = SPAWN_ORDER[index % SPAWN_ORDER.length];
    const spawn = this.map.spawns[spawnIdx];
    const inventory = new Map<ItemId, number>();
    for (const entry of pc.loadout ?? []) {
      if (entry.count > 0) inventory.set(entry.item, entry.count);
    }
    const p: Player = {
      id: index,
      name: pc.name,
      team: pc.team,
      characterId: pc.characterId,
      aiTier: pc.aiTier,
      pos: { x: tileCenterX(spawn.c), y: tileCenterY(spawn.r) },
      logicalTile: { c: spawn.c, r: spawn.r },
      facing: 2,
      state: PlayerState.ALIVE,
      stats: { ...ch.base },
      statsMax: { ...ch.max },
      statsBase: { ...ch.base },
      liveBalloons: 0,
      trappedFor: 0,
      drownTime: DROWN_SECONDS,
      bubbledBy: null,
      invulnUntil: 0,
      shieldUntil: 0,
      supermanUntil: 0,
      ghostUntil: 0,
      disguiseUntil: 0,
      sansamUntil: 0,
      sensorUntil: 0,
      moonwalkUntil: 0,
      curse: CurseKind.NONE,
      curseUntil: 0,
      curseTimer: 0,
      onBond: false,
      slideDir: null,
      springFrom: null,
      springTo: null,
      springT: 0,
      landingDelay: 0,
      respawnIn: 0,
      hedgehogStun: 0,
      superHedgehog: false,
      canPush: false,
      canThrow: false,
      inventory,
      slots: [],
      selectedSlot: 0,
      eaten: [],
      isCaptain: false,
      hasBomb: false,
      bombTimer: 0,
      bombCooldown: 0,
      kills: 0,
      deaths: 0,
      saves: 0,
      itemsUsed: 0,
      input: emptyInput(),
      prevInput: emptyInput(),
    };
    this.refreshSlots(p);
    return p;
  }

  private assignCaptains(): void {
    const byTeam = new Map<number, Player[]>();
    for (const p of this.players) {
      if (!byTeam.has(p.team)) byTeam.set(p.team, []);
      byTeam.get(p.team)!.push(p);
    }
    for (const group of byTeam.values()) {
      const captain = group[this.rng.int(group.length)];
      captain.isCaptain = true;
    }
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  tileAt(c: number, r: number): TileKind {
    if (!inBounds(c, r)) return TileKind.BLOCK_HARD;
    return this.tiles[tileIndex(c, r)] as TileKind;
  }

  setTile(c: number, r: number, k: TileKind): void {
    this.tiles[tileIndex(c, r)] = k;
  }

  groundAt(c: number, r: number): Ground {
    return this.ground[tileIndex(c, r)];
  }

  balloonAt(c: number, r: number): Balloon | null {
    for (const b of this.balloons) {
      if (b.throwFrom) continue; // in flight, not on the grid
      if (b.tile.c === c && b.tile.r === r) return b;
    }
    return null;
  }

  playerById(id: number): Player | undefined {
    return this.players[id];
  }

  sameTeam(a: Player, b: Player): boolean {
    return a.team === b.team;
  }

  /** Walkable for pathfinding, ignoring balloon pass-through grants. */
  solid: SolidFn = (c, r) => {
    if (!inBounds(c, r)) return true;
    if (isBlock(this.tileAt(c, r))) return true;
    return this.balloonAt(c, r) !== null;
  };

  solidForPlayer(p: Player): SolidFn {
    return (c, r) => {
      if (!inBounds(c, r)) return true;
      if (isBlock(this.tileAt(c, r))) return true;
      const b = this.balloonAt(c, r);
      return b !== null && !b.passThrough.has(p.id);
    };
  }

  aliveOnTeam(team: number): number {
    let n = 0;
    for (const p of this.players) {
      if (p.team === team && (p.state === PlayerState.ALIVE || p.state === PlayerState.TRAPPED)) n++;
    }
    return n;
  }

  teams(): number[] {
    return [...new Set(this.players.map((p) => p.team))].sort((a, b) => a - b);
  }

  /** Effective speed stat, after temporary boosts. */
  effectiveSpeed(p: Player): number {
    if (p.supermanUntil > this.time) return p.statsMax.speed;
    // [COMMUNITY] 시한폭탄: the carrier's speed is locked to their maximum.
    if (p.hasBomb) return p.statsMax.speed;
    let s = p.stats.speed;
    if (p.sansamUntil > this.time) s = Math.min(p.statsMax.speed, s + SANSAM_BONUS);
    return s;
  }

  effectiveRange(p: Player): number {
    if (p.supermanUntil > this.time) return p.statsMax.range;
    let r = p.stats.range;
    if (p.sansamUntil > this.time) r = Math.min(p.statsMax.range, r + SANSAM_BONUS);
    return r;
  }

  effectiveCount(p: Player): number {
    if (p.supermanUntil > this.time) return p.statsMax.count;
    let n = p.stats.count;
    if (p.sansamUntil > this.time) n = Math.min(p.statsMax.count, n + SANSAM_BONUS);
    return n;
  }

  /** Recompute the numbered slots from the inventory. Idempotent. */
  refreshSlots(p: Player): void {
    p.slots = SLOT_ORDER.filter((id) => (p.inventory.get(id) ?? 0) > 0);
    if (p.selectedSlot >= p.slots.length) p.selectedSlot = Math.max(0, p.slots.length - 1);
  }

  // -------------------------------------------------------------------------
  // Main step
  // -------------------------------------------------------------------------

  step(): void {
    this.events = [];
    if (this.phase === MatchPhase.OVER) return;

    if (this.phase === MatchPhase.COUNTDOWN) {
      this.countdown -= DT;
      if (this.countdown <= 0) this.phase = MatchPhase.PLAYING;
      return;
    }

    this.time += DT;
    this.clock -= DT;

    this.updateItemPlane();
    for (const p of this.players) this.updatePlayer(p);
    this.updateBalloons();
    this.updateJets();
    this.applyJetDamage();
    this.resolveContacts();
    this.updateModeLogic();
    this.checkWin();

    for (const p of this.players) p.prevInput = { ...p.input };
  }

  // -------------------------------------------------------------------------
  // Players
  // -------------------------------------------------------------------------

  private updatePlayer(p: Player): void {
    // Slot selection is always live so the HUD stays responsive.
    this.refreshSlots(p);
    if (p.input.selectSlot >= 0 && p.input.selectSlot < p.slots.length) {
      p.selectedSlot = p.input.selectSlot;
    }

    if (p.curseUntil <= this.time && p.curse !== CurseKind.NONE) p.curse = CurseKind.NONE;
    if (p.landingDelay > 0) p.landingDelay = Math.max(0, p.landingDelay - DT);

    switch (p.state) {
      case PlayerState.DEAD:
        if (this.cfg.gameType === GameType.RESPAWN && p.respawnIn > 0) {
          p.respawnIn -= DT;
          if (p.respawnIn <= 0) this.respawn(p);
        }
        return;
      case PlayerState.HEDGEHOG:
        this.updateHedgehog(p);
        return;
      case PlayerState.TRAPPED:
        this.updateTrapped(p);
        return;
      case PlayerState.ALIVE:
        this.updateAlive(p);
        return;
    }
  }

  private inputDirection(p: Player): { dx: number; dy: number; dir: DirIndex | null } {
    let up = p.input.up;
    let down = p.input.down;
    let left = p.input.left;
    let right = p.input.right;

    // [COMMUNITY] 보라 악마 inverts controls; 문워크 walks you backwards.
    // Both are axis flips, so two of them cancel out.
    const flips =
      (p.curse === CurseKind.INVERTED ? 1 : 0) + (p.moonwalkUntil > this.time ? 1 : 0);
    if (flips % 2 === 1) {
      [up, down] = [down, up];
      [left, right] = [right, left];
    }

    const dx = (right ? 1 : 0) - (left ? 1 : 0);
    const dy = (down ? 1 : 0) - (up ? 1 : 0);
    let dir: DirIndex | null = null;
    if (dy < 0) dir = 0;
    else if (dy > 0) dir = 2;
    if (dx > 0) dir = 1;
    else if (dx < 0) dir = 3;
    return { dx, dy, dir };
  }

  private updateAlive(p: Player): void {
    // --- spring hop: no collision, no input ---------------------------------
    if (p.springTo && p.springFrom) {
      p.springT += DT / SPRING_SECONDS;
      const t = Math.min(1, p.springT);
      p.pos.x = p.springFrom.x + (p.springTo.x - p.springFrom.x) * t;
      p.pos.y = p.springFrom.y + (p.springTo.y - p.springFrom.y) * t;
      if (t >= 1) {
        const tl = tileOf(p.pos.x, p.pos.y);
        p.logicalTile.c = tl.c;
        p.logicalTile.r = tl.r;
        p.springFrom = null;
        p.springTo = null;
      }
      return;
    }

    const solid = this.solidForPlayer(p);

    // --- banana slide -------------------------------------------------------
    if (p.slideDir !== null) {
      const d = DIRS[p.slideDir];
      const step = SLIDE_SPEED_PPS * DT;
      const res = moveWithCollision(p.pos, d.c * step, d.r * step, solid);
      if (!res.moved) p.slideDir = null;
      commitLogicalTile(p.pos, p.logicalTile);
      this.checkGroundUnder(p);
      return;
    }

    // --- normal movement ----------------------------------------------------
    const { dx, dy, dir } = this.inputDirection(p);
    if (dir !== null) p.facing = dir;

    let pps = speedToPixelsPerSecond(this.effectiveSpeed(p));
    if (p.onBond) pps = Math.min(pps, BOND_SPEED_PPS);
    if (p.landingDelay > 0) pps = 0;

    if ((dx !== 0 || dy !== 0) && pps > 0) {
      // Normalise diagonals so cutting corners is not faster.
      const len = Math.hypot(dx, dy) || 1;
      const step = pps * DT;
      const res = moveWithCollision(p.pos, (dx / len) * step, (dy / len) * step, solid);
      if (res.blocked && p.canPush && res.blockedC >= 0) {
        this.tryPush(p, res.blockedC, res.blockedR);
      }
      commitLogicalTile(p.pos, p.logicalTile);
    }

    this.checkGroundUnder(p);

    // --- balloon placement --------------------------------------------------
    // [COMMUNITY] the forced-placement curse is exactly this, on a timer.
    if (p.curse === CurseKind.FORCED_PLACE) {
      p.curseTimer -= DT;
      if (p.curseTimer <= 0) {
        p.curseTimer = CURSE_FORCED_PLACE_INTERVAL;
        this.placeBalloon(p);
      }
    }
    if (p.input.place && !p.prevInput.place) this.placeBalloon(p);
    if (p.input.use && !p.prevInput.use) this.useSelectedItem(p);
  }

  private updateTrapped(p: Player): void {
    p.trappedFor += DT;

    // [COMMUNITY] you can still move, extremely slowly, and cannot place.
    const { dx, dy } = this.inputDirection(p);
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      const step = TRAPPED_SPEED_PPS * DT;
      moveWithCollision(p.pos, (dx / len) * step, (dy / len) * step, this.solidForPlayer(p));
      commitLogicalTile(p.pos, p.logicalTile);
    }

    // 바늘 is the only item usable from inside a bubble.
    if (p.input.use && !p.prevInput.use) {
      const item = p.slots[p.selectedSlot];
      if (item === ItemId.NEEDLE) this.useSelectedItem(p);
    }

    if (p.trappedFor >= p.drownTime) {
      // Drowning alone denies the opponent a kill — which is exactly why
      // players sometimes refuse the oxygen tank.
      this.killPlayer(p, null);
    }
  }

  private updateHedgehog(p: Player): void {
    if (p.hedgehogStun > 0) {
      p.hedgehogStun -= DT;
      return;
    }
    const { dx, dy, dir } = this.inputDirection(p);
    if (dir !== null) p.facing = dir;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      const step = (p.superHedgehog ? SUPER_HEDGEHOG_SPEED_PPS : HEDGEHOG_SPEED_PPS) * DT;
      // A hedgehog ignores balloons — it detonates them on contact instead.
      moveWithCollision(p.pos, (dx / len) * step, (dy / len) * step, (c, r) => {
        if (!inBounds(c, r)) return true;
        return isBlock(this.tileAt(c, r));
      });
      const tl = tileOf(p.pos.x, p.pos.y);
      p.logicalTile.c = tl.c;
      p.logicalTile.r = tl.r;
    }
  }

  private tryPush(p: Player, c: number, r: number): void {
    const dir = p.facing;
    const d = DIRS[dir];
    const kind = this.tileAt(c, r);
    if (kind === TileKind.BLOCK_PUSHABLE) {
      const nc = c + d.c;
      const nr = r + d.r;
      if (!inBounds(nc, nr)) return;
      if (this.tileAt(nc, nr) !== TileKind.EMPTY) return;
      if (this.balloonAt(nc, nr)) return;
      this.setTile(c, r, TileKind.EMPTY);
      this.setTile(nc, nr, TileKind.BLOCK_PUSHABLE);
      return;
    }
    const b = this.balloonAt(c, r);
    if (b && b.moveDir === null) this.kickBalloon(b, dir);
  }

  private respawn(p: Player): void {
    // Respawn at the spawn point furthest from any living enemy.
    let best = this.map.spawns[0];
    let bestScore = -Infinity;
    for (const s of this.map.spawns) {
      if (this.solid(s.c, s.r)) continue;
      let score = Infinity;
      for (const q of this.players) {
        if (q.id === p.id || this.sameTeam(p, q)) continue;
        if (q.state !== PlayerState.ALIVE) continue;
        score = Math.min(score, Math.abs(q.logicalTile.c - s.c) + Math.abs(q.logicalTile.r - s.r));
      }
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    p.pos = { x: tileCenterX(best.c), y: tileCenterY(best.r) };
    p.logicalTile = { c: best.c, r: best.r };
    p.state = PlayerState.ALIVE;
    p.trappedFor = 0;
    p.slideDir = null;
    p.onBond = false;
    p.invulnUntil = this.time + RESCUE_INVULN_SECONDS;
  }

  // -------------------------------------------------------------------------
  // Balloons
  // -------------------------------------------------------------------------

  placeBalloon(p: Player, remote = false): Balloon | null {
    if (p.state !== PlayerState.ALIVE) return null;
    const { c, r } = p.logicalTile;
    if (this.balloonAt(c, r)) return null;
    const kind = this.tileAt(c, r);
    if (isBlock(kind)) return null;
    if (!remote && p.liveBalloons >= this.effectiveCount(p)) return null;

    const b: Balloon = {
      id: this.nextBalloonId++,
      ownerId: p.id,
      tile: { c, r },
      pos: { x: tileCenterX(c), y: tileCenterY(r) },
      range: this.effectiveRange(p),
      fuse: FUSE_SECONDS,
      remote,
      detonating: false,
      moveDir: null,
      throwT: 0,
      throwFrom: null,
      throwTo: null,
      passThrough: new Set<number>(),
    };
    // Anyone whose box touches the tile right now may walk off it.
    for (const q of this.players) {
      if (boxOverlapsTile(q.pos, b.pos)) b.passThrough.add(q.id);
    }
    if (!remote) p.liveBalloons++;

    // [COMMUNITY] a balloon on or beside a spike detonates immediately.
    // This is the bug that got Camp excluded from 협공배틀.
    if (this.nearSpike(c, r)) b.fuse = 0.01;

    this.balloons.push(b);
    this.events.push({ type: 'place', playerId: p.id, tile: { c, r } });
    return b;
  }

  private nearSpike(c: number, r: number): boolean {
    if (this.tileAt(c, r) === TileKind.SPIKE) return true;
    for (const d of DIRS) {
      if (this.tileAt(c + d.c, r + d.r) === TileKind.SPIKE) return true;
    }
    return false;
  }

  private kickBalloon(b: Balloon, dir: DirIndex): void {
    const d = DIRS[dir];
    const nc = b.tile.c + d.c;
    const nr = b.tile.r + d.r;
    if (!inBounds(nc, nr) || isBlock(this.tileAt(nc, nr)) || this.balloonAt(nc, nr)) return;
    b.moveDir = dir;
  }

  private throwBalloon(p: Player, b: Balloon): void {
    const d = DIRS[p.facing];
    let target: TileRef | null = null;
    for (let i = THROW_TILES; i >= 1; i--) {
      const c = b.tile.c + d.c * i;
      const r = b.tile.r + d.r * i;
      if (!inBounds(c, r)) continue;
      if (isBlock(this.tileAt(c, r)) || this.balloonAt(c, r)) continue;
      target = { c, r };
      break;
    }
    if (!target) return;
    b.throwFrom = { x: b.pos.x, y: b.pos.y };
    b.throwTo = target;
    b.throwT = 0;
    b.moveDir = null;
  }

  private updateBalloons(): void {
    const detonate: Balloon[] = [];

    for (const b of this.balloons) {
      // Pass-through expires only once the character's box has fully cleared
      // the balloon's tile — otherwise they are sealed inside it.
      if (b.passThrough.size > 0) {
        for (const id of [...b.passThrough]) {
          const q = this.players[id];
          if (!q || !boxOverlapsTile(q.pos, b.pos)) b.passThrough.delete(id);
        }
      }

      if (b.throwFrom && b.throwTo) {
        b.throwT += DT / THROW_SECONDS;
        const t = Math.min(1, b.throwT);
        const tx = tileCenterX(b.throwTo.c);
        const ty = tileCenterY(b.throwTo.r);
        b.pos.x = b.throwFrom.x + (tx - b.throwFrom.x) * t;
        b.pos.y = b.throwFrom.y + (ty - b.throwFrom.y) * t;
        if (t >= 1) {
          b.tile = { ...b.throwTo };
          b.throwFrom = null;
          b.throwTo = null;
        }
      } else if (b.moveDir !== null) {
        const d = DIRS[b.moveDir];
        const step = KICK_SPEED_PPS * DT;
        b.pos.x += d.c * step;
        b.pos.y += d.r * step;
        const tl = tileOf(b.pos.x, b.pos.y);
        // Once the balloon's centre passes into a new tile, adopt it, then
        // check whether the *next* tile along is blocked.
        b.tile = { c: tl.c, r: tl.r };
        const nc = tl.c + d.c;
        const nr = tl.r + d.r;
        const centred =
          Math.abs(b.pos.x - tileCenterX(tl.c)) < step && Math.abs(b.pos.y - tileCenterY(tl.r)) < step;
        const nextBlocked =
          !inBounds(nc, nr) ||
          isBlock(this.tileAt(nc, nr)) ||
          this.balloons.some((o) => o !== b && o.tile.c === nc && o.tile.r === nr) ||
          this.players.some(
            (q) =>
              q.state === PlayerState.ALIVE &&
              tileOf(q.pos.x, q.pos.y).c === nc &&
              tileOf(q.pos.x, q.pos.y).r === nr,
          );
        if (centred && nextBlocked) {
          b.pos.x = tileCenterX(tl.c);
          b.pos.y = tileCenterY(tl.r);
          b.moveDir = null;
        }
        // [COMMUNITY] a pushed balloon that touches a 압정 bursts on contact.
        const g = this.groundAt(tl.c, tl.r);
        if (g.kind === GroundKind.PUSHPIN) {
          g.kind = GroundKind.NONE;
          detonate.push(b);
        }
      } else if (!b.remote) {
        b.fuse -= DT;
        if (b.fuse <= 0) detonate.push(b);
      }

      if (!b.remote && this.nearSpike(b.tile.c, b.tile.r) && b.fuse > 0.02) b.fuse = 0.01;
    }

    for (const b of detonate) this.explode(b);
  }

  /** Detonate a balloon, resolving chain reactions breadth-first. */
  explode(start: Balloon): void {
    const queue: Balloon[] = [start];
    const seen = new Set<number>();

    while (queue.length) {
      const b = queue.shift()!;
      if (seen.has(b.id)) continue;
      seen.add(b.id);

      const idx = this.balloons.indexOf(b);
      if (idx < 0) continue;
      this.balloons.splice(idx, 1);
      if (!b.remote) {
        const owner = this.players[b.ownerId];
        if (owner) owner.liveBalloons = Math.max(0, owner.liveBalloons - 1);
      }

      const tiles = this.jetTiles(b.tile, b.range);
      this.jets.push({ tiles, ownerId: b.ownerId, life: JET_SECONDS, origin: { ...b.tile } });
      this.events.push({ type: 'explode', tile: { ...b.tile }, ownerId: b.ownerId });

      for (const t of tiles) {
        const kind = this.tileAt(t.c, t.r);
        if (isDestructible(kind)) {
          this.destroyBlock(t.c, t.r);
          continue;
        }
        const g = this.groundAt(t.c, t.r);
        // Jets destroy ground items and clear floor traps — except 트랩,
        // which water cannot remove at all. That is what makes it real
        // area denial.
        if (g.kind !== GroundKind.NONE && g.kind !== GroundKind.TRAP) {
          g.kind = GroundKind.NONE;
          g.item = undefined;
          g.ownerId = undefined;
        }
        // Chain reaction: a live balloon caught in the jet detonates now.
        const other = this.balloonAt(t.c, t.r);
        if (other && !seen.has(other.id)) queue.push(other);
      }
    }
  }

  /**
   * Cross-shaped jet. One block per direction per balloon: destroy it, then
   * stop. Hard blocks stop the jet without being destroyed. Spikes do not
   * block it.
   */
  jetTiles(origin: TileRef, range: number): JetTile[] {
    const out: JetTile[] = [{ c: origin.c, r: origin.r, dir: null, tip: false }];
    for (let di = 0 as DirIndex; di < 4; di = (di + 1) as DirIndex) {
      const d = DIRS[di];
      for (let i = 1; i <= range; i++) {
        const c = origin.c + d.c * i;
        const r = origin.r + d.r * i;
        if (!inBounds(c, r)) break;
        const kind = this.tileAt(c, r);
        if (kind === TileKind.BLOCK_HARD) break;
        out.push({ c, r, dir: di, tip: i === range });
        if (isDestructible(kind)) break;
      }
    }
    return out;
  }

  private destroyBlock(c: number, r: number): void {
    this.setTile(c, r, TileKind.EMPTY);
    this.events.push({ type: 'blockBreak', tile: { c, r } });
    const g = this.groundAt(c, r);
    if (g.kind === GroundKind.NONE && this.rng.chance(BLOCK_DROP_CHANCE)) {
      g.kind = GroundKind.ITEM;
      g.item = this.rng.weighted(this.map.def.itemPool);
    }
  }

  private updateJets(): void {
    for (let i = this.jets.length - 1; i >= 0; i--) {
      this.jets[i].life -= DT;
      if (this.jets[i].life <= 0) this.jets.splice(i, 1);
    }
  }

  /**
   * Damage resolves against the character's **logical** tile, not their
   * drawn position. This is what lets a straddling player stand visually
   * inside a jet and survive it.
   */
  private applyJetDamage(): void {
    if (this.jets.length === 0) return;
    const hit = new Map<number, number>(); // tileIndex -> ownerId
    for (const j of this.jets) {
      for (const t of j.tiles) hit.set(tileIndex(t.c, t.r), j.ownerId);
    }
    for (const p of this.players) {
      const key = tileIndex(p.logicalTile.c, p.logicalTile.r);
      if (!hit.has(key)) continue;
      if (p.state === PlayerState.ALIVE) {
        this.trapPlayer(p, hit.get(key)!);
      } else if (p.state === PlayerState.HEDGEHOG && p.hedgehogStun <= 0) {
        // [COMMUNITY] hedgehogs hit by a jet are stunned and inert for a while.
        p.hedgehogStun = HEDGEHOG_STUN_SECONDS;
      }
    }
  }

  trapPlayer(p: Player, byId: number): void {
    if (p.state !== PlayerState.ALIVE) return;
    if (this.time < p.invulnUntil) return;
    if (this.time < p.shieldUntil) {
      // [COMMUNITY] 실드 is total invulnerability, but a jet hit eats into it.
      p.shieldUntil = Math.max(this.time, p.shieldUntil - SHIELD_HIT_PENALTY_SECONDS);
      return;
    }
    // [COMMUNITY] 슈퍼맨 is not invulnerable — it cancels on being hit.
    if (p.supermanUntil > this.time) p.supermanUntil = 0;

    p.state = PlayerState.TRAPPED;
    p.trappedFor = 0;
    p.slideDir = null;
    p.bubbledBy = byId;

    const ch = getCharacter(p.characterId);
    let drown = DROWN_SECONDS * (ch.drownMultiplier ?? 1);
    const oxy = p.inventory.get(ItemId.OXYGEN) ?? 0;
    if (oxy > 0) {
      p.inventory.set(ItemId.OXYGEN, oxy - 1);
      if (oxy - 1 <= 0) p.inventory.delete(ItemId.OXYGEN);
      drown += OXYGEN_BONUS_SECONDS;
      this.refreshSlots(p);
    }
    p.drownTime = drown;
    this.events.push({ type: 'trapped', playerId: p.id, byId });
  }

  rescue(p: Player, byId: number): void {
    if (p.state !== PlayerState.TRAPPED) return;
    p.state = PlayerState.ALIVE;
    p.trappedFor = 0;
    p.invulnUntil = this.time + RESCUE_INVULN_SECONDS;
    const saver = this.players[byId];
    if (saver && saver.id !== p.id) saver.saves++;
    this.events.push({ type: 'rescue', playerId: p.id, byId });
  }

  killPlayer(p: Player, byId: number | null): void {
    if (p.state === PlayerState.DEAD || p.state === PlayerState.HEDGEHOG) return;
    p.deaths++;
    p.trappedFor = 0;
    p.hasBomb = false;

    if (byId !== null && byId !== p.id) {
      const killer = this.players[byId];
      if (killer && !this.sameTeam(killer, p)) killer.kills++;
    }
    this.events.push({ type: 'death', playerId: p.id, byId });

    if (this.cfg.gameType === GameType.HEDGEHOG) {
      // [COMMUNITY] you do not leave the map — you become a walking spike.
      p.state = PlayerState.HEDGEHOG;
      p.hedgehogStun = 0;
      return;
    }

    p.state = PlayerState.DEAD;
    if (this.cfg.gameType === GameType.RESPAWN) {
      p.respawnIn = RESPAWN_SECONDS;
      return;
    }

    // [COMMUNITY] 대장잡기: killing the enemy captain wipes their whole team.
    if (this.cfg.gameType === GameType.CAPTAIN && p.isCaptain) {
      this.nextCaptain = byId;
      for (const q of this.players) {
        if (q.team === p.team && q.state !== PlayerState.DEAD) {
          q.deaths++;
          q.state = PlayerState.DEAD;
          this.events.push({ type: 'death', playerId: q.id, byId });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Ground, pickups and contacts
  // -------------------------------------------------------------------------

  /**
   * Ground effects use the character's *physical* tile, not the logical one.
   * That asymmetry is deliberate: it is what lets high-level players slide
   * along boundaries to farm items while staying safe from jets.
   */
  private checkGroundUnder(p: Player): void {
    const { c, r } = tileOf(p.pos.x, p.pos.y);
    const g = this.groundAt(c, r);
    p.onBond = g.kind === GroundKind.BOND;

    switch (g.kind) {
      case GroundKind.ITEM:
        if (g.item) {
          this.applyPickup(p, g.item);
          g.kind = GroundKind.NONE;
          g.item = undefined;
        }
        break;
      case GroundKind.BANANA:
        if (p.slideDir === null) {
          p.slideDir = p.facing;
          g.kind = GroundKind.NONE;
        }
        break;
      case GroundKind.TRAP:
        // [COMMUNITY] anyone passing through gets bubbled. Water cannot
        // clear a trap, so it is genuine area denial.
        if (g.ownerId === undefined || !this.sameTeam(p, this.players[g.ownerId])) {
          this.trapPlayer(p, g.ownerId ?? p.id);
          g.kind = GroundKind.NONE;
          g.ownerId = undefined;
        }
        break;
      default:
        break;
    }
  }

  applyPickup(p: Player, item: ItemId): void {
    this.events.push({ type: 'pickup', playerId: p.id, item });

    if (isUsable(item)) {
      // [COMMUNITY] eating a different item can void a held one — picking up
      // 산소통 after 바늘 destroys the needle, hence its reputation as a trap.
      if (item === ItemId.OXYGEN && OXYGEN_DESTROYS_NEEDLE) p.inventory.delete(ItemId.NEEDLE);
      const def = itemDef(item);
      p.inventory.set(item, (p.inventory.get(item) ?? 0) + def.charges);
      this.refreshSlots(p);
      return;
    }

    switch (item) {
      case ItemId.BUBBLE:
        p.stats.count = Math.min(p.statsMax.count, p.stats.count + 1);
        p.eaten.push(item);
        break;
      case ItemId.FLUID:
        p.stats.range = Math.min(p.statsMax.range, p.stats.range + 1);
        p.eaten.push(item);
        break;
      case ItemId.ULTRA:
        // Purple with a skull. On maps with linear spawn corridors this is a
        // trap: huge range means self-immolation.
        p.stats.range = p.statsMax.range;
        p.eaten.push(item);
        break;
      case ItemId.ROLLER:
        p.stats.speed = Math.min(p.statsMax.speed, p.stats.speed + 1);
        p.eaten.push(item);
        break;
      case ItemId.RED_DEVIL:
        p.stats.speed = p.statsMax.speed;
        p.canPush = true;
        p.eaten.push(item);
        break;
      case ItemId.SKATE:
        p.stats.speed = p.statsMax.speed;
        p.eaten.push(item);
        break;
      case ItemId.SHOES:
        p.canPush = true;
        break;
      case ItemId.GLOVE:
        p.canThrow = true;
        break;
      case ItemId.SUPERMAN:
        p.supermanUntil = this.time + SUPERMAN_SECONDS;
        break;
      case ItemId.GHOST:
        p.ghostUntil = this.time + GHOST_SECONDS;
        break;
      case ItemId.DISGUISE:
        p.disguiseUntil = this.time + DISGUISE_SECONDS;
        break;
      case ItemId.MOONWALK:
        p.moonwalkUntil = this.time + MOONWALK_SECONDS;
        break;
      case ItemId.GREEN_DEVIL:
        this.applyGreenDevil(p);
        break;
      case ItemId.DEVIL:
        p.curse = this.rng.chance(0.5) ? CurseKind.INVERTED : CurseKind.FORCED_PLACE;
        p.curseUntil = this.time + CURSE_SECONDS;
        p.curseTimer = CURSE_FORCED_PLACE_INTERVAL;
        break;
      case ItemId.GOLDEN_DEVIL:
        // [COMMUNITY] 협공배틀 only: every enemy drops to speed 1.
        for (const q of this.players) {
          if (!this.sameTeam(p, q)) q.stats.speed = 1;
        }
        break;
      default:
        break;
    }
  }

  /** [COMMUNITY] 초록 악마 spits out one random eaten item; that stat -1. */
  private applyGreenDevil(p: Player): void {
    if (p.eaten.length === 0) return;
    const i = this.rng.int(p.eaten.length);
    const [spat] = p.eaten.splice(i, 1);
    switch (spat) {
      case ItemId.BUBBLE:
        p.stats.count = Math.max(p.statsBase.count, p.stats.count - 1);
        break;
      case ItemId.FLUID:
      case ItemId.ULTRA:
        p.stats.range = Math.max(p.statsBase.range, p.stats.range - 1);
        break;
      case ItemId.ROLLER:
      case ItemId.RED_DEVIL:
      case ItemId.SKATE:
        p.stats.speed = Math.max(p.statsBase.speed, p.stats.speed - 1);
        break;
      default:
        break;
    }
  }

  private resolveContacts(): void {
    for (const a of this.players) {
      if (a.state === PlayerState.ALIVE) {
        for (const b of this.players) {
          if (b.id === a.id || b.state !== PlayerState.TRAPPED) continue;
          if (!overlaps(a.pos, b.pos, CHAR_HALF)) continue;
          if (this.sameTeam(a, b)) this.rescue(b, a.id);
          else this.killPlayer(b, a.id);
        }
      } else if (a.state === PlayerState.HEDGEHOG && a.hedgehogStun <= 0) {
        // [COMMUNITY] hedgehogs rescue indiscriminately — they pop bubbles
        // regardless of team, so you must be careful not to free an enemy.
        for (const b of this.players) {
          if (b.id === a.id || b.state !== PlayerState.TRAPPED) continue;
          if (overlaps(a.pos, b.pos, CHAR_HALF)) this.rescue(b, a.id);
        }
        // A hedgehog touching a balloon detonates it instantly.
        for (const bl of [...this.balloons]) {
          if (overlaps(a.pos, bl.pos, CHAR_HALF)) this.explode(bl);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Items in hand
  // -------------------------------------------------------------------------

  /** Point the selection at a specific item. Returns false if not held. */
  selectItem(p: Player, item: ItemId): boolean {
    this.refreshSlots(p);
    const i = p.slots.indexOf(item);
    if (i < 0) return false;
    p.selectedSlot = i;
    return true;
  }

  useSelectedItem(p: Player): void {
    // The slot list can be stale if the inventory was mutated directly.
    this.refreshSlots(p);
    const item = p.slots[p.selectedSlot];
    if (!item) return;
    const have = p.inventory.get(item) ?? 0;
    if (have <= 0) return;
    if (!this.applyUse(p, item)) return;

    const left = have - 1;
    if (left <= 0) p.inventory.delete(item);
    else p.inventory.set(item, left);
    p.itemsUsed++;
    this.refreshSlots(p);
    this.events.push({ type: 'useItem', playerId: p.id, item });
  }

  /** Returns false if the item could not be used and should not be consumed. */
  private applyUse(p: Player, item: ItemId): boolean {
    const { c, r } = p.logicalTile;
    switch (item) {
      case ItemId.NEEDLE:
        if (p.state !== PlayerState.TRAPPED) return false;
        p.state = PlayerState.ALIVE;
        p.trappedFor = 0;
        p.invulnUntil = this.time + RESCUE_INVULN_SECONDS;
        return true;

      case ItemId.SHIELD:
        if (p.state !== PlayerState.ALIVE) return false;
        p.shieldUntil = this.time + SHIELD_SECONDS;
        return true;

      case ItemId.POTION:
        p.curse = CurseKind.NONE;
        p.curseUntil = 0;
        p.moonwalkUntil = 0;
        p.onBond = false;
        return true;

      case ItemId.SANSAM:
        p.sansamUntil = this.time + SANSAM_SECONDS;
        return true;

      case ItemId.SENSOR:
        p.sensorUntil = this.time + 30;
        return true;

      case ItemId.SPRING:
        return this.useSpring(p);

      case ItemId.DART:
        return this.useDart(p);

      case ItemId.REMOTE: {
        // [COMMUNITY] the remote bomb does not count against the balloon
        // limit, so it enables an attack from a "no balloons left" state.
        const mine = this.balloons.filter((b) => b.remote && b.ownerId === p.id);
        if (mine.length > 0) {
          for (const b of mine) this.explode(b);
          return true;
        }
        return this.placeBalloon(p, true) !== null;
      }

      case ItemId.BANANA: {
        const g = this.groundAt(c, r);
        if (g.kind !== GroundKind.NONE) return false;
        g.kind = GroundKind.BANANA;
        g.ownerId = p.id;
        return true;
      }

      case ItemId.BOND: {
        const g = this.groundAt(c, r);
        if (g.kind !== GroundKind.NONE) return false;
        g.kind = GroundKind.BOND;
        g.ownerId = p.id;
        return true;
      }

      case ItemId.PUSHPIN: {
        const g = this.groundAt(c, r);
        if (g.kind !== GroundKind.NONE) return false;
        g.kind = GroundKind.PUSHPIN;
        g.ownerId = p.id;
        return true;
      }

      case ItemId.TRAP: {
        // [COMMUNITY] placeable only between two immovable, non-explodable
        // blocks.
        const g = this.groundAt(c, r);
        if (g.kind !== GroundKind.NONE) return false;
        const horizontal =
          this.tileAt(c - 1, r) === TileKind.BLOCK_HARD && this.tileAt(c + 1, r) === TileKind.BLOCK_HARD;
        const vertical =
          this.tileAt(c, r - 1) === TileKind.BLOCK_HARD && this.tileAt(c, r + 1) === TileKind.BLOCK_HARD;
        if (!horizontal && !vertical) return false;
        g.kind = GroundKind.TRAP;
        g.ownerId = p.id;
        return true;
      }

      case ItemId.DRILL: {
        const d = DIRS[p.facing];
        const tc = c + d.c;
        const tr = r + d.r;
        if (!isDestructible(this.tileAt(tc, tr))) return false;
        this.destroyBlock(tc, tr);
        return true;
      }

      default:
        return false;
    }
  }

  /** [COMMUNITY] 스프링 hops over an obstacle, up to 3 tiles in one hop. */
  private useSpring(p: Player): boolean {
    if (p.state !== PlayerState.ALIVE) return false;
    const d = DIRS[p.facing];
    const { c, r } = p.logicalTile;
    let sawObstacle = false;
    for (let i = 1; i <= SPRING_MAX_TILES; i++) {
      const tc = c + d.c * i;
      const tr = r + d.r * i;
      if (!inBounds(tc, tr)) break;
      const blocked = isBlock(this.tileAt(tc, tr)) || this.balloonAt(tc, tr) !== null;
      if (blocked) {
        sawObstacle = true;
        continue;
      }
      if (!sawObstacle) continue; // no point hopping onto open ground
      p.springFrom = { x: p.pos.x, y: p.pos.y };
      p.springTo = { x: tileCenterX(tc), y: tileCenterY(tr) };
      p.springT = 0;
      return true;
    }
    return false;
  }

  /** [COMMUNITY] 다트 detonates a balloon remotely from range. */
  private useDart(p: Player): boolean {
    const d = DIRS[p.facing];
    const { c, r } = p.logicalTile;
    for (let i = 1; i <= DART_RANGE_TILES; i++) {
      const b = this.balloonAt(c + d.c * i, r + d.r * i);
      if (b) {
        this.explode(b);
        return true;
      }
      if (this.tileAt(c + d.c * i, r + d.r * i) === TileKind.BLOCK_HARD) break;
    }
    // Nothing in the firing line — fall back to the nearest balloon in range.
    let best: Balloon | null = null;
    let bestD = Infinity;
    for (const b of this.balloons) {
      const dist = Math.abs(b.tile.c - c) + Math.abs(b.tile.r - r);
      if (dist <= DART_RANGE_TILES && dist < bestD) {
        best = b;
        bestD = dist;
      }
    }
    if (!best) return false;
    this.explode(best);
    return true;
  }

  /** Public helper used by the glove; the AI and UI both go through this. */
  throwHeldBalloon(p: Player): boolean {
    if (!p.canThrow) return false;
    const b = this.balloonAt(p.logicalTile.c, p.logicalTile.r);
    if (!b || b.ownerId !== p.id) return false;
    this.throwBalloon(p, b);
    return true;
  }

  // -------------------------------------------------------------------------
  // Item plane
  // -------------------------------------------------------------------------

  /**
   * [COMMUNITY] Added in 2003. Once one minute has elapsed a plane flies over
   * and drops up to 2 items, on a fixed schedule of remaining-clock windows.
   * It does not appear on the ghost maps.
   */
  private updateItemPlane(): void {
    if (!this.itemPlaneEnabled) return;
    for (let i = 0; i < ITEM_PLANE_WINDOWS.length; i++) {
      if (this.planeFired[i]) continue;
      if (this.clock > ITEM_PLANE_WINDOWS[i]) continue;
      this.planeFired[i] = true;
      const n = 1 + this.rng.int(ITEM_PLANE_MAX_DROPS);
      let dropped = 0;
      for (let k = 0; k < n; k++) {
        if (this.dropPlaneItem()) dropped++;
      }
      this.events.push({ type: 'itemPlane', drops: dropped });
    }
  }

  private dropPlaneItem(): boolean {
    // Mostly stat-up items: 물풍선, 물병(액체), 울트라.
    const pool: (readonly [ItemId, number])[] = [
      [ItemId.BUBBLE, 40],
      [ItemId.FLUID, 34],
      [ItemId.ULTRA, 10],
      [ItemId.ROLLER, 16],
    ];
    for (let attempt = 0; attempt < 60; attempt++) {
      const c = this.rng.int(GRID_COLS);
      const r = this.rng.int(GRID_ROWS);
      if (this.tileAt(c, r) !== TileKind.EMPTY) continue;
      const g = this.groundAt(c, r);
      if (g.kind !== GroundKind.NONE) continue;
      if (this.balloonAt(c, r)) continue;
      g.kind = GroundKind.ITEM;
      g.item = this.rng.weighted(pool);
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Game types
  // -------------------------------------------------------------------------

  private updateModeLogic(): void {
    if (this.cfg.gameType !== GameType.TIMEBOMB) return;

    const carrier = this.players.find((p) => p.hasBomb && p.state === PlayerState.ALIVE);
    if (!carrier) {
      this.timebombAssignIn -= DT;
      if (this.timebombAssignIn <= 0) {
        const candidates = this.players.filter((p) => p.state === PlayerState.ALIVE);
        if (candidates.length > 0) {
          const pick = candidates[this.rng.int(candidates.length)];
          pick.hasBomb = true;
          pick.bombTimer = TIMEBOMB_SECONDS;
          pick.bombCooldown = TIMEBOMB_PASS_COOLDOWN;
        }
        this.timebombAssignIn = TIMEBOMB_ASSIGN_DELAY;
      }
      return;
    }

    carrier.bombTimer -= DT;
    if (carrier.bombCooldown > 0) carrier.bombCooldown -= DT;

    // Touch another player to pass the bomb; the timer resets to 5.
    if (carrier.bombCooldown <= 0) {
      for (const q of this.players) {
        if (q.id === carrier.id || q.state !== PlayerState.ALIVE) continue;
        if (!overlaps(carrier.pos, q.pos, CHAR_HALF)) continue;
        carrier.hasBomb = false;
        q.hasBomb = true;
        q.bombTimer = TIMEBOMB_SECONDS;
        q.bombCooldown = TIMEBOMB_PASS_COOLDOWN;
        this.events.push({ type: 'bombPass', from: carrier.id, to: q.id });
        return;
      }
    }

    if (carrier.bombTimer <= 0) {
      // A jet erupts in a 5x5 area centred on the carrier.
      const tiles: JetTile[] = [];
      for (let dr = -TIMEBOMB_RADIUS; dr <= TIMEBOMB_RADIUS; dr++) {
        for (let dc = -TIMEBOMB_RADIUS; dc <= TIMEBOMB_RADIUS; dc++) {
          const c = carrier.logicalTile.c + dc;
          const r = carrier.logicalTile.r + dr;
          if (!inBounds(c, r)) continue;
          if (this.tileAt(c, r) === TileKind.BLOCK_HARD) continue;
          if (isDestructible(this.tileAt(c, r))) {
            this.destroyBlock(c, r);
            continue;
          }
          tiles.push({ c, r, dir: null, tip: false });
        }
      }
      this.jets.push({
        tiles,
        ownerId: carrier.id,
        life: JET_SECONDS,
        origin: { ...carrier.logicalTile },
      });
      this.events.push({ type: 'explode', tile: { ...carrier.logicalTile }, ownerId: carrier.id });
      carrier.hasBomb = false;
      this.timebombAssignIn = TIMEBOMB_ASSIGN_DELAY;
    }
  }

  // -------------------------------------------------------------------------
  // Win conditions
  // -------------------------------------------------------------------------

  private finish(winningTeam: number | null, reason: string): void {
    this.phase = MatchPhase.OVER;
    this.result = { winningTeam, reason };
    this.events.push({ type: 'matchOver', result: this.result });
  }

  private checkWin(): void {
    if (this.phase !== MatchPhase.PLAYING) return;

    if (this.cfg.gameType === GameType.RESPAWN) {
      if (this.clock <= 0) this.finishByScore();
      return;
    }

    const teams = this.teams();
    const standing = teams.filter((t) => this.aliveOnTeam(t) > 0);
    if (standing.length === 1 && teams.length > 1) {
      this.finish(standing[0], 'Opposing team wiped out');
      return;
    }
    if (standing.length === 0) {
      this.finish(null, 'Everyone went down together');
      return;
    }
    if (this.clock <= 0) {
      // Hold more survivors when the clock expires.
      let bestTeam: number | null = null;
      let best = -1;
      let tied = false;
      for (const t of teams) {
        const n = this.aliveOnTeam(t);
        if (n > best) {
          best = n;
          bestTeam = t;
          tied = false;
        } else if (n === best) {
          tied = true;
        }
      }
      this.finish(tied ? null : bestTeam, tied ? 'Time up — draw' : 'Time up — most survivors');
    }
  }

  /** 부활대전: score is kills, and deaths are the tiebreaker. */
  private finishByScore(): void {
    const teams = this.teams();
    let bestTeam: number | null = null;
    let bestKills = -1;
    let bestDeaths = Infinity;
    let tied = false;
    for (const t of teams) {
      let kills = 0;
      let deaths = 0;
      for (const p of this.players) {
        if (p.team !== t) continue;
        kills += p.kills;
        deaths += p.deaths;
      }
      if (kills > bestKills || (kills === bestKills && deaths < bestDeaths)) {
        bestKills = kills;
        bestDeaths = deaths;
        bestTeam = t;
        tied = false;
      } else if (kills === bestKills && deaths === bestDeaths) {
        tied = true;
      }
    }
    this.finish(tied ? null : bestTeam, tied ? 'Time up — draw' : 'Time up — most kills');
  }

  // -------------------------------------------------------------------------
  // Debug / test helpers
  // -------------------------------------------------------------------------

  /** Clear every soft block, for focused unit tests. */
  clearBlocks(): void {
    for (let i = 0; i < this.tiles.length; i++) {
      if (isDestructible(this.tiles[i] as TileKind)) this.tiles[i] = TileKind.EMPTY;
    }
  }

  /** Teleport a player to a tile centre. */
  placeAt(p: Player, c: number, r: number): void {
    p.pos.x = tileCenterX(c);
    p.pos.y = tileCenterY(r);
    p.logicalTile.c = c;
    p.logicalTile.r = r;
  }

  /** Run n seconds of simulation. */
  advance(seconds: number): void {
    const n = Math.round(seconds / DT);
    for (let i = 0; i < n; i++) this.step();
  }

  /** Skip the pre-match countdown. */
  begin(): void {
    this.phase = MatchPhase.PLAYING;
    this.countdown = 0;
  }
}
