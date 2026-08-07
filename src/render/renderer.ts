import {
  FUSE_SECONDS,
  FUSE_SWELL_SECONDS,
  GRID_COLS,
  GRID_ROWS,
  JET_SECONDS,
  TILE,
  WORLD_H,
  WORLD_W,
  tileCenterX,
  tileCenterY,
} from '../sim/constants.js';
import { getCharacter } from '../sim/characters.js';
import { itemDef } from '../sim/items.js';
import {
  GroundKind,
  PlayerState,
  TileKind,
  type Balloon,
  type Player,
} from '../sim/types.js';
import { World, teamColor } from '../sim/world.js';
import { drawFigure } from './figures.js';

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private floats: FloatingText[] = [];
  private shake = 0;
  /** Per-player walk cycle, advanced by distance travelled rather than time. */
  private gait = new Map<number, { x: number; y: number; phase: number }>();

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const parent = this.canvas.parentElement;
    const availW = parent ? parent.clientWidth : WORLD_W;
    // Reserve room for the topbar above and the player cards below.
    const availH = window.innerHeight - 300;
    const scale = Math.max(0.6, Math.min(availW / WORLD_W, availH / WORLD_H, 1.8));
    this.canvas.style.width = `${Math.round(WORLD_W * scale)}px`;
    this.canvas.style.height = `${Math.round(WORLD_H * scale)}px`;
    this.canvas.width = Math.round(WORLD_W * scale * dpr);
    this.canvas.height = Math.round(WORLD_H * scale * dpr);
    this.ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }

  pushFloat(x: number, y: number, text: string, color: string): void {
    this.floats.push({ x, y, text, color, life: 1 });
  }

  kick(amount = 3): void {
    this.shake = Math.max(this.shake, amount);
  }

  draw(world: World, viewerId: number, dt: number): void {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0.1) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake *= 0.85;
    }

    this.drawFloor(world);
    this.drawConveyors(world);
    this.drawGround(world);
    this.drawBlocks(world);
    this.drawSensor(world, viewerId);
    this.drawJets(world);
    for (const b of world.balloons) this.drawBalloon(b);
    const order = [...world.players].sort((a, b) => a.pos.y - b.pos.y);
    for (const p of order) this.drawPlayer(world, p, viewerId);
    this.drawFloats(dt);

    ctx.restore();
  }

  // -------------------------------------------------------------------------

  private drawFloor(world: World): void {
    const ctx = this.ctx;
    const t = world.map.def.theme;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        ctx.fillStyle = (c + r) % 2 === 0 ? t.floorA : t.floorB;
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }
  }

  /** [COMMUNITY] 컨베이어 벨트 — plated floor with chevrons scrolling along it. */
  private drawConveyors(world: World): void {
    const ctx = this.ctx;
    const plate = world.map.def.theme.belt ?? '#4d5560';
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const dir = world.conveyorAt(c, r);
        if (dir === null) continue;
        const x = c * TILE;
        const y = r * TILE;
        ctx.fillStyle = plate;
        ctx.fillRect(x, y, TILE, TILE);

        // Chevrons march in the belt's direction so which way it runs is
        // readable at a glance, even standing still.
        const dc = dir === 1 ? 1 : dir === 3 ? -1 : 0;
        const dr = dir === 2 ? 1 : dir === 0 ? -1 : 0;
        const scroll = (world.time * 26) % 16;
        ctx.save();
        ctx.translate(x + TILE / 2, y + TILE / 2);
        ctx.rotate(Math.atan2(dr, dc));
        ctx.strokeStyle = 'rgba(255,255,255,0.42)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let i = -1; i < 2; i++) {
          const ox = i * 16 + scroll - 8;
          ctx.beginPath();
          ctx.moveTo(ox - 5, -7);
          ctx.lineTo(ox + 3, 0);
          ctx.lineTo(ox - 5, 7);
          ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      }
    }
  }

  private drawBlocks(world: World): void {
    const ctx = this.ctx;
    const t = world.map.def.theme;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const kind = world.tileAt(c, r);
        const x = c * TILE;
        const y = r * TILE;
        switch (kind) {
          case TileKind.BLOCK_HARD:
            ctx.fillStyle = t.wall;
            roundRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 5);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            roundRect(ctx, x + 4, y + 4, TILE - 8, TILE / 2 - 4, 3);
            ctx.fill();
            break;
          case TileKind.BLOCK_SOFT:
            ctx.fillStyle = t.soft;
            roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 6);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            roundRect(ctx, x + 6, y + 6, TILE - 12, 6, 3);
            ctx.fill();
            break;
          case TileKind.BLOCK_PUSHABLE:
            ctx.fillStyle = t.push;
            roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 6);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 2;
            ctx.stroke();
            drawHeart(ctx, x + TILE / 2, y + TILE / 2 + 1, TILE * 0.26, 'rgba(255,255,255,0.85)');
            break;
          case TileKind.SPIKE:
            ctx.fillStyle = '#5d5347';
            ctx.fillRect(x + 3, y + TILE - 8, TILE - 6, 5);
            ctx.fillStyle = '#d8d8d8';
            for (let i = 0; i < 3; i++) {
              const sx = x + 8 + i * 12;
              ctx.beginPath();
              ctx.moveTo(sx, y + TILE - 6);
              ctx.lineTo(sx + 5, y + 8);
              ctx.lineTo(sx + 10, y + TILE - 6);
              ctx.closePath();
              ctx.fill();
            }
            break;
          default:
            break;
        }
      }
    }
  }

  private drawGround(world: World): void {
    const ctx = this.ctx;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const g = world.groundAt(c, r);
        if (g.kind === GroundKind.NONE) continue;
        const cx = tileCenterX(c);
        const cy = tileCenterY(r);
        switch (g.kind) {
          case GroundKind.ITEM: {
            if (!g.item) break;
            const def = itemDef(g.item);
            const bob = Math.sin(world.time * 4 + c + r) * 1.6;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.35)';
            ctx.shadowBlur = 6;
            ctx.fillStyle = def.color;
            roundRect(ctx, cx - 13, cy - 13 + bob, 26, 26, 7);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = '14px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(def.glyph, cx, cy + 1 + bob);
            break;
          }
          case GroundKind.BANANA:
            ctx.fillStyle = '#fdd835';
            ctx.beginPath();
            ctx.ellipse(cx, cy, 13, 7, 0.5, 0, Math.PI * 2);
            ctx.fill();
            break;
          case GroundKind.BOND:
            ctx.fillStyle = 'rgba(245,245,220,0.75)';
            ctx.beginPath();
            ctx.ellipse(cx, cy, 16, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
          case GroundKind.PUSHPIN:
            ctx.fillStyle = '#bdbdbd';
            ctx.beginPath();
            ctx.moveTo(cx - 7, cy - 4);
            ctx.lineTo(cx + 7, cy - 4);
            ctx.lineTo(cx, cy + 9);
            ctx.closePath();
            ctx.fill();
            break;
          case GroundKind.TRAP:
            ctx.strokeStyle = '#6d4c41';
            ctx.lineWidth = 3;
            for (let i = 0; i < 4; i++) {
              ctx.beginPath();
              ctx.moveTo(cx - 15, cy - 12 + i * 8);
              ctx.lineTo(cx + 15, cy - 12 + i * 8);
              ctx.stroke();
            }
            break;
          default:
            break;
        }
      }
    }
  }

  /** [COMMUNITY] 센서 pre-visualises jet blast areas. */
  private drawSensor(world: World, viewerId: number): void {
    const viewer = world.players[viewerId];
    if (!viewer || viewer.sensorUntil <= world.time) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 90, 90, 0.18)';
    for (const b of world.balloons) {
      for (const t of world.jetTiles(b.tile, b.range)) {
        ctx.fillRect(t.c * TILE, t.r * TILE, TILE, TILE);
      }
    }
    ctx.restore();
  }

  private drawJets(world: World): void {
    const ctx = this.ctx;
    for (const j of world.jets) {
      const k = Math.min(1, j.life / JET_SECONDS);
      const w = TILE * (0.55 + 0.45 * k);
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.6 * k;
      for (const t of j.tiles) {
        const cx = tileCenterX(t.c);
        const cy = tileCenterY(t.r);
        const horizontal = t.dir === 1 || t.dir === 3;
        const vertical = t.dir === 0 || t.dir === 2;
        ctx.fillStyle = '#8fdcff';
        if (t.dir === null) {
          ctx.beginPath();
          ctx.arc(cx, cy, w * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (horizontal) {
          roundRect(ctx, cx - TILE / 2, cy - w / 2, TILE, w, w / 2);
          ctx.fill();
        } else if (vertical) {
          roundRect(ctx, cx - w / 2, cy - TILE / 2, w, TILE, w / 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.arc(cx, cy, w * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawBalloon(b: Balloon): void {
    const ctx = this.ctx;
    // The swell in the last stretch of the fuse is the tell players read.
    const remaining = b.remote ? FUSE_SECONDS : b.fuse;
    let scale = 1;
    if (!b.remote && remaining < FUSE_SWELL_SECONDS) {
      const k = 1 - remaining / FUSE_SWELL_SECONDS;
      scale = 1 + 0.22 * Math.abs(Math.sin(k * Math.PI * 6)) * k;
    }
    const rr = TILE * 0.42 * scale;
    const x = b.pos.x;
    const y = b.pos.y;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y + rr * 0.75, rr * 0.85, rr * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.35, rr * 0.15, x, y, rr);
    grad.addColorStop(0, b.remote ? '#ffd0a8' : '#bdefff');
    grad.addColorStop(1, b.remote ? '#ff7043' : '#2196f3');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(x - rr * 0.32, y - rr * 0.36, rr * 0.2, rr * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPlayer(world: World, p: Player, viewerId: number): void {
    if (p.state === PlayerState.DEAD) return;
    const ctx = this.ctx;
    const ch = getCharacter(p.characterId);
    const x = p.pos.x;
    const y = p.pos.y;
    const rr = TILE * 0.34;

    ctx.save();

    // [COMMUNITY] 유령 makes you near-invisible to enemies, semi-transparent
    // to yourself and your team.
    if (p.ghostUntil > world.time) {
      const viewer = world.players[viewerId];
      const friendly = viewer && (viewer.id === p.id || world.sameTeam(viewer, p));
      ctx.globalAlpha = friendly ? 0.45 : 0.12;
    }

    if (p.state === PlayerState.HEDGEHOG) {
      this.drawHedgehog(p, x, y, rr);
      ctx.restore();
      return;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + rr * 1.15, rr * 0.9, rr * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Team ring under the feet — a disguise wears the enemy colour.
    const shownTeam = p.disguiseUntil > world.time ? (p.team + 1) % 8 : p.team;
    const team = teamColor(shownTeam);
    ctx.strokeStyle = team;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(x, y + rr * 1.15, rr * 0.95, rr * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();

    drawFigure(ctx, {
      look: ch.look,
      x,
      y,
      facing: p.facing,
      walk: this.walkPhase(p),
      team,
    });

    if (p.state === PlayerState.TRAPPED) {
      // The bubble becomes progressively more opaque; when the character is
      // fully hidden, it bursts and they drown.
      const k = Math.min(1, p.trappedFor / p.drownTime);
      ctx.fillStyle = `rgba(120, 200, 255, ${0.25 + 0.55 * k})`;
      ctx.beginPath();
      ctx.arc(x, y, rr * 1.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(x - rr * 0.55, y - rr * 0.65, rr * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.shieldUntil > world.time) {
      ctx.strokeStyle = 'rgba(120,190,255,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, rr * 1.6 + Math.sin(world.time * 12) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.supermanUntil > world.time) {
      ctx.strokeStyle = 'rgba(255,225,120,0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, rr * 1.35, 0, Math.PI * 2);
      ctx.stroke();
    }

    // [COMMUNITY] 대장잡기: the captain carries a team-coloured flag, and a
    // disguise does not change the flag's colour.
    if (p.isCaptain) {
      const top = y - rr - 24;
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(x + rr - 2, top, 2, 16);
      ctx.fillStyle = teamColor(p.team);
      ctx.beginPath();
      ctx.moveTo(x + rr, top);
      ctx.lineTo(x + rr + 13, top + 5);
      ctx.lineTo(x + rr, top + 10);
      ctx.closePath();
      ctx.fill();
    }

    if (p.hasBomb) {
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(x, y - rr - 20, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff6d00';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.ceil(p.bombTimer).toString(), x, y - rr - 19);
    }

    ctx.restore();
  }

  /**
   * The walk cycle advances with distance covered, not with the clock, so a
   * slow character takes slow steps and a stopped one stands still. One full
   * cycle per 26px keeps the stride length believable at every speed.
   */
  private walkPhase(p: Player): number {
    let g = this.gait.get(p.id);
    if (!g) {
      g = { x: p.pos.x, y: p.pos.y, phase: 0 };
      this.gait.set(p.id, g);
    }
    const moved = Math.hypot(p.pos.x - g.x, p.pos.y - g.y);
    g.x = p.pos.x;
    g.y = p.pos.y;
    // A teleport (spring hop, respawn) must not spin the legs.
    if (moved < 12) g.phase = (g.phase + moved / 26) % 1;
    return g.phase;
  }

  private drawHedgehog(p: Player, x: number, y: number, rr: number): void {
    const ctx = this.ctx;
    ctx.globalAlpha *= p.hedgehogStun > 0 ? 0.5 : 1;
    ctx.fillStyle = '#6d4c41';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r1 = rr * 1.15;
      const r2 = rr * 0.7;
      ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      ctx.lineTo(x + Math.cos(a + Math.PI / 12) * r2, y + Math.sin(a + Math.PI / 12) * r2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5e0c8';
    ctx.beginPath();
    ctx.arc(x, y, rr * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1b1b';
    ctx.beginPath();
    ctx.arc(x - 4, y - 1, 1.8, 0, Math.PI * 2);
    ctx.arc(x + 4, y - 1, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawFloats(dt: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt * 1.1;
      f.y -= dt * 26;
      if (f.life <= 0) {
        this.floats.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.7);
  ctx.bezierCurveTo(cx - size * 1.4, cy - size * 0.3, cx - size * 0.4, cy - size * 1.2, cx, cy - size * 0.35);
  ctx.bezierCurveTo(cx + size * 0.4, cy - size * 1.2, cx + size * 1.4, cy - size * 0.3, cx, cy + size * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
