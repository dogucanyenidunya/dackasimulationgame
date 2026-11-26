// Library books (titles and blurbs) and the teachers' multiple-choice questions.
import type { Text } from '../i18n';
import type { BookId, SubjectId } from '../game/state';

export interface Book { id: BookId; title: Text; author: string; blurb: Text }

export const BOOKS: Book[] = [
  { id: 'kucuk_prens', title: { tr: 'Küçük Prens', en: 'The Little Prince' }, author: 'Antoine de Saint-Exupéry',
    blurb: { tr: 'Çölde mahsur kalan bir pilot, küçük bir gezegenden gelen bir prensle tanışır.', en: 'A pilot stranded in the desert meets a prince from a tiny planet.' } },
  { id: 'pal_sokagi', title: { tr: 'Pal Sokağı Çocukları', en: 'The Paul Street Boys' }, author: 'Ferenc Molnár',
    blurb: { tr: 'Bir grup çocuk, oyun oynadıkları boş arsayı başka bir çeteye karşı korur.', en: 'A group of boys defends their playground from a rival gang.' } },
  { id: 'nasreddin', title: { tr: 'Nasreddin Hoca Fıkraları', en: 'Tales of Nasreddin Hodja' }, author: 'Halk hikâyeleri',
    blurb: { tr: 'Akıllı ve komik Nasreddin Hoca\'nın kısa hikâyeleri.', en: 'Short, clever and funny stories about Nasreddin Hodja.' } },
];

// ---- the teacher's question (and the year-end exam): easy multiple choice at 4th-grade level ----

export interface Question { q: Text; options: Text[]; answer: number }

/** `tr`/`en` answers side by side; the first one is the right one (they are shuffled when asked) */
const Q = (tr: string, en: string, trOpts: string[], enOpts: string[] = trOpts): Question => ({ q: { tr, en }, options: trOpts.map((o, i) => ({ tr: o, en: enOpts[i] ?? o })), answer: 0 });

export const QUESTIONS: Record<SubjectId, Question[]> = {
  turkce: [
    Q('"Güzel" kelimesinin zıt anlamlısı hangisidir?', 'Which word is the opposite of "güzel" (beautiful)?', ['Çirkin', 'Hoş', 'Tatlı', 'Büyük'], ['Çirkin (ugly)', 'Hoş (nice)', 'Tatlı (sweet)', 'Büyük (big)']),
    Q('"Siyah" kelimesinin eş anlamlısı hangisidir?', 'Which word means the same as "siyah" (black)?', ['Kara', 'Ak', 'Kırmızı', 'Koyu'], ['Kara', 'Ak (white)', 'Kırmızı (red)', 'Koyu (dark)']),
    Q('"Kelebek" kelimesi kaç hecelidir?', 'How many syllables does the word "kelebek" have?', ['3', '2', '4', '5']),
    Q('Soru cümlesinin sonuna hangi işaret konur?', 'Which mark goes at the end of a question?', ['Soru işareti (?)', 'Nokta (.)', 'Virgül (,)', 'Ünlem (!)'], ['Question mark (?)', 'Full stop (.)', 'Comma (,)', 'Exclamation mark (!)']),
    Q('Hangisi özel isimdir ve büyük harfle başlar?', 'Which one is a proper noun and starts with a capital letter?', ['Ankara', 'şehir', 'okul', 'çiçek'], ['Ankara', 'city', 'school', 'flower']),
    Q('Alfabemizde kaç harf vardır?', 'How many letters are there in the Turkish alphabet?', ['29', '26', '28', '32']),
    Q('"Koşmak" kelimesinin türü nedir?', 'What kind of word is "koşmak" (to run)?', ['Fiil (eylem)', 'İsim', 'Sıfat', 'Zamir'], ['Verb', 'Noun', 'Adjective', 'Pronoun']),
    Q('Hangi kelime çoğuldur?', 'Which word is plural?', ['Kitaplar', 'Kitap', 'Kitabım', 'Kitapçı'], ['Kitaplar (books)', 'Kitap (book)', 'Kitabım (my book)', 'Kitapçı (bookshop)']),
  ],
  matematik: [
    Q('125 + 275 kaç eder?', 'What is 125 + 275?', ['400', '390', '410', '300']),
    Q('9 × 7 kaç eder?', 'What is 9 × 7?', ['63', '56', '72', '67']),
    Q('144 ÷ 12 kaç eder?', 'What is 144 ÷ 12?', ['12', '14', '11', '16']),
    Q('Bir bütünün yarısı hangi kesirle gösterilir?', 'Which fraction shows half of a whole?', ['1/2', '1/4', '2/3', '1/3']),
    Q('Dik açı kaç derecedir?', 'How many degrees is a right angle?', ['90', '45', '180', '60']),
    Q('1 saat kaç dakikadır?', 'How many minutes are there in an hour?', ['60', '100', '30', '24']),
    Q('1000 − 250 kaç eder?', 'What is 1000 − 250?', ['750', '850', '650', '700']),
    Q('Bir karenin kaç kenarı vardır?', 'How many sides does a square have?', ['4', '3', '5', '6']),
    Q('Hangi sayı çifttir?', 'Which number is even?', ['48', '35', '51', '77']),
  ],
  fen: [
    Q('Dünya\'nın uydusu hangisidir?', "Which one is the Earth's satellite?", ['Ay', 'Güneş', 'Mars', 'Venüs'], ['The Moon', 'The Sun', 'Mars', 'Venus']),
    Q('Su kaç derecede kaynar?', 'At what temperature does water boil?', ['100 °C', '0 °C', '50 °C', '200 °C']),
    Q('Hangisi maddenin bir hâli değildir?', 'Which one is not a state of matter?', ['Sıcak', 'Katı', 'Sıvı', 'Gaz'], ['Hot', 'Solid', 'Liquid', 'Gas']),
    Q('Bitkiler besin üretmek için neye ihtiyaç duyar?', 'What do plants need to make their food?', ['Güneş ışığı', 'Karanlık', 'Tuz', 'Gürültü'], ['Sunlight', 'Darkness', 'Salt', 'Noise']),
    Q('Mıknatıs hangisini çeker?', 'Which one does a magnet attract?', ['Demir çivi', 'Tahta kaşık', 'Plastik şişe', 'Cam bardak'], ['An iron nail', 'A wooden spoon', 'A plastic bottle', 'A glass cup']),
    Q('Kaç duyu organımız vardır?', 'How many sense organs do we have?', ['5', '3', '7', '10']),
    Q('Vücudumuza şekil veren ve iç organları koruyan yapı hangisidir?', 'What gives our body its shape and protects the organs inside?', ['İskelet', 'Deri', 'Saç', 'Tırnak'], ['The skeleton', 'The skin', 'Hair', 'Nails']),
    Q('Dünya\'nın kendi etrafında dönmesi neyi oluşturur?', 'What does the Earth spinning on its axis give us?', ['Gece ve gündüzü', 'Mevsimleri', 'Depremleri', 'Yağmuru'], ['Day and night', 'The seasons', 'Earthquakes', 'Rain']),
  ],
  sosyal: [
    Q('Türkiye\'nin başkenti neresidir?', 'What is the capital of Türkiye?', ['Ankara', 'İstanbul', 'İzmir', 'Bursa']),
    Q('Cumhuriyet hangi tarihte ilan edildi?', 'When was the Republic proclaimed?', ['29 Ekim 1923', '23 Nisan 1920', '19 Mayıs 1919', '30 Ağustos 1922'], ['29 October 1923', '23 April 1920', '19 May 1919', '30 August 1922']),
    Q('Türkiye\'nin ilk cumhurbaşkanı kimdir?', 'Who was the first president of Türkiye?', ['Mustafa Kemal Atatürk', 'İsmet İnönü', 'Fatih Sultan Mehmet', 'Mimar Sinan']),
    Q('Yön bulmak için hangi alet kullanılır?', 'Which tool do we use to find directions?', ['Pusula', 'Termometre', 'Cetvel', 'Terazi'], ['A compass', 'A thermometer', 'A ruler', 'A pair of scales']),
    Q('Güneş hangi yönden doğar?', 'Where does the sun rise?', ['Doğu', 'Batı', 'Kuzey', 'Güney'], ['East', 'West', 'North', 'South']),
    Q('23 Nisan hangi bayramdır?', 'Which holiday is 23 April?', ['Ulusal Egemenlik ve Çocuk Bayramı', 'Cumhuriyet Bayramı', 'Zafer Bayramı', 'Gençlik ve Spor Bayramı'], ["National Sovereignty and Children's Day", 'Republic Day', 'Victory Day', 'Youth and Sports Day']),
    Q('Türkiye\'de kaç coğrafi bölge vardır?', 'How many geographical regions does Türkiye have?', ['7', '5', '9', '81']),
    Q('Hangisi bir ihtiyaçtır (istek değil)?', 'Which one is a need, not a want?', ['Su', 'Oyuncak araba', 'Çikolata', 'Oyun konsolu'], ['Water', 'A toy car', 'Chocolate', 'A games console']),
  ],
  ingilizce: [
    Q('"Elma" İngilizcede nasıl söylenir?', 'What is "elma" in English?', ['Apple', 'Orange', 'Banana', 'Grape']),
    Q('"Good morning" ne demektir?', 'What does "Good morning" mean in Turkish?', ['Günaydın', 'İyi geceler', 'Hoşça kal', 'Teşekkürler']),
    Q('"Blue" hangi renktir?', 'Which colour is "blue" in Turkish?', ['Mavi', 'Kırmızı', 'Yeşil', 'Sarı']),
    Q('"Seven" hangi sayıdır?', 'Which number is "seven"?', ['7', '6', '8', '17']),
    Q('"Kedi" İngilizcede nasıl söylenir?', 'What is "kedi" in English?', ['Cat', 'Dog', 'Bird', 'Fish']),
    Q('"Teacher" ne demektir?', 'What does "teacher" mean in Turkish?', ['Öğretmen', 'Öğrenci', 'Doktor', 'Aşçı']),
    Q('Hangisi haftanın bir günüdür?', 'Which one is a day of the week?', ['Monday', 'Summer', 'March', 'Morning']),
    Q('"Thank you" ne demektir?', 'What does "Thank you" mean in Turkish?', ['Teşekkür ederim', 'Özür dilerim', 'Merhaba', 'Lütfen']),
  ],
  muzik: [
    Q('Kaç temel nota vardır?', 'How many basic notes are there?', ['7', '5', '8', '12']),
    Q('İstiklal Marşı\'nın şairi kimdir?', 'Who wrote the words of the İstiklal Marşı?', ['Mehmet Akif Ersoy', 'Osman Zeki Üngör', 'Yunus Emre', 'Âşık Veysel']),
    Q('"Do"dan sonra hangi nota gelir?', 'Which note comes after "do"?', ['Re', 'Mi', 'Sol', 'La']),
    Q('Mandolin nasıl bir çalgıdır?', 'What kind of instrument is the mandolin?', ['Telli', 'Üflemeli', 'Vurmalı', 'Tuşlu'], ['A string instrument', 'A wind instrument', 'A percussion instrument', 'A keyboard instrument']),
    Q('Hangisi vurmalı çalgıdır?', 'Which one is a percussion instrument?', ['Davul', 'Flüt', 'Keman', 'Gitar'], ['Drum', 'Flute', 'Violin', 'Guitar']),
    Q('Notaların yazıldığı beş çizgiye ne denir?', 'What do we call the five lines that notes are written on?', ['Porte (dizek)', 'Ritim', 'Ölçü', 'Nakarat'], ['The staff', 'The rhythm', 'The bar', 'The chorus']),
    Q('İstiklal Marşı\'nın bestecisi kimdir?', 'Who composed the music of the İstiklal Marşı?', ['Osman Zeki Üngör', 'Mehmet Akif Ersoy', 'Barış Manço', 'Dede Efendi']),
    Q('Bir şarkının tekrar eden bölümüne ne denir?', 'What do we call the part of a song that repeats?', ['Nakarat', 'Nota', 'Porte', 'Anahtar'], ['The chorus', 'A note', 'The staff', 'The clef']),
  ],
  beden: [
    Q('Spora başlamadan önce ne yapılmalıdır?', 'What should you do before you start exercising?', ['Isınma hareketleri', 'Ağır bir yemek yemek', 'Hemen tam hızda koşmak', 'Uyumak'], ['Warm up', 'Eat a heavy meal', 'Sprint flat out straight away', 'Take a nap']),
    Q('Bir futbol takımı sahaya kaç oyuncuyla çıkar?', 'How many players does a football team field?', ['11', '5', '6', '9']),
    Q('Bir basketbol takımı sahada kaç oyuncuyla oynar?', 'How many players does a basketball team have on court?', ['5', '11', '6', '7']),
    Q('Olimpiyat bayrağında kaç halka vardır?', 'How many rings are on the Olympic flag?', ['5', '3', '4', '7']),
    Q('Spor yaparken en çok neyi içmeliyiz?', 'What should we drink most when we exercise?', ['Su', 'Gazoz', 'Çay', 'Kahve'], ['Water', 'Fizzy pop', 'Tea', 'Coffee']),
    Q('Voleybolda top neyin üzerinden karşı sahaya atılır?', 'In volleyball, what does the ball go over?', ['File', 'Kale', 'Pota', 'Çizgi'], ['The net', 'The goal', 'The hoop', 'The line']),
    Q('Hangisi takım sporu değildir?', 'Which one is not a team sport?', ['Yüzme', 'Futbol', 'Basketbol', 'Hentbol'], ['Swimming', 'Football', 'Basketball', 'Handball']),
    Q('Oyunda kurallara uymak ve rakibe saygı göstermek neyin gereğidir?', 'Following the rules and respecting your opponent is called…', ['Centilmenlik (fair play)', 'Hız', 'Güç', 'Şans'], ['Fair play', 'Speed', 'Strength', 'Luck']),
  ],
  din: [
    Q('Ramazan ayının sonunda hangi bayram kutlanır?', 'Which holiday is celebrated at the end of Ramadan?', ['Ramazan Bayramı', 'Kurban Bayramı', 'Cumhuriyet Bayramı', 'Nevruz']),
    Q('İslam dininin kutsal kitabı hangisidir?', 'Which is the holy book of Islam?', ['Kur\'an-ı Kerim', 'İncil', 'Tevrat', 'Zebur'], ["The Qur'an", 'The Gospel', 'The Torah', 'The Psalms']),
    Q('Karşılaştığımız birine "Selamün aleyküm" ya da "Merhaba" demeye ne denir?', 'What do we call saying "Selamün aleyküm" or "Hello" to someone we meet?', ['Selamlaşma', 'Vedalaşma', 'Tartışma', 'Şakalaşma'], ['Greeting', 'Saying goodbye', 'Arguing', 'Joking']),
    Q('Hangisi güzel ahlakın bir örneğidir?', 'Which one is an example of good character?', ['Doğru sözlü olmak', 'Yalan söylemek', 'Arkadaşını kırmak', 'Söz kesmek'], ['Telling the truth', 'Lying', 'Hurting a friend', 'Interrupting']),
    Q('Bir işe başlarken söylenen "Bismillah" sözüne ne denir?', 'What is the word "Bismillah", said when starting something, called?', ['Besmele', 'Tekbir', 'Selam', 'Dua'], ['The basmala', 'The takbir', 'A greeting', 'A prayer']),
    Q('Hz. Muhammed hangi şehirde doğmuştur?', 'In which city was the Prophet Muhammad born?', ['Mekke', 'Medine', 'Kudüs', 'İstanbul'], ['Mecca', 'Medina', 'Jerusalem', 'Istanbul']),
    Q('İhtiyacı olan birine yardım etmeye ne denir?', 'What do we call helping someone in need?', ['Yardımlaşma', 'Kıskançlık', 'İnatlaşma', 'Bencillik'], ['Helping one another', 'Jealousy', 'Stubbornness', 'Selfishness']),
    Q('Birinin iyiliğine karşılık ne söyleriz?', 'What do we say when someone does us a kindness?', ['Teşekkür ederim', 'Bana ne', 'Sus', 'Hiçbir şey'], ['Thank you', 'So what', 'Be quiet', 'Nothing']),
  ],
  teknoloji: [
    Q('Tasarım sürecinin ilk adımı hangisidir?', 'What is the first step of the design process?', ['Sorunu belirlemek', 'Ürünü satmak', 'Reklam yapmak', 'Boyamak'], ['Defining the problem', 'Selling the product', 'Advertising it', 'Painting it']),
    Q('Ampulü geliştiren mucit kimdir?', 'Which inventor developed the light bulb?', ['Thomas Edison', 'Graham Bell', 'Isaac Newton', 'Wright Kardeşler'], ['Thomas Edison', 'Graham Bell', 'Isaac Newton', 'The Wright brothers']),
    Q('Kullanılmış kâğıt, cam ve plastiği yeniden işe yarar hâle getirmeye ne denir?', 'What do we call making used paper, glass and plastic useful again?', ['Geri dönüşüm', 'İsraf', 'Tüketim', 'Üretim'], ['Recycling', 'Waste', 'Consumption', 'Production']),
    Q('Telefonun mucidi olarak kim bilinir?', 'Who is known as the inventor of the telephone?', ['Graham Bell', 'Thomas Edison', 'Marie Curie', 'Galileo']),
    Q('İnternette tanımadığın biri adresini sorarsa ne yaparsın?', 'A stranger on the internet asks for your address. What do you do?', ['Paylaşmam, bir büyüğüme söylerim', 'Hemen yazarım', 'Fotoğrafımı da gönderirim', 'Şifremi de veririm'], ["I don't share it, and I tell a grown-up", 'I type it right away', 'I send a photo too', 'I give my password too']),
    Q('Bir fikri denemek için yapılan ilk örnek ürüne ne denir?', 'What do we call the first sample made to test an idea?', ['Prototip', 'Fatura', 'Reklam', 'Ambalaj'], ['A prototype', 'An invoice', 'An advert', 'Packaging']),
    Q('Hangisi yenilenebilir bir enerji kaynağıdır?', 'Which one is a renewable energy source?', ['Güneş', 'Kömür', 'Petrol', 'Doğal gaz'], ['The Sun', 'Coal', 'Oil', 'Natural gas']),
    Q('Yeni bir şey bulan ya da icat eden kişiye ne denir?', 'What do we call someone who invents something new?', ['Mucit', 'Müşteri', 'Seyirci', 'Yolcu'], ['An inventor', 'A customer', 'A spectator', 'A passenger']),
  ],
};

/** a question for this subject, with its answers shuffled; `seed` keeps one lesson from repeating the last */
export function askFor(subject: SubjectId, seed: number): { q: Text; options: Text[]; answer: number } {
  const pool = QUESTIONS[subject];
  const base = pool[((seed % pool.length) + pool.length) % pool.length];
  const order = base.options.map((_, i) => i).sort(() => Math.random() - 0.5);
  return { q: base.q, options: order.map((i) => base.options[i]), answer: order.indexOf(base.answer) };
}
