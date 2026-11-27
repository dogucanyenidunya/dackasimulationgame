// Rock-paper-scissors the way it's played in the corridor: both shake a fist to the chant "Taş… Kâğıt… Makas!" and
// show their hands together on the last word. Pick during the chant (1/2/3 or the buttons; your last pick counts);
// no pick by the time the hands come down and you lose that round. Draws are thrown again; first to two rounds wins.
// Against a classmate, they play like people do: a favourite throw, keep a winning throw, switch after a loss.
// Against a real player, the one who invited starts each round; both send their throw as the hands come down and see
// the other's as soon as it arrives.
import { L } from '../i18n';
import { sfx } from '../audio';
import { injectPeerGameStyles } from './yetimball';

export type RpsMove = 'tas' | 'kagit' | 'makas';
const MOVES: Array<{ id: RpsMove; icon: string; name: { tr: string; en: string }; key: string }> = [
  { id: 'tas', icon: '✊', name: { tr: 'Taş', en: 'Rock' }, key: '1' },
  { id: 'kagit', icon: '✋', name: { tr: 'Kâğıt', en: 'Paper' }, key: '2' },
  { id: 'makas', icon: '✌️', name: { tr: 'Makas', en: 'Scissors' }, key: '3' },
];
const BEATS: Record<RpsMove, RpsMove> = { tas: 'makas', kagit: 'tas', makas: 'kagit' };
const BEAT_MS = 560;
const CHANT = [{ tr: 'Taş…', en: 'Rock…' }, { tr: 'Kâğıt…', en: 'Paper…' }, { tr: 'Makas!', en: 'Scissors!' }];
/** rounds to win */
const WIN = 2;
const LOST_MS = 20_000;

export interface RpsOpts {
  me: string;
  them: string;
  /** online: who invited starts the rounds; against a classmate, leave out `send` */
  host: boolean;
  send?: (n: number, v: string) => void;
  quit: () => void;
  /** true = won, false = lost, null = it didn't finish */
  onEnd: (won: boolean | null) => void;
  /** a classmate: a seed for their habits */
  bot?: string;
}

export class RpsView {
  readonly el: HTMLElement;
  private round = 0;
  private score: [number, number] = [0, 0];
  private pick: RpsMove | null = null;
  private sent = new Set<number>();
  private theirs = new Map<number, RpsMove | '-'>();
  private mineAt = new Map<number, RpsMove | '-'>();
  private phase: 'wait' | 'chant' | 'reveal' | 'over' = 'wait';
  private chantAt = 0;
  private n = 0;
  private lastHeard = performance.now();
  private ended = false;
  private raf = 0;
  private timers: number[] = [];
  /** the classmate's habits */
  private fav: RpsMove = 'tas';
  private history: Array<{ mine: RpsMove | '-'; theirs: RpsMove | '-' }> = [];
  private onKey = (e: KeyboardEvent) => {
    const m = MOVES.find((x) => x.key === e.key);
    if (m) { e.preventDefault(); e.stopPropagation(); this.choose(m.id); }
    else if (e.key === 'Enter' && this.ended) { e.preventDefault(); this.close(); }
  };

  constructor(host: HTMLElement, private o: RpsOpts) {
    injectPeerGameStyles();
    injectStyles();
    if (o.bot) { let h = 0; for (const ch of o.bot) h = (h * 31 + ch.charCodeAt(0)) >>> 0; this.fav = MOVES[h % 3].id; }
    this.el = document.createElement('div');
    this.el.className = 'pg-overlay';
    this.el.innerHTML = `
      <div class="pg-card rps-card">
        <div class="yb-head"><b>✊ ${L({ tr: 'Taş-kâğıt-makas', en: 'Rock-paper-scissors' })}</b><span class="yb-vs"></span></div>
        <div class="pg-score rps-score"></div>
        <div class="rps-stage">
          <div class="rps-side them"><div class="rps-name"></div><div class="rps-hand them">✊</div></div>
          <div class="rps-call"></div>
          <div class="rps-side me"><div class="rps-hand me">✊</div><div class="rps-name"></div></div>
        </div>
        <div class="pg-picks">${MOVES.map((m) => `<button type="button" class="secondary" data-pick="${m.id}"><span>${m.icon}</span><small>${m.key} · ${L(m.name)}</small></button>`).join('')}</div>
        <div class="pg-status rps-status"></div>
        <div class="pg-row"><button type="button" class="secondary pg-quit"></button><button type="button" class="primary rps-go hidden"></button></div>
      </div>`;
    this.el.querySelector('.yb-vs')!.textContent = `${o.me} · ${o.them}`;
    (this.el.querySelector('.rps-side.them .rps-name') as HTMLElement).textContent = o.them;
    (this.el.querySelector('.rps-side.me .rps-name') as HTMLElement).textContent = o.me;
    (this.el.querySelector('.pg-quit') as HTMLElement).textContent = L({ tr: 'Oyundan çık', en: 'Leave the game' });
    this.el.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.choose(b.dataset.pick as RpsMove); }));
    this.el.querySelector('.pg-quit')!.addEventListener('click', () => { if (!this.ended) { this.o.quit(); this.finish(null); } this.close(); });
    window.addEventListener('keydown', this.onKey, true);
    host.appendChild(this.el);
    this.renderScore();
    this.status(o.host || o.bot ? L({ tr: 'Hazır mısın? Elini salla, son sözde (Makas!) eller açılır. 1/2/3 ile seç.', en: 'Ready? Shake your fist; the hands come out on the last word (Scissors!). Pick with 1/2/3.' })
      : L({ tr: `${o.them} başlatıyor… Son sözde (Makas!) eller açılır. 1/2/3 ile seç.`, en: `${o.them} is starting… The hands come out on the last word. Pick with 1/2/3.` }));
    if (o.host || o.bot) this.later(1400, () => this.startRound(0));
    const loop = () => { this.tick(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    if (import.meta.env.DEV) (window as unknown as { dackaRps: RpsView }).dackaRps = this;
  }

  private later(ms: number, f: () => void) { this.timers.push(window.setTimeout(f, ms)); }
  private status(t: string) { (this.el.querySelector('.rps-status') as HTMLElement).textContent = t; }
  private renderScore() { (this.el.querySelector('.rps-score') as HTMLElement).textContent = `${this.o.me} ${this.score[0]} – ${this.score[1]} ${this.o.them}`; }
  private hand(who: 'me' | 'them') { return this.el.querySelector(`.rps-hand.${who}`) as HTMLElement; }

  // ---------- a round ----------

  private startRound(r: number) {
    if (this.ended || r < this.round || (this.phase === 'chant' && r === this.round)) return;
    this.round = r;
    this.pick = null;
    this.phase = 'chant';
    this.chantAt = performance.now();
    if (this.o.host && this.o.send) this.o.send(this.n++, `r ${r}`);
    for (const h of ['me', 'them'] as const) { this.hand(h).textContent = '✊'; this.hand(h).classList.remove('won', 'lost'); }
    this.el.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => { b.disabled = false; b.classList.remove('on'); });
    this.status(L({ tr: 'Seç: 1 Taş · 2 Kâğıt · 3 Makas', en: 'Pick: 1 Rock · 2 Paper · 3 Scissors' }));
  }

  private choose(id: RpsMove) {
    if (this.ended || this.phase !== 'chant') return;
    this.pick = id;
    sfx.click();
    this.el.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => b.classList.toggle('on', b.dataset.pick === id));
  }

  private tick() {
    if (this.ended) return;
    const now = performance.now();
    if (this.phase === 'chant') {
      const t = now - this.chantAt, beat = Math.floor(t / BEAT_MS);
      const call = this.el.querySelector('.rps-call') as HTMLElement;
      if (beat < 3) {
        call.textContent = L(CHANT[beat]);
        // the fists bob down on every beat
        const k = (t % BEAT_MS) / BEAT_MS, y = Math.sin(k * Math.PI) * -26;
        this.hand('me').style.transform = `translateY(${y}px)`;
        this.hand('them').style.transform = `rotate(180deg) translateY(${y}px)`;
      } else this.throwNow();
    }
    if (this.o.send && !this.ended && (this.phase === 'wait' || this.phase === 'reveal') && now - this.lastHeard > LOST_MS) {
      this.status(L({ tr: `${this.o.them} ile bağlantı koptu.`, en: `Lost the connection to ${this.o.them}.` }));
      this.finish(null);
    }
  }

  /** the hands come down: yours is what you picked (or nothing, if you didn't) */
  private throwNow() {
    this.phase = 'reveal';
    const r = this.round;
    const mine: RpsMove | '-' = this.pick ?? '-';
    this.mineAt.set(r, mine);
    this.el.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => { b.disabled = true; });
    this.hand('me').style.transform = ''; this.hand('them').style.transform = 'rotate(180deg)';
    this.hand('me').textContent = mine === '-' ? '🤷' : MOVES.find((m) => m.id === mine)!.icon;
    (this.el.querySelector('.rps-call') as HTMLElement).textContent = '';
    if (this.o.send) { if (!this.sent.has(r)) { this.sent.add(r); this.o.send(this.n++, `p ${r} ${mine}`); } this.lastHeard = Math.max(this.lastHeard, performance.now()); }
    else this.theirs.set(r, this.botThrow());
    this.settle();
  }

  /** a classmate's throw: mostly their habits, sometimes anything */
  private botThrow(): RpsMove {
    const last = this.history[this.history.length - 1];
    const rnd = () => MOVES[Math.floor(Math.random() * 3)].id;
    if (!last || last.theirs === '-') return Math.random() < 0.45 ? this.fav : rnd();
    const lt = last.theirs;
    const wonLast = last.mine === '-' || BEATS[lt] === last.mine;
    const lostLast = last.mine !== '-' && BEATS[last.mine] === lt;
    if (Math.random() < 0.35) return rnd();
    if (wonLast) return lt; // keep a winning throw
    if (lostLast) return MOVES.find((m) => BEATS[m.id] === last.mine)!.id; // switch to what would have beaten you
    return Math.random() < 0.5 ? this.fav : rnd();
  }

  private settle() {
    const r = this.round;
    const a = this.mineAt.get(r), b = this.theirs.get(r);
    if (this.phase !== 'reveal' || a === undefined) return;
    if (b === undefined) { this.status(L({ tr: `${this.o.them} bekleniyor…`, en: `Waiting for ${this.o.them}…` })); return; }
    this.phase = 'wait';
    this.history.push({ mine: a, theirs: b });
    const th = this.hand('them');
    th.textContent = b === '-' ? '🤷' : MOVES.find((m) => m.id === b)!.icon;
    const name = (m: RpsMove | '-') => (m === '-' ? L({ tr: 'hiçbir şey', en: 'nothing' }) : L(MOVES.find((x) => x.id === m)!.name));
    let line = `${name(a)} – ${name(b)}: `;
    let winner: 0 | 1 | null;
    if (a === '-' && b === '-') { winner = null; line = L({ tr: 'İkiniz de geç kaldınız! Bir daha.', en: 'You were both too late! Again.' }); }
    else if (a === '-') { winner = 1; line = L({ tr: 'Geç kaldın! Bu el gitti.', en: 'Too late! That round is gone.' }); }
    else if (b === '-') { winner = 0; line = L({ tr: `${this.o.them} geç kaldı: bu el senin!`, en: `${this.o.them} was too late: this round is yours!` }); }
    else if (a === b) { winner = null; line += L({ tr: 'berabere, bir daha!', en: 'a draw, again!' }); }
    else if (BEATS[a] === b) { winner = 0; line += L({ tr: 'bu el senin!', en: 'this round is yours!' }); }
    else { winner = 1; line += L({ tr: `bu el ${this.o.them}'ın.`, en: `this round goes to ${this.o.them}.` }); }
    if (winner !== null) {
      this.score[winner]++;
      this.hand(winner === 0 ? 'me' : 'them').classList.add('won');
      this.hand(winner === 0 ? 'them' : 'me').classList.add('lost');
      if (winner === 0) sfx.hop(); else sfx.bump();
    }
    this.renderScore();
    if (this.score[0] >= WIN || this.score[1] >= WIN) {
      const won = this.score[0] >= WIN;
      if (won) sfx.success();
      this.status(`${line} ${won ? L({ tr: '🏆 Kazandın!', en: '🏆 You win!' }) : L({ tr: `${this.o.them} kazandı.`, en: `${this.o.them} wins.` })}`);
      this.finish(won);
      return;
    }
    this.status(`${line} ${L({ tr: 'Sıradaki el geliyor…', en: 'Next round coming…' })}`);
    if (this.o.host || this.o.bot) this.later(1700, () => this.startRound(r + 1));
  }

  // ---------- the other player ----------

  receive(_n: number, v: number | string) {
    if (this.ended || typeof v !== 'string') return;
    this.lastHeard = performance.now();
    const [k, rs, m] = v.split(' ');
    const r = Number(rs);
    if (k === 'r' && !this.o.host) this.startRound(r);
    else if (k === 'p' && (m === '-' || MOVES.some((x) => x.id === m)) && !this.theirs.has(r)) {
      this.theirs.set(r, m as RpsMove | '-');
      if (r === this.round) this.settle();
    }
  }

  abandoned() {
    if (this.ended) return;
    // walking out while losing doesn't save you: whoever was ahead gets the win
    if (this.score[0] > this.score[1]) {
      this.status(L({ tr: `🏆 ${this.o.them} sen öndeyken oyundan çıktı: kazandın!`, en: `🏆 ${this.o.them} left while you were ahead: you win!` }));
      this.finish(true);
      return;
    }
    this.status(L({ tr: `${this.o.them} oyundan çıktı.`, en: `${this.o.them} left the game.` }));
    this.finish(null);
  }

  private finish(won: boolean | null) {
    if (this.ended) return;
    this.ended = true;
    this.phase = 'over';
    this.el.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => { b.disabled = true; });
    const q = this.el.querySelector('.pg-quit') as HTMLElement;
    q.textContent = L({ tr: 'Kapat (Enter)', en: 'Close (Enter)' });
    q.className = 'primary pg-quit';
    this.o.onEnd(won);
  }

  close() {
    cancelAnimationFrame(this.raf);
    for (const t of this.timers) window.clearTimeout(t);
    window.removeEventListener('keydown', this.onKey, true);
    this.el.remove();
  }
}

let styled = false;
function injectStyles() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
.rps-card { width: min(460px, 100%); }
.rps-stage { position: relative; background: radial-gradient(circle at 50% 50%, #3a4a52, #232c31); border-radius: 10px; padding: 10px 0; margin: 6px 0 4px; user-select: none; }
.rps-side { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.rps-name { font-size: 13px; opacity: 0.8; }
.rps-hand { font-size: 74px; line-height: 1.1; transition: filter 0.2s; }
.rps-hand.them { transform: rotate(180deg); }
.rps-hand.won { filter: drop-shadow(0 0 14px #f2c14e); }
.rps-hand.lost { filter: grayscale(0.7) brightness(0.7); }
.rps-call { text-align: center; font-size: 30px; font-weight: 800; letter-spacing: 0.04em; min-height: 40px; color: #fff6c8; }
.rps-card .pg-picks button { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 92px; }
.rps-card .pg-picks button small { font-size: 11px; opacity: 0.8; }
.rps-card .pg-picks button.on { outline: 3px solid #f2c14e; }
`;
  document.head.appendChild(s);
}
