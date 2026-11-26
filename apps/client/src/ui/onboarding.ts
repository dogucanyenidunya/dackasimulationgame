// The one-time tour shown the first time you reach the campus: how to move and interact, what is where on the
// screen, and how a school day runs. A few pages with Back / Next; the last button closes it.
import { L } from '../i18n';
import { isTouch } from './touch';

interface Page { icon: string; title: string; items: Array<[string, string]> }

function pages(): Page[] {
  const touch = isTouch();
  return [
    {
      icon: '🎮', title: L({ tr: 'Kontroller', en: 'Controls' }),
      items: touch
        ? [
          ['🕹️', L({ tr: 'Sol alttaki joystick ile yürü; sonuna kadar itersen koşarsın.', en: 'Walk with the joystick at the bottom left; push it all the way to run.' })],
          ['✋', L({ tr: 'Birinin ya da bir kapının yanına git, sağ alttaki düğmeye ya da ekrandaki ipucuna dokun.', en: 'Walk up to someone or a door, then tap the button at the bottom right or the hint on screen.' })],
          ['🗺️', L({ tr: 'Harita düğmesi büyük haritayı açar. İki parmakla yakınlaştır.', en: 'The map button opens the big map. Pinch to zoom.' })],
        ]
        : [
          ['⌨️', L({ tr: '<b>W A S D</b> ya da <b>ok tuşları</b> ile yürü, <b>Shift</b> ile koş.', en: 'Walk with <b>W A S D</b> or the <b>arrow keys</b>; hold <b>Shift</b> to run.' })],
          ['✋', L({ tr: 'Etkileşim için birinin ya da bir kapının <b>hemen yanına</b> git: altta "E — …" yazınca <b>E</b>\'ye bas.', en: 'To interact, stand <b>right next to</b> someone or a door: when "E — …" shows at the bottom, press <b>E</b>.' })],
          ['🗺️', L({ tr: '<b>M</b> büyük haritayı açar, <b>Esc</b> kapatır. Fare tekerleği yakınlaştırır.', en: '<b>M</b> opens the big map, <b>Esc</b> closes it. The mouse wheel zooms.' })],
          ['💬', L({ tr: 'Çevrimiçiyken <b>Enter</b> ile sohbet edersin.', en: 'Online, press <b>Enter</b> to chat.' })],
        ],
    },
    {
      icon: '🧭', title: L({ tr: 'Ekranda ne nerede?', en: "What's where on screen" }),
      items: [
        ['🕒', L({ tr: '<b>Sol üst:</b> adın, gün, saat, şu anki ders ya da serbest zaman; altında açlık, enerji, moral ve sağlık.', en: '<b>Top left:</b> your name, the day, the time and what is on now; below them hunger, energy, mood and health.' })],
        ['📋', L({ tr: 'Altındaki düğmeler: 📋 Görevler (<b>J</b>), 👥 İlişkiler (<b>R</b>), 🤝 Arkadaşlar (<b>F</b>), 👤 Profil (<b>C</b>), dil, müzik ve ses.', en: 'The buttons under it: 📋 Missions (<b>J</b>), 👥 People (<b>R</b>), 🤝 Friends (<b>F</b>), 👤 Profile (<b>C</b>), language, music and sound.' })],
        ['📍', L({ tr: '<b>Sağ üst:</b> mini harita ve altında şu anki görevin. Karta tıklarsan görev ayrıntısı açılır.', en: '<b>Top right:</b> the minimap, with your current mission under it. Click the card for the details.' })],
        ['⏳', L({ tr: '<b>Üstte ortada:</b> süreli işler (kayıt, etüt, ışıkların sönmesi, ziyaretler) bir geri sayımla görünür.', en: '<b>Top centre:</b> anything on a timer (registration, study time, lights out, visits) shows with a countdown.' })],
      ],
    },
    {
      icon: '🏫', title: L({ tr: 'Okulda bir gün', en: 'A day at school' }),
      items: [
        ['🌫️', L({ tr: 'Kampüs sisle kaplı: dolaştıkça binalar ortaya çıkar. Kapılara yaklaşıp içeri girersin.', en: 'The campus starts in fog: buildings appear as you explore. Walk up to a door to go in.' })],
        ['🔔', L({ tr: 'Hafta içi kahvaltı 07:00, ilk ders 08:30. Akşam yemeğinden sonra 18:00–20:00 etüt: yurdunda ol.', en: 'On weekdays breakfast is at 07:00 and the first lesson at 08:30. After dinner, 18:00–20:00 is study time: be in your dorm.' })],
        ['🌙', L({ tr: 'Işıklar 22:00\'de (lisede 22:30\'da) söner. Yurdundaki yatağına gidip uyu; gece hızlı geçer.', en: 'Lights go out at 22:00 (22:30 in the lise). Go to your bed in the dorm and sleep; the night goes by fast.' })],
        ['🍽️', L({ tr: 'Yemekhane yalnızca öğün saatlerinde açık. Aç kalırsan hastalanırsın; Revir Kız Yurdu\'nun doğu yüzünde.', en: "The dining hall is only open at mealtimes. Go hungry and you'll get ill; the infirmary is on the east side of the girls' dorm." })],
      ],
    },
    {
      icon: '📋', title: L({ tr: 'İlk işin: kayıt', en: 'First things first: registration' }),
      items: [
        ['🗓️', L({ tr: 'Cuma, Cumartesi ve Pazar kayıt günleri. Pazar 18:00\'e kadar dört işi bitir:', en: 'Friday, Saturday and Sunday are registration days. Finish four things by Sunday 18:00:' })],
        ['✍️', L({ tr: 'Cemiyet Binası\'nda kayıt · Revir\'de sağlık kontrolü · Spor Salonu deposundan kıyafet · Kütüphane\'den kitap.', en: 'Enrol at the Cemiyet building · health check at the infirmary · clothes from the Spor Salonu stores · books from the library.' })],
        ['➡️', L({ tr: 'Nereye gideceğini sağ üstteki görev kartı ve haritadaki işaretler gösterir. Kayıt bitince gün kaldığı yerden devam eder.', en: 'The mission card at the top right and the markers on the map show you where to go. Once you are done, the day just carries on.' })],
      ],
    },
  ];
}

/** the tour card (closed by its last button, Skip or Escape) */
export function onboardingCard(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'card onboard-card';
  const list = pages();
  let i = 0;
  const render = () => {
    const p = list[i], last = i === list.length - 1;
    el.innerHTML = `
      <div class="m-label">${L({ tr: 'Hoş geldin', en: 'Welcome' })} · ${i + 1}/${list.length}</div>
      <h2><span aria-hidden="true">${p.icon}</span> ${p.title}</h2>
      <ul class="onboard-list">${p.items.map(([ic, text]) => `<li><span class="ob-ic" aria-hidden="true">${ic}</span><span>${text}</span></li>`).join('')}</ul>
      <div class="onboard-dots" aria-hidden="true">${list.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="onboard-btns">
        <button type="button" class="linkish" data-close>${L({ tr: 'Geç', en: 'Skip' })}</button>
        <span></span>
        ${i > 0 ? `<button type="button" class="secondary" data-back>${L({ tr: 'Geri', en: 'Back' })}</button>` : ''}
        ${last ? `<button type="button" class="primary" data-close>${L({ tr: 'Başlayalım!', en: "Let's go!" })}</button>` : `<button type="button" class="primary" data-next>${L({ tr: 'İleri', en: 'Next' })}</button>`}
      </div>`;
  };
  // (captured before the button's own listeners: the modal closes on its first primary button, which "Next" is not meant to do)
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.hasAttribute('data-next')) { e.stopPropagation(); i = Math.min(list.length - 1, i + 1); render(); }
    else if (b.hasAttribute('data-back')) { e.stopPropagation(); i = Math.max(0, i - 1); render(); }
  }, true);
  render();
  return el;
}
