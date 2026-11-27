// Things you can do with another real player: the same kinds of things as with a classmate (chat, share a simit,
// play, joke, a nickname, borrow 5 ₺), only the other side is a person who answers for themselves.
// Games are two-player for real: Yetimball and rock-paper-scissors, invited and accepted over the channel.
// (Gossip and making fun of someone are left out on purpose: with real people they'd only hurt.)
import { L, type Text } from '../i18n';
import { sfx } from '../audio';
import { askConfirm } from '../ui/confirm';
import type { ActionView } from '../ui/panel';
import type { PeerGame, PeerMsg } from '../net/multiplayer';
import { YetimballView, injectPeerGameStyles, type YbResult } from '../ui/yetimball';
import type { GameCtx } from './buildings';

const T = (tr: string, en: string) => L({ tr, en });
const INVITE_MS = 25_000;
/** games against players that pay out in a day (more are just for fun) */
const REWARDED_GAMES = 3;

export interface PeerHost {
  me: () => { id: string; name: string };
  send: (to: string, msg: PeerMsg) => void;
  ctx: () => GameCtx;
  name: (id: string) => string | undefined;
  /** a speech bubble above that player (or above you with 'me') */
  bubble: (id: string | 'me', text: string) => void;
  /** in a menu, asleep, busy… (an invitation then gets "not now") */
  busy: () => boolean;
  /** a game screen is open: the scene holds you still */
  setPlaying: (on: boolean) => void;
  openChat: () => void;
  uiHost: HTMLElement;
}

interface Session { gid: string; peer: string; game: PeerGame; host: boolean; view: { receive(n: number, v: number | string): void; abandoned(): void; close(): void } }

const JOKES: Text[] = [
  { tr: '"Temel ile Dursun kantine gitmiş…" diye başladı.', en: 'Started with "So Temel and Dursun walk into the canteen…"' },
  { tr: '"Neden matematik kitabı üzgünmüş? Çünkü çok problemi varmış!"', en: '"Why was the maths book sad? It had too many problems!"' },
  { tr: '"Yemekhanede bugün sürpriz var: yemek sıcak!"', en: '"Big surprise in the dining hall today: the food is hot!"' },
  { tr: '"Etütte uyumak yasak değil ki, horlamak yasak."', en: '"Sleeping in study isn\'t against the rules. Snoring is."' },
];
const NICKS = ['Kirpi', 'Uzay Adam', 'Profesör', 'Turbo', 'Fasulye', 'Şimşek', 'Kaptan', 'Pamuk'];
const RPS = [{ id: 'tas', icon: '✊', name: { tr: 'Taş', en: 'Rock' } }, { id: 'kagit', icon: '✋', name: { tr: 'Kâğıt', en: 'Paper' } }, { id: 'makas', icon: '✌️', name: { tr: 'Makas', en: 'Scissors' } }];
const BEATS: Record<string, string> = { tas: 'makas', kagit: 'tas', makas: 'kagit' };
const pick = <X,>(a: X[]) => a[Math.floor(Math.random() * a.length)];

export class PeerPlay {
  private session: Session | null = null;
  private pending: { gid: string; peer: string; game: PeerGame; timer: number } | null = null;

  constructor(private h: PeerHost) {}

  get playing() { return this.session !== null; }

  // ---------- the menu when you walk up to a player ----------

  actions(peerId: string): ActionView[] {
    const ctx = this.h.ctx();
    const st = ctx.st;
    const name = this.h.name(peerId) ?? '?';
    const today = (k: string) => st.daily[`p-${k}-${peerId}`] === ctx.clock.day;
    const mark = (k: string) => { st.daily[`p-${k}-${peerId}`] = ctx.clock.day; };
    const busyGame = this.pending ? T('Bir davetin cevap bekliyor.', 'An invitation of yours is waiting for an answer.') : this.session ? T('Zaten bir oyundasın.', "You're already in a game.") : undefined;
    return [
      {
        id: 'p-chat', label: T('💬 Sohbet et', '💬 Chat'), hint: T('Sohbet kutusunu açar (Enter)', 'Opens the chat box (Enter)'),
        run: () => { ctx.panel.close(); this.h.openChat(); },
      },
      {
        id: 'p-yetimball', label: T('🪢 Yetimball oyna', '🪢 Play Yetimball'), hint: T('İkiniz karşılıklı · topu kendi yönüne vurup ipi direğe sar', 'Head to head · hit the ball your way round and wind the rope round the pole'),
        locked: busyGame,
        run: () => { ctx.panel.close(); this.invite(peerId, 'yetimball'); },
      },
      {
        id: 'p-play', label: T('🎮 Birlikte oyun oyna', '🎮 Play a game together'), hint: T('Yetimball, taş-kâğıt-makas', 'Yetimball, rock-paper-scissors'),
        locked: busyGame,
        run: async () => {
          const game = await ctx.panel.choose(T('Ne oynayalım?', 'What shall we play?'), [
            { id: 'yetimball', label: T('🪢 Yetimball', '🪢 Yetimball'), hint: T('İp sarma düellosu', 'A rope-winding duel') },
            { id: 'rps', label: T('✊ Taş-kâğıt-makas', '✊ Rock-paper-scissors'), hint: T('Üç elden iki alan kazanır', 'Best of three') },
          ]);
          if (!game) return;
          ctx.panel.close();
          this.invite(peerId, game as PeerGame);
        },
      },
      {
        id: 'p-treat', label: T('🥯 Simit ikram et (5 ₺)', '🥯 Share a simit (5 ₺)'), hint: T(`${name} doyar · günde bir`, `Fills ${name} up · once a day`),
        locked: today('treat') ? T('Bugün zaten ikram ettin.', 'You already shared a treat today.') : st.money < 5 ? T('Paran yetmiyor.', "You can't afford it.") : undefined,
        run: () => {
          mark('treat');
          ctx.gain({ money: -5, mood: 3 });
          this.h.send(peerId, { kind: 'social', act: 'treat', name: this.h.me().name });
          this.h.bubble('me', '🥯');
          ctx.toast(T(`${name}'a simit ikram ettin.`, `You shared a simit with ${name}.`), 'good');
        },
      },
      {
        id: 'p-joke', label: T('😂 Şaka yap', '😂 Tell a joke'), hint: T('İkinizin de keyfi yerine gelir · günde bir', 'Cheers you both up · once a day'),
        locked: today('joke') ? T('Bugün zaten şaka yaptın.', 'You already told a joke today.') : undefined,
        run: () => {
          mark('joke');
          const joke = pick(JOKES);
          ctx.gain({ mood: 3, attrs: { social: 1 } });
          this.h.send(peerId, { kind: 'social', act: 'joke', name: this.h.me().name, text: L(joke) });
          this.h.bubble('me', L(joke));
        },
      },
      {
        id: 'p-nick', label: T('🏷️ Lakap tak', '🏷️ Give them a nickname'), hint: T('Beğenip beğenmeyeceğini sohbette söyler · günde bir', "They'll tell you in chat whether they like it · once a day"),
        locked: today('nick') ? T('Bugün zaten lakap taktın.', 'You already gave a nickname today.') : undefined,
        run: async () => {
          const nick = await ctx.panel.choose(T('Hangi lakap?', 'Which nickname?'), pick([NICKS.slice(0, 4), NICKS.slice(4)]).map((n) => ({ id: n, label: `"${n}"` })));
          if (!nick) return;
          mark('nick');
          this.h.send(peerId, { kind: 'social', act: 'nick', name: this.h.me().name, text: nick });
          this.h.bubble('me', `"${nick}"!`);
          ctx.panel.close();
        },
      },
      {
        id: 'p-borrow', label: T('💰 5 ₺ borç iste', '💰 Ask to borrow 5 ₺'), hint: T(`${name} karar verir`, `${name} decides`),
        locked: today('borrow') ? T('Bugün zaten istedin.', 'You already asked today.') : undefined,
        run: () => {
          mark('borrow');
          this.h.send(peerId, { kind: 'borrow', name: this.h.me().name });
          ctx.toast(T(`${name}'dan 5 ₺ istedin. Cevabını bekle…`, `You asked ${name} for 5 ₺. Wait for the answer…`));
          ctx.panel.close();
        },
      },
      {
        id: 'p-react', label: T('😊 Tepki gönder', '😊 Send a reaction'), hint: '👋 😂 ❤️ ⚽ 🤝',
        run: async () => {
          const e = await ctx.panel.choose(T('Tepki', 'Reaction'), ['👋', '😂', '❤️', '⚽', '🤝'].map((x) => ({ id: x, label: x })));
          if (!e) return;
          this.emote(e);
          ctx.panel.close();
        },
      },
    ];
  }

  /** set by the scene: send an emote the usual way */
  emote: (e: string) => void = () => {};

  // ---------- invitations ----------

  private invite(peer: string, game: PeerGame) {
    if (this.pending || this.session) return;
    const gid = Math.random().toString(36).slice(2, 10);
    const name = this.h.name(peer) ?? '?';
    this.pending = { gid, peer, game, timer: window.setTimeout(() => this.expire(gid), INVITE_MS) };
    this.h.send(peer, { kind: 'invite', gid, game, name: this.h.me().name });
    this.h.ctx().toast(T(`${name} davet edildi: ${gameName(game)}. Cevabını bekliyorsun…`, `Invited ${name} to ${gameName(game)}. Waiting for an answer…`));
  }

  private expire(gid: string) {
    if (this.pending?.gid !== gid) return;
    const p = this.pending;
    this.pending = null;
    this.h.send(p.peer, { kind: 'cancel', gid });
    this.h.ctx().toast(T(`${this.h.name(p.peer) ?? '?'} cevap vermedi.`, `${this.h.name(p.peer) ?? '?'} didn't answer.`));
  }

  // ---------- messages from other players ----------

  async onMessage(from: string, m: PeerMsg) {
    const ctx = this.h.ctx();
    const who = this.h.name(from) ?? ('name' in m ? m.name : '?');
    switch (m.kind) {
      case 'social':
        if (m.act === 'treat') { ctx.gain({ hunger: 15, mood: 4 }); ctx.toast(T(`🥯 ${who} sana simit ikram etti!`, `🥯 ${who} shared a simit with you!`), 'good'); this.h.bubble(from, '🥯'); }
        if (m.act === 'joke' && m.text) { ctx.gain({ mood: 3 }); this.h.bubble(from, m.text); ctx.toast(`😂 ${who}: ${m.text}`); }
        if (m.act === 'nick' && m.text) { this.h.bubble(from, `"${m.text}"!`); ctx.toast(T(`🏷️ ${who} sana "${m.text}" lakabını taktı. Beğendin mi? Söyle ona (Enter).`, `🏷️ ${who} calls you "${m.text}" now. Like it? Tell them (Enter).`)); }
        return;
      case 'borrow': {
        if (this.h.busy() || this.session) { this.h.send(from, { kind: 'lend', ok: false, name: this.h.me().name }); return; }
        const ok = ctx.st.money >= 5 && await askConfirm(T(`${who} senden 5 ₺ borç istiyor. (Sende ${ctx.st.money} ₺ var.)`, `${who} asks to borrow 5 ₺. (You have ${ctx.st.money} ₺.)`), T('Ver', 'Lend it'), T('Vermem', 'No'));
        if (ok) { ctx.gain({ money: -5, mood: 2 }); ctx.toast(T(`${who}'a 5 ₺ verdin.`, `You lent ${who} 5 ₺.`), 'good'); }
        this.h.send(from, { kind: 'lend', ok, name: this.h.me().name });
        return;
      }
      case 'lend':
        if (m.ok) { ctx.gain({ money: 5 }); ctx.toast(T(`💰 ${who} sana 5 ₺ verdi.`, `💰 ${who} lent you 5 ₺.`), 'good'); }
        else ctx.toast(T(`${who} şimdi veremiyor.`, `${who} can't lend it right now.`));
        return;
      case 'invite': {
        if (this.session || this.pending || this.h.busy()) { this.h.send(from, { kind: 'reply', gid: m.gid, ok: false, busy: true }); return; }
        sfx.friend();
        const ok = await askConfirm(T(`${who} seni ${gameName(m.game)} oynamaya çağırıyor!`, `${who} wants to play ${gameName(m.game)} with you!`), T('Oyna', 'Play'), T('Şimdi değil', 'Not now'));
        // (they may have given up waiting meanwhile: then their side answers with "cancel")
        this.h.send(from, { kind: 'reply', gid: m.gid, ok });
        if (ok) this.start(m.gid, from, m.game, false);
        return;
      }
      case 'reply': {
        const p = this.pending;
        if (!p || p.gid !== m.gid || p.peer !== from) { if (m.ok) this.h.send(from, { kind: 'cancel', gid: m.gid }); return; }
        window.clearTimeout(p.timer);
        this.pending = null;
        if (m.ok) this.start(p.gid, from, p.game, true);
        else ctx.toast(m.busy ? T(`${who} şu an meşgul.`, `${who} is busy right now.`) : T(`${who} şimdi oynamak istemiyor.`, `${who} doesn't want to play right now.`));
        return;
      }
      case 'cancel':
        if (this.session?.gid === m.gid) this.session.view.abandoned();
        return;
      case 'move':
        if (this.session?.gid === m.gid && this.session.peer === from) this.session.view.receive(m.n, m.v);
        return;
    }
  }

  /** that player went offline */
  peerLeft(id: string) {
    if (this.pending?.peer === id) { window.clearTimeout(this.pending.timer); this.pending = null; }
    if (this.session?.peer === id) this.session.view.abandoned();
  }

  // ---------- playing ----------

  private start(gid: string, peer: string, game: PeerGame, host: boolean) {
    const me = this.h.me().name, them = this.h.name(peer) ?? '?';
    const send = (n: number, v: number | string) => this.h.send(peer, { kind: 'move', gid, n, v });
    const quit = () => this.h.send(peer, { kind: 'cancel', gid });
    const done = (won: boolean | null) => this.reward(game, won, them);
    this.h.setPlaying(true);
    const view = game === 'yetimball'
      ? new YetimballView(this.h.uiHost, { me, them, host, send: (n, q) => send(n, q), quit, onEnd: (r: YbResult) => done(r === 'win' ? true : r === 'lose' ? false : null) })
      : new RpsDuel(this.h.uiHost, { me, them, send, quit, onEnd: done });
    // the view removes itself when closed; the scene lets you move again then
    const close = view.close.bind(view);
    view.close = () => { close(); if (this.session?.gid === gid) this.session = null; this.h.setPlaying(false); };
    const receive = (n: number, v: number | string) => {
      if (view instanceof YetimballView) view.receive(n, v);
      else if (typeof v === 'string') view.receive(n, v);
    };
    this.session = { gid, peer, game, host, view: { receive, abandoned: () => view.abandoned(), close: () => view.close() } };
  }

  /** won (true), lost (false) or didn't finish (null) */
  private reward(game: PeerGame, won: boolean | null, them: string) {
    if (won === null) return;
    const ctx = this.h.ctx();
    const st = ctx.st;
    // (daily keys hold the day they were last done: one key per rewarded game)
    let n = 0;
    while (n < REWARDED_GAMES && st.daily[`p-game${n + 1}`] === ctx.clock.day) n++;
    const paid = n < REWARDED_GAMES;
    if (paid) st.daily[`p-game${n + 1}`] = ctx.clock.day;
    const fit = game === 'yetimball' ? 1 : 0;
    if (won) { if (paid) ctx.gain({ mood: 10, xp: 20, attrs: { fitness: fit, social: 1 } }); else ctx.gain({ mood: 4 }); }
    else if (paid) ctx.gain({ mood: 3, xp: 8, attrs: { fitness: fit } });
    if (!paid) ctx.toast(T(`Bugün ${them} ile çok oynadın: artık sadece eğlencesine.`, `You've played a lot today: from now on it's just for fun.`));
  }
}

function gameName(g: PeerGame): string {
  return g === 'yetimball' ? 'Yetimball' : T('taş-kâğıt-makas', 'rock-paper-scissors');
}

/** rock-paper-scissors against a real player: both pick, then both see; best of three */
class RpsDuel {
  private el: HTMLElement;
  private round = 0;
  private mine = new Map<number, string>();
  private theirs = new Map<number, string>();
  private score: [number, number] = [0, 0];
  private ended = false;
  private waitTimer = 0;

  constructor(host: HTMLElement, private o: { me: string; them: string; send: (n: number, v: string) => void; quit: () => void; onEnd: (won: boolean | null) => void }) {
    injectPeerGameStyles();
    this.el = document.createElement('div');
    this.el.className = 'pg-overlay';
    this.el.innerHTML = `<div class="pg-card"><div class="yb-head"><b>✊ ${T('Taş-kâğıt-makas', 'Rock-paper-scissors')}</b><span class="yb-vs"></span></div>
      <div class="pg-score"></div><div class="pg-picks">${RPS.map((r) => `<button type="button" class="secondary" data-pick="${r.id}" title="${L(r.name)}">${r.icon}</button>`).join('')}</div>
      <div class="pg-status"></div><div class="pg-row"><button type="button" class="secondary pg-quit"></button></div></div>`;
    this.el.querySelector('.yb-vs')!.textContent = `${o.me} · ${o.them}`;
    (this.el.querySelector('.pg-quit') as HTMLElement).textContent = T('Oyundan çık', 'Leave the game');
    this.el.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => b.addEventListener('click', () => this.choose(b.dataset.pick!)));
    this.el.querySelector('.pg-quit')!.addEventListener('click', () => { if (!this.ended) { this.o.quit(); this.finish(null); } this.close(); });
    host.appendChild(this.el);
    this.render(T('Seçimini yap! Rakibin seçimini sen seçince görürsün.', "Make your pick! You'll see theirs once you've picked."));
  }

  private render(status: string) {
    (this.el.querySelector('.pg-score') as HTMLElement).textContent = `${this.o.me} ${this.score[0]} – ${this.score[1]} ${this.o.them}`;
    (this.el.querySelector('.pg-status') as HTMLElement).textContent = status;
    const locked = this.ended || this.mine.has(this.round);
    this.el.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => { b.disabled = locked; });
  }

  private choose(id: string) {
    if (this.ended || this.mine.has(this.round)) return;
    this.mine.set(this.round, id);
    this.o.send(this.round, id);
    sfx.click();
    window.clearTimeout(this.waitTimer);
    this.waitTimer = window.setTimeout(() => { if (!this.ended && !this.theirs.has(this.round)) { this.render(T(`${this.o.them} ile bağlantı koptu.`, `Lost the connection to ${this.o.them}.`)); this.finish(null); } }, 30_000);
    this.settle();
  }

  receive(n: number, v: string) {
    if (this.ended || !RPS.some((r) => r.id === v) || this.theirs.has(n)) return;
    this.theirs.set(n, v);
    if (n === this.round) this.settle();
  }

  private settle() {
    const a = this.mine.get(this.round), b = this.theirs.get(this.round);
    if (!a) { this.render(T(`${this.o.them} seçti. Sıra sende!`, `${this.o.them} has picked. Your turn!`)); return; }
    if (!b) { this.render(T(`${this.o.them} bekleniyor…`, `Waiting for ${this.o.them}…`)); return; }
    window.clearTimeout(this.waitTimer);
    const ra = RPS.find((r) => r.id === a)!, rb = RPS.find((r) => r.id === b)!;
    let line = `${ra.icon} ${L(ra.name)} – ${rb.icon} ${L(rb.name)}: `;
    if (a === b) line += T('berabere!', 'a draw!');
    else if (BEATS[a] === b) { this.score[0]++; line += T('bu el senin!', 'this round is yours!'); }
    else { this.score[1]++; line += T(`bu el ${this.o.them}'ın.`, `this round goes to ${this.o.them}.`); }
    this.round++;
    if (this.score[0] === 2 || this.score[1] === 2) {
      const won = this.score[0] === 2;
      if (won) sfx.success();
      this.render(`${line} ${won ? T('🏆 Kazandın!', '🏆 You win!') : T(`${this.o.them} kazandı.`, `${this.o.them} wins.`)}`);
      this.finish(won);
      return;
    }
    this.render(`${line} ${T('Sıradaki el!', 'Next round!')}`);
    if (this.theirs.has(this.round)) this.settle();
  }

  abandoned() {
    if (this.ended) return;
    // walking out while losing doesn't save you: whoever was ahead gets the win
    if (this.score[0] > this.score[1]) {
      this.render(T(`🏆 ${this.o.them} sen öndeyken oyundan çıktı: kazandın!`, `🏆 ${this.o.them} left while you were ahead: you win!`));
      this.finish(true);
      return;
    }
    this.render(T(`${this.o.them} oyundan çıktı.`, `${this.o.them} left the game.`));
    this.finish(null);
  }

  private finish(won: boolean | null) {
    if (this.ended) return;
    this.ended = true;
    window.clearTimeout(this.waitTimer);
    (this.el.querySelector('.pg-quit') as HTMLElement).textContent = T('Kapat', 'Close');
    this.el.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => { b.disabled = true; });
    this.o.onEnd(won);
  }

  close() { window.clearTimeout(this.waitTimer); this.el.remove(); }
}
