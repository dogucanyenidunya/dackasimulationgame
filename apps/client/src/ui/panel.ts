// Building interiors (as menus) and minigames. Interiors become walkable maps later (GDD §4).
import { L, type Text } from '../i18n';
import { sfx } from '../audio';

export interface ActionView {
  id: string;
  label: string;
  /** small grey hint: cost / reward / time */
  hint?: string;
  /** when set, the button is disabled and shows this reason */
  locked?: string;
  run: () => Promise<void> | void;
}

export interface RoomView { id: string; name: string; note?: string; actions: ActionView[]; locked?: string }

export interface PanelView {
  title: string; sub?: string; status?: string; rooms: RoomView[];
  /** return a message to refuse leaving (e.g. during evening study) */
  canClose?: () => string | undefined;
}

const UI = {
  close: { tr: 'Çık', en: 'Leave' },
  continue: { tr: 'Devam', en: 'Continue' },
  correct: { tr: 'Doğru!', en: 'Correct!' },
  wrong: { tr: 'Yanlış. Doğrusu: {a}', en: 'Wrong. Answer: {a}' },
  result: { tr: '{c}/{t} doğru', en: '{c}/{t} correct' },
  time: { tr: 'Süre', en: 'Time' },
  press: { tr: 'Yeşil alana gelince BOŞLUK tuşuna bas ya da tıkla', en: 'Press SPACE or click when the marker is in the green zone' },
  hit: { tr: 'İsabet!', en: 'Hit!' },
  higher: { tr: 'Daha büyük bir sayı…', en: 'A higher number…' },
  lower: { tr: 'Daha küçük bir sayı…', en: 'A lower number…' },
  guessRight: { tr: 'Doğru! Kapı boş, şimdi!', en: 'Right! The door is clear, go!' },
  guessWrong: { tr: 'Olmadı. Doğru sayı: {n}', en: 'No luck. It was {n}' },
  triesLeft: { tr: '{n} hakkın kaldı', en: '{n} tries left' },
  miss: { tr: 'Kaçtı!', en: 'Missed!' },
  attempt: { tr: 'Deneme {n}/{t}', en: 'Attempt {n}/{t}' },
  cancel: { tr: 'Vazgeç', en: 'Cancel' },
} satisfies Record<string, Text>;

const fill = (s: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((a, [k, v]) => a.replace(`{${k}}`, String(v)), s);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Panel {
  private el: HTMLElement;
  private view: (() => PanelView) | null = null;
  private room = 0;
  private busy = false;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  isOpen = false;

  constructor(host: HTMLElement, private onBlock: (blocked: boolean) => void) {
    this.el = document.createElement('div');
    this.el.className = 'overlay panel hidden';
    host.appendChild(this.el);
  }

  /** opens a building; `build` is re-evaluated after every action so state changes show up */
  open(build: () => PanelView, roomId?: string) {
    this.view = build;
    const v = build();
    this.room = Math.max(0, v.rooms.findIndex((r) => r.id === roomId));
    this.isOpen = true;
    this.onBlock(true);
    this.el.classList.remove('hidden');
    this.render();
    this.listenKeys((e) => { if (e.key === 'Escape' && !this.busy) this.tryClose(); });
  }

  /** the player asked to leave; the view may refuse */
  tryClose() {
    const why = this.view?.().canClose?.();
    if (why) { this.onRefuse?.(why); return; }
    this.close();
  }

  onRefuse: ((why: string) => void) | null = null;

  close() {
    this.isOpen = false;
    this.view = null;
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
    this.listenKeys(null);
    this.onBlock(false);
  }

  refresh() { if (this.view && !this.busy) this.render(); }

  private listenKeys(fn: ((e: KeyboardEvent) => void) | null) {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler, true);
    this.keyHandler = fn;
    if (fn) window.addEventListener('keydown', fn, true);
  }

  private render() {
    if (!this.view) return;
    const v = this.view();
    if (this.room >= v.rooms.length) this.room = 0;
    const room = v.rooms[this.room];
    this.el.innerHTML = `
      <div class="card panel-card">
        <div class="panel-head">
          <div><h2>${esc(v.title)}</h2>${v.sub ? `<div class="modal-sub">${esc(v.sub)}</div>` : ''}</div>
          <button type="button" class="secondary close-btn">${esc(L(UI.close))} ✕</button>
        </div>
        ${v.status ? `<div class="panel-status">${esc(v.status)}</div>` : ''}
        ${v.rooms.length > 1 ? `<div class="tabs">${v.rooms.map((r, i) => `<button type="button" data-room="${i}" class="${i === this.room ? 'on' : ''} ${r.locked ? 'locked' : ''}">${r.locked ? '🔒 ' : ''}${esc(r.name)}</button>`).join('')}</div>` : ''}
        <div class="room">
          ${room.note ? `<p class="room-note">${esc(room.note)}</p>` : ''}
          ${room.locked ? `<p class="room-locked">🔒 ${esc(room.locked)}</p>` : `<div class="actions">${room.actions.map((a, i) => `
            <button type="button" class="action" data-action="${i}" ${a.locked ? 'disabled' : ''}>
              <b>${esc(a.label)}</b>${a.hint ? `<span class="hint">${esc(a.hint)}</span>` : ''}${a.locked ? `<span class="why">${esc(a.locked)}</span>` : ''}
            </button>`).join('')}</div>`}
        </div>
      </div>`;
    this.el.querySelector('.close-btn')!.addEventListener('click', () => this.tryClose());
    this.el.querySelectorAll<HTMLButtonElement>('[data-room]').forEach((b) => b.addEventListener('click', () => {
      sfx.click();
      this.room = Number(b.dataset.room);
      this.onRoomChange?.(v.rooms[this.room].id);
      this.render();
    }));
    this.el.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((b) => b.addEventListener('click', async () => {
      const a = room.actions[Number(b.dataset.action)];
      if (a.locked || this.busy) return;
      sfx.click();
      this.busy = true;
      try { await a.run(); } finally { this.busy = false; }
      if (this.isOpen) this.render();
    }));
    this.onRoomChange?.(room.id);
  }

  onRoomChange: ((roomId: string) => void) | null = null;

  // ---------- minigames (render inside the panel card) ----------

  private stage(): HTMLElement {
    const card = this.el.querySelector('.panel-card') ?? this.el;
    const stage = document.createElement('div');
    stage.className = 'stage';
    card.appendChild(stage);
    return stage;
  }

  /** timing bar: press when the marker is inside the green zone; returns hits */
  async timing(title: string, tries = 3, zone = 0.22, speed = 1.25): Promise<number> {
    const stage = this.stage();
    let hits = 0;
    for (let n = 1; n <= tries; n++) {
      const start = 0.15 + Math.random() * (0.7 - zone);
      const hit = await new Promise<boolean>((resolve) => {
        stage.innerHTML = `
          <div class="stage-card">
            <div class="stage-top"><b>${esc(title)}</b><span>${fill(L(UI.attempt), { n, t: tries })}</span></div>
            <p class="stage-help">${esc(L(UI.press))}</p>
            <div class="meter"><div class="zone" style="left:${start * 100}%;width:${zone * 100}%"></div><div class="marker"></div></div>
            <div class="feedback"></div>
          </div>`;
        const marker = stage.querySelector('.marker') as HTMLElement;
        const meter = stage.querySelector('.meter') as HTMLElement;
        let pos = 0, dir = 1, last = performance.now(), raf = 0, finished = false;
        const loop = (now: number) => {
          pos += dir * speed * ((now - last) / 1000); last = now;
          if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
          marker.style.left = `${pos * 100}%`;
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        const press = () => {
          if (finished) return;
          finished = true;
          cancelAnimationFrame(raf);
          this.listenKeys(null);
          resolve(pos >= start && pos <= start + zone);
        };
        meter.addEventListener('click', press);
        stage.querySelector('.stage-card')!.addEventListener('click', press);
        this.listenKeys((e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); press(); } });
      });
      if (hit) hits++;
      const fb = stage.querySelector('.feedback') as HTMLElement;
      fb.textContent = hit ? L(UI.hit) : L(UI.miss);
      fb.className = `feedback ${hit ? 'good' : 'bad'}`;
      await wait(800);
    }
    stage.remove();
    this.listenKeys((e) => { if (e.key === 'Escape' && !this.busy) this.close(); });
    return hits;
  }

  /** pick one option; resolves to its id, or null when cancelled */
  choose(title: string, options: Array<{ id: string; label: string; hint?: string }>): Promise<string | null> {
    const stage = this.stage();
    return new Promise((resolve) => {
      stage.innerHTML = `
        <div class="stage-card">
          <div class="stage-top"><b>${esc(title)}</b></div>
          <div class="choices">${options.map((o) => `<button type="button" class="action" data-id="${esc(o.id)}"><b>${esc(o.label)}</b>${o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ''}</button>`).join('')}</div>
          <button type="button" class="secondary cancel">${esc(L(UI.cancel))}</button>
        </div>`;
      const done = (v: string | null) => { stage.remove(); resolve(v); };
      stage.querySelectorAll<HTMLButtonElement>('[data-id]').forEach((b) => b.addEventListener('click', () => done(b.dataset.id!)));
      stage.querySelector('.cancel')!.addEventListener('click', () => done(null));
    });
  }

  /** pick a single number 1…max (the teacher's question in class) */
  pickNumber(title: string, prompt: string, max: number): Promise<number> {
    const stage = this.stage();
    return new Promise((resolve) => {
      stage.innerHTML = `
        <div class="stage-card">
          <div class="stage-top"><b>${esc(title)}</b></div>
          <p class="stage-body">${esc(prompt)}</p>
          <div class="guess-grid">${Array.from({ length: max }, (_, i) => `<button type="button" data-n="${i + 1}">${i + 1}</button>`).join('')}</div>
        </div>`;
      stage.querySelectorAll<HTMLButtonElement>('[data-n]').forEach((b) => b.addEventListener('click', () => { stage.remove(); resolve(Number(b.dataset.n)); }));
    });
  }

  /** guess a number 1…max with `tries` attempts and higher/lower hints; true on success */
  async guess(title: string, max: number, tries: number): Promise<boolean> {
    return (await this.guessScore(title, '', max, tries)).ok;
  }

  /** higher/lower guessing game; resolves with success and how many tries it took */
  guessScore(title: string, prompt: string, max: number, tries: number): Promise<{ ok: boolean; used: number }> {
    const stage = this.stage();
    const secret = 1 + Math.floor(Math.random() * max);
    let left = tries;
    return new Promise((resolve) => {
      const render = (hint = '') => {
        stage.innerHTML = `
          <div class="stage-card">
            <div class="stage-top"><b>${esc(title)}</b><span>${fill(L(UI.triesLeft), { n: left })}</span></div>
            ${prompt ? `<p class="stage-body">${esc(prompt)}</p>` : ''}
            <div class="guess-grid">${Array.from({ length: max }, (_, i) => `<button type="button" data-n="${i + 1}">${i + 1}</button>`).join('')}</div>
            <div class="feedback">${esc(hint)}</div>
          </div>`;
        stage.querySelectorAll<HTMLButtonElement>('[data-n]').forEach((b) => b.addEventListener('click', () => pick(Number(b.dataset.n))));
      };
      const finish = async (ok: boolean) => {
        const fb = stage.querySelector('.feedback') as HTMLElement;
        fb.textContent = ok ? L(UI.guessRight) : fill(L(UI.guessWrong), { n: secret });
        fb.className = `feedback ${ok ? 'good' : 'bad'}`;
        stage.querySelectorAll<HTMLButtonElement>('[data-n]').forEach((b) => { b.disabled = true; if (Number(b.dataset.n) === secret) b.classList.add('right'); });
        await wait(1500);
        stage.remove();
        resolve({ ok, used: tries - left + 1 });
      };
      const pick = (n: number) => {
        if (n === secret) { void finish(true); return; }
        left--;
        if (left <= 0) { void finish(false); return; }
        render(L(n < secret ? UI.higher : UI.lower));
      };
      render();
    });
  }

  /** spins through options and lands on `pick` (used for the class draw) */
  roulette(title: string, options: string[], pick: string): Promise<void> {
    const stage = this.stage();
    return new Promise((resolve) => {
      stage.innerHTML = `<div class="stage-card"><div class="stage-top"><b>${esc(title)}</b></div><div class="roulette">?</div><button type="button" class="primary hidden">${esc(L(UI.continue))}</button></div>`;
      const box = stage.querySelector('.roulette') as HTMLElement;
      const btn = stage.querySelector('button') as HTMLButtonElement;
      let i = 0, delay = 60;
      const spin = () => {
        box.textContent = options[i++ % options.length];
        delay *= 1.12;
        if (delay < 420) { setTimeout(spin, delay); return; }
        box.textContent = pick;
        box.classList.add('landed');
        btn.classList.remove('hidden');
      };
      spin();
      btn.addEventListener('click', () => { stage.remove(); resolve(); });
    });
  }

  /** a short story/info card inside the panel */
  message(title: string, body: string): Promise<void> {
    const stage = this.stage();
    return new Promise((resolve) => {
      stage.innerHTML = `<div class="stage-card"><div class="stage-top"><b>${esc(title)}</b></div><p class="stage-body">${esc(body)}</p><button type="button" class="primary">${esc(L(UI.continue))}</button></div>`;
      stage.querySelector('button')!.addEventListener('click', () => { stage.remove(); resolve(); });
    });
  }
}
