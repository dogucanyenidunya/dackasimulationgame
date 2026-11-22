// Character creator (GDD §5): look → about you → your story → summary.
import { paintCharacter, type CharacterLook, type HairStyle } from '../art/textures';
import {
  ATTRS, BOARDING_OPTIONS, CAUSES, EYE_COLORS, GUARDIANS, HAIR_COLORS, HAIR_STYLES, LOSSES, MIX_STEP, MIX_TOTAL, PROVINCES, SKIN_TONES, TRAITS, UNIFORM,
  defaultGuardian, startingAttributes, guardianOptions, mainTrait, mixLabel, mixLean,
  type Boarding, type CauseId, type CharacterData, type Gender, type GuardianId, type Loss, type TraitId, type TraitMix,
} from '../content/character';
import { leanings } from '../game/dilemmas';
import { L, getLang, onLangChange, type Text } from '../i18n';

const S = {
  steps: [
    { tr: 'Görünüm', en: 'Look' }, { tr: 'Sen', en: 'You' }, { tr: 'Hikâyen', en: 'Your story' }, { tr: 'Özet', en: 'Summary' },
  ] as Text[],
  gender: { tr: 'Cinsiyet', en: 'Gender' },
  girl: { tr: 'Kız', en: 'Girl' },
  boy: { tr: 'Erkek', en: 'Boy' },
  skin: { tr: 'Ten rengi', en: 'Skin tone' },
  hairStyle: { tr: 'Saç modeli', en: 'Hair style' },
  hairColor: { tr: 'Saç rengi', en: 'Hair color' },
  uniform: { tr: 'Üniforma', en: 'Uniform' },
  trousers: { tr: 'Pantolon', en: 'Trousers' },
  skirt: { tr: 'Etek', en: 'Skirt' },
  glasses: { tr: 'Gözlük', en: 'Glasses' },
  eyes: { tr: 'Göz rengi', en: 'Eye color' },
  freckles: { tr: 'Çil', en: 'Freckles' },
  yes: { tr: 'Var', en: 'Yes' },
  no: { tr: 'Yok', en: 'No' },
  first: { tr: 'Adın', en: 'First name' },
  last: { tr: 'Soyadın', en: 'Last name' },
  hometown: { tr: 'Memleketin', en: 'Hometown' },
  trait: { tr: 'Kişiliğin', en: 'Personality' },
  storyIntro: {
    tr: 'Daçka\'daki her öğrenci bir ebeveynini kaybetmiştir. Hikâyeni sen anlat. Burada doğru ya da yanlış cevap yok.',
    en: 'Every student at Daçka has lost a parent. Tell your story your way. There are no right or wrong answers here.',
  },
  whoLost: { tr: 'Kimi kaybettin?', en: 'Who did you lose?' },
  guardian: { tr: 'Seni kim büyütüyor ve ziyaret ediyor?', en: 'Who raises you and visits you?' },
  how: { tr: 'Nasıl oldu?', en: 'How did it happen?' },
  attributes: { tr: 'Özellikler', en: 'Attributes' },
  respect: { tr: 'Saygınlık', en: 'Respect' },
  family: { tr: 'Ailen', en: 'Family' },
  lost: { tr: 'Kaybettiğin', en: 'You lost' },
  back: { tr: 'Geri', en: 'Back' },
  next: { tr: 'İleri', en: 'Next' },
  start: { tr: 'Daçka\'ya git', en: 'Go to Daçka' },
  randomize: { tr: 'Rastgele', en: 'Random' },
  nameError: { tr: 'Lütfen adını ve soyadını yaz.', en: 'Please enter your first and last name.' },
  storyError: { tr: 'Lütfen "Nasıl oldu?" sorusuna bir cevap seç.', en: 'Please choose an answer for "How did it happen?".' },
  traitError: { tr: 'Kişiliğine {n} puan daha dağıt (toplam 100).', en: 'Share out {n} more points across your personality (100 in all).' },
  mixIntro: { tr: '100 puanı özellikler arasında paylaştır. Hepsini tek bir özelliğe de verebilirsin.', en: 'Share 100 points across these traits. You can also give them all to one.' },
  mixLeft: { tr: 'Kalan', en: 'Left' },
  mixLean: { tr: 'Başlangıçta', en: 'You start out' },
  mixLeanNone: { tr: 'Henüz bir eğilimin yok', en: 'No leaning yet' },
  age: { tr: '9 yaşında · 4. sınıf', en: 'Age 9 · Grade 4' },
};

interface Draft {
  first: string; last: string; gender: Gender;
  look: CharacterLook; hometown: string; mix: TraitMix;
  loss: Loss; guardian: GuardianId; cause: CauseId | null; boarding: Boarding;
}

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function runCreator(host: HTMLElement): Promise<CharacterData> {
  return new Promise((resolve) => {
    let step = 0;
    let error = '';
    const d: Draft = {
      first: '', last: '', gender: 'girl',
      look: { skin: SKIN_TONES[2], hair: HAIR_COLORS[2], hairStyle: 2, top: UNIFORM.top, bottom: UNIFORM.bottom, skirt: true, glasses: false, eyes: EYE_COLORS[1], freckles: false },
      hometown: 'İstanbul', mix: {}, loss: 'father', guardian: 'mother', cause: null, boarding: 'evci',
    };

    host.innerHTML = `
      <div class="card creator">
        <div class="creator-steps"></div>
        <div class="creator-body">
          <div class="creator-preview">
            <canvas class="cp-bust" width="300" height="300"></canvas>
            <canvas class="cp-body" width="256" height="256"></canvas>
            <div class="preview-name"></div>
            <div class="preview-age"></div>
          </div>
          <div class="creator-form"></div>
        </div>
        <div class="creator-nav"></div>
      </div>`;
    const stepsEl = host.querySelector('.creator-steps') as HTMLElement;
    const form = host.querySelector('.creator-form') as HTMLElement;
    const nav = host.querySelector('.creator-nav') as HTMLElement;
    const bust = host.querySelector('.cp-bust') as HTMLCanvasElement;
    const body = host.querySelector('.cp-body') as HTMLCanvasElement;
    const nameEl = host.querySelector('.preview-name') as HTMLElement;
    const ageEl = host.querySelector('.preview-age') as HTMLElement;

    // animated preview: a close-up that blinks now and then, and the whole body turning around and walking in place
    let tick = 0;
    let shown = '';
    const paintBust = (blink: boolean) => {
      const key = JSON.stringify(d.look) + blink;
      if (key === shown) return;
      shown = key;
      paintCharacter(bust, d.look, 0, 0, { bust: true, blink });
    };
    const timer = window.setInterval(() => {
      tick++;
      const dir = [0, 2, 3, 1][Math.floor(tick / 8) % 4];
      const frame = [1, 0, 2, 0][tick % 4];
      paintCharacter(body, d.look, dir, frame);
      paintBust(tick % 17 === 0);
    }, 180);

    const seg = (name: string, options: Array<{ v: string; label: string }>, current: string) =>
      `<div class="seg" data-field="${name}">${options.map((o) => `<button type="button" data-v="${esc(o.v)}" class="${o.v === current ? 'on' : ''}">${esc(o.label)}</button>`).join('')}</div>`;
    const swatches = (name: string, colors: string[], current: string) =>
      `<div class="swatches" data-field="${name}">${colors.map((c) => `<button type="button" data-v="${c}" class="${c === current ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>`;
    const field = (label: Text, inner: string, help?: Text) =>
      `<div class="field"><div class="field-label">${esc(L(label))}</div>${inner}${help ? `<div class="field-help">${esc(L(help))}</div>` : ''}</div>`;

    /** points not yet shared out */

    const mixLeft = () => MIX_TOTAL - Object.values(d.mix).reduce((a, v) => a + (v ?? 0), 0);

    /** the personality step: share 100 points across the traits */

    const mixer = (): string => {

      const left = mixLeft();

      const lean = leanings(mixLean(d.mix));

      // what the share does: speeds up one attribute, or (Tasasız) softens mood losses
      const effect = (tr: (typeof TRAITS)[number], pts: number) => tr.attr
        ? `${L(ATTRS.find((a) => a.id === tr.attr)!.name)} +%${pts / 10}`
        : L({ tr: `Moral kaybı −%${(pts * 0.3).toFixed(0)}`, en: `Mood losses −${(pts * 0.3).toFixed(0)}%` });

      return `<p class="mix-intro">${esc(L(S.mixIntro))} <b class="mix-left">${esc(L(S.mixLeft))}: ${left}</b></p>

        <div class="cards">${TRAITS.map((tr) => {

          const pts = d.mix[tr.id] ?? 0;

          return `<div class="opt mix ${pts > 0 ? 'on' : ''}">

            <b>${esc(L(tr.name))}</b><span>${esc(L(tr.desc))}</span>

            <div class="mix-ctl">

              <button type="button" class="mix-btn" data-act="mix-" data-v="${tr.id}" ${pts === 0 ? 'disabled' : ''} aria-label="−">−</button>

              <div class="mix-bar"><i style="width:${pts}%"></i></div>

              <b class="mix-pts">${pts}</b>

              <button type="button" class="mix-btn" data-act="mix+" data-v="${tr.id}" ${left === 0 ? 'disabled' : ''} aria-label="+">+</button>

            </div>

            <span class="mix-gain">${esc(effect(tr, pts))}</span>

          </div>`;

        }).join('')}</div>

        <div class="mix-lean">${esc(L(S.mixLean))}: <b>${esc(lean.length ? lean.join(' · ') : L(S.mixLeanNone))}</b></div>`;

    };


    const render = () => {
      stepsEl.innerHTML = S.steps.map((s, i) => `<div class="${i === step ? 'on' : i < step ? 'done' : ''}">${i + 1}. ${esc(L(s))}</div>`).join('');
      const full = `${d.first} ${d.last}`.trim();
      nameEl.textContent = full || '…';
      ageEl.textContent = L(S.age);

      if (step === 0) {
        form.innerHTML =
          field(S.gender, seg('gender', [{ v: 'girl', label: L(S.girl) }, { v: 'boy', label: L(S.boy) }], d.gender)) +
          field(S.skin, swatches('skin', SKIN_TONES, d.look.skin)) +
          field(S.hairStyle, seg('hairStyle', HAIR_STYLES.map((h) => ({ v: String(h.id), label: L(h.name) })), String(d.look.hairStyle))) +
          field(S.hairColor, swatches('hair', HAIR_COLORS, d.look.hair)) +
          field(S.eyes, swatches('eyes', EYE_COLORS, d.look.eyes ?? EYE_COLORS[1])) +
          field(S.uniform, seg('skirt', [{ v: 'no', label: L(S.trousers) }, { v: 'yes', label: L(S.skirt) }], d.look.skirt ? 'yes' : 'no')) +
          `<div class="row2">${field(S.glasses, seg('glasses', [{ v: 'no', label: L(S.no) }, { v: 'yes', label: L(S.yes) }], d.look.glasses ? 'yes' : 'no'))}` +
          `${field(S.freckles, seg('freckles', [{ v: 'no', label: L(S.no) }, { v: 'yes', label: L(S.yes) }], d.look.freckles ? 'yes' : 'no'))}</div>` +
          `<button type="button" class="link-btn" data-act="random">🎲 ${esc(L(S.randomize))}</button>`;
      } else if (step === 1) {
        form.innerHTML =
          `<div class="row2">${field(S.first, `<input type="text" maxlength="16" data-input="first" value="${esc(d.first)}" autocomplete="off">`)}` +
          `${field(S.last, `<input type="text" maxlength="16" data-input="last" value="${esc(d.last)}" autocomplete="off">`)}</div>` +
          field(S.hometown, `<select data-input="hometown">${PROVINCES.map((p) => `<option ${p === d.hometown ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>`) +
          field(S.trait, mixer());
      } else if (step === 2) {
        const gOpts = guardianOptions(d.loss).map((id) => GUARDIANS.find((g) => g.id === id)!);
        form.innerHTML =
          `<p class="story-intro">${esc(L(S.storyIntro))}</p>` +
          field(S.whoLost, seg('loss', LOSSES.map((l) => ({ v: l.id, label: L(l.name) })), d.loss)) +
          field(S.guardian, `<select data-input="guardian">${gOpts.map((g) => `<option value="${g.id}" ${g.id === d.guardian ? 'selected' : ''}>${esc(L(g.name))}</option>`).join('')}</select>`) +
          field(S.how, `<div class="cards">${CAUSES.map((c) => `
            <button type="button" class="opt ${d.cause === c.id ? 'on' : ''}" data-field="cause" data-v="${c.id}">
              <b>${esc(L(c.how))}</b><span>${esc(L(c.blurb))}</span></button>`).join('')}</div>`) +
          field({ tr: 'Hafta sonları', en: 'Weekends' }, `<div class="cards">${BOARDING_OPTIONS.map((b) => `
            <button type="button" class="opt ${d.boarding === b.id ? 'on' : ''}" data-field="boarding" data-v="${b.id}">
              <b>${esc(L(b.name))}</b><span>${esc(L(b.desc))}</span></button>`).join('')}</div>`);
      } else {
        const cause = CAUSES.find((c) => c.id === d.cause)!;
        const { attributes, respect } = startingAttributes();
        const guardian = GUARDIANS.find((g) => g.id === d.guardian)!;
        const loss = LOSSES.find((l) => l.id === d.loss)!;
        form.innerHTML = `
          <div class="summary">
            <div class="sum-row"><span>${esc(L(S.hometown))}</span><b>${esc(d.hometown)}</b></div>
            <div class="sum-row"><span>${esc(L(S.trait))}</span><b>${esc(mixLabel(d.mix))}</b></div>
            <div class="sum-row"><span>${esc(L(S.lost))}</span><b>${esc(L(loss.name))}</b></div>
            <div class="sum-row"><span>${esc(L(S.family))}</span><b>${esc(L(guardian.name))}</b></div>
            <div class="sum-row"><span>${esc(L({ tr: 'Hafta sonları', en: 'Weekends' }))}</span><b>${esc(L(BOARDING_OPTIONS.find((b) => b.id === d.boarding)!.name))}</b></div>
            <div class="sum-row"><span>${esc(L({ tr: 'Nasıl oldu', en: 'How it happened' }))}</span><b>${esc(L(cause.how))}</b></div>
            <div class="field-label">${esc(L(S.attributes))}</div>
            ${ATTRS.map((a) => `<div class="attr"><span>${esc(L(a.name))}</span><div class="attr-bar"><i style="width:${Math.min(100, attributes[a.id] * 2)}%"></i></div><b>${attributes[a.id]}</b></div>`).join('')}
            <div class="attr"><span>${esc(L(S.respect))}</span><div class="attr-bar respect"><i style="width:${respect / 10}%"></i></div><b>${respect}</b></div>
          </div>`;
      }

      nav.innerHTML = `
        ${error ? `<div class="nav-error">${esc(error)}</div>` : ''}
        <div class="nav-buttons">
          ${step > 0 ? `<button type="button" class="secondary" data-act="back">${esc(L(S.back))}</button>` : `<button type="button" class="secondary" data-act="menu">← ${esc(L({ tr: 'Ana menü', en: 'Menu' }))}</button>`}
          <button type="button" class="primary" data-act="next">${esc(L(step === 3 ? S.start : S.next))}</button>
        </div>`;
    };

    const validate = (): string => {
      if (step === 1 && (!d.first.trim() || !d.last.trim())) return L(S.nameError);
      if (step === 1 && mixLeft() > 0) return L(S.traitError).replace('{n}', String(mixLeft()));
      if (step === 2 && !d.cause) return L(S.storyError);
      return '';
    };

    host.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement | HTMLSelectElement;
      const key = el.dataset.input;
      if (key === 'first' || key === 'last') { d[key] = el.value.replace(/[^\p{L}\s'-]/gu, ''); nameEl.textContent = `${d.first} ${d.last}`.trim() || '…'; }
      if (key === 'hometown') d.hometown = el.value;
      if (key === 'guardian') d.guardian = el.value as GuardianId;
    });

    host.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'random') {
        d.look.skin = pick(SKIN_TONES); d.look.hair = pick(HAIR_COLORS);
        d.look.hairStyle = pick(HAIR_STYLES.filter((h) => d.gender === 'girl' ? h.id !== 1 : h.id !== 2 && h.id !== 5)).id;
        d.look.glasses = Math.random() < 0.25; d.look.eyes = pick(EYE_COLORS); d.look.freckles = Math.random() < 0.2;
        render(); return;
      }
      if (act === 'mix+' || act === 'mix-') {
        const id = btn.dataset.v as TraitId, cur = d.mix[id] ?? 0;
        const next = act === 'mix+' ? cur + Math.min(MIX_STEP, mixLeft()) : Math.max(0, cur - MIX_STEP);
        if (next > 0) d.mix[id] = next; else delete d.mix[id];
        error = '';
        render(); return;
      }
      if (act === 'back') { error = ''; step--; render(); return; }
      if (act === 'menu') { window.clearInterval(timer); window.location.reload(); return; }
      if (act === 'next') {
        error = validate();
        if (error) { render(); return; }
        if (step < 3) { step++; render(); return; }
        window.clearInterval(timer);
        const { attributes, respect } = startingAttributes();
        resolve({
          first: d.first.trim(), last: d.last.trim(), gender: d.gender, look: { ...d.look },
          hometown: d.hometown, trait: mainTrait(d.mix), mix: { ...d.mix }, loss: d.loss, guardian: d.guardian, cause: d.cause!,
          boarding: d.boarding, attributes, respect,
        });
        return;
      }
      const fieldName = (btn.closest('[data-field]') as HTMLElement | null)?.dataset.field ?? btn.dataset.field;
      const v = btn.dataset.v;
      if (!fieldName || v === undefined) return;
      switch (fieldName) {
        case 'gender':
          d.gender = v as Gender;
          d.look.skirt = d.gender === 'girl';
          if (d.gender === 'boy' && (d.look.hairStyle === 2 || d.look.hairStyle === 5)) d.look.hairStyle = 0;
          if (d.gender === 'girl' && d.look.hairStyle === 1) d.look.hairStyle = 2;
          break;
        case 'skin': d.look.skin = v; break;
        case 'hair': d.look.hair = v; break;
        case 'hairStyle': d.look.hairStyle = Number(v) as HairStyle; break;
        case 'eyes': d.look.eyes = v; break;
        case 'freckles': d.look.freckles = v === 'yes'; break;
        case 'skirt': d.look.skirt = v === 'yes'; break;
        case 'glasses': d.look.glasses = v === 'yes'; break;
        case 'loss':
          d.loss = v as Loss;
          if (!guardianOptions(d.loss).includes(d.guardian)) d.guardian = defaultGuardian(d.loss);
          break;
        case 'cause': d.cause = v as CauseId; error = ''; break;
        case 'boarding': d.boarding = v as Boarding; break;
      }
      render();
      paintBust(false);
    });

    onLangChange(render);
    render();
    paintCharacter(body, d.look, 0, 0);
    paintBust(false);
    void getLang;
  });
}
