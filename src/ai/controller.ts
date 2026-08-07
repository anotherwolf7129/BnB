import {
  AI_TICK_HZ,
  DIRS,
  DT,
  FUSE_SECONDS,
  GRID_COLS,
  GRID_ROWS,
  TILE,
  inBounds,
  speedToPixelsPerSecond,
  tileCenterX,
  tileCenterY,
  tileIndex,
  type DirIndex,
} from '../sim/constants.js';
import { Rng } from '../sim/rng.js';
import {
  CurseKind,
  GroundKind,
  ItemId,
  MatchPhase,
  PlayerState,
  TileKind,
  isDestructible,
  type Player,
  type TileRef,
} from '../sim/types.js';
import type { World } from '../sim/world.js';
import { TILE_COUNT, bfs, buildDangerMap, firstStep, maskDanger, type BfsResult } from './danger.js';
import { dodgeDecayChance, tierParams, type TierParams } from './tiers.js';
import { SHIELD_AI_COOLDOWN } from '../sim/constants.js';

interface Decision {
  targetX: number | null;
  targetY: number | null;
  /** Forces a facing direction for one tick, used before a directional item. */
  face: DirIndex | null;
  place: boolean;
  use: ItemId | null;
}

function idle(): Decision {
  return { targetX: null, targetY: null, face: null, place: false, use: null };
}

interface Intent {
  score: number;
  decision: Decision;
}

const THINK_INTERVAL = 1 / AI_TICK_HZ;

export class AIController {
  readonly world: World;
  readonly id: number;
  readonly params: TierParams;
  private rng: Rng;
  private director: AIDirector | null = null;

  private thinkAcc = 0;
  private pending: { at: number; decision: Decision }[] = [];
  private current: Decision = idle();
  private shieldReadyAt = 0;
  private lastPos = new Map<number, { x: number; y: number }>();
  private lastThinkTime = 0;
  private wanderTarget: TileRef | null = null;
  private wanderUntil = 0;

  constructor(world: World, id: number, tier: number, seed = 1) {
    this.world = world;
    this.id = id;
    this.params = tierParams(tier);
    this.rng = new Rng(seed * 7919 + id * 104729 + 1);
  }

  attach(director: AIDirector): void {
    this.director = director;
  }

  private get player(): Player {
    return this.world.players[this.id];
  }

  // -------------------------------------------------------------------------
  // Tick
  // -------------------------------------------------------------------------

  update(): void {
    const p = this.player;
    p.input.place = false;
    p.input.use = false;
    p.input.selectSlot = -1;

    if (this.world.phase !== MatchPhase.PLAYING || p.state === PlayerState.DEAD) {
      p.input.up = p.input.down = p.input.left = p.input.right = false;
      return;
    }

    this.thinkAcc += DT;
    if (this.thinkAcc >= THINK_INTERVAL) {
      this.thinkAcc -= THINK_INTERVAL;
      const decision = this.think();
      // Reaction latency is modelled as a delay between deciding and acting,
      // which is what makes low tiers feel human rather than merely bad.
      this.pending.push({ at: this.world.time + this.params.reactionMs / 1000, decision });
    }
    while (this.pending.length && this.pending[0].at <= this.world.time) {
      this.current = this.pending.shift()!.decision;
    }

    this.apply(this.current);
  }

  private apply(d: Decision): void {
    const p = this.player;
    p.input.up = p.input.down = p.input.left = p.input.right = false;

    if (d.face !== null) {
      const dir = DIRS[d.face];
      p.input.up = dir.r < 0;
      p.input.down = dir.r > 0;
      p.input.left = dir.c < 0;
      p.input.right = dir.c > 0;
      d.face = null;
    } else if (d.targetX !== null && d.targetY !== null) {
      const dx = d.targetX - p.pos.x;
      const dy = d.targetY - p.pos.y;
      const eps = 1.5;
      // Move on the dominant axis so travel is L-shaped and never wedges
      // diagonally into a corner.
      if (Math.abs(dx) > eps && Math.abs(dx) >= Math.abs(dy)) {
        p.input.right = dx > 0;
        p.input.left = dx < 0;
      } else if (Math.abs(dy) > eps) {
        p.input.down = dy > 0;
        p.input.up = dy < 0;
      }
    }

    if (d.place) {
      p.input.place = true;
      d.place = false;
    }
    if (d.use) {
      const slot = p.slots.indexOf(d.use);
      if (slot >= 0) {
        p.input.selectSlot = slot;
        p.input.use = true;
      }
      d.use = null;
    }
  }

  // -------------------------------------------------------------------------
  // Decision making
  // -------------------------------------------------------------------------

  private think(): Decision {
    const p = this.player;
    const now = this.world.time;
    const dt = Math.max(1e-3, now - this.lastThinkTime);
    this.lastThinkTime = now;

    if (p.state === PlayerState.TRAPPED) return this.thinkTrapped();
    if (p.state !== PlayerState.ALIVE) return idle();

    const danger = maskDanger(
      buildDangerMap(this.world, {
        resolveChains: this.params.lookahead === 'fullChains' || this.params.lookahead === 'fullChainsPredict',
        predictBlockClears: this.params.lookahead === 'fullChainsPredict',
      }),
      p.logicalTile,
      this.params.lookahead,
    );

    const pps = speedToPixelsPerSecond(this.world.effectiveSpeed(p));
    const myIdx = tileIndex(p.logicalTile.c, p.logicalTile.r);

    // 물약 clears a curse; a cursed AI is otherwise comically bad.
    if (this.params.usesItems && p.curse !== CurseKind.NONE && (p.inventory.get(ItemId.POTION) ?? 0) > 0) {
      return { ...idle(), use: ItemId.POTION };
    }

    const decayed = this.params.dodgeDecay && this.rng.chance(dodgeDecayChance(this.params, now));
    if (Number.isFinite(danger[myIdx]) && !decayed) {
      return this.flee(danger, pps);
    }

    this.updateVelocities(dt);

    const intents: Intent[] = [
      this.rescueAlly(danger, pps),
      this.attackTarget(danger, pps),
      this.collectItem(danger, pps),
      this.farmBlocks(danger, pps),
      this.reposition(danger, pps),
    ];

    let best = intents[0];
    for (const i of intents) if (i.score > best.score) best = i;
    return best.score > 0 ? best.decision : idle();
  }

  private thinkTrapped(): Decision {
    const p = this.player;
    // ★5 and up carry a needle; ★2-★4 use one only if the map gave them one.
    if (this.params.usesItems && (p.inventory.get(ItemId.NEEDLE) ?? 0) > 0) {
      return { ...idle(), use: ItemId.NEEDLE };
    }
    // Otherwise struggle toward the nearest ally, in the hope of a save.
    let nearest: Player | null = null;
    let bestD = Infinity;
    for (const q of this.world.players) {
      if (q.id === p.id || q.state !== PlayerState.ALIVE || !this.world.sameTeam(p, q)) continue;
      const d = Math.hypot(q.pos.x - p.pos.x, q.pos.y - p.pos.y);
      if (d < bestD) {
        bestD = d;
        nearest = q;
      }
    }
    if (!nearest) return idle();
    return { ...idle(), targetX: nearest.pos.x, targetY: nearest.pos.y };
  }

  // -------------------------------------------------------------------------
  // Flee — the highest-priority behaviour
  // -------------------------------------------------------------------------

  private flee(danger: Float32Array, pps: number): Decision {
    const p = this.player;
    const search = bfs(this.world, p.logicalTile, pps, danger, this.params.safetyMargin, this.passable);

    let bestIdx = -1;
    let bestEta = Infinity;
    for (let i = 0; i < TILE_COUNT; i++) {
      if (search.dist[i] < 0) continue;
      if (Number.isFinite(danger[i])) continue;
      if (search.eta[i] < bestEta) {
        bestEta = search.eta[i];
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const step = firstStep(search, p.logicalTile, bestIdx);
      if (!step) return idle();
      return { ...idle(), targetX: tileCenterX(step.c), targetY: tileCenterY(step.r) };
    }

    // No refuge. ★6 hops the containment wall; ★5 pops a shield; everyone
    // else runs for the tile that buys the most time and hopes.
    const spring = this.trySpring(danger);
    if (spring) return spring;

    if (
      this.params.usesItems &&
      (p.inventory.get(ItemId.SHIELD) ?? 0) > 0 &&
      this.world.time >= this.shieldReadyAt &&
      this.world.time >= p.shieldUntil
    ) {
      this.shieldReadyAt = this.world.time + SHIELD_AI_COOLDOWN;
      return { ...idle(), use: ItemId.SHIELD };
    }

    const plain = bfs(this.world, p.logicalTile, pps, undefined, 0, this.passable);
    let panicIdx = -1;
    let panicScore = -Infinity;
    for (let i = 0; i < TILE_COUNT; i++) {
      if (plain.dist[i] < 0 || plain.dist[i] > 6) continue;
      const slack = (Number.isFinite(danger[i]) ? danger[i] : 99) - plain.eta[i];
      if (slack > panicScore) {
        panicScore = slack;
        panicIdx = i;
      }
    }
    if (panicIdx < 0) return idle();
    const step = firstStep(plain, p.logicalTile, panicIdx);
    if (!step) return idle();
    return { ...idle(), targetX: tileCenterX(step.c), targetY: tileCenterY(step.r) };
  }

  /** [COMMUNITY] ★6 carries 스프링 and can hop over your containment walls. */
  private trySpring(danger: Float32Array): Decision | null {
    const p = this.player;
    if (!this.params.usesItems) return null;
    if ((p.inventory.get(ItemId.SPRING) ?? 0) <= 0) return null;

    for (let dir = 0 as DirIndex; dir < 4; dir = (dir + 1) as DirIndex) {
      const d = DIRS[dir];
      let sawObstacle = false;
      for (let i = 1; i <= 3; i++) {
        const c = p.logicalTile.c + d.c * i;
        const r = p.logicalTile.r + d.r * i;
        if (!inBounds(c, r)) break;
        const blocked =
          this.world.tileAt(c, r) === TileKind.BLOCK_HARD ||
          isDestructible(this.world.tileAt(c, r)) ||
          this.world.balloonAt(c, r) !== null;
        if (blocked) {
          sawObstacle = true;
          continue;
        }
        if (!sawObstacle) continue;
        if (!Number.isFinite(danger[tileIndex(c, r)])) {
          return { ...idle(), face: dir, use: ItemId.SPRING };
        }
        break;
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Intents
  // -------------------------------------------------------------------------

  /**
   * Faithful to the original and deliberately exploitable: when one AI is
   * trapped another comes to rescue it, and below ★5 it does not check
   * whether the approach is covered. Players bait this to catch two at once.
   */
  private rescueAlly(danger: Float32Array, pps: number): Intent {
    const p = this.player;
    if (this.params.rescueWeight <= 0) return { score: 0, decision: idle() };

    const search = this.params.rescuePathSafety
      ? bfs(this.world, p.logicalTile, pps, danger, this.params.safetyMargin, this.passable)
      : bfs(this.world, p.logicalTile, pps, undefined, 0, this.passable);

    let bestScore = 0;
    let bestDecision = idle();
    for (const ally of this.world.players) {
      if (ally.id === p.id || ally.state !== PlayerState.TRAPPED) continue;
      if (!this.world.sameTeam(p, ally)) continue;
      const idx = tileIndex(ally.logicalTile.c, ally.logicalTile.r);
      if (search.dist[idx] < 0) continue;
      const eta = search.eta[idx];
      const remaining = ally.drownTime - ally.trappedFor;
      if (eta >= remaining) continue;
      const score = this.params.rescueWeight / Math.max(0.3, eta);
      if (score > bestScore) {
        const step = firstStep(search, p.logicalTile, idx);
        bestScore = score;
        bestDecision = step
          ? { ...idle(), targetX: tileCenterX(step.c), targetY: tileCenterY(step.r) }
          : idle();
      }
    }
    return { score: bestScore, decision: bestDecision };
  }

  /**
   * The original AI dodges reactively but does not model being enclosed.
   * We reproduce that weakness, and give it the symmetric strength: it tries
   * to enclose you.
   */
  private attackTarget(danger: Float32Array, pps: number): Intent {
    const p = this.player;
    const target = this.pickTarget(pps);
    if (!target) return { score: 0, decision: idle() };

    const search = bfs(this.world, p.logicalTile, pps, undefined, 0, this.passable);
    const tIdx = tileIndex(target.logicalTile.c, target.logicalTile.r);
    const pathDist = search.dist[tIdx];
    if (pathDist < 0 || pathDist > this.params.engagementRange) return { score: 0, decision: idle() };

    if (!this.director?.requestEngage(this.id, this.params.maxEngaging)) {
      return { score: 0, decision: idle() };
    }

    // A sharp temporary boost is worth spending when a fight is actually on.
    if (this.params.usesItems && (p.inventory.get(ItemId.SANSAM) ?? 0) > 0 && p.sansamUntil < this.world.time) {
      return { score: 2.2, decision: { ...idle(), use: ItemId.SANSAM } };
    }

    const predicted = this.predictTile(target);
    const range = this.world.effectiveRange(p);
    const covers = this.jetCovers(p.logicalTile, range, predicted);

    if (covers && p.liveBalloons < this.world.effectiveCount(p) && this.canPlaceHere()) {
      if (this.selfTrapOk(danger, pps, range)) {
        let score = 3.0;
        // Enclosure pressure: prefer placements that shrink the target's
        // escape set. Plus the 일자 bonus — a straight line of balloons
        // bursts near-simultaneously and is nearly unavoidable.
        score += 0.6 * this.enclosurePressure(target, range);
        if (this.continuesLine(p.logicalTile)) score += 0.5;
        return { score, decision: { ...idle(), place: true } };
      }
      return { score: 0.2, decision: idle() };
    }

    const step = firstStep(search, p.logicalTile, tIdx);
    if (!step) return { score: 0, decision: idle() };
    // Do not walk into a tile that is about to be a jet.
    if (Number.isFinite(danger[tileIndex(step.c, step.r)])) return { score: 0, decision: idle() };
    return {
      score: 1.4,
      decision: { ...idle(), targetX: tileCenterX(step.c), targetY: tileCenterY(step.r) },
    };
  }

  private collectItem(danger: Float32Array, pps: number): Intent {
    const p = this.player;
    const search = bfs(this.world, p.logicalTile, pps, danger, this.params.safetyMargin, this.passable);
    let bestScore = 0;
    let bestDecision = idle();
    for (let i = 0; i < TILE_COUNT; i++) {
      if (search.dist[i] <= 0) continue;
      const c = i % GRID_COLS;
      const r = (i - c) / GRID_COLS;
      if (this.world.groundAt(c, r).kind !== GroundKind.ITEM) continue;
      const score = 1.6 / (1 + search.eta[i]);
      if (score > bestScore) {
        const step = firstStep(search, p.logicalTile, i);
        if (!step) continue;
        bestScore = score;
        bestDecision = { ...idle(), targetX: tileCenterX(step.c), targetY: tileCenterY(step.r) };
      }
    }
    return { score: bestScore, decision: bestDecision };
  }

  private farmBlocks(danger: Float32Array, pps: number): Intent {
    const p = this.player;
    const range = this.world.effectiveRange(p);

    // Standing next to a breakable block? Blow it and step away.
    if (p.liveBalloons < this.world.effectiveCount(p) && this.canPlaceHere()) {
      let adjacent = false;
      for (const d of DIRS) {
        for (let i = 1; i <= range; i++) {
          const c = p.logicalTile.c + d.c * i;
          const r = p.logicalTile.r + d.r * i;
          if (!inBounds(c, r)) break;
          const k = this.world.tileAt(c, r);
          if (k === TileKind.BLOCK_HARD) break;
          if (isDestructible(k)) {
            adjacent = true;
            break;
          }
        }
        if (adjacent) break;
      }
      if (adjacent && this.selfTrapOk(danger, pps, range)) {
        return { score: 0.9, decision: { ...idle(), place: true } };
      }
    }

    // Otherwise walk toward the nearest breakable block.
    const search = bfs(this.world, p.logicalTile, pps, danger, this.params.safetyMargin, this.passable);
    let bestScore = 0;
    let bestDecision = idle();
    for (let i = 0; i < TILE_COUNT; i++) {
      if (search.dist[i] <= 0) continue;
      const c = i % GRID_COLS;
      const r = (i - c) / GRID_COLS;
      let touches = false;
      for (const d of DIRS) {
        if (isDestructible(this.world.tileAt(c + d.c, r + d.r))) {
          touches = true;
          break;
        }
      }
      if (!touches) continue;
      const score = 0.7 / (1 + search.eta[i]);
      if (score > bestScore) {
        const step = firstStep(search, p.logicalTile, i);
        if (!step) continue;
        bestScore = score;
        bestDecision = { ...idle(), targetX: tileCenterX(step.c), targetY: tileCenterY(step.r) };
      }
    }
    return { score: bestScore, decision: bestDecision };
  }

  private reposition(danger: Float32Array, pps: number): Intent {
    const p = this.player;
    const search = bfs(this.world, p.logicalTile, pps, danger, this.params.safetyMargin, this.passable);
    if (!this.wanderTarget || this.world.time > this.wanderUntil) {
      const candidates: number[] = [];
      for (let i = 0; i < TILE_COUNT; i++) {
        if (search.dist[i] > 1 && search.dist[i] < 8) candidates.push(i);
      }
      if (candidates.length) {
        const i = candidates[this.rng.int(candidates.length)];
        const c = i % GRID_COLS;
        this.wanderTarget = { c, r: (i - c) / GRID_COLS };
        this.wanderUntil = this.world.time + 2.5;
      }
    }
    if (!this.wanderTarget) return { score: 0, decision: idle() };
    const idx = tileIndex(this.wanderTarget.c, this.wanderTarget.r);
    const step = firstStep(search, p.logicalTile, idx);
    if (!step) {
      this.wanderTarget = null;
      return { score: 0, decision: idle() };
    }
    return {
      score: 0.05,
      decision: { ...idle(), targetX: tileCenterX(step.c), targetY: tileCenterY(step.r) },
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private passable = (c: number, r: number): boolean => {
    if (!inBounds(c, r)) return false;
    const k = this.world.tileAt(c, r);
    if (k === TileKind.BLOCK_HARD || isDestructible(k)) return false;
    // Anti-frustration rule: never route through, or place on, a spike.
    if (k === TileKind.SPIKE) return false;
    return this.world.balloonAt(c, r) === null;
  };

  /**
   * Never place a balloon on a spike: it bursts on the spot, which is how the
   * original AI blew itself up on Camp. Standing *next* to a spike is fine.
   */
  private canPlaceHere(): boolean {
    const { c, r } = this.player.logicalTile;
    if (this.world.tileAt(c, r) === TileKind.SPIKE) return false;
    return this.world.balloonAt(c, r) === null;
  }

  private pickTarget(pps: number): Player | null {
    const p = this.player;
    let best: Player | null = null;
    let bestD = Infinity;
    const search = bfs(this.world, p.logicalTile, pps, undefined, 0, this.passable);
    for (const q of this.world.players) {
      if (q.id === p.id || q.state !== PlayerState.ALIVE) continue;
      if (this.world.sameTeam(p, q)) continue;
      // [COMMUNITY] 위장도구 makes you wear the enemy colour — the AI reads
      // the colour, so a disguised player is not a target.
      if (q.disguiseUntil > this.world.time) continue;
      if (q.ghostUntil > this.world.time) continue;
      const d = search.dist[tileIndex(q.logicalTile.c, q.logicalTile.r)];
      if (d < 0) continue;
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
    return best;
  }

  private velocity = new Map<number, { x: number; y: number }>();

  private updateVelocities(dt: number): void {
    for (const q of this.world.players) {
      const prev = this.lastPos.get(q.id);
      this.velocity.set(
        q.id,
        prev ? { x: (q.pos.x - prev.x) / dt, y: (q.pos.y - prev.y) / dt } : { x: 0, y: 0 },
      );
      this.lastPos.set(q.id, { x: q.pos.x, y: q.pos.y });
    }
  }

  /** Linear extrapolation over the fuse, with per-tier noise. */
  private predictTile(target: Player): TileRef {
    const v = this.velocity.get(target.id) ?? { x: 0, y: 0 };
    const noise = this.params.predictionNoise;
    const px = target.pos.x + v.x * FUSE_SECONDS + this.rng.range(-noise, noise) * TILE;
    const py = target.pos.y + v.y * FUSE_SECONDS + this.rng.range(-noise, noise) * TILE;
    return {
      c: Math.max(0, Math.min(GRID_COLS - 1, Math.floor(px / TILE))),
      r: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(py / TILE))),
    };
  }

  private jetCovers(origin: TileRef, range: number, target: TileRef): boolean {
    for (const t of this.world.jetTiles(origin, range)) {
      if (t.c === target.c && t.r === target.r) return true;
    }
    return false;
  }

  /** After placing here, would I still have somewhere to run? */
  private selfTrapOk(danger: Float32Array, pps: number, range: number): boolean {
    if (this.params.selfTrapCheck === 'none') return true;
    const p = this.player;
    const hypothetical = danger.slice();
    for (const t of this.world.jetTiles(p.logicalTile, range)) {
      const i = tileIndex(t.c, t.r);
      if (FUSE_SECONDS < hypothetical[i]) hypothetical[i] = FUSE_SECONDS;
    }

    if (this.params.selfTrapCheck === 'weak') {
      for (const d of DIRS) {
        const c = p.logicalTile.c + d.c;
        const r = p.logicalTile.r + d.r;
        if (this.passable(c, r) && !Number.isFinite(hypothetical[tileIndex(c, r)])) return true;
      }
      return false;
    }

    const search: BfsResult = bfs(
      this.world,
      p.logicalTile,
      pps,
      hypothetical,
      this.params.safetyMargin,
      this.passable,
    );
    for (let i = 0; i < TILE_COUNT; i++) {
      if (search.dist[i] > 0 && !Number.isFinite(hypothetical[i])) return true;
    }
    return false;
  }

  /** How much a balloon here would shrink the target's escape set. */
  private enclosurePressure(target: Player, range: number): number {
    const covered = new Set<number>();
    for (const t of this.world.jetTiles(this.player.logicalTile, range)) {
      covered.add(tileIndex(t.c, t.r));
    }
    let free = 0;
    let blocked = 0;
    for (const d of DIRS) {
      const c = target.logicalTile.c + d.c;
      const r = target.logicalTile.r + d.r;
      if (!this.passable(c, r)) {
        blocked++;
        continue;
      }
      if (covered.has(tileIndex(c, r))) blocked++;
      else free++;
    }
    return free === 0 ? 1 : blocked / 4;
  }

  /** 일자: does a balloon here continue a straight line with my existing ones? */
  private continuesLine(tile: TileRef): boolean {
    for (const b of this.world.balloons) {
      if (b.ownerId !== this.id) continue;
      if (b.tile.c === tile.c && Math.abs(b.tile.r - tile.r) <= 2) return true;
      if (b.tile.r === tile.r && Math.abs(b.tile.c - tile.c) <= 2) return true;
    }
    return false;
  }
}

/**
 * Owns the AI fleet. Its only cross-cutting job is the anti-frustration cap:
 * at low tiers, no more than two enemies may engage the player at once, so
 * the early ladder does not simply gang up.
 */
export class AIDirector {
  readonly controllers: AIController[] = [];
  private engaged = new Set<number>();
  private engagedAt = new Map<number, number>();

  constructor(private world: World, seed = 1) {
    for (const p of world.players) {
      if (p.aiTier === null) continue;
      const c = new AIController(world, p.id, p.aiTier, seed);
      c.attach(this);
      this.controllers.push(c);
      applyTierSetup(p, c.params);
    }
  }

  update(): void {
    // An engagement claim lapses if it is not renewed.
    for (const [id, at] of this.engagedAt) {
      if (this.world.time - at > 1.5) {
        this.engaged.delete(id);
        this.engagedAt.delete(id);
      }
    }
    for (const c of this.controllers) c.update();
  }

  requestEngage(id: number, max: number): boolean {
    if (this.engaged.has(id)) {
      this.engagedAt.set(id, this.world.time);
      return true;
    }
    if (this.engaged.size >= max) return false;
    this.engaged.add(id);
    this.engagedAt.set(id, this.world.time);
    return true;
  }
}

/**
 * Tier affects stat ceilings and starting kit, not just behaviour: ★1 is
 * described as having very low stat caps, and ★5/★6 are ★4 plus items.
 */
export function applyTierSetup(p: Player, params: TierParams): void {
  const m = params.statCapMultiplier;
  p.statsMax = {
    count: Math.max(p.statsBase.count, Math.round(p.statsMax.count * m)),
    range: Math.max(p.statsBase.range, Math.round(p.statsMax.range * m)),
    speed: Math.max(p.statsBase.speed, Math.round(p.statsMax.speed * m)),
  };
  p.stats.count = Math.min(p.stats.count, p.statsMax.count);
  p.stats.range = Math.min(p.stats.range, p.statsMax.range);
  p.stats.speed = Math.min(p.stats.speed, p.statsMax.speed);
  for (const { item, count } of params.ownedItems) {
    p.inventory.set(item, (p.inventory.get(item) ?? 0) + count);
  }
}
