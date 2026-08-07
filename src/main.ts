import { AIDirector } from './ai/controller.js';
import { tierParams } from './ai/tiers.js';
import { Keyboard } from './input.js';
import { Renderer } from './render/renderer.js';
import { drawFigure } from './render/figures.js';
import {
  CHARACTERS,
  getCharacter,
  pickEnemies,
  pickEnemyTeamFor,
  type CharacterDef,
} from './sim/characters.js';
import { DT, MATCH_SECONDS_NORMAL, MATCH_SECONDS_RESPAWN } from './sim/constants.js';
import { LOADOUT_PRESETS, getPreset, itemDef } from './sim/items.js';
import { MAPS } from './sim/maps.js';
import { computeRank, formatTime, gradeColor } from './sim/rank.js';
import { GameType, MatchPhase, PlayerState, type MatchConfig, type PlayerConfig } from './sim/types.js';
import { World, teamColor } from './sim/world.js';

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const menuEl = $('menu');
const gameEl = $('game');
const canvas = $<HTMLCanvasElement>('canvas');
const clockEl = $('clock');
const scorelineEl = $('scoreline');
const hudEl = $('hud');
const bannerEl = $('banner');
const overlayEl = $('overlay');
const overlayTitle = $('overlayTitle');
const overlayBody = $('overlayBody');
const rankBox = $('rankBox');

const gameTypeSel = $<HTMLSelectElement>('gameType');
const mapSel = $<HTMLSelectElement>('mapId');
const opponentsSel = $<HTMLSelectElement>('opponents');
const teamModeSel = $<HTMLSelectElement>('teamMode');
const tierSel = $<HTMLSelectElement>('tier');
const presetSel = $<HTMLSelectElement>('preset');
const tierNote = $('tierNote');
const presetNote = $('presetNote');
const charGrid = $('charGrid');

let selectedCharacter = 'bazzi';

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

const TIER_NOTES: Record<number, string> = {
  1: 'Appears not to understand the rules of the game at all. Picks items up but cannot use them.',
  2: 'Understands the basics and uses items. Dodges well at first, then starts walking into blast tiles — it eventually gets itself killed.',
  3: 'Between ★2 and ★4. Clearly harder than ★2, not sharply different from ★4.',
  4: 'Always recognises blast tiles and avoids them, indefinitely. You cannot beat it by baiting — you have to enclose it.',
  5: '★4 behaviour, plus it carries and uses 바늘 and 실드.',
  6: '★5, plus 스프링 — it can hop over your containment walls.',
};

function buildMenu(): void {
  for (const m of MAPS) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.ko} — ${m.en}`;
    mapSel.appendChild(opt);
  }

  for (const p of LOADOUT_PRESETS) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.ko} — ${p.en}`;
    presetSel.appendChild(opt);
  }
  presetSel.value = 'basic';

  for (const c of CHARACTERS) {
    const el = document.createElement('div');
    el.className = 'char' + (c.id === selectedCharacter ? ' selected' : '');
    el.innerHTML = `
      <div class="ko">${c.ko}${c.bonus ? ' <span class="bonus">랜덤</span>' : ''}</div>
      <div class="en">${c.en}</div>
      <div class="stats">${c.base.count}→${c.max.count} · ${c.base.range}→${c.max.range} · ${c.base.speed}→${c.max.speed}</div>`;
    el.prepend(makePortrait(c));
    el.addEventListener('click', () => {
      selectedCharacter = c.id;
      for (const child of charGrid.children) child.classList.remove('selected');
      el.classList.add('selected');
    });
    charGrid.appendChild(el);
  }

  const syncNotes = () => {
    const tier = Number(tierSel.value);
    const team = pickEnemyTeamFor(tier);
    tierNote.textContent = `${TIER_NOTES[tier]} Roster: ${team.ko} (${team.en}).`;
    presetNote.textContent = getPreset(presetSel.value).desc;
    const map = MAPS.find((m) => m.id === mapSel.value);
    if (map && !map.aiAllowed) {
      tierNote.textContent +=
        ' — Note: this map has spikes (가시). A balloon left on one bursts on the spot, which is how the original AI killed itself here, and why the map was excluded from 협공배틀. Ours simply never places on a spike tile.';
    }
  };
  tierSel.addEventListener('change', syncNotes);
  presetSel.addEventListener('change', syncNotes);
  mapSel.addEventListener('change', syncNotes);
  gameTypeSel.addEventListener('change', syncNotes);
  syncNotes();
}

/** A small canvas showing the character, drawn with the in-game figure code. */
function makePortrait(c: CharacterDef): HTMLCanvasElement {
  const size = 56;
  const dpr = window.devicePixelRatio || 1;
  const cv = document.createElement('canvas');
  cv.className = 'portrait';
  cv.width = size * dpr;
  cv.height = size * dpr;
  cv.style.width = `${size}px`;
  cv.style.height = `${size}px`;
  const ctx = cv.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
    drawFigure(ctx, { look: c.look, x: size / 2, y: size / 2 + 4, scale: 1.35, facing: 2 });
  }
  return cv;
}

function buildConfig(): MatchConfig {
  const gameType = gameTypeSel.value as GameType;
  const tier = Number(tierSel.value);
  const opponents = Number(opponentsSel.value);
  const teamMode = teamModeSel.value;
  const preset = getPreset(presetSel.value);

  const players: PlayerConfig[] = [
    {
      name: 'You',
      team: 0,
      characterId: selectedCharacter,
      aiTier: null,
      loadout: preset.items.map((i) => ({ ...i })),
    },
  ];

  const enemies = pickEnemies(tier, opponents);
  const usedChars = new Set([selectedCharacter]);
  const nameCounts = new Map<string, number>();
  enemies.forEach((e, i) => {
    let charId = e.statsFrom;
    if (usedChars.has(charId)) {
      const free = CHARACTERS.find((c) => !usedChars.has(c.id));
      if (free) charId = free.id;
    }
    usedChars.add(charId);
    // The roster repeats when a tier has fewer than `opponents` eligible
    // members, so number the duplicates rather than showing two identical cards.
    const seen = (nameCounts.get(e.id) ?? 0) + 1;
    nameCounts.set(e.id, seen);
    const suffix = enemies.filter((x) => x.id === e.id).length > 1 ? ` ${seen}` : '';
    players.push({
      name: `${e.ko} ${e.en}${suffix}`,
      team: teamMode === 'team' ? 1 : i + 1,
      characterId: charId,
      aiTier: tier,
    });
  });

  return {
    gameType,
    players,
    mapId: mapSel.value,
    seed: (Math.random() * 0xffffffff) >>> 0,
    matchSeconds: gameType === GameType.RESPAWN ? MATCH_SECONDS_RESPAWN : MATCH_SECONDS_NORMAL,
  };
}

// ---------------------------------------------------------------------------
// Game session
// ---------------------------------------------------------------------------

class Session {
  world: World;
  director: AIDirector;
  renderer: Renderer;
  keyboard: Keyboard;
  accumulator = 0;
  lastFrame = 0;
  raf = 0;
  running = true;
  hudAcc = 0;
  bannerUntil = 0;
  finished = false;
  readonly enemyTier: number;

  constructor(cfg: MatchConfig, renderer: Renderer, keyboard: Keyboard) {
    this.world = new World(cfg);
    this.director = new AIDirector(this.world, cfg.seed);
    this.renderer = renderer;
    this.keyboard = keyboard;
    this.enemyTier = Math.max(1, ...cfg.players.map((p) => p.aiTier ?? 0));
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  start(): void {
    this.lastFrame = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.25, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.accumulator += dt;

      while (this.accumulator >= DT) {
        this.accumulator -= DT;
        this.tick();
      }

      this.renderer.draw(this.world, 0, dt);
      this.hudAcc += dt;
      if (this.hudAcc > 0.1) {
        this.hudAcc = 0;
        this.updateHud();
      }
      if (this.world.time > this.bannerUntil) bannerEl.classList.add('hidden');

      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private tick(): void {
    // The result screen is built once. Re-running it every frame rebuilt the
    // whole HUD 60 times a second for as long as the overlay was up.
    if (this.finished) return;
    const human = this.world.players[0];
    if (human.state !== PlayerState.DEAD) this.keyboard.applyTo(human);
    this.director.update();
    this.world.step();
    this.consumeEvents();
    if (this.world.phase === MatchPhase.OVER) {
      this.finished = true;
      this.finish();
    }
  }

  private consumeEvents(): void {
    for (const e of this.world.events) {
      switch (e.type) {
        case 'explode':
          this.renderer.kick(4);
          break;
        case 'trapped': {
          const p = this.world.players[e.playerId];
          this.renderer.pushFloat(p.pos.x, p.pos.y - 26, 'bubbled!', '#8fdcff');
          break;
        }
        case 'rescue': {
          const p = this.world.players[e.playerId];
          this.renderer.pushFloat(p.pos.x, p.pos.y - 26, 'SAVE', '#8fd16a');
          break;
        }
        case 'death': {
          const p = this.world.players[e.playerId];
          this.renderer.pushFloat(p.pos.x, p.pos.y - 26, 'OUT', '#ff8a65');
          this.renderer.kick(6);
          break;
        }
        case 'pickup': {
          if (e.playerId !== 0) break;
          const p = this.world.players[0];
          this.renderer.pushFloat(p.pos.x, p.pos.y - 30, itemDef(e.item).ko, itemDef(e.item).color);
          break;
        }
        case 'itemPlane':
          this.showBanner(`Item plane — ${e.drops} dropped`);
          break;
        case 'bombPass': {
          const to = this.world.players[e.to];
          this.renderer.pushFloat(to.pos.x, to.pos.y - 30, 'BOMB!', '#ff6d00');
          break;
        }
        default:
          break;
      }
    }
  }

  private showBanner(text: string): void {
    bannerEl.textContent = text;
    bannerEl.classList.remove('hidden');
    this.bannerUntil = this.world.time + 2.5;
  }

  private updateHud(): void {
    const w = this.world;
    const urgent = w.clock <= 30;
    clockEl.textContent = formatTime(Math.max(0, w.clock));
    clockEl.classList.toggle('urgent', urgent);

    scorelineEl.innerHTML = '';
    for (const t of w.teams()) {
      const kills = w.players.filter((p) => p.team === t).reduce((s, p) => s + p.kills, 0);
      const alive = w.aliveOnTeam(t);
      const el = document.createElement('div');
      el.className = 'team';
      el.style.color = teamColor(t);
      el.textContent =
        w.cfg.gameType === GameType.RESPAWN
          ? `Team ${t + 1}: ${kills} kills`
          : `Team ${t + 1}: ${alive} alive`;
      scorelineEl.appendChild(el);
    }

    hudEl.innerHTML = '';
    for (const p of w.players) {
      const ch = getCharacter(p.characterId);
      const card = document.createElement('div');
      card.className = 'card' + (p.state === PlayerState.DEAD ? ' dead' : '');
      card.style.borderLeftColor = teamColor(p.team);

      const tierLabel = p.aiTier ? `COM ★${p.aiTier} ${tierParams(p.aiTier).name}` : 'Player';
      const slots = p.slots
        .map((id, i) => {
          const d = itemDef(id);
          const n = p.inventory.get(id) ?? 0;
          const active = i === p.selectedSlot ? ' active' : '';
          return `<span class="slot${active}"><span class="n">${i + 1}</span> ${d.ko} ×${n}</span>`;
        })
        .join('');

      let state = '';
      if (p.state === PlayerState.TRAPPED) {
        state = `bubbled — ${Math.max(0, p.drownTime - p.trappedFor).toFixed(1)}s`;
      } else if (p.state === PlayerState.HEDGEHOG) {
        state = p.hedgehogStun > 0 ? 'hedgehog (stunned)' : 'hedgehog';
      } else if (p.state === PlayerState.DEAD) {
        state = w.cfg.gameType === GameType.RESPAWN ? `respawning ${p.respawnIn.toFixed(1)}s` : 'out';
      } else if (p.isCaptain) {
        state = 'captain';
      }

      card.innerHTML = `
        <div class="row1">
          <span class="name" style="color:${ch.color}">${ch.ko}</span>
          <span class="tag">${p.name} · ${tierLabel}</span>
        </div>
        <div class="stats">
          <span>개수 <b>${w.effectiveCount(p)}</b>/${p.statsMax.count}</span>
          <span>물줄기 <b>${w.effectiveRange(p)}</b>/${p.statsMax.range}</span>
          <span>속도 <b>${w.effectiveSpeed(p)}</b>/${p.statsMax.speed}</span>
        </div>
        <div class="stats"><span>K ${p.kills}</span><span>D ${p.deaths}</span><span>Saves ${p.saves}</span></div>
        ${slots ? `<div class="slots">${slots}</div>` : ''}
        ${state ? `<div class="state">${state}</div>` : ''}`;
      hudEl.appendChild(card);
    }
  }

  private finish(): void {
    const w = this.world;
    const human = w.players[0];
    const won = w.result?.winningTeam === human.team;
    const rank = computeRank({
      kills: human.kills,
      saves: human.saves,
      died: human.deaths > 0,
      enemyTier: this.enemyTier,
      clearTime: w.time,
      itemsUsed: human.itemsUsed,
      won,
    });

    overlayTitle.textContent = won ? 'Victory' : w.result?.winningTeam === null ? 'Draw' : 'Defeat';
    overlayTitle.style.color = won ? '#8fd16a' : '#ff8a65';
    overlayBody.textContent = w.result?.reason ?? '';

    rankBox.innerHTML =
      `<div class="rank-badge" style="color:${gradeColor(rank.grade)}">${rank.grade}</div>` +
      rank.breakdown
        .map(
          (b) =>
            `<div>${b.label} <b style="color:${b.value >= 0 ? '#8fd16a' : '#ff8a65'}">${
              b.value >= 0 ? '+' : ''
            }${b.value}</b></div>`,
        )
        .join('') +
      `<div style="margin-top:6px">Total <b>${rank.score}</b></div>`;

    overlayEl.classList.remove('hidden');
    this.updateHud();
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const keyboard = new Keyboard();
let renderer: Renderer | null = null;
let session: Session | null = null;
let lastConfig: MatchConfig | null = null;

function startMatch(cfg: MatchConfig): void {
  session?.stop();
  menuEl.classList.add('hidden');
  gameEl.classList.remove('hidden');
  overlayEl.classList.add('hidden');
  bannerEl.classList.add('hidden');
  if (!renderer) renderer = new Renderer(canvas);
  renderer.resize();
  lastConfig = cfg;
  session = new Session(cfg, renderer, keyboard);
  session.start();
}

function toMenu(): void {
  session?.stop();
  session = null;
  gameEl.classList.add('hidden');
  menuEl.classList.remove('hidden');
}

buildMenu();
$('startBtn').addEventListener('click', () => startMatch(buildConfig()));
$('quitBtn').addEventListener('click', toMenu);
$('menuBtn').addEventListener('click', toMenu);
$('againBtn').addEventListener('click', () => {
  if (!lastConfig) return;
  startMatch({ ...lastConfig, seed: (Math.random() * 0xffffffff) >>> 0 });
});
