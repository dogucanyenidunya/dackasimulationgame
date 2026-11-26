// Yetim's card: what you can do with the Merkez Meydan's cat. Trust grows slowly (kept in st.friends.yetim, 0–100):
// a stranger gets sniffed at, a friend gets purrs, and the cat's best friends may pick it up.
import { L } from '../i18n';
import type { ActionView, PanelView } from '../ui/panel';
import { snackById } from '../content/wardrobe';
import type { GameCtx } from './buildings';

const T = (tr: string, en: string): string => L({ tr, en });
export const YETIM_ID = 'yetim';

/** what the cat does on the plaza when you've done something with it */
export interface CatReactions {
  purr(follow: boolean): void;
  zoomies(): void;
  startle(): void;
}

/** a cat can have a nibble of these; the rest of your snacks are for you */
const CAT_OK = ['biskuvi', 'ayran'];
const CAT_BAD = ['atistirmalik', 'gofret'];

export function yetimBond(ctx: GameCtx): number { return ctx.st.friends[YETIM_ID] ?? 0; }
function addBond(ctx: GameCtx, n: number) { ctx.st.friends[YETIM_ID] = Math.max(0, Math.min(100, yetimBond(ctx) + n)); }
/** "done n times today": counters in st.daily (which keeps day numbers, so each count is its own key) */
function timesToday(ctx: GameCtx, what: string) {
  let n = 0;
  while (ctx.st.daily[`yetim-${what}-${n + 1}`] === ctx.clock.day) n++;
  return n;
}
function countToday(ctx: GameCtx, what: string) { ctx.st.daily[`yetim-${what}-${timesToday(ctx, what) + 1}`] = ctx.clock.day; }

export function yetimPanel(ctx: GameCtx, cat: CatReactions): PanelView {
  const bond = yetimBond(ctx);
  const actions: ActionView[] = [];
  const name = 'Yetim';

  actions.push({
    id: 'pet', label: T('Sev', 'Pet'), hint: T('2 dk', '2 min'),
    run: async () => {
      ctx.advance(2);
      // a cat that doesn't know you yet decides for itself
      if (bond < 12 && timesToday(ctx, 'pet') === 0 && Math.random() < 0.5) {
        countToday(ctx, 'pet'); addBond(ctx, 2);
        cat.startle();
        await ctx.panel.message(name, T('Yetim elini kokluyor, sonra bir adım geri çekiliyor. Henüz seni tanımıyor. Acele etme; her gün biraz.', 'Yetim sniffs your hand, then takes a step back. It doesn\'t know you yet. No rush: a little every day.'));
        return;
      }
      const n = timesToday(ctx, 'pet');
      countToday(ctx, 'pet');
      if (n < 3) addBond(ctx, 3);
      if (n < 2) ctx.gain({ mood: 4 });
      cat.purr(yetimBond(ctx) >= 25);
      await ctx.panel.message(name, bond >= 60
        ? T('Yetim gözlerini kısıp avucuna başını dayıyor. Mırıltısı motor gibi. Bir süre öyle kalıyorsunuz.', 'Yetim narrows its eyes and pushes its head into your palm, purring like an engine. You stay like that for a while.')
        : bond >= 25
          ? T('Kulaklarının arkasını kaşıyorsun. Yetim mırlamaya başlıyor ve kuyruğunu dikiyor.', 'You scratch behind its ears. Yetim starts to purr, tail straight up.')
          : T('Sırtını yavaşça okşuyorsun. Yetim kaçmıyor; kuyruğunun ucu oynuyor.', 'You stroke its back, slowly. Yetim stays; the tip of its tail twitches.'));
    },
  });

  const bag = ctx.st.food.bag;
  const ok = bag.find((id) => CAT_OK.includes(id));
  const fed = timesToday(ctx, 'feed') > 0;
  const onlyBad = !ok && bag.some((id) => CAT_BAD.includes(id));
  actions.push({
    id: 'feed', label: ok ? T(`İkram et: ${L(snackById(ok)!.name)}`, `Offer some ${L(snackById(ok)!.name)}`) : T('İkram et', 'Offer a treat'),
    hint: T('Cebinden · günde bir', 'From your pocket · once a day'),
    locked: fed ? T('Bugün zaten bir şeyler yedi.', 'It has already had something today.')
      : onlyBad ? T('Cebinde çikolata ve cips var: kediler bunları yememeli. Bisküvi ya da ayran olur.', 'All you have is chocolate and crisps, and cats shouldn\'t eat those. Biscuits or ayran would do.')
        : !ok ? T('Cebinde kediye verecek bir şey yok (bisküvi ya da biraz ayran olur).', 'Nothing in your pocket for a cat (biscuits or a little ayran would do).')
          : undefined,
    run: async () => {
      if (!ok || fed) return;
      bag.splice(bag.indexOf(ok), 1);
      countToday(ctx, 'feed');
      addBond(ctx, 6);
      ctx.gain({ mood: 3 });
      ctx.advance(3);
      cat.purr(yetimBond(ctx) >= 25);
      await ctx.panel.message(name, ok === 'ayran'
        ? T('Kapağa biraz ayran döküyorsun. Yetim önce burnunu buruşturuyor, sonra pembe diliyle şapır şupur hepsini yalıyor.', 'You pour a little ayran into the cap. Yetim wrinkles its nose, then laps the lot up with its little pink tongue.')
        : T('Bisküviyi ufalayıp avucuna koyuyorsun. Yetim kırıntıları tek tek topluyor, sonra bıyıklarını yalıyor.', 'You crumble a biscuit into your palm. Yetim picks up every crumb, then licks its whiskers.'));
    },
  });

  const played = timesToday(ctx, 'play');
  actions.push({
    id: 'play', label: T('Bir dalla oyna', 'Play with a twig'), hint: T('10 dk · biraz yorar', '10 min · a little tiring'),
    locked: played >= 2 ? T('Yetim yoruldu; şimdi güneşte uzanmak istiyor.', 'Yetim is tired; it wants to lie in the sun now.')
      : bond < 8 ? T('Önce biraz alışması gerek. Birkaç gün sev, belki bir şey ikram et.', 'It needs to get used to you first. Pet it for a few days, maybe offer a treat.')
        : ctx.st.energy < 10 ? T('Çok yorgunsun.', 'You\'re too tired.') : undefined,
    run: async () => {
      countToday(ctx, 'play');
      addBond(ctx, 3);
      ctx.gain({ mood: 6, energy: -3 });
      ctx.advance(10);
      cat.zoomies();
      await ctx.panel.message(name, T('Dalı yerde sürüklüyorsun. Yetim pusuya yatıp kıçını sallıyor, sonra hop! Biraz sonra meydanın bir ucundan öbürüne deli gibi koşturmaya başlıyor.', 'You drag the twig along the ground. Yetim crouches, wiggles its bottom, then pounce! A moment later it\'s tearing from one end of the plaza to the other.'));
    },
  });

  if (bond >= 60) {
    actions.push({
      id: 'hold', label: T('Kucağına al', 'Pick it up'), hint: T('5 dk', '5 min'),
      run: async () => {
        ctx.advance(5);
        if (timesToday(ctx, 'hold') === 0) { ctx.gain({ mood: 8 }); addBond(ctx, 1); }
        countToday(ctx, 'hold');
        cat.purr(true);
        await ctx.panel.message(name, T('Yetim kucağına yerleşip patileriyle kazağını yoğuruyor. Sıcacık ve ağır. Bir an için her şey yerli yerinde.', 'Yetim settles in your arms and kneads your sweater with its paws. Warm and heavy. For a moment everything is where it should be.'));
      },
    });
  }

  const note = bond < 12
    ? T('Sarı tekir bir kedi, göğsü ve patileri bembeyaz. Herkes ona Yetim diyor; onu ilk kimin bulduğunu kimse hatırlamıyor ama Eğitim Binası\'nın önü onun evi. Seni biraz uzaktan süzüyor.', 'A yellow tabby with a snow-white chest and white socks. Everyone calls it Yetim; nobody remembers who found it first, but the front of the Eğitim Binası is its home. It watches you from a little way off.')
    : bond < 30 ? T('Yetim seni tanımaya başladı. Yaklaşınca kaçmıyor, kuyruğunu dik tutuyor.', 'Yetim is getting to know you. It doesn\'t run off when you come close, and its tail is up.')
      : bond < 60 ? T('Yetim seni görünce miyavlayarak yanına geliyor, sonra bir süre peşinden dolaşıyor.', 'Yetim trots over with a mew when it sees you, then follows you about for a while.')
        : T('Yetim\'in en sevdiği insan sensin. Bacaklarına sürtünüp mırlıyor.', 'You\'re Yetim\'s favourite person. It winds round your legs, purring.');
  const hearts = bond >= 60 ? '♥♥♥' : bond >= 30 ? '♥♥' : bond >= 12 ? '♥' : '';
  return {
    title: 'Yetim', sub: `${T('Merkez Meydan\'ın kedisi', 'The Merkez Meydan\'s cat')}${hearts ? ` · ${hearts}` : ''}`,
    rooms: [{ id: 'yetim', name: 'Yetim', note, actions }],
  };
}
