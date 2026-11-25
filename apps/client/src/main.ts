import Phaser from 'phaser';
import { CampusScene } from './scenes/CampusScene';
import './ui/popups.css';
import { getLang, setLang, t, onLangChange, type Lang } from './i18n';
import { backupSave, clearSave, hasBackup, loadSave, newSave, restoreBackup, writeSave, type SaveData } from './save';
import { runCreator } from './ui/creator';
import { sfx } from './audio';
import { askConfirm } from './ui/confirm';
import { GUARDIANS, type CharacterData } from './content/character';
import { L, type Text } from './i18n';
import { clearLinkToken, currentSession, online, pendingLinkToken, sendSignInLink, signOut, takeLinkError, verifyLinkToken, verifySignInCode } from './net/supabase';
import { flushCloudSave, loadCloudSave, saveToCloud } from './net/cloudSave';
import { clearPendingInvite, inviteInfo, pendingInvite, redeemInvite } from './net/friends';
import { withDefaults } from './game/state';
import { applyDrift, markVisit } from './game/care';
import { mountCare } from './ui/care';
import { clearUnsubscribe, pendingUnsubscribe, unsubscribeNoteEmails } from './net/notes';
import { gameStatus, joinWaitlist, mustWait, setGameOpen, type GameStatus } from './net/launch';
import { mountLobby } from './ui/lobby';
import { openWaitlist } from './ui/waitlistView';

/** who is playing online (null = offline / signed out) */
export interface NetUser { id: string; email: string }

async function startGame(save: SaveData, net: NetUser | null = null) {
  // (whatever the save's origin, bring it up to date before the scene reads it)
  save.state = withDefaults(save.state);
  // being on campus counts as looking after your character (GDD §6.2.2)
  markVisit(save.state);
  // in-world labels use the pixel font; wait (briefly) so the first labels don't render in a fallback font
  try { await Promise.race([document.fonts.load('700 16px "Pixelify Sans"'), new Promise((r) => setTimeout(r, 1500))]); } catch { /* offline: fallback font */ }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1c2e28',
    pixelArt: true,
    // a hidden tab can report 0×0, which breaks WebGL framebuffers, so fall back to a sane size
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth || 1024, height: window.innerHeight || 768 },
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [],
    callbacks: {
      postBoot: (g) => g.scene.add('campus', CampusScene, true, { save, net }),
    },
  });
  // handy for debugging in the browser console during development
  if (import.meta.env.DEV) (window as unknown as { dacka: Phaser.Game }).dacka = game;
}

async function titleScreen() {
  const session = online ? await currentSession() : null;
  const net: NetUser | null = session ? { id: session.user.id, email: session.user.email ?? '' } : null;
  // signed in: your save lives in your account (falls back to this browser's save the first time)
  const existing = (net ? await loadCloudSave(net.id) : null) ?? loadSave();
  if (existing) setLang(existing.lang);
  // before launch: everyone but owners and testers makes a character and waits in the lobby
  let status = online ? await gameStatus() : null;
  const waiting = mustWait(status);
  // the time you were away: mood, energy and health drift down gently (never below a floor)
  const persist = () => {
    if (!existing) return;
    writeSave(existing);
    if (net) { saveToCloud(net.id, existing); flushCloudSave(); }
  };
  const away = existing && !waiting ? applyDrift(existing.state) : 0;
  if (away > 0) persist();
  const el = document.createElement('div');
  el.className = 'title-screen';
  document.body.appendChild(el);
  let linkSentTo = '';
  let signInError = '';
  // (before the sign-in error check below, which tidies the whole address)
  const invite = await handleInvite(net);
  // a link that was already used (often by a mail scanner) or expired lands back here with an error
  const linkError = online && !net ? takeLinkError() : null;
  const expiredLink = () => L({ tr: 'Bu giriş bağlantısı geçersiz ya da süresi dolmuş (bazı e-posta servisleri bağlantıyı önceden açıp kullanır). Yeni bir bağlantı iste ve e-postadaki kodu gir.', en: 'That sign-in link is invalid or expired (some mail services open links before you do, which uses them up). Ask for a new one and enter the code from the email.' });
  if (linkError) signInError = expiredLink();
  // came from the sign-in email: sign in only when the player presses the button (scanners never do)
  let linkToken = online && !net ? pendingLinkToken() : null;
  // the "stop these emails" link from a note email: switched off only when the player presses the button
  let unsub = online ? pendingUnsubscribe() : null;
  let unsubDone = '';
  if (net && pendingLinkToken()) clearLinkToken();
  // signed in, character made, game not open yet: straight to the lobby
  if (waiting && net && existing && !unsub) { el.remove(); void openLobby(existing, net, status!); return; }
  let ownerError = '';

  const render = () => {
    const account = !online ? '' : net
      ? `<div class="account">✓ ${L({ tr: 'Çevrimiçi', en: 'Online' })} · <b></b> · <button type="button" data-act="signout">${L({ tr: 'Çıkış', en: 'Sign out' })}</button></div>`
      : linkToken
        ? `<form class="signin" data-link-form>
             <div class="account sent">✉️ ${L({ tr: 'E-postandaki bağlantıyla geldin. Okula girmek için butona bas.', en: 'You came from your sign-in email. Press the button to go in.' })}</div>
             <button type="submit" class="primary">${L({ tr: 'Giriş yap', en: 'Sign in' })}</button>
           </form>`
      : linkSentTo
        ? `<div class="account sent">📬 ${L({ tr: 'Giriş bağlantısı gönderildi:', en: 'Sign-in link sent to' })} <b></b>. ${L({ tr: 'E-postandaki bağlantıya tıkla ya da kodu buraya gir.', en: 'Click the link in your email, or enter its code here.' })}</div>
           <form class="signin" data-code-form>
             <label for="otp">${L({ tr: 'E-postadaki kod', en: 'Code from the email' })}</label>
             <div class="signin-row"><input id="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" required placeholder="123456"><button type="submit" class="primary">${L({ tr: 'Giriş yap', en: 'Sign in' })}</button></div>
             ${signInError ? `<div class="nav-error"></div>` : ''}
             <button type="button" class="linkish" data-act="resend">${L({ tr: 'Başka bir e-posta kullan', en: 'Use a different email' })}</button>
           </form>`
        : `<form class="signin" data-form>
             <label for="email">${L({ tr: 'Arkadaşlarınla oynamak için e-postanla giriş yap', en: 'Sign in with your email to play with friends' })}</label>
             <div class="signin-row"><input id="email" type="email" required autocomplete="email" placeholder="ornek@mail.com"><button type="submit" class="primary">${L({ tr: 'Bağlantı gönder', en: 'Send link' })}</button></div>
             ${signInError ? `<div class="nav-error"></div>` : ''}
           </form>`;
    el.innerHTML = `
      <div class="card title-card">
        <div class="tc-left">
        <h1>Daçka</h1>
        <div class="sub">${t('title_sub')}</div>
        ${invite ? `<div class="account invite ${invite.kind}"></div>` : ''}
        ${unsub ? `<div class="account sent unsub">${L({ tr: 'Bir arkadaşın not bırakınca gelen e-postaları kapatmak istiyor musun?', en: 'Stop the emails you get when a friend leaves you a note?' })}
           <div class="unsub-btns"><button type="button" data-act="unsub-yes">${L({ tr: 'E-postaları kapat', en: 'Stop the emails' })}</button> · <button type="button" data-act="unsub-no">${L({ tr: 'Vazgeç', en: 'Keep them' })}</button></div></div>`
          : unsubDone ? `<div class="account">${unsubDone}</div>` : ''}
        ${account}
        </div>
        <div class="tc-right">
        ${status?.role === 'owner' ? ownerPanel(status, ownerError) : ''}
        ${status?.role === 'tester' && !status.open ? `<div class="tester-note">🧪 ${L({ tr: 'Test oyuncususun: açılıştan önce oynayabilirsin.', en: "You're a tester: you can play before launch." })}</div>` : ''}
        ${waiting ? `<div class="soon-note">⏳ ${net
          ? L({ tr: 'Daçka çok yakında açılıyor! Karakterini şimdi yarat, bekleme listesine gir ve açılışta ilk gelenlerden ol.', en: "Daçka opens very soon! Make your character now, join the waitlist and be among the first in on opening day." })
          : L({ tr: 'Daçka çok yakında açılıyor! E-postanla giriş yap, karakterini yarat ve açılışı lobide bekle.', en: 'Daçka opens very soon! Sign in with your email, make your character and wait for launch in the lobby.' })}</div>` : ''}
        ${existing && !waiting ? '<div class="care-slot"></div>' : ''}
        <div class="stack">
          ${waiting
            ? (net ? `<button class="primary" data-act="new">${L({ tr: '✏️ Karakterini yarat', en: '✏️ Make your character' })}</button>` : '')
            : `${existing ? `<button class="primary" data-act="continue">${t('continue')}</button>` : ''}
          <button class="${existing ? 'secondary' : 'primary'}" data-act="new">${online && !net ? L({ tr: 'Tek başına oyna (yeni oyun)', en: 'Play solo (new game)' }) : t('new_game')}</button>
          ${hasBackup() ? `<button class="secondary" data-act="restore">${L({ tr: '↩ Önceki oyunu geri yükle', en: '↩ Restore previous game' })}</button>` : ''}`}
        </div>
        <div class="lang">
          <button data-lang="tr" class="${getLang() === 'tr' ? 'on' : ''}">Türkçe</button> ·
          <button data-lang="en" class="${getLang() === 'en' ? 'on' : ''}">English</button>
        </div>
        <div class="proto">${online ? L({ tr: 'Prototip · çok oyunculu deneme', en: 'Prototype · multiplayer test' }) : L({ tr: 'Prototip · tek kişilik', en: 'Prototype · single-player' })}</div>
        </div>
      </div>`;
    const b = el.querySelector('.account b');
    if (b) b.textContent = net ? net.email : linkSentTo;
    const inv = el.querySelector('.account.invite');
    if (inv && invite) inv.textContent = L(invite.text);
    const err = el.querySelector('.signin .nav-error');
    if (err) err.textContent = signInError;
    const opDate = el.querySelector('.owner-panel input') as HTMLInputElement | null;
    if (opDate && status?.opensAt) opDate.value = toLocalInput(status.opensAt);
    const careSlot = el.querySelector('.care-slot') as HTMLElement | null;
    if (careSlot && existing) mountCare(careSlot, existing, net, away, persist);
  };
  render();
  onLangChange(render);

  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    if ((e.target as HTMLElement).hasAttribute('data-link-form') && linkToken) {
      const btn = el.querySelector('[data-link-form] button') as HTMLButtonElement;
      btn.disabled = true;
      const error = await verifyLinkToken(linkToken);
      clearLinkToken();
      if (!error) { window.location.reload(); return; }
      linkToken = null;
      signInError = expiredLink();
      render();
      return;
    }
    if ((e.target as HTMLElement).hasAttribute('data-code-form')) {
      const code = (el.querySelector('#otp') as HTMLInputElement).value.replace(/\D/g, '');
      if (!code) return;
      const btn = el.querySelector('[data-code-form] button[type=submit]') as HTMLButtonElement;
      btn.disabled = true;
      const error = await verifySignInCode(linkSentTo, code);
      if (!error) { window.location.reload(); return; }
      signInError = error; btn.disabled = false;
      render();
      return;
    }
    const input = el.querySelector('#email') as HTMLInputElement;
    const email = input.value.trim();
    if (!email) return;
    const btn = el.querySelector('.signin button') as HTMLButtonElement;
    btn.disabled = true;
    const error = await sendSignInLink(email);
    if (error) { signInError = error; btn.disabled = false; } else { linkSentTo = email; signInError = ''; }
    render();
  });

  el.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const lang = target.dataset.lang as Lang | undefined;
    if (lang) { setLang(lang); return; }
    const act = target.dataset.act;
    if (act === 'signout') { await signOut(); window.location.reload(); return; }
    if (act === 'resend') { linkSentTo = ''; signInError = ''; render(); return; }
    if (act === 'unsub-yes' && unsub) {
      (target as HTMLButtonElement).disabled = true;
      const ok = await unsubscribeNoteEmails(unsub);
      unsub = null;
      clearUnsubscribe();
      unsubDone = ok
        ? L({ tr: '✓ Not e-postaları kapatıldı. İstediğin zaman buradaki ayardan yeniden açabilirsin.', en: '✓ Note emails are off. You can switch them back on here any time.' })
        : L({ tr: 'Bu bağlantı çalışmadı. Giriş yapıp aşağıdaki ayardan kapatabilirsin.', en: "That link didn't work. Sign in and switch them off with the setting below." });
      render();
      return;
    }
    if (act === 'unsub-no') { unsub = null; clearUnsubscribe(); render(); return; }
    if (act === 'op-list') { openWaitlist(); return; }
    if ((act === 'op-open' || act === 'op-close' || act === 'op-date') && status) {
      const input = el.querySelector('.owner-panel input') as HTMLInputElement | null;
      const opensAt = input?.value ? new Date(input.value).toISOString() : null;
      const opening = act === 'op-open' ? true : act === 'op-close' ? false : status.open;
      if (act === 'op-open' && !(await askConfirm(L({ tr: `Oyun herkese açılsın mı? Bekleme listesindeki ${status.total} kişi hemen girebilecek.`, en: `Open the game to everyone? The ${status.total} people on the waitlist can come in straight away.` }), L({ tr: 'Herkese aç', en: 'Open to everyone' }), L({ tr: 'Vazgeç', en: 'Cancel' })))) return;
      if (act === 'op-close' && !(await askConfirm(L({ tr: 'Oyun yeniden kapatılsın mı? Sahipler ve test oyuncuları dışında herkes lobiye döner.', en: 'Close the game again? Everyone except owners and testers goes back to the lobby.' }), L({ tr: 'Kapat', en: 'Close it' }), L({ tr: 'Vazgeç', en: 'Cancel' })))) return;
      (target as HTMLButtonElement).disabled = true;
      ownerError = (await setGameOpen(opening, opensAt)) ?? '';
      status = (await gameStatus()) ?? status;
      render();
      return;
    }
    if (act === 'new' && waiting && net) {
      if (existing && !(await askConfirm(L({ tr: 'Yeni bir karakter yaratmak istiyor musun? Şimdiki karakterinin yerini alacak.', en: 'Make a new character? It will replace the one you have now.' }), L({ tr: 'Yeni karakter', en: 'New character' }), L({ tr: 'Vazgeç', en: 'Cancel' })))) return;
      el.innerHTML = '';
      const character = await runCreator(el);
      el.remove();
      void waitWithNewCharacter(character, net);
      return;
    }
    if (act === 'continue' && existing) {
      el.remove();
      existing.lang = getLang();
      startGame(existing, net);
    } else if (act === 'restore') {
      if (restoreBackup()) window.location.reload();
    } else if (act === 'new') {
      // nothing is deleted here: the old game is only replaced (and backed up) when you walk in with the new character
      if (existing && !(await askConfirm(L({ tr: 'Yeni bir oyuna başlamak istiyor musun? Mevcut oyunun, yeni karakterinle okula girdiğinde yedeklenip değiştirilecek.', en: 'Start a new game? Your current game will be backed up and replaced when your new character walks in.' }), L({ tr: 'Yeni oyun', en: 'New game' }), L({ tr: 'Vazgeç', en: 'Cancel' })))) return;
      el.innerHTML = '';
      runCreator(el).then((character) => showArrival(el, character, net));
    }
  });
}

/** the owner's launch switch on the title screen */
function ownerPanel(s: GameStatus, error: string): string {
  return `<div class="owner-panel">
    <b>🔑 ${L({ tr: 'Oyun sahibi', en: 'Game owner' })}</b> · ${L({ tr: `bekleme listesinde ${s.total} kişi`, en: `${s.total} on the waitlist` })}
    · <button type="button" class="linkish" data-act="op-list">${L({ tr: '👥 Hepsini gör', en: '👥 See them all' })}</button>
    <div class="op-state ${s.open ? 'open' : 'closed'}">${s.open ? L({ tr: '● Oyun herkese açık', en: '● The game is open to everyone' }) : L({ tr: '● Oyun kapalı: diğerleri lobide bekliyor', en: '● The game is closed: everyone else waits in the lobby' })}</div>
    <div class="op-row">
      <input type="datetime-local" aria-label="${L({ tr: 'Açılış zamanı (lobide geri sayım)', en: 'Launch time (the lobby counts down to it)' })}" title="${L({ tr: 'Açılış zamanı (lobide geri sayım)', en: 'Launch time (the lobby counts down to it)' })}">
      <button type="button" class="secondary" data-act="op-date">${L({ tr: 'Tarihi kaydet', en: 'Save date' })}</button>
      ${s.open ? `<button type="button" class="secondary" data-act="op-close">${L({ tr: 'Kapat', en: 'Close' })}</button>` : `<button type="button" class="primary" data-act="op-open">${L({ tr: 'Herkese aç', en: 'Open to everyone' })}</button>`}
    </div>
    ${error ? `<div class="op-err">${error.replace(/[<>&]/g, '')}</div>` : ''}
  </div>`;
}

/** an ISO time as the value of a datetime-local input (local time, to the minute) */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** made a character before launch: it's saved to your account, you're on the waitlist, and into the lobby you go */
async function waitWithNewCharacter(character: CharacterData, net: NetUser) {
  const save = newSave(getLang(), character);
  backupSave();
  writeSave(save);
  saveToCloud(net.id, save);
  flushCloudSave();
  await joinWaitlist();
  const status = await gameStatus();
  // (opened meanwhile, or no longer reachable: just walk in)
  if (!status || !mustWait(status)) { startGame(save, net); return; }
  void openLobby(save, net, status);
}

async function openLobby(save: SaveData, net: NetUser, status: GameStatus) {
  // someone who made their character before the waitlist existed gets a place on it first, so the lobby shows the number
  if (!status.position) { await joinWaitlist(); status = (await gameStatus()) ?? status; }
  mountLobby(document.body, {
    save, userId: net.id, status,
    onEnter: () => { save.lang = getLang(); startGame(save, net); },
    onNewCharacter: () => {
      const el = document.createElement('div');
      el.className = 'title-screen';
      document.body.appendChild(el);
      void runCreator(el).then((character) => { el.remove(); void waitWithNewCharacter(character, net); });
    },
    onSignOut: () => { void signOut().then(() => window.location.reload()); },
  });
}

/**
 * A friend's invite link (?invite=CODE). Signed in: you become friends right away. Signed out: says who invited you
 * and keeps the code until you sign in (the page reloads after signing in, and this runs again).
 */
async function handleInvite(net: NetUser | null): Promise<{ kind: 'good' | 'sent'; text: Text } | null> {
  if (!online) return null;
  const code = pendingInvite();
  if (!code) return null;
  const who = (name: string | undefined) => ({ tr: name || 'Bir arkadaşın', en: name || 'A friend' });
  if (!net) {
    const name = await inviteInfo(code);
    if (name === undefined) return null; // couldn't check (or friends aren't set up yet): try again after signing in
    if (name === null) { clearPendingInvite(); return { kind: 'sent', text: { tr: 'Bu davet bağlantısı artık geçerli değil. Arkadaşından yenisini iste.', en: "This invite link doesn't work any more. Ask your friend for a new one." } }; }
    return { kind: 'good', text: {
      tr: `🎟 ${who(name).tr} seni Daçka'ya davet etti. Arkadaş olmak ve birlikte oynamak için e-postanla giriş yap.`,
      en: `🎟 ${who(name).en} invited you to Daçka. Sign in with your email to become friends and play together.`,
    } };
  }
  const r = await redeemInvite(code);
  if (!r) return null; // a network hiccup: the code stays for next time
  clearPendingInvite();
  const name = { tr: r.name || 'Davet eden arkadaşın', en: r.name || 'your friend' };
  switch (r.status) {
    case 'friends': return { kind: 'good', text: { tr: `🤝 ${name.tr} ile artık arkadaşsınız! Kampüste birbirinizi göreceksiniz.`, en: `🤝 You and ${name.en} are friends now! You'll see each other on campus.` } };
    case 'already': return { kind: 'good', text: { tr: `🤝 ${name.tr} ile zaten arkadaşsınız.`, en: `🤝 You and ${name.en} are already friends.` } };
    case 'self': return { kind: 'sent', text: { tr: 'Bu senin kendi davet bağlantın. Arkadaşlarına gönder!', en: 'This is your own invite link. Send it to your friends!' } };
    default: return { kind: 'sent', text: { tr: 'Bu davet bağlantısı artık geçerli değil. Arkadaşından yenisini iste.', en: "This invite link doesn't work any more. Ask your friend for a new one." } };
  }
}

function showArrival(el: HTMLElement, character: CharacterData, net: NetUser | null) {
  const guardian = L(GUARDIANS.find((g) => g.id === character.guardian)!.your);
  el.innerHTML = `
    <div class="card title-card">
      <h2 style="margin:0 0 10px">${t('arrival_title')}</h2>
      <p style="line-height:1.55;text-align:left"></p>
      <button class="primary" data-go>${t('arrival_go')}</button>
    </div>`;
  el.querySelector('p')!.textContent = t('arrival_personal', { guardian });
  el.querySelector('[data-go]')!.addEventListener('click', () => {
    el.remove();
    backupSave();
    clearSave();
    startGame(newSave(getLang(), character), net);
  });
}

// browsers only allow audio after a user gesture
// (iOS Safari only counts touchend/click as such a gesture, not pointerdown)
const kickEvents = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
const kickMusic = () => { sfx.music(); sfx.unlock(); for (const ev of kickEvents) window.removeEventListener(ev, kickMusic); };
for (const ev of kickEvents) window.addEventListener(ev, kickMusic);

void titleScreen();
