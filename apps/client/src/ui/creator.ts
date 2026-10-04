// Character creator (GDD §5): look → about you → your story → summary.
import { drawCharacter, type CharacterLook } from '../art/textures';
import {
  ATTRS, BOARDING_OPTIONS, CAUSES, GUARDIANS, HAIR_COLORS, HAIR_STYLES, LOSSES, MEMORY_OPTIONS, PROVINCES, SKIN_TONES, TRAITS, UNIFORM,
  capitalize, computeAttributes, defaultGuardian, guardianOptions, keepsakeName,
  type Boarding, type CauseId, type CharacterData, type Gender, type GuardianId, type Loss, type MemoryScenes, type TraitId,
} from '../content/character';
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
  memory: { tr: 'Anı sahneleri', en: 'Memory scenes' },
  memoryHelp: { tr: 'Duygusal sahnelerin yoğunluğu. Güçlerin her ayarda aynı çalışır.', en: 'How much emotional content you see. Your strengths work the same either way.' },
  strength: { tr: 'Gücün', en: 'Your strength' },
  keepsake: { tr: 'Hatıran', en: 'Your keepsake' },
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
  traitError: { tr: 'Lütfen bir kişilik seç.', en: 'Please choose a personality.' },
  age: { tr: '9 yaşında · 4. sınıf', en: 'Age 9 · Grade 4' },
};

interface Draft {
  first: string; last: string; gender: Gender;
  look: CharacterLook; hometown: string; trait: TraitId | null;
  loss: Loss; guardian: GuardianId; cause: CauseId | null; memoryScenes: MemoryScenes; boarding: Boarding;
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
      look: { skin: SKIN_TONES[2], hair: HAIR_COLORS[2], hairStyle: 2, top: UNIFORM.top, bottom: UNIFORM.bottom, skirt: true, glasses: false },
      hometown: 'İstanbul', trait: null, loss: 'father', guardian: 'mother', cause: null, memoryScenes: 'full', boarding: 'evci',
    };

    host.innerHTML = `
      <div class="card creator">
        <div class="creator-steps"></div>
        <div class="creator-body">
          <div class="creator-preview">
            <canvas width="32" height="32"></canvas>
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
    const canvas = host.querySelector('.creator-preview canvas') as HTMLCanvasElement;
    const nameEl = host.querySelector('.preview-name') as HTMLElement;
    const ageEl = host.querySelector('.preview-age') as HTMLElement;
    const ctx = canvas.getContext('2d')!;

    // animated preview: turns around and walks in place
    let tick = 0;
    const timer = window.setInterval(() => {
      tick++;
      const dir = [0, 2, 3, 1][Math.floor(tick / 8) % 4];
      const frame = [1, 0, 2, 0][tick % 4];
      ctx.clearRect(0, 0, 32, 32);
      drawCharacter(ctx, 0, 0, d.look, dir, frame);
    }, 180);

    const seg = (name: string, options: Array<{ v: string; label: string }>, current: string) =>
      `<div class="seg" data-field="${name}">${options.map((o) => `<button type="button" data-v="${esc(o.v)}" class="${o.v === current ? 'on' : ''}">${esc(o.label)}</button>`).join('')}</div>`;
    const swatches = (name: string, colors: string[], current: string) =>
      `<div class="swatches" data-field="${name}">${colors.map((c) => `<button type="button" data-v="${c}" class="${c === current ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>`;
    const field = (label: Text, inner: string, help?: Text) =>
      `<div class="field"><div class="field-label">${esc(L(label))}</div>${inner}${help ? `<div class="field-help">${esc(L(help))}</div>` : ''}</div>`;

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
          field(S.uniform, seg('skirt', [{ v: 'no', label: L(S.trousers) }, { v: 'yes', label: L(S.skirt) }], d.look.skirt ? 'yes' : 'no')) +
          field(S.glasses, seg('glasses', [{ v: 'no', label: L(S.no) }, { v: 'yes', label: L(S.yes) }], d.look.glasses ? 'yes' : 'no')) +
          `<button type="button" class="link-btn" data-act="random">🎲 ${esc(L(S.randomize))}</button>`;
      } else if (step === 1) {
        form.innerHTML =
          `<div class="row2">${field(S.first, `<input type="text" maxlength="16" data-input="first" value="${esc(d.first)}" autocomplete="off">`)}` +
          `${field(S.last, `<input type="text" maxlength="16" data-input="last" value="${esc(d.last)}" autocomplete="off">`)}</div>` +
          field(S.hometown, `<select data-input="hometown">${PROVINCES.map((p) => `<option ${p === d.hometown ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>`) +
          field(S.trait, `<div class="cards">${TRAITS.map((tr) => `
            <button type="button" class="opt ${d.trait === tr.id ? 'on' : ''}" data-field="trait" data-v="${tr.id}">
              <b>${esc(L(tr.name))}</b><span>${esc(L(tr.desc))}</span></button>`).join('')}</div>`);
      } else if (step === 2) {
        const gOpts = guardianOptions(d.loss).map((id) => GUARDIANS.find((g) => g.id === id)!);
        form.innerHTML =
          `<p class="story-intro">${esc(L(S.storyIntro))}</p>` +
          field(S.whoLost, seg('loss', LOSSES.map((l) => ({ v: l.id, label: L(l.name) })), d.loss)) +
          field(S.guardian, `<select data-input="guardian">${gOpts.map((g) => `<option value="${g.id}" ${g.id === d.guardian ? 'selected' : ''}>${esc(L(g.name))}</option>`).join('')}</select>`) +
          field(S.how, `<div class="cards">${CAUSES.map((c) => `
            <button type="button" class="opt ${d.cause === c.id ? 'on' : ''}" data-field="cause" data-v="${c.id}">
              <b>${esc(L(c.how))}</b><span>${esc(L(c.strength))}: ${esc(L(c.blurb))}</span></button>`).join('')}</div>`) +
          field({ tr: 'Hafta sonları', en: 'Weekends' }, `<div class="cards">${BOARDING_OPTIONS.map((b) => `
            <button type="button" class="opt ${d.boarding === b.id ? 'on' : ''}" data-field="boarding" data-v="${b.id}">
              <b>${esc(L(b.name))}</b><span>${esc(L(b.desc))}</span></button>`).join('')}</div>`) +
          field(S.memory, seg('memoryScenes', MEMORY_OPTIONS.map((m) => ({ v: m.id, label: L(m.name) })), d.memoryScenes), S.memoryHelp);
      } else {
        const cause = CAUSES.find((c) => c.id === d.cause)!;
        const trait = TRAITS.find((x) => x.id === d.trait)!;
        const { attributes, respect } = computeAttributes(d.trait!, d.cause!);
        const guardian = GUARDIANS.find((g) => g.id === d.guardian)!;
        const loss = LOSSES.find((l) => l.id === d.loss)!;
        form.innerHTML = `
          <div class="summary">
            <div class="sum-row"><span>${esc(L(S.hometown))}</span><b>${esc(d.hometown)}</b></div>
            <div class="sum-row"><span>${esc(L(S.trait))}</span><b>${esc(L(trait.name))}</b></div>
            <div class="sum-row"><span>${esc(L(S.lost))}</span><b>${esc(L(loss.name))}</b></div>
            <div class="sum-row"><span>${esc(L(S.family))}</span><b>${esc(L(guardian.name))}</b></div>
            <div class="sum-row"><span>${esc(L({ tr: 'Hafta sonları', en: 'Weekends' }))}</span><b>${esc(L(BOARDING_OPTIONS.find((b) => b.id === d.boarding)!.name))}</b></div>
            <div class="strength-card">
              <div class="sc-label">${esc(L(S.strength))}</div>
              <div class="sc-name">${esc(L(cause.strength))}</div>
              <p>${esc(L(cause.perk))}</p>
              <div class="sc-keep">🎁 ${esc(L(S.keepsake))}: <b>${esc(capitalize(keepsakeName(cause.id, d.loss)))}</b></div>
            </div>
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
      if (step === 1 && !d.trait) return L(S.traitError);
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
        d.look.hairStyle = pick(HAIR_STYLES).id; d.look.glasses = Math.random() < 0.25;
        render(); return;
      }
      if (act === 'back') { error = ''; step--; render(); return; }
      if (act === 'menu') { window.clearInterval(timer); window.location.reload(); return; }
      if (act === 'next') {
        error = validate();
        if (error) { render(); return; }
        if (step < 3) { step++; render(); return; }
        window.clearInterval(timer);
        const { attributes, respect } = computeAttributes(d.trait!, d.cause!);
        resolve({
          first: d.first.trim(), last: d.last.trim(), gender: d.gender, look: { ...d.look },
          hometown: d.hometown, trait: d.trait!, loss: d.loss, guardian: d.guardian, cause: d.cause!,
          memoryScenes: d.memoryScenes, boarding: d.boarding, attributes, respect,
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
          if (d.gender === 'boy' && d.look.hairStyle === 2) d.look.hairStyle = 0;
          if (d.gender === 'girl' && d.look.hairStyle === 1) d.look.hairStyle = 2;
          break;
        case 'skin': d.look.skin = v; break;
        case 'hair': d.look.hair = v; break;
        case 'hairStyle': d.look.hairStyle = Number(v) as 0 | 1 | 2 | 3; break;
        case 'skirt': d.look.skirt = v === 'yes'; break;
        case 'glasses': d.look.glasses = v === 'yes'; break;
        case 'trait': d.trait = v as TraitId; error = ''; break;
        case 'loss':
          d.loss = v as Loss;
          if (!guardianOptions(d.loss).includes(d.guardian)) d.guardian = defaultGuardian(d.loss);
          break;
        case 'cause': d.cause = v as CauseId; error = ''; break;
        case 'memoryScenes': d.memoryScenes = v as MemoryScenes; break;
        case 'boarding': d.boarding = v as Boarding; break;
      }
      render();
    });

    onLangChange(render);
    render();
    void getLang;
  });
}
