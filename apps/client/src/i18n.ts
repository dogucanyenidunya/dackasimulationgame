export type Lang = 'tr' | 'en';
export interface Text { tr: string; en: string }

let lang: Lang = 'tr';
const listeners: Array<() => void> = [];

export function getLang(): Lang { return lang; }
export function setLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l;
  listeners.forEach((fn) => fn());
}
export function onLangChange(fn: () => void) { listeners.push(fn); }

/** pick the current-language string from a {tr, en} pair */
export function L(t: Text): string { return t[lang]; }

const STRINGS = {
  title_sub: { tr: 'Bir yatılı okul hikâyesi · 10 yıl', en: 'A boarding school story · 10 years' },
  new_game: { tr: 'Yeni oyun', en: 'New game' },
  continue: { tr: 'Devam et', en: 'Continue' },
  arrival_title: { tr: 'Ana Kapı', en: 'The main gate' },
  arrival_body: {
    tr: '9 yaşındasın. Bavulun elinde, kapının önündesin. Vedalaşma bitti; içeri tek başına gireceksin. Kampüsü henüz tanımıyorsun: binalar, sen onları keşfedene kadar sisin içinde kalacak.',
    en: "You're 9 years old, standing at the gate with your suitcase. The goodbyes are over; you'll walk in alone. You don't know the campus yet: the buildings stay hidden in the fog until you discover them.",
  },
  arrival_go: { tr: 'İçeri gir', en: 'Walk in' },
  arrival_personal: {
    tr: '{guardian} seni kapıya kadar getirdi. Sıkıca sarıldınız, sonra el sallayıp gitti. Cebinde {keepsake} var. 9 yaşındasın ve içeri tek başına gireceksin. Kampüsü henüz tanımıyorsun: binalar, sen onları keşfedene kadar sisin içinde kalacak.',
    en: "{guardian} walked you to the gate. You hugged tight, then they waved and left. In your pocket: {keepsake}. You're 9 years old, and you'll walk in alone. You don't know the campus yet: the buildings stay hidden in the fog until you discover them.",
  },
  own_dorm: { tr: 'Burası senin yurdun: A1 Blok, 1. Kat.', en: 'This is your dorm: Block A1, Floor 1.' },
  locked_girls: { tr: 'Kapı kilitli: burası kızların yurdu.', en: "The door is locked: this is the girls' dorm." },
  locked_boys: { tr: 'Kapı kilitli: burası erkeklerin yurdu.', en: "The door is locked: this is the boys' dorm." },
  teknik_open: { tr: 'Hüseyin Usta el sallıyor: "Gel evlat, atölyenin kapısı sana hep açık."', en: 'Hüseyin Usta waves: "Come in, kid. The workshop is always open to you."' },
  teknik_locked: { tr: 'Kapı kilitli. İçeriden makine sesleri geliyor.', en: 'The door is locked. You can hear machines humming inside.' },
  profile: { tr: 'Profil', en: 'Profile' },
  age_line: { tr: '9 yaşında · 4. sınıf · {home}', en: 'Age 9 · Grade 4 · {home}' },
  days: { tr: 'Pazartesi,Salı,Çarşamba,Perşembe,Cuma,Cumartesi,Pazar', en: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday' },
  day_n: { tr: '{n}. gün', en: 'Day {n}' },
  discovered: { tr: 'Keşfedilen', en: 'Discovered' },
  discovered_toast: { tr: 'Keşfedildi: {name}', en: 'Discovered: {name}' },
  press_e: { tr: 'E — {name}', en: 'E — {name}' },
  unknown_door: { tr: 'E — ??? (bu bina ne?)', en: 'E — ??? (what is this building?)' },
  enter: { tr: 'Kapıya bak', en: 'Check the door' },
  coming_soon: { tr: 'İçerisi 3. adımda gelecek.', en: 'Interiors come in step 3.' },
  close: { tr: 'Kapat', en: 'Close' },
  controls: { tr: 'WASD/oklar: yürü · E: etkileşim · J: görevler · R: ilişkiler · M: harita · C: profil · T: hızlı zaman', en: 'WASD/arrows: walk · E: interact · J: missions · R: people · M: map · C: profile · T: fast time' },
  lights_out: { tr: '22:00 — Işıklar söndü. Belletmen herkesi yatağa gönderiyor.', en: '22:00 — Lights out. The belletmen sends everyone to bed.' },
  morning: { tr: 'Günaydın! Yeni bir gün başladı.', en: 'Good morning! A new day has begun.' },
  map_title: { tr: 'Kampüs haritası', en: 'Campus map' },
  fast_on: { tr: 'Zaman hızlı (×6)', en: 'Fast time (×6)' },
  fast_off: { tr: 'Zaman normal', en: 'Normal time' },
  all_found: { tr: 'Tüm kampüsü keşfettin! 🎉', en: "You've explored the whole campus! 🎉" },
  reset_confirm: { tr: 'Kayıt silinip yeni oyun başlasın mı?', en: 'Delete the save and start a new game?' },
  menu_reset: { tr: 'Yeni oyun', en: 'New game' },
  saved: { tr: 'Kaydedildi', en: 'Saved' },
} satisfies Record<string, Text>;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  let s = STRINGS[key][lang];
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
