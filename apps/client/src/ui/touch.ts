// On-screen controls for phones and tablets: a joystick to walk, and buttons for the keys
// (E interact, Shift run, M map, T fast time, Enter chat). Shown only once the device is touch-driven.
import { L, onLangChange } from '../i18n';

const listeners: Array<() => void> = [];
let touchMode = false;

/** true once the game is being played by touch (a coarse pointer, or the first real touch) */
export function isTouch() { return touchMode; }

/** runs `fn` now if already in touch mode, otherwise the first time the player touches the screen */
export function onTouchMode(fn: () => void) { if (touchMode) fn(); else listeners.push(fn); }

function enterTouchMode() {
  if (touchMode) return;
  touchMode = true;
  document.body.classList.add('touch');
  for (const fn of listeners.splice(0)) fn();
}

if (typeof window !== 'undefined') {
  if (window.matchMedia?.('(pointer: coarse)').matches) enterTouchMode();
  // (a laptop with a touchscreen switches over only when it's actually touched)
  window.addEventListener('touchstart', enterTouchMode, { once: true, passive: true });
}

const STICK_R = 46; // px the knob can travel from the centre
const DEAD = 0.22;

export class TouchControls {
  readonly el: HTMLElement;
  /** where the joystick points: a unit vector, or 0,0 when it's let go / inside the dead zone */
  readonly vector = { x: 0, y: 0 };
  /** the run button is held */
  running = false;
  onAct: () => void = () => {};
  onMap: () => void = () => {};
  onFast: () => void = () => {};
  onChat: () => void = () => {};
  /** two-finger pinch on the campus: factor > 1 zooms in */
  onPinch: (factor: number) => void = () => {};

  private zone: HTMLElement;
  private base: HTMLElement;
  private knob: HTMLElement;
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };
  private hidden = false;

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'touch-ui';
    this.el.innerHTML = `
      <div class="stick-zone"><div class="stick-base"><div class="stick-knob"></div></div></div>
      <div class="touch-btns">
        <button type="button" class="t-btn t-chat hidden">💬</button>
        <button type="button" class="t-btn t-fast">⏩</button>
        <button type="button" class="t-btn t-map">🗺️</button>
        <button type="button" class="t-btn t-run">🏃</button>
        <button type="button" class="t-btn t-act">✋</button>
      </div>`;
    // first in the HUD, so cards, panels and overlays all sit above it
    host.prepend(this.el);
    const q = (s: string) => this.el.querySelector(s) as HTMLElement;
    this.zone = q('.stick-zone');
    this.base = q('.stick-base');
    this.knob = q('.stick-knob');
    this.setupStick();

    // buttons fire on pointerdown: a tap feels instant and never turns into a page zoom
    const tap = (sel: string, fn: () => void) => q(sel).addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
    tap('.t-act', () => this.onAct());
    tap('.t-map', () => this.onMap());
    tap('.t-fast', () => this.onFast());
    tap('.t-chat', () => this.onChat());
    const run = q('.t-run');
    const runOn = (on: boolean) => { this.running = on; run.classList.toggle('on', on); };
    run.addEventListener('pointerdown', (e) => { e.preventDefault(); run.setPointerCapture(e.pointerId); runOn(true); });
    run.addEventListener('pointerup', () => runOn(false));
    run.addEventListener('pointercancel', () => runOn(false));
    run.addEventListener('lostpointercapture', () => runOn(false));

    this.setupPinch();
    onLangChange(() => this.refreshTitles());
    this.refreshTitles();
  }

  private refreshTitles() {
    const title = (sel: string, text: string) => { const b = this.el.querySelector(sel) as HTMLElement; b.title = text; b.setAttribute('aria-label', text); };
    title('.t-act', L({ tr: 'Etkileşim', en: 'Interact' }));
    title('.t-run', L({ tr: 'Koş (basılı tut)', en: 'Run (hold)' }));
    title('.t-map', L({ tr: 'Harita', en: 'Map' }));
    title('.t-fast', L({ tr: 'Hızlı zaman', en: 'Fast time' }));
    title('.t-chat', L({ tr: 'Sohbet', en: 'Chat' }));
  }

  /** shows the chat button (online only) */
  enableChat() { this.el.querySelector('.t-chat')!.classList.remove('hidden'); }

  /** hidden (and let go) while a panel, card or chat is open */
  setHidden(hidden: boolean) {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    this.el.classList.toggle('off', hidden);
    if (hidden) { this.release(); this.running = false; this.el.querySelector('.t-run')!.classList.remove('on'); }
  }

  private setupStick() {
    const zone = this.zone;
    zone.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      e.preventDefault();
      this.stickId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      // the stick appears under your thumb, wherever it lands in the zone
      const r = zone.getBoundingClientRect();
      const pad = STICK_R + 14;
      const x = Math.min(r.width - pad, Math.max(pad, e.clientX - r.left));
      const y = Math.min(r.height - pad, Math.max(pad, e.clientY - r.top));
      this.origin = { x: r.left + x, y: r.top + y };
      this.base.style.left = `${x}px`;
      this.base.style.top = `${y}px`;
      this.base.style.bottom = 'auto';
      this.base.classList.add('active');
      this.move(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === this.stickId) this.move(e.clientX, e.clientY); });
    const end = (e: PointerEvent) => { if (e.pointerId === this.stickId) this.release(); };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
  }

  private move(cx: number, cy: number) {
    let dx = cx - this.origin.x, dy = cy - this.origin.y;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, d / STICK_R);
    if (m < DEAD) { this.vector.x = 0; this.vector.y = 0; return; }
    this.vector.x = dx / (m * STICK_R);
    this.vector.y = dy / (m * STICK_R);
  }

  private release() {
    this.stickId = null;
    this.vector.x = 0; this.vector.y = 0;
    this.knob.style.transform = '';
    this.base.classList.remove('active');
    this.base.style.left = ''; this.base.style.top = ''; this.base.style.bottom = '';
  }

  /** pinch with two fingers on the game itself (not on the HUD) to zoom the campus */
  private setupPinch() {
    const game = document.getElementById('game');
    if (!game) return;
    let last = 0;
    const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    game.addEventListener('touchstart', (e) => { if (e.touches.length === 2) last = spread(e.touches); }, { passive: true });
    game.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2 || !last || this.hidden) return;
      e.preventDefault();
      const now = spread(e.touches);
      if (Math.abs(now - last) < 6) return;
      this.onPinch(now / last);
      last = now;
    }, { passive: false });
    game.addEventListener('touchend', (e) => { if (e.touches.length < 2) last = 0; }, { passive: true });
  }
}
