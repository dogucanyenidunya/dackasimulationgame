// Who everyone is: a short type ("Sınıfın şakacısı") and a few lines about them, told the way the school talks about them.
// Students also get the story they tell you themselves when you first meet (bios.ts); grown-ups never introduce
// themselves that way, so for them this is all there is.
import type { Text } from '../i18n';

export interface Persona {
  /** the kind of person they are, in a couple of words */
  type: Text;
  /** what the school knows about them, in the third person */
  about: Text;
}

/** a full student bio, for the students who were generated but now have a story of their own (keyed by id; `name` must still match) */
export interface WrittenBio extends Persona {
  name: string;
  from: string;
  likes: Text;
  story: Text;
}

const T = (tr: string, en: string): Text => ({ tr, en });

/** the main cast (their first-meeting stories are in bios.ts) */
export const HAND_PERSONAS: Record<string, Persona> = {
  zeynep: { type: T('Hayalperest denizci', 'Dreamy sailor'), about: T(
    'Defterinin kenarları tekne çizimleriyle dolu. Teneffüste Boğaz\'a bakan pencereden ayrılmaz; vapurların adlarını tek tek bilir. Babasından kalan pusulayı hiç yanından ayırmaz.',
    'The margins of her notebooks are full of boats. At break she stays glued to the window that looks towards the Bosphorus and can name every ferry. She never goes anywhere without the compass her father left her.') },
  mert: { type: T('Enerji topu', 'Ball of energy'), about: T(
    'Zil çaldığı anda sınıftan ilk o fırlar. Kortta takım kurmak hep onun işidir ve kimseyi dışarıda bırakmaz. Derste yerinde duramadığı için Murat Hoca onu en ön sıraya oturttu.',
    "He's always first out of the door when the bell goes. Picking teams on the court is his job, and he never leaves anyone out. He can't sit still in class, so Murat Hoca has put him in the front row.") },
  defne: { type: T('Sessiz sanatçı', 'Quiet artist'), about: T(
    'Az konuşur, çok gözlemler. Herkesin bir karikatürü onun çizim defterinde vardır, ama defteri kimseye göstermez. Kantinin önündeki kedileri saatlerce çizebilir.',
    "She says little and notices everything. Everyone has a caricature in her sketchbook, though she shows it to nobody. She can spend hours drawing the cats outside the canteen.") },
  emre: { type: T('Sınıfın şakacısı', 'Class joker'), about: T(
    'Yemekhanede masadakileri güldürmeden çorbasını bitirmez. Şakalarının altında evini çok özleyen bir çocuk var; ablalarına her hafta mektup yazar. Eskrim takımına girmeyi kafasına koydu.',
    "He won't finish his soup until the whole table is laughing. Under the jokes is a boy who misses home badly; he writes to his sisters every week. He's set his heart on the fencing team.") },
  ayse: { type: T('Utangaç sporcu', 'Shy athlete'), about: T(
    'Kalabalıkta sesi çıkmaz ama raketi eline alınca bambaşka biri olur. Pazarları kapının önünde annesini bekler. Herkesin doğum gününü bir deftere yazmış, kimseninkini unutmaz.',
    "She goes quiet in a crowd, but with a racket in her hand she's someone else. On Sundays she waits by the gate for her mum. She has everyone's birthday written in a notebook and never forgets one.") },
  can: { type: T('Küçük tarihçi', 'Little historian'), about: T(
    'Okulun 1863\'ten beri süren hikâyesini öğretmenlerden iyi bilir. Müzedeki eski fotoğraflarda kendi dedesinin sınıfını aradığını söyler. Sesini hiç yükseltmez, ama anlatmaya başladı mı herkes susup dinler.',
    "He knows the school's story since 1863 better than the teachers. He says he's looking for his grandad's class in the old photos in the museum. He never raises his voice, but once he starts telling a story everyone goes quiet.") },
  burak: { type: T('Koruyucu kaptan', 'Protective captain'), about: T(
    'Basketbol takımının kaptanı ve küçüklerin gayriresmî abisi. İlk gece ağlayan dördüncü sınıfları o yatıştırır. Üniversitede beden eğitimi okuyup okula hoca olarak dönmek istiyor.',
    "Captain of the basketball team and the little ones' unofficial big brother. He's the one who calms down the 4th graders crying on their first night. He wants to study PE at university and come back as a teacher.") },
  ece: { type: T('Sahnenin yıldızı', 'Star of the stage'), about: T(
    'Tiyatro kulübünün başrol oyuncusu. Yağmurlu akşamlarda yurdun ortak salonunda küçüklere şiir okur. Utangaç çocukları kulübe getirmek onun gizli hobisi.',
    "The drama club's leading lady. On rainy evenings she reads poems to the younger girls in the dorm's common room. Getting shy kids into the club is her secret hobby.") },
};

/** the generated students, now with stories of their own (keyed by id, with the name they ended up with) */
export const WRITTEN: Record<string, WrittenBio> = {
  'classmate-0': { name: 'Nezir', from: 'Kars', likes: T('kar yağışını ve kalecilik yapmayı', 'snow and keeping goal'),
    type: T('Sessiz kaleci', 'Quiet goalkeeper'), about: T(
      'Kars\'ın karlı kışlarından geldi; İstanbul\'un ılık havasına hâlâ şaşırıyor. Az konuşur ama kalede bir duvar gibidir, kortta herkes onu takımına ister. Annesine her akşam aynı saatte telefon eder.',
      "He comes from Kars and its snowy winters; Istanbul's mild weather still surprises him. He hardly talks, but in goal he's a wall, and everyone wants him on their team. He phones his mum at the same time every evening."),
    story: T('Ben Nezir, Kars\'tan geldim. Babam tır şoförüydü; bir kazada kaybettik. Annemle babaannem orada. Bizde kış altı ay sürer, burada kar bile yağmıyor! Kaleye geçmeyi severim, kimse gol atamasın diye. Konuşmayı pek beceremem ama iyi bir dinleyiciyimdir.',
      "I'm Nezir, from Kars. My dad was a lorry driver; we lost him in an accident. My mum and my gran are there. Winter lasts six months back home, and here it doesn't even snow! I like going in goal, so nobody scores. I'm not much of a talker, but I'm a good listener.") },
  'classmate-1': { name: 'Onur', from: 'Bursa', likes: T('soru sormayı ve deney yapmayı', 'asking questions and doing experiments'),
    type: T('Soru makinesi', 'Question machine'), about: T(
      'Cebinde hep "Neden?" defteri var; cevabını bulamadığı her soruyu oraya yazıyor. Müge Hoca onun yüzünden fen dersine her gün fazladan beş dakika ayırıyor. Büyüyünce bilim insanı olacağından emin.',
      'There\'s always a "Why?" notebook in his pocket; every question he can\'t answer goes in it. Because of him, Müge Hoca leaves five extra minutes at the end of every science lesson. He\'s sure he\'ll be a scientist.'),
    story: T('Ben Onur, Bursa\'dan. Annemi iki yıl önce kaybettim. Babam otobüs şoförü, ablam da lisede. Her şeyin nasıl çalıştığını merak ederim: neden gök mavi, neden ekmek kabarır? Defterimde 214 soru var, 37\'sinin cevabını buldum. Senin bir sorun var mı?',
      "I'm Onur, from Bursa. I lost my mum two years ago. My dad drives a bus and my big sister is at high school. I want to know how everything works: why is the sky blue, why does bread rise? I've got 214 questions in my notebook and I've answered 37. Have you got one for me?") },
  'classmate-2': { name: 'Yiğithan', from: 'Hatay', likes: T('origami yapmayı ve künefeyi', 'origami and künefe'),
    type: T('Origami ustası', 'Origami master'), about: T(
      'Bir kâğıt parçasından turna, kurbağa, hatta ejderha katlayabilir. Kâğıt turnalarını tanımadığı çocukların yastıklarına bırakır. Depremden sonra geldi; yeni bir yere alışmanın ne demek olduğunu herkesten iyi bilir.',
      "He can fold a crane, a frog or even a dragon out of any scrap of paper, and leaves paper cranes on the pillows of kids he hasn't met yet. He came after the earthquake, and knows better than anyone what it's like to start over somewhere new."),
    story: T('Ben Yiğithan, Antakya\'dan geldim. Depremde babamı ve evimizi kaybettik. Annem ve kardeşimle şimdi teyzemlerde kalıyoruz. Origami yapmayı severim; bin turna katlayan dileğine kavuşurmuş, ben 600\'deyim. Künefeyi de çok özledim. Sana bir turna katlayayım mı?',
      "I'm Yiğithan, from Antakya. In the earthquake we lost my dad and our house. My mum, my little brother and I live with my aunt now. I love origami; they say if you fold a thousand cranes you get a wish, and I'm on 600. I really miss künefe too. Shall I fold you a crane?") },
  'classmate-3': { name: 'Kardelen', from: 'Erzurum', likes: T('yastık savaşlarını ve kar topunu', 'pillow fights and snowballs'),
    type: T('Gizli planlar ustası', 'Mastermind of mischief'), about: T(
      'Yurttaki gece yarısı yastık savaşlarının mimarı olduğu söyleniyor, ama hiç yakalanmadı. Üç ağabeyle büyüdüğü için kimseden korkmaz. Haksızlığa uğrayan birini görürse herkesten önce o araya girer.',
      "They say she's behind the midnight pillow fights in the dorm, but she's never been caught. Growing up with three big brothers, she's scared of nobody. If she sees someone treated unfairly, she's the first to step in."),
    story: T('Ben Kardelen, Erzurumluyum. Adımı karın altından çıkan çiçekten almışım. Annemi kaybettim; babam ve üç ağabeyimle büyüdüm, o yüzden biraz hırçınım. Plan yapmayı severim, özellikle gizli olanları! Kuralları sevmem ama sözümü hep tutarım.',
      "I'm Kardelen, from Erzurum. I'm named after the flower that comes up through the snow. I lost my mum; I grew up with my dad and three big brothers, so I'm a bit fierce. I love making plans, especially secret ones! I'm not fond of rules, but I always keep my word.") },
  'classmate-4': { name: 'Aylin', from: 'Adana', likes: T('koşmayı ve adana kebabını', 'running and Adana kebab'),
    type: T('Hız tutkunu', 'Speed lover'), about: T(
      'Dördüncü sınıfların en hızlısı; Kemal Hoca bile kronometreye iki kez baktı. Her sabah kalkış zilinden önce sahada bir tur atar. Annesi gece vardiyasında çalışan bir hemşire; Aylin de Revir\'deki Gül Hanım\'a çok yardım eder.',
      "The fastest 4th grader; even Kemal Hoca checked his stopwatch twice. She does a lap of the pitch every morning before the wake-up bell. Her mum is a nurse on night shifts, and Aylin is always helping Gül Hanım in the infirmary."),
    story: T('Ben Aylin, Adana\'dan geliyorum. Babamı kaybettim; annem hemşire, geceleri çalışıyor. Koşmaya bayılırım, rüzgârı yüzümde hissetmek gibisi yok! Bir gün olimpiyatlarda koşacağım. Yavaş yürüyenler beni biraz deli eder, söylemiş olayım.',
      "I'm Aylin, from Adana. I lost my dad; my mum's a nurse who works nights. I love running, there's nothing like the wind in your face! One day I'll run at the Olympics. Slow walkers drive me a bit crazy, just so you know.") },
  'classmate-5': { name: 'Gizem', from: 'Sinop', likes: T('polisiye kitapları ve bilmeceleri', 'detective stories and riddles'),
    type: T('Bulmaca dedektifi', 'Puzzle detective'), about: T(
      'Kampüsün çözülmemiş gizemleri için bir "dava defteri" tutuyor: kütüphanedeki gizli raf, gece yanan tek pencere, Yetim\'in nerede uyuduğu. Bir şeyi kaybeden ilk ona gider. Adına yakışır biçimde sırları çok iyi saklar.',
      "She keeps a \"case book\" of the campus's unsolved mysteries: the secret shelf in the library, the one window lit at night, where Yetim sleeps. Anyone who loses something goes to her first. True to her name (Gizem means mystery), she keeps secrets very well."),
    story: T('Ben Gizem, Sinop\'tan. Babamı kaybettim, babaannemle yaşıyorum. Polisiye kitapları, bilmeceleri ve ipucu toplamayı severim. Kütüphanede gizli bir raf varmış, onu bulacağım! Yalan söyleyenleri hemen anlarım, ona göre.',
      "I'm Gizem, from Sinop. I lost my dad and live with my gran. I love detective books, riddles and collecting clues. They say there's a secret shelf in the library, and I'm going to find it! I can always tell when someone's lying, so watch out.") },
  'student-0': { name: 'Merve', from: 'İstanbul', likes: T('yazı yazmayı ve röportaj yapmayı', 'writing and interviewing people'),
    type: T('Okul gazetesinin kalemi', "The school paper's pen"), about: T(
      'Yedinci sınıfta ama okul gazetesinin en çalışkan muhabiri. Elinde not defteriyle herkese soru sorar; yemekhane menüsünden maç skorlarına her şeyi yazar. Bir gün senin de röportajını yapmak istiyor.',
      "Only in 7th grade but the school paper's hardest-working reporter. Notebook in hand, she questions everyone and writes about everything from the dining hall menu to the match scores. One day she wants to interview you."),
    story: T('Ben Merve, Kadıköy\'denim, yani aslında çok uzaktan gelmedim! Annemi kaybettim, babam ve kardeşimle yaşıyorum. Okul gazetesinde yazıyorum. Herkesin anlatacak bir hikâyesi var, ben de onları topluyorum. Seninki ne?',
      "I'm Merve, from Kadıköy, so I didn't actually come very far! I lost my mum; I live with my dad and my little brother. I write for the school paper. Everyone has a story to tell and I collect them. What's yours?") },
  'student-1': { name: 'Nehir', from: 'Muğla', likes: T('kestirme yollar bulmayı ve ağaçlara tırmanmayı', 'finding shortcuts and climbing trees'),
    type: T('Kaçak keşifçi', 'Runaway explorer'), about: T(
      'Kampüsün her köşesini, her kestirmesini bilir; kaybolan küçüklere yolu o gösterir. Ağaçlara tırmandığı için belletmenlerden çok uyarı aldı. Haritası olmayan yer onun için en heyecanlısıdır.',
      "She knows every corner and every shortcut on campus; lost little ones get shown the way by her. She's been told off by the belletmens many times for climbing trees. A place with no map is the most exciting kind for her."),
    story: T('Ben Nehir, Muğla\'dan, zeytin ağaçlarının arasından geldim. Babamı kaybettim; annem ve iki ağabeyim orada. Kampüsün bütün kestirmelerini biliyorum, istersen gösteririm. Kapalı kapılar ve "girmek yasak" yazıları beni çok meraklandırır.',
      "I'm Nehir, from Muğla, from among the olive trees. I lost my dad; my mum and my two big brothers are there. I know all the shortcuts on campus, I'll show you if you like. Closed doors and \"no entry\" signs make me really curious.") },
  'student-2': { name: 'İpek', from: 'Bolu', likes: T('voleybolu ve orman yürüyüşlerini', 'volleyball and walks in the woods'),
    type: T('Voleybol smaçörü', 'Volleyball spiker'), about: T(
      'Yaşıtlarından bir baş uzun; voleybol takımı onu ilk haftada kaptı. Smaçları kadar sabrıyla da bilinir: yeni başlayanlara pas atmayı o öğretir. Orman kokusunu özlediği için hep çam kozalağı toplar.',
      "A head taller than everyone her age; the volleyball team snapped her up in the first week. She's known for her patience as much as her spikes: she's the one who teaches beginners to set. She misses the smell of the forest, so she's always collecting pine cones."),
    story: T('Ben İpek, Bolu\'dan. Babam orman bekçisiydi; onu kaybettik. Annemle anneannem Bolu\'da. Voleybolu ve ormanda yürümeyi severim. Uzun boyluyum diye herkes basketbol oynamamı istiyor ama ben voleybolcuyum!',
      "I'm İpek, from Bolu. My dad was a forest ranger; we lost him. My mum and my gran are in Bolu. I love volleyball and walking in the forest. Everyone wants me to play basketball because I'm tall, but I'm a volleyball player!") },
  'student-3': { name: 'İzay', from: 'Van', likes: T('satrancı ve kahvaltıyı', 'chess and breakfast'),
    type: T('Satranç dahisi', 'Chess prodigy'), about: T(
      'Dördüncü sınıfta ama okulun satranç kulübünde lise abilerini yeniyor. Etütten sonra Selim Hoca ile tek bir maç oynamasına izin var; o maç bazen bir hafta sürüyor. Kaybettiğinde kızmaz, nerede hata yaptığını defterine yazar.',
      "Only in 4th grade, but he beats the high schoolers at chess club. After study time he's allowed one game with Selim Hoca, and that game sometimes lasts a week. He never sulks when he loses; he writes down where he went wrong."),
    story: T('Ben İzay, Van\'dan. Annemi kaybettim; babam ve dedemle yaşıyorum. Dedem bana satrancı dört yaşımda öğretti. Bir de Van kahvaltısını çok özlüyorum, otlu peynir yok burada! Benimle bir maç yapar mısın? Söz, yavaş oynarım.',
      "I'm İzay, from Van. I lost my mum; I live with my dad and my grandad. Grandad taught me chess when I was four. And I really miss a Van breakfast, there's no herb cheese here! Will you play me? I promise I'll go slow.") },
  'student-4': { name: 'Yağmur', from: 'Rize', likes: T('şarkı söylemeyi ve çay kokusunu', 'singing and the smell of tea'),
    type: T('Koro solisti', 'Choir soloist'), about: T(
      'Nevin Hoca\'nın korosunda solo söyleyen en küçük öğrenci. Yatakhanede karadeniz türküleri mırıldanır, odadakiler onunla uykuya dalar. Sahneye çıkmadan önce hep elleri titrer ama sesi hiç titremez.',
      "The youngest soloist in Nevin Hoca's choir. She hums Black Sea folk songs in the dorm and her roommates fall asleep to them. Her hands always shake before she goes on stage, but her voice never does."),
    story: T('Ben Yağmur, Rize\'den. Adım gibi bizde hep yağmur yağar! Annemi kaybettim; babam çay bahçesinde çalışıyor. Şarkı söylemeyi çok severim, en çok da annemin söylediği türküleri. Karanlıktan biraz korkarım, kimseye söyleme.',
      "I'm Yağmur, from Rize. Like my name, it always rains back home! I lost my mum; my dad works in the tea gardens. I love singing, most of all the folk songs my mum used to sing. I'm a bit scared of the dark, don't tell anyone.") },
  'student-5': { name: 'Nisa', from: 'Aydın', likes: T('hayvanları ve inciri', 'animals and figs'),
    type: T('Hayvan dostu', 'Friend to animals'), about: T(
      'Kampüsteki bütün kedilerin, kuşların ve hatta kirpinin adını bilir. Yemekhaneden peçeteye sarıp kaçırdığı köfteler Yetim\'e gider, herkes bilir ama kimse söylemez. Veteriner olmaya karar vermiş.',
      "She knows the name of every cat and bird on campus, even the hedgehog. The köfte she smuggles out of the dining hall in a napkin goes to Yetim; everyone knows, and nobody tells. She's decided to become a vet."),
    story: T('Ben Nisa, Aydın\'dan, incir bahçelerinin oradan. Babamı kaybettim; annem ve teyzemle yaşıyorum. Hayvanları insanlardan çok severim, belki biraz fazla! Meydandaki kedi Yetim benim en iyi arkadaşım. Büyüyünce veteriner olacağım.',
      "I'm Nisa, from Aydın, from the fig orchards. I lost my dad; I live with my mum and my aunt. I like animals more than people, maybe a bit too much! Yetim, the cat on the square, is my best friend. I'm going to be a vet.") },
  'student-6': { name: 'Gökmen', from: 'Malatya', likes: T('basketbolu ve kayısıyı', 'basketball and apricots'),
    type: T('Basketbol fanatiği', 'Basketball fanatic'), about: T(
      'Darüşşafaka basketbol takımının bütün oyuncularını, formalarının numaralarıyla bilir. Maç gecesi tribünde davulun yanından ayrılmaz. Boyu kısa ama "Ben de bir gün o parkede oynayacağım" diyor ve buna gerçekten inanıyor.',
      "He knows every Darüşşafaka basketball player and their shirt number. On match night he never leaves the drum in the stand. He's short, but he says \"one day I'll play on that court too\", and he truly believes it."),
    story: T('Ben Gökmen, Malatya\'dan. Annemi kaybettim; babam ve ağabeyimle yaşıyorum. Babam her ay bir kutu kayısı yollar, istersen paylaşırız! Basketbolu her şeyden çok severim. Darüşşafaka\'nın maçlarını hiç kaçırmam.',
      "I'm Gökmen, from Malatya. I lost my mum; I live with my dad and my big brother. Dad sends a box of apricots every month, we can share if you like! I love basketball more than anything. I never miss a Darüşşafaka game.") },
  'student-7': { name: 'Şahan', from: 'Kocaeli', likes: T('robot yapmayı ve eski radyoları sökmeyi', 'building robots and taking old radios apart'),
    type: T('Robot yapımcısı', 'Robot builder'), about: T(
      'Sevgi Hoca\'nın robotik kulübünün yıldızı. Yatağının altındaki kutu kablolar, pil ve eski oyuncak motorlarıyla dolu. Bozulan her şeyi ona götürürler; çoğunu da çalışır hâle getirir.',
      "The star of Sevgi Hoca's robotics club. The box under his bed is full of wires, batteries and old toy motors. Anything broken gets taken to him, and he gets most of it working again."),
    story: T('Ben Şahan, İzmit\'ten. Babam mühendisti; onu kaybettik. Bana kalan en güzel şey alet çantası. Annem ve kız kardeşimle yaşıyorum. Bir şeyin içini açıp nasıl çalıştığını görmeye bayılırım. Şu an, odayı toplayan bir robot yapıyorum!',
      "I'm Şahan, from İzmit. My dad was an engineer; we lost him. The best thing he left me is his toolbox. I live with my mum and my little sister. I love opening things up to see how they work. Right now I'm building a robot that tidies the room!") },
  'student-8': { name: 'Elif', from: 'Kütahya', likes: T('çini boyamayı ve çamurla oynamayı', 'painting tiles and playing with clay'),
    type: T('Çini sanatçısı', 'Tile painter'), about: T(
      'Kütahya\'nın çinicilerinden birinin torunu. Resim atölyesinde çamurdan yaptığı küçük kâseler okulun sergisinde yer aldı. Ellerinde hep boya lekesi olur, yemekhanede bile.',
      "The granddaughter of one of Kütahya's tile makers. The little clay bowls she made in the art room were shown in the school exhibition. There's always paint on her hands, even at dinner."),
    story: T('Ben Elif, Kütahya\'dan. Dedem çini ustası; annemi kaybedince bana o baktı, şimdi babamla birlikte yaşıyorlar. Çini boyamak sabır ister, ben de sabırlıyımdır. Dağınıklığı hiç sevmem, ama boyalarım hep etrafa saçılır!',
      "I'm Elif, from Kütahya. My grandad is a tile master; when I lost my mum he looked after me, and now he lives with my dad. Painting tiles takes patience, and I'm patient. I hate mess, but my paints always end up everywhere!") },
  'student-9': { name: 'Murad', from: 'Gaziantep', likes: T('taklit yapmayı ve baklavayı', 'doing impressions and baklava'),
    type: T('Taklit ustası', 'Master of impressions'), about: T(
      'Okuldaki bütün hocaların taklidini yapar; Murat Hoca\'nın "Sessiz olun!" deyişi en meşhuru. Bir keresinde Ercan Hoca\'nın taklidini yaparken arkasında Ercan Hoca vardı. O bile güldü.',
      "He can do every teacher in the school; his Murat Hoca saying \"Quiet, please!\" is the most famous. Once he was doing Ercan Hoca while Ercan Hoca was standing right behind him. Even he laughed."),
    story: T('Ben Murad, Antep\'ten. Babamı kaybettim; annem ve üç kız kardeşimle yaşıyorum, evin tek erkeği benim! İnsanları güldürmeyi severim, en çok da taklit yaparak. Baklava deyince aklıma hep annem gelir. Sıkıcı derslerde uyuklarım, sakın söyleme.',
      "I'm Murad, from Antep. I lost my dad; I live with my mum and my three sisters, so I'm the man of the house! I love making people laugh, especially with impressions. Baklava always makes me think of my mum. I nod off in boring lessons, don't tell.") },
  'student-10': { name: 'Ömer', from: 'Ordu', likes: T('futbolu ve fındıklı çikolatayı', 'football and hazelnut chocolate'),
    type: T('Kaptan adayı', 'Captain in the making'), about: T(
      'Altıncı sınıfların futbol takımının kaptanı ve Burak Abi\'nin en sadık takipçisi. Maçtan sonra kaybeden takımın elini ilk o sıkar. Sınıf temsilciliğine de aday olmayı düşünüyor.',
      "Captain of the 6th graders' football team and Burak Abi's most loyal follower. After a match he's the first to shake hands with the losing side. He's thinking of running for class rep too."),
    story: T('Ben Ömer, Ordu\'dan, fındık bahçelerinin oradan. Annemi kaybettim; babam ve babaannemle yaşıyorum. Futbol takımının kaptanıyım, Burak Abi gibi olmak istiyorum. Haksız oynayanlara çok kızarım. Bir gün sen de takıma gel!',
      "I'm Ömer, from Ordu, where the hazelnut orchards are. I lost my mum; I live with my dad and my gran. I captain our football team and I want to be like Burak Abi. Players who cheat make me so angry. Come and join the team one day!") },
  'student-11': { name: 'Tuna', from: 'Çanakkale', likes: T('yıldızlara bakmayı ve gemileri', 'stargazing and ships'),
    type: T('Gökyüzü gözlemcisi', 'Stargazer'), about: T(
      'Sekizinci sınıfta, LGS\'ye hazırlanıyor ama gece göğünden kopamıyor. Selim Hoca ile aralarında bir anlaşma var: bulutsuz gecelerde nöbet kulübesinin önünden on dakika yıldızlara bakabiliyor. Küçüklere takımyıldızlarını o öğretir.',
      "In 8th grade and studying for the LGS exam, but he can't tear himself away from the night sky. He has a deal with Selim Hoca: on clear nights he gets ten minutes of stargazing outside the duty hut. He's the one who teaches the little ones the constellations."),
    story: T('Ben Tuna, Çanakkale\'den. Babam kaptandı; onu denizde kaybettik. Annem ve kardeşimle yaşıyorum. Geceleri yıldızlara bakarım, babam bana yönü onlarla bulmayı öğretmişti. Bu yıl sınava gireceğim; çok çalışmam lazım ama gökyüzü beni hep çağırıyor.',
      "I'm Tuna, from Çanakkale. My dad was a ship's captain; we lost him at sea. I live with my mum and my little brother. At night I look at the stars; Dad taught me to find my way by them. I take the big exam this year; I need to study hard, but the sky keeps calling.") },
  'abi-0': { name: 'Berk Abi', from: 'Denizli', likes: T('gitar çalmayı ve eski şarkıları', 'playing guitar and old songs'),
    type: T('Müzisyen abi', 'The musician'), about: T(
      'Akşamları yurdun ortak salonunda gitar çalar, küçükler etrafına toplanır. Okul gruplarının hepsinde çalmış; mezuniyet töreninde kendi bestesini çalacağı konuşuluyor. Ev özlemini en iyi o anlar.',
      "In the evenings he plays guitar in the dorm common room and the little ones gather round. He's played in every school band; people say he'll play his own song at graduation. Nobody understands homesickness better."),
    story: T('Ben Berk, Denizli\'den geldim, altı yıl oldu. Annemi kaybettim; babam ve ablam orada. İlk yılımda her gece gitarımı çalarak uyurdum, şimdi küçükler için çalıyorum. Bir şarkı istersen söyle, bilmiyorsam öğrenirim!',
      "I'm Berk; I came from Denizli six years ago. I lost my mum; my dad and my big sister are there. My first year I played my guitar every night to fall asleep, and now I play for the little ones. Ask me for a song; if I don't know it, I'll learn it!") },
  'abi-1': { name: 'Mirza Abi', from: 'Erzincan', likes: T('münazarayı ve satrancı', 'debating and chess'),
    type: T('Meclis başkanı', 'Council president'), about: T(
      'Öğrenci meclisinin başkanı. Yemekhanede pilav günü sayısını artıran önergeyi o vermiş, bu yüzden çok sevilir. Sakin konuşur, kimseyi kırmadan "hayır" demeyi bilir.',
      "President of the student council. He's the one who got more rice days in the dining hall, which is why everyone loves him. He speaks calmly and knows how to say no without hurting anyone."),
    story: T('Ben Mirza, Erzincan\'dan. Babamı kaybettim; annem öğretmen, kardeşlerimle orada. Yedi yıldır buradayım. Öğrenci meclisinin başkanıyım; bir derdin olursa önerini bana getir, birlikte çözelim. Hukuk okumak istiyorum.',
      "I'm Mirza, from Erzincan. I lost my dad; my mum's a teacher and she's there with my siblings. I've been here seven years. I'm the student council president; if anything bothers you, bring me your idea and we'll sort it out together. I want to study law.") },
  'abi-2': { name: 'Asel Abla', from: 'Kayseri', likes: T('matematiği ve mantıyı', 'maths and mantı'),
    type: T('Olimpiyat ablası', 'Olympiad girl'), about: T(
      'Matematik olimpiyatında madalya almış. Etüt saatinde dördüncü sınıflara bölme öğretmek için sırada bekleyenler olur. Zor bir soruyu çözünce çıkardığı küçük zafer çığlığı yurtta meşhurdur.',
      "She won a medal at the maths olympiad. At study time 4th graders queue up for her to explain division. The little victory squeal she lets out when she cracks a hard problem is famous in the dorm."),
    story: T('Ben Asel, Kayseri\'den. Annemle babamı küçükken kaybettim; teyzem büyüttü beni. Matematik benim için bir oyun gibi. Ödevde takılırsan etütte yanıma gel. Bir de mantı yapmayı bilirim, Kayserili olup da bilmemek olmaz!',
      "I'm Asel, from Kayseri. I lost both my parents when I was little; my aunt raised me. Maths is like a game to me. If you get stuck on homework, come and find me at study time. And I can make mantı, of course: you can't be from Kayseri and not know how!") },
};

/** the grown-ups: teachers, the deputy head and the belletmens */
export const STAFF: Record<string, Persona> = {
  'ogr-turkce': { type: T('Kitap aşığı', 'Book lover'), about: T(
    'Kendisi de bir Daçkalı: bu okuldan mezun olup öğretmen olarak geri döndü. Her derse bir şiirle başlar ve dönem sonunda herkesin okuduğu kitapları bir duvara asar. "Kelimeler sizin en sadık arkadaşınız" demeyi sever.',
    'A Daçkalı herself: she graduated from this school and came back to teach. She starts every lesson with a poem, and at the end of term pins the books everyone has read on a wall. "Words are your most loyal friends," she likes to say.') },
  'ogr-matematik': { type: T('Çaycı sınıf öğretmeni', 'Tea-loving homeroom teacher'), about: T(
    'Yirmi yıldır bu okulda; sınıf öğretmenin ve elinde hep ince belli bir bardak çay. Ödev konusunda çok serttir ama adildir. Masasındaki kavanozda limonlu şekerler durur: en zor soruyu çözen bir tane alır.',
    'Twenty years at the school, your homeroom teacher, and never without a tulip glass of tea. He is strict about homework, but fair. There\'s a jar of lemon sweets on his desk: whoever solves the hardest problem gets one.') },
  'ogr-fen': { type: T('Deneyci', 'The experimenter'), about: T(
    'Öğretmen olmadan önce bir laboratuvarda araştırmacıydı. Derslerinde sirkeli volkanlar patlar, fasulyeler pencere önünde filizlenir. Onur\'un bitmeyen soruları için dersin sonuna her gün beş dakika ayırır.',
    "Before teaching she was a researcher in a lab. In her lessons vinegar volcanoes erupt and beans sprout on the windowsill. She saves five minutes at the end of every lesson for Onur's never-ending questions.") },
  'ogr-sosyal': { type: T('Hikâyeci tarihçi', 'Storytelling historian'), about: T(
    'Tarihi bir masal gibi anlatır; derslerinde kimse saate bakmaz. Sınıfın duvarı onun çizdiği haritalarla kaplı. Her yıl öğrencilerini okulun müzesine götürüp 1863\'te kurulan okulun ilk günlerini anlatır.',
    "She tells history like a fairy tale; nobody looks at the clock in her lessons. The classroom wall is covered in maps she drew herself. Every year she takes her pupils to the school museum and tells them about the school's first days in 1863.") },
  'ogr-ingilizce': { type: T('Gezgin', 'The traveller'), about: T(
    'Yıllarca yurt dışında yaşamış, otuzdan fazla ülke görmüş. İngilizceyi şarkılarla ve oyunlarla öğretir; derslerinde herkes en az bir kez dans eder. Masasının üstünde dünyanın her yerinden kartpostallar var.',
    "She lived abroad for years and has seen more than thirty countries. She teaches English through songs and games; everyone dances at least once in her lessons. Her desk is covered in postcards from all over the world.") },
  'ogr-muzik': { type: T('Koro şefi', 'Choir leader'), about: T(
    'Okul korosunun şefi; Darüşşafaka Marşı\'nı ondan dinlemeyen kalmamıştır. Sesi olmadığını düşünen çocuklara bile koroda bir yer bulur. Mandolin derslerini de o verir.',
    "She leads the school choir; nobody has heard the Darüşşafaka March sung like hers. She finds a place in the choir even for kids who think they can't sing. She teaches the mandolin lessons too.") },
  'ogr-beden': { type: T('Düdüklü antrenör', 'Coach with a whistle'), about: T(
    'Gençliğinde profesyonel basketbolcuydu, dizindeki sakatlık yüzünden bıraktı. Düdüğü sert, kalbi yumuşaktır. Okulun bütün takımlarının seçmelerini o yapar ve "Vazgeçmeyen kazanır" diye tekrarlar durur.',
    'He played professional basketball in his youth until a knee injury ended it. His whistle is harsh and his heart is soft. He runs the try-outs for every school team and keeps repeating "Whoever doesn\'t give up wins."') },
  'ogr-din': { type: T('Bilge dede', 'The wise grandad'), about: T(
    'Okulun en yaşlı öğretmeni; bembeyaz saçları ve yumuşak sesiyle herkesin dedesi gibi. Derslerinde iyilik, dürüstlük ve paylaşmak üzerine hikâyeler anlatır. Teneffüste bahçedeki çınarın altında oturup dertleşmek isteyenleri bekler.',
    'The oldest teacher in the school; with his white hair and soft voice he\'s like everyone\'s grandad. In his lessons he tells stories about kindness, honesty and sharing. At break he sits under the plane tree in the garden for anyone who wants to talk.') },
  'ogr-teknoloji': { type: T('Mucit', 'The inventor'), about: T(
    'Robotik kulübünü kurdu; atölyesinde lehim kokusu hiç eksik olmaz. Öğrencileriyle yaptığı güneş enerjili saksı sulayıcı bir yarışmada ödül aldı. "Bozduğunuz şeyi tamir etmeyi öğrenin" der.',
    'She founded the robotics club; her workshop always smells of solder. A solar-powered plant waterer she built with her pupils won a prize at a competition. "Learn to fix what you break," she says.') },
  'mdr-yrd': { type: T('Kuralların bekçisi', 'Keeper of the rules'), about: T(
    'Geç kâğıdını o verir, dersi asanı o bulur; koridorda topuk sesini duyan herkes doğrulur. Ama çekmecesinde her öğrencinin başarılarını yazdığı bir dosya tuttuğu söylenir. Kural koyar çünkü herkesin güvende olmasını ister.',
    "She hands out the late slips and finds anyone skipping class; hear her heels in the corridor and everyone stands up straight. But they say she keeps a file in her drawer of every pupil's achievements. She makes rules because she wants everyone safe.") },
  'bel-hatice': { type: T('Yurdun annesi', "The dorm's mother"), about: T(
    'Kız yurdunun belletmeni ve kendisi de eski bir Daçkalı. Işıklar sönmeden önce küçüklerin odalarını tek tek dolaşıp iyi geceler der. Kurallara sıkı bağlıdır ama ağlayan bir çocuğun yanından kalkmaz.',
    "The girls' dorm belletmen, and a former Daçkalı herself. Before lights out she goes round the little ones' rooms one by one to say good night. She sticks to the rules, but she won't leave a crying child's side.") },
  'bel-mehmet': { type: T('Sert ama adil', 'Strict but fair'), about: T(
    'Erkek yurdunun belletmeni. Gençliğinde güreşçiymiş, gür sesi bütün meydanı tutar. Herkes ondan çekinir ama hasta olan çocuğa gece yarısı ıhlamur yapan da odur.',
    "The boys' dorm belletmen. He was a wrestler in his youth, and his booming voice carries across the whole plaza. Everyone is wary of him, but he's also the one who makes linden tea at midnight for a sick boy.") },
  'bel-selim': { type: T('Gecenin bekçisi', 'Keeper of the night'), about: T(
    'Gece nöbetçisi; elinde feneriyle kampüsü sabaha kadar dolaşır. Gündüzleri uyur, geceleri yıldızlara bakar; bütün takımyıldızlarını bilir. Yurttan kaçanları bulmakta üstüne yoktur, ama yakaladıklarına önce bir bardak sıcak süt verir.',
    "The night watchman, who walks the campus with his torch until morning. He sleeps by day and watches the stars by night, and knows every constellation. Nobody is better at finding kids who sneak out, but he gives everyone he catches a glass of warm milk first.") },
};
