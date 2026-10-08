import Phaser from 'phaser';
import { CampusScene } from './scenes/CampusScene';
import { getLang, setLang, t, onLangChange, type Lang } from './i18n';
import { backupSave, clearSave, hasBackup, loadSave, newSave, restoreBackup, type SaveData } from './save';
import { runCreator } from './ui/creator';
import { sfx } from './audio';
import { askConfirm } from './ui/confirm';
import { GUARDIANS, keepsakeName, type CharacterData } from './content/character';
import { L } from './i18n';
import { currentSession, online, sendSignInLink, signOut } from './net/supabase';
import { loadCloudSave } from './net/cloudSave';

/** who is playing online (null = offline / signed out) */
export interface NetUser { id: string; email: string }

async function startGame(save: SaveData, net: NetUser | null = null) {
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
  const el = document.createElement('div');
  el.className = 'title-screen';
  document.body.appendChild(el);
  let linkSentTo = '';
  let signInError = '';

  const render = () => {
    const account = !online ? '' : net
      ? `<div class="account">✓ ${L({ tr: 'Çevrimiçi', en: 'Online' })} · <b></b> · <button type="button" data-act="signout">${L({ tr: 'Çıkış', en: 'Sign out' })}</button></div>`
      : linkSentTo
        ? `<div class="account sent">📬 ${L({ tr: 'Giriş bağlantısı gönderildi:', en: 'Sign-in link sent to' })} <b></b>. ${L({ tr: 'E-postandaki bağlantıya tıkla.', en: 'Click the link in your email.' })}</div>`
        : `<form class="signin" data-form>
             <label for="email">${L({ tr: 'Arkadaşlarınla oynamak için e-postanla giriş yap', en: 'Sign in with your email to play with friends' })}</label>
             <div class="signin-row"><input id="email" type="email" required autocomplete="email" placeholder="ornek@mail.com"><button type="submit" class="primary">${L({ tr: 'Bağlantı gönder', en: 'Send link' })}</button></div>
             ${signInError ? `<div class="nav-error"></div>` : ''}
           </form>`;
    el.innerHTML = `
      <div class="card title-card">
        <h1>Daçka</h1>
        <div class="sub">${t('title_sub')}</div>
        ${account}
        <div class="stack">
          ${existing ? `<button class="primary" data-act="continue">${t('continue')}</button>` : ''}
          <button class="${existing ? 'secondary' : 'primary'}" data-act="new">${online && !net ? L({ tr: 'Tek başına oyna (yeni oyun)', en: 'Play solo (new game)' }) : t('new_game')}</button>
          ${hasBackup() ? `<button class="secondary" data-act="restore">${L({ tr: '↩ Önceki oyunu geri yükle', en: '↩ Restore previous game' })}</button>` : ''}
        </div>
        <div class="lang">
          <button data-lang="tr" class="${getLang() === 'tr' ? 'on' : ''}">Türkçe</button> ·
          <button data-lang="en" class="${getLang() === 'en' ? 'on' : ''}">English</button>
        </div>
        <div class="proto">${online ? L({ tr: 'Prototip · çok oyunculu deneme', en: 'Prototype · multiplayer test' }) : L({ tr: 'Prototip · tek kişilik', en: 'Prototype · single-player' })}</div>
      </div>`;
    const b = el.querySelector('.account b');
    if (b) b.textContent = net ? net.email : linkSentTo;
    const err = el.querySelector('.signin .nav-error');
    if (err) err.textContent = signInError;
  };
  render();
  onLangChange(render);

  el.addEventListener('submit', async (e) => {
    e.preventDefault();
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

function showArrival(el: HTMLElement, character: CharacterData, net: NetUser | null) {
  const guardian = L(GUARDIANS.find((g) => g.id === character.guardian)!.your);
  el.innerHTML = `
    <div class="card title-card">
      <h2 style="margin:0 0 10px">${t('arrival_title')}</h2>
      <p style="line-height:1.55;text-align:left"></p>
      <button class="primary" data-go>${t('arrival_go')}</button>
    </div>`;
  el.querySelector('p')!.textContent = t('arrival_personal', { guardian, keepsake: keepsakeName(character.cause, character.loss) });
  el.querySelector('[data-go]')!.addEventListener('click', () => {
    el.remove();
    backupSave();
    clearSave();
    startGame(newSave(getLang(), character), net);
  });
}

// browsers only allow audio after a user gesture
const kickMusic = () => { sfx.music(); window.removeEventListener('pointerdown', kickMusic); window.removeEventListener('keydown', kickMusic); };
window.addEventListener('pointerdown', kickMusic);
window.addEventListener('keydown', kickMusic);

void titleScreen();
