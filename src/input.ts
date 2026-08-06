import type { Player } from './sim/types.js';

/**
 * [OFFICIAL] Arrow keys move. Space places a balloon. Number keys select an
 * inventory slot; Ctrl uses the selected slot.
 *
 * The original also supported two players on one keyboard — R/D/F/G plus
 * LShift and LCtrl for player one, arrows plus RShift and RCtrl for player
 * two. That second scheme is wired up here so couch play is a config change
 * rather than a rewrite.
 */
export interface KeyMap {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  place: string[];
  use: string[];
  /** Slot keys, in order. */
  slots: string[];
}

export const ARROW_KEYS: KeyMap = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  place: ['Space'],
  use: ['ControlLeft', 'ControlRight'],
  slots: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'],
};

export const COUCH_P1_KEYS: KeyMap = {
  up: ['KeyR'],
  down: ['KeyF'],
  left: ['KeyD'],
  right: ['KeyG'],
  place: ['ShiftLeft'],
  use: ['ControlLeft'],
  slots: ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB'],
};

const SWALLOW = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'ControlLeft',
  'ControlRight',
  'ShiftLeft',
]);

export class Keyboard {
  private down = new Set<string>();
  private onKeyDown = (e: KeyboardEvent) => {
    this.down.add(e.code);
    if (SWALLOW.has(e.code)) e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };
  private onBlur = () => this.down.clear();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  isDown(codes: string[]): boolean {
    for (const c of codes) if (this.down.has(c)) return true;
    return false;
  }

  /** Write the current keyboard state into a player's input struct. */
  applyTo(p: Player, map: KeyMap = ARROW_KEYS): void {
    p.input.up = this.isDown(map.up);
    p.input.down = this.isDown(map.down);
    p.input.left = this.isDown(map.left);
    p.input.right = this.isDown(map.right);
    p.input.place = this.isDown(map.place);
    p.input.use = this.isDown(map.use);
    p.input.selectSlot = -1;
    for (let i = 0; i < map.slots.length; i++) {
      if (this.down.has(map.slots[i])) {
        p.input.selectSlot = i;
        break;
      }
    }
  }
}
