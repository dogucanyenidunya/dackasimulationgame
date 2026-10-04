# Daçka — Game Design Document

**Version:** 0.8 · **Date:** 2026-10-03
**Changes in 0.8:**
- Compact campus with buildings about half their old size
- Unnamed friend groups
- Art pass, night lighting, seasonal particles, sound and background music

**Changes in 0.7:**
- Evening rules (study time, dorm plaza, lights out)
- Belletmens and sneaking out
- Lesson choices
- Relationships, friend groups and bad surprises
- 40 students

**Changes in 0.6:**
- Year 1 missions are a chain that unlocks school life step by step
- Dorm blocks A1–A3, 4 floors and 14 sections, moving up every year

**Changes in 0.5:**
- Year 1 missions defined
- Health and sickness system
- Favor Board
- Pool, fencing and tennis
- Ambar supply room
- Player romance within ±2 years of real age

**Changes in 0.4:**
- Girls' dorm in the north-west and boys' dorm in the north-east, with the new Yurt Meydanı (dorm plaza) between them
- The academic building is narrower, in the center-west, with the library inside
- The dining hall (Yemekhane & Sosyal Merkez) is in the center-east
- The infirmary is on floor −1 of the girls' dorm, open to everyone

**Changes in 0.3:**
- Combined dorms (boys/girls) facing each other
- One academic building
- No football field
- Start at the main gate, buildings hidden until discovered
- Romance from Year 4, any genders

**Changes in 0.2:**
- Name is **Daçka**
- Campus is built from the real aerial render
- Prep year confirmed
- Loss-of-a-parent backstory with skills
- Romance with age rules

> This is a living plan. Sections marked **[DECIDE]** need your input; numbers marked **[TUNE]** are starting values that playtesting will change.

---

## 0. Decisions made so far

| Topic | Decision |
|---|---|
| Platform | Web browser, desktop first; mobile browser later |
| Visual style | 2D top-down pixel art (like Stardew Valley or Pokémon) |
| Multiplayer | Cohort worlds: players who start together form a *devre* and share a live campus |
| Pacing | Player-paced: a school year ends when *you* complete its requirements |
| Languages | Turkish (primary) + English |
| Persistence | Server-side saves; your progress follows your account to any device |
| Name | **Daçka**, used as both the game title and the school's name in the game |
| Campus | Adapted from the real aerial render ([reference/campus-layout.svg](reference/campus-layout.svg)). **North:** girls' dorm (with the infirmary at −1) · dorm plaza · boys' dorm. **Center:** academic building + library · central plaza · dining hall. **South:** Cemiyet + Müze · Spor Salonu · court · Teknik Alan. No football field |
| Start & exploration | Every player starts at the **Ana Kapı (main gate)**. Buildings stay hidden until explored and interacted with (§4.4) |
| School structure | 10 years: grades 4–8, then **prep (*hazırlık*)**, then grades 9–12 |
| Backstory | The player chooses who they lost and how. Their story gives them a unique strength (§5.2) |
| Romance | Included from Year 4 (age 12), between any genders. Under 16: hanging out and holding hands only. 16+: hugs, a kiss on the cheek, a dance partner. Nothing sexual, ever. Between players: real ages within ±2 years, and never between an adult and a minor (§10.7) |
| Year 1 missions | Explore the campus, registration and kit, 5 friends, pass exams, a sandwich from an abi, three meals, a library book, join a sport, plus the healthy-year challenge (§9) |

---

## 1. Vision

You arrive at Daçka as a 9-year-old boarder with a suitcase and no friends. Ten school years later you walk out as a graduate with a diploma, a yearbook full of signatures and friends who grew up with you. Some of those friends are other real players.

### Design pillars
1. **Growing up together.** The core fantasy is the bond with your cohort (*devre*). Multiplayer exists to make that bond real.
2. **Authentic boarding-school life.** The game follows the real rhythm: the bell, *etüt* (evening study), the dining hall, lights-out, report cards (*karne*), weekend leave, ceremonies.
3. **Every path is valid.** Top student, sports star, class clown, artist or leader: each path has its own rewards and endings.
4. **Small choices, long memory.** A fight in Year 2 or a friendship in Year 4 still matters in Year 10.
5. **Safe and kind by design.** Players may be real kids, so mischief and conflict stay playful, and griefing is designed out.

---

## 2. Core loops

```
MOMENT (seconds–minutes)
  walk the campus → interact → play a minigame / dialogue → get a reward

DAY (≈ 25 real minutes, shared campus clock)
  wake up → breakfast → lessons → lunch → lessons → free time / clubs / sports
  → dinner → etüt (homework) → dorm time → lights out (optional sneaking)

YEAR (player-paced, ≈ 4–8 hours of play)  [TUNE]
  get the year's missions → earn XP, grades and relationships → 2 semesters and 2 report cards
  → meet the year gate → year-end exam → summer holiday → next grade

LIFE (10 years)
  Year 1 newcomer → mentor to younger players → leader → graduate → alumni
```

---

## 3. Time model

Player-paced years and a shared live campus pull in different directions. The design resolves this by giving the **world** one clock and each **player** their own school year.

### 3.1 Campus clock (shared, always running)
- Every player in a campus world sees the same time of day.
- **1 game day ≈ 25 real minutes** [TUNE]:
  - 07:00–22:30 runs at **1 game hour = 1.5 real minutes** (~23 min)
  - 22:30–07:00 (night) is compressed into ~2 real minutes
- **Week:** Monday–Friday are school days; Saturday and Sunday are for tournaments, weekend leave, visiting day and free time. One game week ≈ 3 real hours.
- Because days are short, every activity comes around again within minutes. Someone who can only play for 20 minutes in the evening still gets a full day.

### 3.1.1 Evening rules (v0.7, as built)
| Time | Rule |
|---|---|
| 17:00–18:00 | Dinner |
| **18:00–20:00** | **Evening study (*etüt*) in your dorm.** A countdown at the top of the screen from 17:30; you walk there yourself. Arriving 5+ minutes late costs +5 discipline and −10 with your belletmen; missing it altogether (still out at 19:00) costs the same again. Inside: homework, play with friends, read, be creative, go to bed early. Homework not done by the next morning scores 0 and costs discipline points. A belletmen you've annoyed (−20 or lower) catches you more often |
| **20:00–22:00** | **Around the dorms only:** the dorm plaza and the lawns around both dorms. Every grade has its own spot (grade 4 west lawn, 5 south of the girls' dorm, 6 north of the girls' dorm, 7 north of the boys' dorm, 8 east lawn, high school south of the boys' dorm), and the dorm plaza in the middle is a mixed crowd. Belletmens stop anyone who tries to go further |
| **22:00–07:00** | **Lights out**, which works like study time: a countdown from 21:30, and you walk back yourself. Still out at 22:05: +5 discipline and −10 with your belletmen; again at 23:00. Not in bed at the 07:00 roll call: +10 and −10. Outside after lights-out you're kept to the area around the dorms; only sneaking out takes you further |

**Weekends: Evci or Daimi** (chosen in character creation, on the Your Story screen):
- **Evci:** after Friday's lessons a countdown starts (15:20–17:00). Take the bus at the **Ana Kapı** and choose how to spend the weekend at home:
  - With family: +mood, +health
  - With old friends back home: +mood, +Social, +Fitness
  - Studying: +Knowledge, and pending homework gets done
  - Resting: +health, +mood

  Your guardian gives you 20 ₺, and you're back at the gate on **Sunday at 17:40**, just before study time. Miss the bus and you spend the weekend at school.
- **Daimi:** you stay at school. No lessons, and the **Cemiyet building and Müze are closed**; everything else is open. On **Sunday 10:00–16:00** your family visits at the gate: +15 mood and 15 ₺.
- About half the other students are evci, so from Friday 17:00 to Sunday 17:40 the campus is quieter.

**Belletmens** (night teachers: Hatice Hanım in the girls' dorm, Mehmet Bey in the boys' dorm, Selim Bey on night patrol) are on duty from 18:00 to 07:00.

**Sneaking out** (from grade 6):
- In the dorm at night, guess the belletmen's patrol turn: a number from 1 to 10, with 2 tries and higher/lower hints (about a 30% chance).
- Fail: +10 discipline.
- Succeed: you're outside at night. If Selim Bey's torch gets within ~3 tiles, you're caught (+15 discipline).
- Get back to your dorm door unseen: +30 XP and +10 respect.

**Hunger at 0** makes you sick, and you have to go to the infirmary.

**In lessons you choose what to do:**
- **Answer the teacher's question:** guess the number from 1 to 10 they're thinking of. The closer you are, the higher your score and XP.
- **Take notes:** a safe choice.
- **Whisper with a friend:** friendship goes up, with a 30% chance of a warning.
- **Make fun of a classmate:** others laugh, but they drop −25 and may take revenge; 40% chance of discipline.
- **Get distracted:** creativity goes up, with no XP.

**No real school questions:** lessons, homework, the year-end exam and the library book chat are all guessing games. In the higher/lower game you narrow in on a number. In the closeness game, the nearer your guess the higher the score. Your Knowledge stat gives a small bonus.

**Things you can do with another student (once a day each):**
- Chat, or share a simit
- 🎮 Play a game: rock-paper-scissors, marbles, dodgeball or hide-and-seek
- 😂 Tell a joke: it lands or flops
- 🏷️ Give them a nickname: they love it or hate it
- 🗣️ Gossip about someone: it can backfire or get back to them
- 😜 Make fun of them
- 💰 Ask to borrow 5 ₺
- 📄 Copy their homework: risky
- 🤫 Share a secret: close friends only
- 🙏 Apologize: when things are bad between you

**Relationships:**
- Every student has a bar from −100 to 100.
- There are four friend groups. **They have no names**: each is known by its best-known member (*Mert'in grubu*). You join the one where you have at least 2 friends, and **only your own group can be named**, by you.
- Your group gives +25% friendship with its members and halves bad surprises. Joining a group makes its rival group like you less.
- Anyone at −15 or below can spring a **bad surprise** in the morning: hiding your shoes, spilling water on your homework, gossiping, telling the belletmen on you, or taking your seat.

### 3.2 Personal school year (player-paced)
- Each character has their own **current grade** and **year progress**.
- The year ends when the player meets the **Year Gate** (§6.8). No timer runs out.
- Exams are **per player**. You take a midterm once you're eligible (enough lessons attended), not on a fixed date.
- **Missing a lesson isn't punished.** You can make it up in the library for 70% of the XP.

### 3.3 How cohorts stay together
- **Cohort (*devre*)** = the group you were admitted with. It's permanent: a badge, a group chat, a yearbook and shared goals.
- **Class section (*şube*)** = the students currently in your grade. Membership changes as people progress. Empty seats are **filled with NPC classmates**, so every class feels full whether 3 or 30 players are present.
- **Catch-up:** if you are behind your cohort's median grade, you get **+25% XP** ("the older students are helping you").
- **Waiting is optional:** a player who finishes a year early can start the next one right away or stay in **summer content** (camp, reading list, hometown trip) until friends catch up. Best friends get a "Move up together" option.
- Because players progress at different speeds, every campus naturally mixes grades, much like a real school, and that powers the mentoring system (§10.5).

---

## 4. World: the Daçka campus

**Source:** the aerial render ([reference/campus-aerial.webp](reference/campus-aerial.webp)), adapted. The game map is [reference/campus-layout.svg](reference/campus-layout.svg).

The campus has **three rows** with **two plazas** running down the middle:

| Row | West | Middle | East |
|---|---|---|---|
| **North** | **Kız Yurdu** (girls' dorm), with the **infirmary on floor −1** | **Yurt Meydanı** (dorm plaza) | **Erkek Yurdu** (boys' dorm) |
| **Center** | **Eğitim Binası + Kütüphane** (academic building with the library) | **Merkez Meydan** (central plaza) | **Yemekhane & Sosyal Merkez** (dining hall) |
| **South** | Cemiyet Binası + Müze | Spor Salonu | Outdoor court · Teknik Alan |

The **Ana Kapı (main gate)** is in the south-west, where every player's story begins.

### 4.1 Top-down layout
```
                                   N   (forest)
 ┌───────────────┐                                        ┌───────────────┐
 │   KIZ YURDU   │         YURT MEYDANI (dorm plaza)      │  ERKEK YURDU  │
 │  [courtyard]  ▌◄──────── dorms face each other ──────►▐  [courtyard]  │
 │ fl.1–2 ortaokul│        benches · evening hangout     │fl.1–2 ortaokul│
 │ fl.3–4 lise   │                                        │ fl.3–4 lise   │
 │ ✚ REVİR (−1)  │                                        │               │
 └──────▀────────┘════════════════════╤═══════════════════└───────────────┘
 ┌──────────────┐                     │                   ┌───────────────┐
 │ EĞİTİM BİNASI│                     │                   │  YEMEKHANE &  │
 │ ortaokul wing│      MERKEZ MEYDAN (central plaza)      │ SOSYAL MERKEZ │
 │  KÜTÜPHANE   ▌◄───── trees · benches · ceremonies ───►▐ kantin · audit.│
 │  lise wing   │                     │                   │ roof terraces │
 └──────────────┘                     │                   └───────────────┘
 ┌──────────────┐ ┌───────────────────────────┐ ┌─────────┐ ┌─────────┐
 │ CEMİYET +    │ │        SPOR SALONU         │ │ outdoor │ │ TEKNİK  │
 │ MÜZE         │ │        (solar roof)        │ │  court  │ │  ALAN   │
 └──────────────┘ └───────────────────────────┘ └─────────┘ └─────────┘
       ★ ANA KAPI (main gate): the game starts here         S (street side)
```
`▌▐` = main entrances · `▀` = the infirmary's own outside entrance

**Outdoor map size:** ~124 × 96 tiles at 32 px (plazas made smaller in the prototype), so walking corner to corner takes about 30 seconds [TUNE]. Every building has its own interior map, with one map per floor where it matters.

### 4.2 Buildings
| Building | In English | What happens there | Who |
|---|---|---|---|
| **Ana Kapı** | Main gate (south-west) | **The game starts here.** Arrival cutscene, visiting day, weekend leave check-out | Everyone |
| **Kız Yurdu** | Girls' dorm (**north-west**) | Three blocks, **A1, A2 and A3**, each with **4 floors** of **14 sections** (sections hold 4–6 beds). Your address looks like *Kız Yurdu · A1 Blok · 1. Kat · 7. Bölüm*. **Every year you move up:** Years 1–4 on A1 floors 1–4, Years 5–8 on A2 floors 1–4, Years 9–10 on A3 floors 1–2. Courtyard, common room with TV, lockers, laundry, a belletmen office on each level. **The entrance faces the dorm plaza and the boys' dorm** | Girls |
| ↳ **Revir** | Infirmary (**Kız Yurdu, floor −1**) | Nurse, beds, recovery after fights, illness events, the *Compassion* story's volunteer chapter. Its **own outside entrance**, stairs down from the path, so **everyone can use it** without entering the dorm. **Open day and night**: a nurse's note is a legit reason to be out after lights-out | **Everyone** |
| **Erkek Yurdu** | Boys' dorm (**north-east**) | Same layout, mirrored. **The entrance faces the dorm plaza and the girls' dorm** | Boys |
| **Yurt Meydanı** | Dorm plaza (between the dorms) | Benches and trees. The **evening hangout** after dinner, mornings before school, gossip, where friends (and, from Year 4, crushes) from both dorms meet. The belletmen sweep it at lights-out | Everyone |
| **Eğitim Binası + Kütüphane** | Academic building with the library (**center-west**, narrower than before) | **Ortaokul wing (north part):** grades 4–8 classrooms, science lab, art and music rooms, technology & design workshop, middle school *etüt*. **Kütüphane (in the middle):** the shared library for make-up study, reading lists, the library-helper job and quiet-study bonus. **Lise wing (south part):** prep and grades 9–12 classrooms, physics, chemistry and biology labs, language lab, robotics lab, high school *etüt*. **Teachers' room.** The entrance faces the central plaza | Ortaokul wing: Y1–5 · Lise wing: Prep–Y10 · Library: everyone |
| **Yemekhane & Sosyal Merkez** | Dining hall and social center (**center-east**) | **Dining hall** (breakfast, lunch, dinner; where you choose a table and who you sit with), kitchen (target of the night raid), **canteen (*kantin*)**, **auditorium** (theater, Graduation Ball), club rooms, music studio, **roof terraces** (hangout by day, secret spot at night). The entrance faces the central plaza and the school | Everyone. The main social hub |
| **Merkez Meydan** | Central plaza (between school and dining hall) | The daily crossing between lessons and meals. **Ceremonies** (29 Ekim, 18 Mart, 19 Mayıs, graduation), the **earthquake assembly point**, café tables, scuffles behind the trees | Everyone |
| **Spor Salonu** | Sports hall | Basketball, volleyball, **futsal (indoor football)**, **swimming pool**, **fencing (*eskrim*) room**, PE, fitness room, coaches' office (sport enrollment), indoor tournaments, Sports Day | Everyone |
| **Outdoor courts** | Between the hall and Teknik Alan | A red **basketball / mini football court** and a **tennis court**. Outdoor PE, pickup games. Also the **running loop** for athletics, which goes along the forest edge | Everyone |
| **Cemiyet Binası** | Society building | **Your first stop: enrollment.** The **Ambar** (supply room, floor −1) hands out uniforms, coats, shoes and tracksuits. Administration: principal's office, guidance counselor (*rehber öğretmen*), visitors' room (visiting day), reception | Everyone |
| **Müze** | Museum (Cemiyet ground floor) | The school's history since 1863. Exhibits are **lore collectibles**; one **Museum chapter** unlocks each year; an alumni wall | Everyone |
| **Teknik Alan** | Technical area (green roof) | Caretaker's workshop and boiler room. **Restricted** (it unlocks for some backstories and for robotics); its green roof is a hidden spot | Caretaker's quests |
| **Forest edge** | Woods around the campus | Exploration, the Secret Tree, night sneaking routes | Exploration |

### 4.3 Space follows growing up
- **Daily rhythm, north to south:** wake up in the dorm → cross the **Yurt Meydanı** → classes in the Eğitim Binası → cross the **Merkez Meydan** to the Yemekhane for lunch → back for lessons → sports in the south → dinner → evening on the dorm plaza → lights-out.
- **Years 1–5:** you use the ortaokul wing and the **lower floors** of your dorm. The lise wing and the upper floors are visible but locked; that's where the older students are.
- **Prep year, "Moving Up" (*Üst Kata Çıkmak*):** a milestone cutscene where you carry your suitcase upstairs to the high school floors. The lise wing of the Eğitim Binası opens to you.
- **Ages share a building.** Middle and high schoolers live in the same dorm, so older students are always around. Mentoring (§10.5) happens naturally in the common room.
- **The dorms face each other** across the Yurt Meydanı, which makes it the evening social space between the boys' and girls' dorms.
- **Opposite-gender dorm doors are simply locked;** there's no sneaking in. The **infirmary** is the exception by design: it has its own outside entrance and never connects to the girls' dorm floors.
- **Teknik Alan** unlocks through quests or the *Handy* backstory.

### 4.4 Discovery: start at the gate, explore to reveal
Every new student starts at the **Ana Kapı** with a suitcase and their guardian. The campus is **unknown**: buildings appear only as you explore them and interact with them.

**Each building or room has 3 states:**
| State | In the world | On the map/minimap | How you get there |
|---|---|---|---|
| **Hidden** | Covered by a soft fog layer | Blank fog | Default |
| **Seen** | The building shape is visible, but it has no name label and its door shows "?" | Grey outline marked "???" | Walk within ~8 tiles, get directions from an NPC, or walk with a friend who knows it |
| **Discovered** | Full color, name label, door usable | Full color, name and icon; quests can point to it; click-to-walk route | **Interact:** enter the building, or talk to an NPC or read the sign at its door |

**Rules:**
- **Fog:** the outdoor map is split into fog cells (4×4 tiles). Cells within ~6 tiles of you are revealed, and they **stay revealed forever**.
- **Interiors:** every room is its own discovery (e.g. the Kütüphane inside the Eğitim Binası).
- **Rewards:** +20 XP per building, +5 XP per room. Finding every building, room and hidden spot earns the *Explorer* achievement.
- **Quests respect discovery:** before you've found a place, a quest only gives a vague hint ("Find the dining hall: ask someone, or follow the smell of lunch") and a rough direction arrow.
- **Friends show the way:** walking with a friend who has already discovered a building marks it as **Seen** for you, but you still have to interact to discover it.
- **Locked places** (the lise wing in Year 1, Teknik Alan) can be **discovered from outside** (you learn what they are) but not entered.

**Year 1 tutorial:** *Arrival* and *Find Your Way* (§9) walk you through the first discoveries:
1. Ana Kapı
2. Cemiyet (enrollment)
3. Merkez Meydan
4. Eğitim Binası (your classroom)
5. Yemekhane (lunch)
6. Yurt Meydanı
7. Your dorm

The rest (Kütüphane, Revir, Spor Salonu, Müze, Teknik Alan, the outdoor court, the forest edge, hidden spots) are left for you to find. You'll usually find the infirmary the first time you need it.

**Map structure:** one **outdoor campus map** plus **interior maps** for each building. You move between them through doors, which also lets the server split players into zones (§18).

---


## 5. Character creation

### 5.1 Appearance & basics
| Step | Options | Notes |
|---|---|---|
| Name | First name and surname | Profanity and impersonation filter, unique display name within the campus world |
| Gender | Girl / Boy | Decides your dorm |
| Skin tone | 8 options | |
| Face | Eye shape and color, eyebrows, freckles | |
| Hair | ~15 styles × 12 colors | Styles change as you age |
| Uniform | Fixed Daçka uniform | Authentic. You express yourself through **hair, glasses, bag, shoes, watch and pins** |
| Hometown | Any of Turkey's 81 provinces | Flavor in dialogue, plus small hometown quests and summer trips |
| Personality trait | Pick 1: *Curious*, *Sporty*, *Chatty*, *Creative*, *Calm* | +10% XP in one attribute family (§6.1). What you *like* |

**Aging:** sprites change across **3 age stages**: *child* (Years 1–3), *early teen* (Years 4–6) and *teen* (Years 7–10). The player can restyle their hair at each new stage.

### 5.2 Your story (*Hikâyen*)
Every Daçka student has lost a parent. The character creator's last step is a quiet, respectful screen where you tell your story in two choices.

**A. Who you lost.** This sets your family, not your stats.

| Choice | Who raises you, visits you and writes letters |
|---|---|
| Mother | Father, or pick another relative |
| Father | Mother, or pick another relative |
| Both | Pick one: grandmother, grandfather, aunt, uncle, older sibling |

The game doesn't treat any of these as "harder" or "stronger". Losing both parents gives no extra power: grief isn't a stat.

**B. How it happened → the strength you grew.** Each answer gives:
- **+10 to one starting attribute**
- **one unique perk**
- **a keepsake item**
- **a personal storyline** that runs through the 10 years

| How | Strength | Start bonus | Perk | Keepsake |
|---|---|---|---|---|
| **Long illness** | *Şefkat* (Compassion): you cared for your parent | +10 Social | Friendship grows +15% faster. Once per day you can **comfort** a friend (+15 to their mood). The nurse starts at Trust 30 | Parent's scarf |
| **Sudden accident** | *Erken Olgunluk* (Grew up early): you became responsible overnight | +10 Discipline | Homework costs 20% less energy. Discipline points fade twice as fast. Teachers start at Trust 15 | Parent's watch |
| **Earthquake / natural disaster** | *Dayanıklılık* (Resilience): you've already survived the worst | +10 Fitness | Mood never falls below 25. You recover twice as fast from losses and failed exams. You lead the school's **earthquake drill** event | A photo saved from home |
| **Work accident** | *El Becerisi* (Handy): you inherited your parent's craft | +10 Creativity | **Teknik Alan unlocked from Year 1**, caretaker friendship, +10% on robotics, art and technology minigames, can repair items | Parent's work badge |
| **Lost in service** (*şehit*: soldier, police officer, firefighter, health worker) | *Onur* (Honor): you carry their name with pride | +5 Discipline, +5 Social, +50 Respect | Extra respect and mood at the 29 Ekim and 18 Mart ceremonies. +10% votes in elections | Parent's medal or cap |
| **I'd rather not say** | *Sessiz Güç* (Quiet strength) | +2 to every attribute | Mood falls 10% slower. Your story stays private: classmates never ask | A small notebook |

**Balance rule:** each story is worth about the same. They're **different, not better**, and none is the optimal choice.

**Keepsake:** it stays in your locker and can't be lost, traded or sold. Holding it in your dorm gives +20 mood once per game day. It appears at the graduation ceremony.

**Personal storyline:** four short chapters, with optional emotional depth.

| Year | Chapter | What happens |
|---|---|---|
| 1 | *The Keepsake* | Find a safe place for it and choose whether to tell a friend your story (+friendship if you do) |
| 4 | *The Anniversary* | A quiet day. Friends (players or NPCs) can visit you, and the counselor checks in |
| 7 | *Pass It On* | Mentor a new Year 1 student with a similar story, for a bonus on mentoring rewards |
| 10 | *They'd Be Proud* | A moment at graduation with your keepsake and family |

Each story also has its own scene: Compassion volunteers at the infirmary (Year 9), Resilience leads the earthquake drill (Year 3), Handy builds something in Teknik Alan in your parent's honor (Year 8), Honor gives the ceremony speech (Year 4), Grew-up-early becomes dorm room leader (Year 6), and Quiet Strength keeps a journal the player can read back at graduation.

**Handled with care:**
- Real Daçka students who play may have lost a parent themselves.
- **Settings → Memory scenes:** *Full* / *Gentle* (shorter, no flashbacks) / *Off*. The perks work the same either way.
- Other players can't see your story unless you share it from your profile.
- The **guidance counselor (*rehber öğretmen*)** in the Cemiyet building is always there to talk to for a mood boost, any time.
- Mother's Day and Father's Day show a gentle, optional scene based on your story, never a "make a card for your mom" task.

---

## 6. Stats & progression

### 6.1 Attributes (grow slowly and permanently, 0–100)
| Attribute | Turkish | Raised by | Used for |
|---|---|---|---|
| Knowledge | *Bilgi* | Lessons, homework, library, reading | Exam bonuses, academic minigame difficulty |
| Fitness | *Kondisyon* | PE, sports training, tournaments | Sports minigames, fights, energy pool |
| Social | *Sosyallik* | Talking, meals with friends, clubs | Dialogue checks (talking someone down, persuading), friendship speed |
| Discipline | *Disiplin* | Attendance, homework on time, rules | Homework speed, teacher trust, leadership roles |
| Creativity | *Yaratıcılık* | Art, music, theater, projects | Arts minigames, science fair, ending variety |

### 6.2 Needs (short-term, Sims-lite, 0–100)
| Need | Decays | Restored by | If low |
|---|---|---|---|
| Energy | Per action | Sleeping in the dorm; offline time (+10/real hour) | Can't do demanding activities |
| Hunger | 6 per game hour [TUNE] | Meals (best), canteen snacks | Minigame scores −15% |
| Mood | Events | Friends, wins, hobbies, letters from home | XP −20%; "homesick" quests trigger |

Needs are intentionally gentle. They give the day a rhythm, and **neglecting them never kills you or ends the game**.

#### 6.2.1 Health & getting sick
- **Health (0–100)** shows as a small heart on the HUD.

**What lowers Health:**
| Cause | Health |
|---|---|
| Sleeping too little (energy < 15 overnight) | −10 |
| Skipping meals (hunger < 20) | −5 per game hour |
| Outdoors in winter **without your coat** | −3 per game hour |
| Out in the rain | −2 per game hour |
| Sneaking out at night in winter | −5 |
| Sitting or standing next to sick students during **flu season** (winter weeks) | −4 per game hour (sick NPCs and players show a sniffle icon) |

**What raises Health:**
| Action | Health |
|---|---|
| Full meals | +3 each |
| A full night's sleep | +10 |
| Sports training | +2 |
| Washing hands at the Yemekhane sinks before a meal | Halves contagion for that game day |
| Visiting the Revir for a check-up | +5 |

**Getting sick:** every game morning with Health < 40 there's a chance you wake up sick: 5% at Health 39, rising to 50% at Health 0 [TUNE]. You get a cold or the flu:
- Go to the **Revir**, then 1–2 game days of **bed rest** (in the Revir or your dorm)
- No sports or clubs, and lessons are made up later
- Friends can visit with snacks for +friendship
- You're **contagious**, so people near you take a small Health hit

**It's never dangerous:** no permanent harm, no lost progress. Fight bruises and bandages (§8.3) don't count as being sick.

### 6.3 Academics
- **Subjects by stage:**
  - Years 1–5 (grades 4–8): Turkish, Math, Science, Social Studies, English, Art, Music, PE (plus Technology & Design from Year 4)
  - Year 6 (prep, if it exists): mostly English
  - Years 7–10 (grades 9–12): Literature, Math, Physics, Chemistry, Biology, History, Geography, English, Philosophy, PE + **track subjects** (§9)
- **Subject grade (0–100)** = 30% lesson minigame scores + 20% homework + 50% exams (one midterm and one final per semester).
- **Pass mark: 50** (the Turkish system).
- **Report card (*karne*)** at the end of each semester:
  - Average ≥ 70 → *Teşekkür Belgesi* (certificate of thanks)
  - Average ≥ 85 → *Takdir Belgesi* (certificate of honor)
  - Behavior grade (§6.6) shown separately
- Collected certificates appear in your room and count toward graduation honors.

### 6.4 Experience (XP)
- Every activity grants XP. XP **resets each year**: it measures "how much of this year you lived".
- Yearly XP targets [TUNE]:

| Year | Grade | Age | XP to advance |
|---|---|---|---|
| 1 | 4 | 9 | 2,000 |
| 2 | 5 | 10 | 2,600 |
| 3 | 6 | 11 | 3,200 |
| 4 | 7 | 12 | 3,800 |
| 5 | 8 | 13 | 4,500 |
| 6 | Prep | 14 | 4,000 |
| 7 | 9 | 15 | 5,000 |
| 8 | 10 | 16 | 5,500 |
| 9 | 11 | 17 | 6,000 |
| 10 | 12 | 18 | 7,000 |

### 6.5 Respect (*Saygınlık*), lifetime 0–1000
How the student body sees you. It never resets.

| Range | Title |
|---|---|
| 0–99 | *Yeni Gelen* (newcomer) |
| 100–249 | *Tanınan* (known) |
| 250–499 | *Sözü Dinlenen* (listened to) |
| 500–799 | *Örnek Öğrenci* (role model) |
| 800–1000 | *Efsane* (legend) |

- **Gain:** winning tournaments, medals, standing up for someone, being elected, mentoring, winning fair fights
- **Lose:** caught cheating, picking on weaker or younger students, betraying a friend, walking away from a fight (a small loss)
- **Unlocks:** running for class president, team captain, prefect, some dialogue options and cosmetics

### 6.6 Discipline record (lower is better, 0–100)
| Offense | Points |
|---|---|
| Skipping class | +5 |
| Out after lights-out (caught) | +10 |
| Fighting (caught) | +15 |
| Cheating (caught) | +20 |

| Threshold | Consequence |
|---|---|
| 20 | Talk with the homeroom teacher (dialogue scene) |
| 40 | Detention: loses next weekend's activities |
| 60 | Guardian called; behavior grade drops on the report card |
| 80 | Suspension: social activities locked for 1 game week |

- Points **decay by 2 per clean game day**.
- **Nobody is ever expelled.** The game never locks you out of finishing.
- Behavior grade on the karne: *Very good* (< 20), *Good* (< 40), *Fair* (< 60), *Poor* (≥ 60).

### 6.7 Relationships (−100 to +100, with every player and NPC)
| Score | Status | Perks |
|---|---|---|
| ≤ −40 | Rival | Rivalry quests, fights more likely |
| −39 to 9 | Stranger | — |
| 10–39 | Acquaintance | Can sit together |
| 40–69 | Friend | Homework help (+bonus for both), duo activities |
| 70–89 | Close friend | Shared secrets quests, night adventures together |
| 90+ | Best friend (**max 3**) | Combo XP when together (+10%), "move up together", yearbook special page |

Teachers also have a relationship score (**Teacher Trust**). It affects hints during lessons, references and leadership roles.

**Romance** is a separate layer on top of friendship. It needs Friend (≥ 40) first, and the rules are in §10.7.

### 6.8 Year Gate: requirements to advance
1. XP ≥ the year's target
2. Every core subject's yearly average ≥ 50
3. All of the year's **main missions** completed
4. **Year-end exam** passed (a multi-subject minigame)

Then: **karne ceremony → summer holiday scene → pick a summer activity** (camp: +Fitness · reading list: +Knowledge · hometown visit: +Mood/Social · art workshop: +Creativity) → **new grade**.

If a subject is failed, you get a **make-up exam (*bütünleme*)** instead of repeating the year. There's no game-over.

---

## 7. Activities catalog

| Activity | Where | When | Cost | Reward [TUNE] |
|---|---|---|---|---|
| Attend lesson | Classroom | Timetable slots | 10 energy | 40 XP + subject score + Knowledge |
| Make-up study | Library | Anytime | 10 energy | 28 XP (70%) |
| Homework | Study hall / dorm | Assigned after lessons, due in 3 game days | 8 energy | 30 XP + homework grade |
| Ask a friend for homework help | Anywhere | — | — | Both get +friendship and +10% homework score |
| Copy homework | Anywhere | — | — | Fast, but 25% chance of getting caught (+20 discipline, grade 0) |
| Eat a meal | Dining hall | 07:30 / 12:30 / 18:30 | — | Hunger restored, 5 XP, +friendship with tablemates |
| Canteen snack | Canteen | Breaks | Pocket money | Hunger and mood |
| Talk to a student | Anywhere | — | — | Friendship + Social |
| Talk to a teacher | Classroom, teachers' room | Breaks | — | Teacher Trust, hints, quests |
| Club activity | Club rooms | Afternoons | 10 energy | Creativity/Social, club rank, club quests |
| Sports training | Spor Salonu / pool / outdoor courts | Afternoons | 15 energy | Fitness, team skill, +2 Health |
| Tournament match | Spor Salonu / outdoor courts | Weekends | 20 energy | XP, respect, medals |
| Read a book | Kütüphane (+25% speed), dorm, plaza bench | Anytime | 5 energy per session | Knowledge, reading-list progress; book chat with the librarian at the end |
| Favor for an abi/abla | Anywhere (Favor Board, §10.5) | Anytime | 5 energy | Sandwich or other small thanks, +friendship |
| Wash hands | Yemekhane sinks | Before meals | — | Halves illness contagion for the day (§6.2.1) |
| Revir check-up | Revir | Anytime | — | +5 Health |
| Part-time campus job | Library / canteen | Afternoons | 10 energy | Pocket money |
| Fight | Courtyard, dorm, behind the gym | Anytime | 15 energy | See §8.3 |
| Sneak out after lights-out | Campus at night | 22:30–06:00 | 10 energy | Secrets, achievements, night quests (risk) |
| Midnight feast (*yatakhane şöleni*) | Dorm | Night | Snacks | Big friendship boost for everyone there |
| Write a letter home | Dorm | Anytime | — | Mood, family dialogue |
| Visiting day | Main gate / garden | Sundays | — | Mood, gifts, pocket money |
| Weekend leave (*çarşı izni*) | Gate → city scene | Weekends, Year 4+ | — | Shopping for cosmetics, city mini-events |

---

## 8. Minigames

All minigames last **30–90 seconds**, get harder by grade, and are **generated and scored by the server** (§18.6).

### 8.1 Lesson minigames
| Subject | Minigame |
|---|---|
| Math | Mental-math blitz, then equation solving in later years |
| Turkish / Literature | Spelling, proverb completion (*atasözleri*), poem line ordering |
| Science / Physics / Chemistry / Biology | Lab sequence: drag the steps into the right order, then mix and measure |
| Social Studies / History | Timeline ordering, "who said it" |
| Geography | Pin the city or region on the map of Turkey or the world |
| English | Vocabulary match, listening pick, sentence building |
| Music | Rhythm tapping |
| Art | Shape and color matching, small pixel drawing |
| PE | Sport skill check (see 8.2) |

Question banks follow the real **MEB curriculum** topics for each grade, so the game also teaches a little.

### 8.2 Sports minigames
- **MVP (skill checks):** penalty shootout (timing), free throws (power bar), sprint (button rhythm), volleyball serve, chess puzzles.
- **Later (real-time multiplayer):** 3v3 top-down football and basketball matches between real players.

### 8.3 Fights (playful, never graphic)
**Triggers:** NPC bully events, rivalry quests, or a player challenge.

**Before the fight:** you choose one of four options:

| Choice | Effect |
|---|---|
| **Talk it down** | Social check. If it works: +respect, no fight |
| **Walk away** | −5 respect, no risk |
| **Get a teacher** | −10 respect with students, +Teacher Trust, the bully gets disciplined |
| **Fight** | Starts the fight minigame |

**The fight:** a cartoon dust-cloud scuffle (classic comic style). It's a 3-round timing and stamina minigame driven by Fitness.

**Outcomes:**
- **Win:** +respect, +mood
- **Lose:** −mood, a possible infirmary visit (cosmetic bandage for one day)
- **Either way:** a **chance of getting caught** that depends on distance to the nearest teacher NPC, the time of day and the location (+15 discipline)

**Player-vs-player rules (anti-griefing):**
- Both players must **accept** the challenge
- Grade difference of at most **1**
- One fight per player pair per game day
- Repeatedly challenging lower-respect or younger players **costs** respect ("bully" flag)
- Nothing can be lost except mood and respect: no items, no grades

### 8.4 Night stealth
Top-down sneaking past the **belletmen's** (duty teacher's) patrol with a flashlight cone. Getting caught means the discipline penalty and being walked back to the dorm. Success brings secrets, midnight-feast snacks and achievements.

---

## 9. The ten years: missions by year

Every year has **main missions** (required for the gate), **side missions** (optional XP and stories) and **recurring tasks** (lessons, meals, homework).

Structure (confirmed): grades 4–8 → **prep (*hazırlık*)** → grades 9–12.

Every year also has a **Museum chapter** (*Müze*): a short lore quest in the Cemiyet building that tells part of the school's story since 1863. All 10 chapters unlock the *Historian* achievement. Personal storyline chapters (§5.2) fall in Years 1, 4, 7 and 10.

### Year 1: Grade 4, age 9: *The Newcomer* (*Yeni Gelen*)
- **Theme:** a new home, learning the campus, first friends, looking after yourself
- **Opening:** *Arrival*. You start at the Ana Kapı with your suitcase and guardian, say goodbye, and walk in alone. The first few missions double as the discovery tutorial (§4.4).
- **Story:** *The Keepsake* (§5.2) · Museum chapter 1

**Mission order (v0.6, as built in the prototype).** Main missions unlock one after another, and each one opens up part of school life:

| # | Mission | Requires | Unlocks |
|---|---|---|---|
| 1 | *Bavulunu Yerleştir*: carry your suitcase to your dorm | — | Your bed and locker |
| 2 | *Kampüsü Keşfet*: discover all 14 places | 1 | Registration |
| 3 | *Kayıt*: register, pass the health check at the infirmary, collect your kit from the Ambar, collect your textbooks | 2 | Meal card (dining hall), the class draw |
| 4 | *Sınıf Kurası*: draw your class at random (4-A to 4-D) | 3 | Meeting classmates |
| 5 | *İlk Arkadaş*: become friends with one classmate | 4 | Lessons begin |
| 6 | *İlk Ders*: attend a lesson | 5 | Homework, study hall |
| 7 | *Üç Öğün*: breakfast, lunch and dinner in the dining hall | 6 | Everything below |
| 8 | *Beş Arkadaş* · *İlk Kitabım* · *Spora Başla* · *Abi'den Sandviç* · *Sınavları Geç* (any order) | 7 | Report Card Day |
| 9 | *Karne Günü*: 2000 XP + the ceremony in the auditorium | all of 8 | Year 2 |
| ★ | *Sağlıklı Bir Yıl* (challenge, runs all year) | — | Medal |

**Main missions (all required to pass Year 1):**

| # | Mission | Goal | How it works | Reward [TUNE] |
|---|---|---|---|---|
| 1 | ***Kampüsü Keşfet*** (Explore the campus) | **Discover every building** (§4.4) | Ana Kapı, Cemiyet, Müze, Kız Yurdu, Erkek Yurdu, Revir, Yurt Meydanı, Merkez Meydan, Eğitim Binası, Kütüphane, Yemekhane, Spor Salonu, outdoor courts, Teknik Alan. Locked places (the other dorm, the lise wing, Teknik Alan) count once you **discover them from outside**. Hidden spots aren't required; they're for the *Explorer* achievement | +20 XP per building, +150 XP on completion, the **campus map** item (fast click-to-walk) |
| 2 | ***Kayıt*** (Registration) | Complete registration and **get your clothes, shoes and books** | (a) Enroll at the **Cemiyet** reception (name, dorm and class assigned). (b) Collect your kit from the **Ambar** (supply room, Cemiyet floor −1): uniform (shirt, trousers or skirt, sweater, tie), a **winter coat**, school shoes, sports shoes and a tracksuit. (c) Collect your **textbooks** at the **Kütüphane** desk. Without books you can't take part in lessons, and without sports shoes there's no PE or sport. The coat matters for mission 9 | 100 XP, uniform equipped, locker unlocked |
| 3 | ***Beş Arkadaş*** (Five friends) | Reach **Friend (≥ 40)** with **5 students** | Players and NPC classmates both count. Daily friendship caps (§10.2) mean this takes several game days, so it can't be rushed in one evening | +50 XP per friend, *Social Butterfly* badge at 5 |
| 4 | ***Sınavları Geç*** (Pass the exams) | **Pass every subject** | A midterm and a final in each semester, a yearly average ≥ 50 per subject, then the **year-end exam**. A failed subject goes to a make-up exam (*bütünleme*), never a repeated year | Karne, *Teşekkür*/*Takdir* certificates |
| 5 | ***Abi'den Sandviç*** (A sandwich from an abi) | Do a favor for an older student (an *abi* or *abla*) and **get a sandwich** as thanks | Older students (Year 7+) ask for help in person or on the **Favor Board** (§10.5). Examples: deliver a note, fetch a ball from the forest edge, save a seat at dinner, return a book to the Kütüphane, bring something from the Revir. Older **players** pay with a sandwich they buy at the kantin; NPC abis and ablas also give favors, so solo players can finish this | 80 XP, +friendship with the abi or abla, a **sandwich** (+40 hunger, +15 mood) |
| 6 | ***Üç Öğün*** (Three meals) | Eat **at least one breakfast, one lunch and one dinner** in the Yemekhane | Meal windows: 07:30 / 12:30 / 18:30. Wash your hands at the sinks, take a tray and **choose a table**: sit with friends or with strangers (a good way to start mission 3) | 30 XP per meal type, *Afiyet Olsun* stamp |
| 7 | ***İlk Kitabım*** (My first book) | **Read at least 1 book** from the library | Borrow from the age 9–10 shelf at the Kütüphane. Read it in **3 sessions** of about one game hour each (library: +25% speed; dorm or plaza bench: normal). Then have a **book chat** with the librarian: 3 questions about the story | 120 XP, +Knowledge, the **reading list** unlocks (more books, more XP) |
| 8 | ***Spora Başla*** (Join a sport) | **Enroll in one sport** | Talk to the coach at the Spor Salonu, play a short **try-out minigame**, then pick your sport (table below). One sport in Year 1; a second can be added from Year 2 | 100 XP, team tracksuit cosmetic, the sport's skill track |
| 9 | ***Sağlıklı Bir Yıl*** (A healthy year) | **Finish Year 1 without getting sick** | Uses the health system (§6.2.1). Eat your meals, sleep, wear your coat in winter, wash your hands, and don't sit next to a sniffling classmate during flu season. **If you get sick, this mission fails**, and the year can still be finished (see note) | *Demir Gibi* ("Iron Kid") medal, +10 Fitness, +50 Respect |

Mission 9 is a **challenge**: it shows in the Year 1 list with a big reward, but failing it doesn't block the Year Gate.

**Sports you can join in Year 1:**
| Sport | Where | Try-out minigame |
|---|---|---|
| Basketball | Spor Salonu / outdoor courts | Free throws (power bar) |
| Volleyball | Spor Salonu | Serve timing |
| Football (futsal) | Spor Salonu / outdoor courts | Penalty shootout |
| Tennis | Outdoor tennis court | Rally timing |
| Swimming | Pool (Spor Salonu) | Stroke rhythm |
| **Eskrim** (fencing) | Fencing room (Spor Salonu) | Parry and lunge timing |
| Athletics | Running loop along the forest edge | Sprint rhythm |
| Table tennis | Club room (Yemekhane & Sosyal Merkez) | Reaction speed |
| Chess | Kütüphane / club room | Chess puzzles |

**Side missions:** *Letter Home* · *The Lost Key* (help the caretaker near Teknik Alan) · *The Secret Tree* (exploration at the forest edge) · *Rules of the Dorm* (first game week with no discipline points)

**Unlocks:** lessons, dining, your dorm (lower floors), library, Revir, your sport

**Example book shelf (ages 9–10):** *Küçük Prens*, *Pal Sokağı Çocukları*, *Şeker Portakalı*, Ömer Seyfettin stories, Nasreddin Hoca tales. In-game, only the title and a short summary are shown, not the full text.

### Year 2: Grade 5, age 10: *Finding Your Thing*
- **Theme:** middle school starts, clubs open
- **Main:** *Join a Club* · *Make the Team* (play your first league match in your sport) · *The Bully* (first fight-or-talk event) · *Group Project* (2–4 players or NPCs)
- **Side:** *Choir Audition* · *Canteen Economics* (first part-time job)
- **Unlocks:** clubs, a second sport, intra-school league

### Year 3: Grade 6, age 11: *Competition*
- **Theme:** first tournaments and the science fair
- **Main:** *First Tournament* (play in one) · *Science Fair* (team project with judged stages) · *Mid-year Slump* (mood quest: help a friend who is struggling)
- **Side:** *Chess Club Ladder* · *Night Kitchen Raid* (first stealth mission into the Yemekhane kitchen) · *Earthquake Drill* (everyone evacuates to the Meydan assembly point; the Resilience story leads it)
- **Unlocks:** inter-school tournaments, night stealth

### Year 4: Grade 7, age 12: *Voice*
- **Theme:** leadership and standing up for yourself
- **Main:** *Class President Election* (run or campaign for a friend; **real players vote**) · *Weekend Leave* (first trip outside the gate) · *Stand Up* (defend a younger student)
- **Side:** *School Newspaper* · *Debate Club* first debate · *First Crush* (romance unlocks, §10.7)
- **Story:** *The Anniversary* (§5.2)
- **Unlocks:** weekend leave (city scene), elections, newspaper, romance (hanging out and holding hands)

### Year 5: Grade 8, age 13: *Pressure*
- **Theme:** the big national exam year (LGS-style)
- **Main:** *Mock Exams* (3 practice exams) · *Study Group* (form one with 2+ friends) · *The Big Exam* (multi-subject minigame; your score feeds into endings) · *Middle School Farewell*
- **Side:** *Burnout* (balance study and rest) · *Last Match* of middle school
- **Unlocks:** the year-end middle school ceremony

### Year 6: Prep, age 14: *A New Language*
- **Theme:** English immersion
- **Main:** *Moving Up* (move to your dorm's high school floors, §4.3) · *English Only* (some NPC dialogue switches to English, which uses the bilingual game well) · *Speaking Contest* · *Pen Pal* (international letter exchange)
- **Side:** *Movie Night in English* · *Exchange Visitor* event
- **Unlocks:** the lise wing of the Eğitim Binası and the upper dorm floors

### Year 7: Grade 9, age 15: *Abi / Abla*
- **Theme:** now *you* are an older student
- **Main:** *Become a Mentor* (adopt a Year 1–2 student, a player or an NPC) · *High School Clubs* · *New Freedoms* (later curfew, longer leave)
- **Side:** *Robotics Build* · *Theater Lead Role*
- **Story:** *Pass It On* (§5.2)
- **Unlocks:** mentoring program, prefect candidacy

### Year 8: Grade 10, age 16: *The Track*
- **Theme:** choosing your future
- **Main:** *Choose a Track* (*Sayısal* science/math · *Eşit Ağırlık* math/social · *Sözel* humanities · *Dil* languages), which changes subjects and endings · *Career Day* (alumni NPC talks)
- **Side:** *Team Captain* · *First Competition Project* (national science contest)
- **Unlocks:** track subjects, captaincy, romance 16+ stage (§10.7)

### Year 9: Grade 11, age 17: *Leading*
- **Theme:** running the school
- **Main:** *Student Council* (election or appointment) · *Organize an Event* (players plan a school event: Sports Day or a concert) · *Championship* (inter-school final)
- **Side:** *Dorm Prefect* · *Final Science Project*
- **Unlocks:** council powers (pick an event theme, set the canteen menu of the week)

### Year 10: Grade 12, age 18–19: *Graduation*
- **Theme:** university exam, goodbyes
- **Main:** *Exam Prep* (YKS-style mocks) · *The University Exam* (the biggest minigame) · *Yearbook* (collect signatures from friends) · *Graduation Ball* (in the Yemekhane & Sosyal Merkez auditorium: invite a partner or go with friends) · *Graduation Ceremony* (with your cohort, on the Meydan)
- **Side:** *Last Night in the Dorm* · *Thank a Teacher* (visit every teacher with Trust ≥ 50) · *Leave a Legacy* (a mark on campus seen by future cohorts)
- **Story:** *They'd Be Proud* (§5.2)
- **Ending:** see §15

---

## 10. Social & multiplayer gameplay

### 10.1 Seeing each other
All players in the same zone see each other moving in real time, with name tags, cohort badges and respect titles.

### 10.2 Friendship with players
Friendship grows through shared activities rather than spamming a button:

| Shared activity | Friendship |
|---|---|
| Eating at the same table | +2 |
| Same lesson | +1 |
| Homework help | +5 |
| Same team win | +5 |
| Midnight feast | +8 |
| Gifting a snack or item | +3 |

There are daily caps per pair to prevent farming.

### 10.3 Cohort (*devre*) features
- Cohort name (e.g. "Devre 2026-A"), badge and private chat
- **Cohort goals:** a weekly shared target (e.g. "complete 500 lessons together") that unlocks a cosmetic and a campus-wide celebration
- **Class photo:** taken automatically each year, it shows everyone in the cohort and goes into the yearbook
- Graduation ceremonies are held for the cohort

### 10.4 Group content
- Group projects (2–4 players; NPCs fill missing slots)
- Sports teams and tournaments (player teams vs. NPC or player teams)
- Elections (players vote)
- Midnight feasts and night missions (co-op stealth)
- Organizing events (Year 9)

### 10.5 Mentoring (*Abi/Abla* program)
- From Year 7, players can mentor a Year 1–2 player.
- The mentee gets +15% XP and a guide. The mentor gets respect and an achievement line.
- Rewards are based on the mentee's progress, which encourages genuinely helping new players.

**Favor Board (*Rica Panosu*):** a board in each dorm's common room and on the Merkez Meydan.
- **Who posts:** older players (Year 7+) pick a favor from a **fixed list** (deliver a note, fetch a ball, save a seat at dinner, return a library book, bring a plaster from the Revir…) and attach a **sandwich** bought at the kantin with their own pocket money.
- **Who accepts:** younger players (Years 1–4). The game checks when the favor is done (item delivered, seat saved), then the sandwich is handed over.
- **Rewards:** the younger player gets the sandwich, XP and friendship. The older player gets Respect and mentoring points.
- **No pressure, no abuse:**
  - Favors come only from the fixed list; there are no free-text demands.
  - Younger players can ignore or decline with no penalty, and the older player can't punish them.
  - Each older player can post at most 2 favors per game day.
  - Report and block work as usual.
- **NPC abis and ablas** post favors too, so the Year 1 sandwich mission works even with nobody older online.

### 10.6 Chat & communication
- Channels: **nearby** (zone), **class**, **cohort**, **friends/DM**, **team/club**
- Emotes and quick phrases
- Safety rules are in §20

### 10.7 Romance (*Aşk*)
Romance is a separate status on top of friendship. It's built around **hanging out** and slowly getting closer, never anything sexual.

**Stages:**
1. **Crush (*Hoşlanma*):** private; only you know. Needs Friend ≥ 40.
2. **Confess (*Açılmak*):** a dialogue scene. The other person accepts, or kindly declines with no penalty.
3. **Going out (*Çıkmak*):** visible on both profiles.
4. **Couple:** unlocks at age 16 (see the table below).

**What you can do, by character age:**
| Years | Age | Allowed |
|---|---|---|
| 1–3 | 9–11 | **No romance.** Friendship only. |
| 4–7 | 12–15 | **Hanging out:** walk together, sit together at meals, share a canteen treat, study together, movie night, sit together at ceremonies. **Holding hands.** |
| 8–10 | 16–18 | All of the above, plus a **hug**, a **kiss on the cheek** (shown as a small heart pop), a **slow dance** at the Graduation Ball, anniversary gifts, a couple epilogue |
| any | — | **Nothing sexual, ever.** Every character is under 18. |

**Gameplay effects:**
- Hanging out together: +mood for both, and +10% XP on shared activities
- Graduation Ball partner
- A shared yearbook page
- Being together at graduation adds a joint epilogue line (§15)

**School rules (for fun, not punishment):**
- Holding hands in front of a teacher triggers an "Ahem…" moment. It costs a little Teacher Trust but adds no discipline points.
- Dorm separation always applies.
- One relationship at a time.

**Breaking up:**
- Either person can end it at any time.
- −20 mood for 2 game days, and no other penalties.
- You can't confess to the same person again for 1 game week.

**Who:** NPC classmates with romanceable personalities, and other players.

Romance is possible between **any genders**.

**Player-to-player romance safety.** A character's age isn't the player's real age, so these rules stop adults from targeting real children:
- Romance between two players is only possible when their **real ages are within ±2 years** of each other.
- **Hard line at 18:** adult accounts (18+) can only romance adult accounts, and under-18 accounts only under-18 accounts, even within the ±2 window. For example, 17 with 19 is **not** allowed.
- **Under-13 accounts get NPC romance only.**
- What two characters can do is set by the **younger character's** age (e.g. a 15- and a 16-year-old character can only hold hands).
- Both players must have **"Romance with players"** switched on. It's **on by default for 18+** and **off by default for minors**, who can switch it on themselves. Accounts that need parental consent need it for this setting too.
- Romance unlocks no extra private channels. DMs follow the normal friend rules.
- **Report or block ends the relationship instantly.** Romance-related reports go to the top of the moderation queue.

---

## 11. NPCs

| NPC | Role |
|---|---|
| Principal (*Müdür*) | Discipline, ceremonies, big announcements |
| Vice principal | Day-to-day discipline, schedules |
| Homeroom teacher (*sınıf öğretmeni / rehber öğretmen*) | Your main adult, gives quests, does report cards |
| Subject teachers (one per subject) | Lessons, Trust, subject quests |
| Belletmen (dorm duty teacher) | Lights-out, night patrols |
| Guidance counselor (*rehber öğretmen*) | Cemiyet building. Always available to talk to for a mood boost; checks in during story chapters (§5.2) |
| School nurse | Revir (Kız Yurdu, floor −1, own outside entrance), day and night |
| Cook / dining staff | Meals, kitchen-raid targets |
| Caretaker | Lives in Teknik Alan. Lore, secrets, side quests; mentor figure for the *Handy* story |
| Museum keeper (a retired teacher and alumnus) | Müze. Tells one chapter of the school's history each year |
| Coaches | Teams, tournaments |
| Librarian | Reading list, library job |
| NPC classmates (pool of ~40 personalities) | Fill classes, become friends, rivals or bullies, with ages that progress |
| Alumni visitors | Career Day, lore about the school's history |

**Schedules:** every NPC follows the campus clock. Teachers are in classrooms during lessons, in the teachers' room during breaks and patrolling in the evening. This makes "getting caught" fair and readable.

---

## 12. Calendar events (by game week within each player's year)

| Event | Content |
|---|---|
| Orientation | Year 1 arrival, or the start of each year |
| Republic Day (29 Ekim) | Ceremony and poem recital minigame |
| Atatürk Commemoration (10 Kasım) | Respectful ceremony scene, with no gameplay rewards attached |
| Çanakkale Victory and Martyrs' Day (18 Mart) | Ceremony on the Merkez Meydan. The *Honor* story gets its moment here |
| Mother's Day / Father's Day | A gentle, optional memory scene based on your story (§5.2); respects the Memory scenes setting |
| Semester break (*yarıyıl tatili*) | First report card, short holiday choice |
| New Year | Dorm celebration, gift exchange |
| National Sovereignty and Children's Day (23 Nisan) | Performances, the children's council |
| Youth and Sports Day (19 Mayıs) | Sports Day, athletics tournament |
| Science fair / art exhibition | Spring |
| Year-end | Exams, karne, summer |

> **[DECIDE]** Add the school's own traditions and anniversaries that you know (founding day, traditional events, school songs, slang). They make it feel like Daçka.

---

## 13. Economy & items

- **Currency:** pocket money (*harçlık*, ₺). Sources: weekly allowance, visiting day, campus jobs, tournament prizes.
- **Spend on:**
  - Canteen snacks (needs)
  - Stationery (temporary study buffs, e.g. a "new notebook" gives +5% homework score for a game day)
  - Cosmetics (bags, shoes, pins, glasses, watches)
  - Dorm decorations (posters, plants)
  - Gifts for friends
- **Locker:** a limited inventory, with upgrades through quests
- **No pay-to-win.**
  > **[DECIDE]** Is this non-commercial, or cosmetic-only monetization later?

---

## 14. Achievements & medals

- **Medals:** physical items shown in your dorm and profile. They come from tournaments (gold/silver/bronze), competitions (science fair, debate, speaking contest) and academic honors (Takdir streaks).
- **Achievements** (~100 at launch). Examples:
  - *First Friend*
  - *Never Late* (100 lessons, no skips)
  - *Night Owl* (10 successful sneaks)
  - *Peacemaker* (talk down 10 fights)
  - *Bookworm* (finish all reading lists)
  - *Legend* (respect 800)
  - *Explorer* (discover every building, room and hidden spot)
  - *Big Brother / Big Sister* (mentee graduates Year 2)
  - *Perfect Karne* (all subjects ≥ 85)
- **Titles** from achievements can be shown under your name.

---

## 15. Graduation & endings

**Final score inputs:** 10-year GPA, university exam score, track, attributes, clubs and sports history, respect, leadership roles, behavior, medals.

**Graduation honors:**
- Valedictorian of the cohort (*devre birincisi*)
- Honor graduate
- Sports star
- Arts award
- Community award (mentoring and council)

**Ending: a "Where are they now?" epilogue**, selected from ~30 outcomes. Examples:
- Medical school → doctor
- Engineering → founder
- Conservatory → musician
- National team athlete
- Teacher returning to Daçka
- Journalist, lawyer, architect, game developer…

A couple who are still together at graduation get a **joint epilogue line**. Your **keepsake** and your family (§5.2) appear in the final scene.

**Yearbook:** a permanent page per player. It includes your class photos from all 10 years, stats, medals, best friends and **signatures and messages from other players**.

**Alumni (*Mezun*) mode (post-game):**
- Alumni keep their character and can visit campus.
- They can give a Career Day talk (a live event they host) and mentor new cohorts.
- They can donate in-game money to a scholarship fund that gives every new cohort small starting perks.

This mirrors the school's strong alumni culture, keeps veterans in the game and makes newcomers' experience better.

---

## 16. UI / screens

1. **Login / sign-up** (language toggle TR/EN)
2. **Character creator** (live preview, randomize button) → **Your Story** screen (§5.2): calm music, simple choices, no stats shown until the end
3. **Campus HUD:**
   - Clock and day
   - Energy, hunger and mood bars
   - Pocket money
   - Active quest tracker
   - Minimap (fog and "???" outlines until discovered, §4.4)
   - Chat
   - Notification toasts
4. **Timetable (*ders programı*):** today's lessons and where they are
5. **Quest journal:** main, side and recurring, with progress
6. **Report card (*karne*):** subjects, averages, behavior grade, certificates
7. **Relationships:** friends, rivals, teachers, crush and partner, with scores
8. **Locker / inventory**
9. **Profile:** attributes, respect, medals, titles, discipline record
10. **Cohort page:** members, goals, chat, class photos
11. **Yearbook**
12. **Settings:** language, audio, chat safety, **Memory scenes** (Full / Gentle / Off), **Romance with players** (on/off), accessibility (text size, colorblind-safe colors, reduced motion)

Input: keyboard and mouse (WASD or arrows, E to interact) plus click-to-move. Design touch controls in from the start for mobile later.

---

## 17. Art & audio direction

**Art:**
- 32×32 px pixel art in a **3/4 top-down view** (like Stardew Valley): you see each building's roof and its front façade
- Day/night lighting, seasonal tile swaps (autumn leaves, snow, spring)

**Taken from the aerial render** ([reference/campus-aerial.webp](reference/campus-aerial.webp)):
| Element | In the render | In pixel art |
|---|---|---|
| Roofs | Light-grey standing-seam metal with rectangular skylights | Grey roof tiles with a skylight "window" tile |
| Façades | White and light-grey, ribbon windows, **warm wood/orange vertical fins** | White walls with an orange-brown fin tile pattern: Daçka's signature look |
| Yemekhane & Spor Salonu | **Blue solar panel** roofs; stepped roof terraces with plants on the Yemekhane & Sosyal Merkez | Solar tile sets; the terraces are walkable zones |
| Teknik Alan | **Green roof** | Grass-top roof: a hidden spot |
| Eğitim Binası & dorms | Open inner **atriums** | The two Eğitim atriums and the dorm courtyards are walkable outdoor spaces |
| Plazas (Yurt Meydanı & Merkez Meydan) | Pale stone paving, grass strips, round deciduous trees, white café umbrellas | Paving plus a grass tileset, 3 tree variants, café tables (central plaza), benches (dorm plaza) |
| Outdoor court | Red-brown surface with white lines | Court tileset |
| Surroundings | Dense green forest; a residential neighborhood to the east | Forest border (non-walkable except for secret paths); rooftops visible past the fence |

**Palette anchors:** roof grey `#C9CED3`, façade white `#EEF0F1`, fin wood `#C98A4B`, solar blue `#3A5F9E`, tree green `#4F8A4F`, forest `#2F6B45`, paving `#E7E3DA`, court red `#A8483E`.

**Characters:**
- Layered sprites (body + face + hair + uniform + accessories) × 3 age stages × 4 directions × walk/idle/sit/sleep animations
- For prototyping, use the **LPC (Liberated Pixel Cup)** character generator assets.
- Note: LPC assets are CC-BY-SA/GPL, so they need attribution and their share-alike terms apply. Plan to **commission original art** before launch.

**Campus:** built in the **Tiled** map editor following [reference/campus-layout.svg](reference/campus-layout.svg).

**Audio:**
- Lo-fi or chiptune music per area and time of day
- The **school bell** as the signature sound
- Ambience: dining hall chatter, birds in the courtyard, a quiet dorm at night

---

## 18. Technical architecture

### 18.1 Stack
| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere | Shared types and formulas between client and server |
| Game client | **Phaser 3** + **Vite** | Mature 2D web engine, Tiled support |
| UI overlay | **React** (menus, journal, karne, chat) | Much easier than building UI inside the canvas |
| Multiplayer server | **Colyseus** (Node.js) | Authoritative rooms, automatic state sync, built for this kind of game |
| API | **Fastify** (Node.js) | Auth, profiles, non-realtime reads |
| Database | **PostgreSQL** (+ Drizzle or Prisma ORM) | Durable saves, relational data (relationships, cohorts) |
| Cache / presence | **Redis** | Colyseus presence and scaling, rate limits, sessions |
| Auth | Email + password and Google sign-in (or **Supabase Auth** to move faster) | |
| i18n | **i18next**, `tr` and `en` JSON files | All text through translation keys from day one |
| Maps | **Tiled** → JSON | |
| Hosting | Start: one VPS with Docker Compose, client on a CDN (Cloudflare Pages). Later: Colyseus Cloud or Kubernetes | Cheap to start, room to grow |

### 18.2 System diagram
```
 ┌───────────────────────────── Browser ─────────────────────────────┐
 │ Phaser 3 (world, sprites, minigames)  +  React (menus, HUD, chat) │
 └───────────────┬───────────────────────────────────┬───────────────┘
                 │ HTTPS (REST)                       │ WebSocket
                 ▼                                    ▼
        ┌─────────────────┐               ┌───────────────────────────┐
        │ API (Fastify)   │               │ Game server (Colyseus)    │
        │ auth, profile,  │               │ CampusRoom (outdoor)      │
        │ yearbook, admin │               │ BuildingRoom (per interior)│
        └───────┬─────────┘               │ LessonRoom (per class)    │
                │                         │ MinigameRoom / FightRoom  │
                │                         │ Campus clock, NPC sim     │
                │                         └──────┬─────────────┬──────┘
                ▼                                ▼             ▼
        ┌──────────────────────────────────────────┐   ┌─────────────┐
        │ PostgreSQL (saves, progress, social)     │   │ Redis       │
        └──────────────────────────────────────────┘   └─────────────┘
```

### 18.3 Campus worlds (shards) and rooms
- A **campus world** holds up to ~200 characters [TUNE]. New cohorts are admitted in **admission windows** (e.g. a new cohort opens every 2 weeks), so cohorts are real groups who start together.
- Inside a world, each **zone** (outdoor campus or a building interior) is its own Colyseus room. Players only receive updates for their zone, which keeps bandwidth small.
- **Lesson instances:** when a lesson starts, players of that grade and section join a `LessonRoom` with NPC classmates.
- **The world simulation** (campus clock, NPC schedules and patrols) runs on the server, one per campus world.

### 18.4 Movement & sync
- The client predicts its own movement for snappy controls and sends inputs or positions at about 10–15 Hz.
- The server validates speed, collisions and zone transitions and corrects cheaters.
- Other players are interpolated smoothly.

### 18.5 Saving progress
- **The server is the only source of truth.** The client never sends "I have 500 XP", only "I did action X", and the server decides the reward.
- **Important events** (quest complete, item change, grade, relationship change) are written to Postgres immediately in a transaction.
- **Volatile state** (position, needs) is saved every 30 seconds and on disconnect.
- **Every reward is logged** in an append-only `event_log` for debugging, rollbacks and anti-cheat.
- Daily backups with point-in-time recovery.
- **Log in anywhere and continue.** If you disconnect mid-minigame, the attempt is voided, not lost.

### 18.6 Anti-cheat
- Minigame questions are generated server-side with a seed, answers are checked server-side and minimum reaction times are enforced.
- XP sources have per-hour caps per player, and friendship has daily caps per pair.
- Rate limits on chat and actions.
- Admin tools to inspect and roll back a player.

### 18.7 Content as data
Missions, dialogues, NPC schedules, question banks and items live in **YAML files** in the repo, not in code. Adding next year's missions doesn't need a programmer. Example:

```yaml
id: y1_first_friend
year: 1
type: main
title: quests.y1_first_friend.title          # i18n key
description: quests.y1_first_friend.desc
requires: [y1_arrival]
steps:
  - id: talk_roommate
    objective: { type: talk_to, target: role:roommate }
  - id: share_meal
    objective: { type: eat_meal_with, target: any_student, count: 1 }
  - id: become_friends
    objective: { type: relationship_at_least, target: any_student, value: 40 }
rewards:
  xp: 150
  mood: 10
  achievement: first_friend
```

### 18.8 Repository layout (monorepo)
```
/apps
  /client        Phaser + React (Vite)
  /server        Colyseus game server
  /api           Fastify REST API
/packages
  /shared        types, formulas (XP, grades), quest engine, validation
/content
  /quests        YAML missions per year
  /dialogue      dialogue trees
  /questions     minigame question banks per grade/subject
  /i18n          tr.json, en.json
/assets
  /maps          Tiled maps
  /sprites  /audio
/infra           docker-compose, deploy scripts
```

---

## 19. Data model (first draft)

```
users              id, email, password_hash, birth_year, age_band, locale, parental_consent,
                   settings(jsonb: memory_scenes, romance_with_players, safe_chat), created_at
campus_worlds      id, name, region, capacity, status
cohorts            id, world_id, name, admitted_at
characters         id, user_id, world_id, cohort_id, name, gender, appearance(jsonb),
                   hometown, trait, loss (mother|father|both), loss_cause, guardian,
                   keepsake_item_id, current_year, track, age_stage,
                   xp_this_year, respect, discipline, money,
                   attributes(jsonb), needs(jsonb), position(jsonb), created_at
class_sections     id, world_id, grade, label            -- 4-A, 4-B …
section_members    section_id, character_id | npc_id
subject_grades     character_id, year, semester, subject, lesson_score, homework_score,
                   midterm, final, average
report_cards       character_id, year, semester, gpa, behavior, certificate
quest_progress     character_id, quest_id, status, step_index, data(jsonb), updated_at
discoveries        character_id, location_id, state (seen|discovered), at
fog_maps           character_id, map_id, revealed_cells(bytea bitmap)
relationships      a_id, b_id (character or npc), score, flags, romance_status
                   (none|crush|going_out|couple), romance_since, updated_at
inventory_items    character_id, item_id, qty, equipped
achievements       character_id, achievement_id, unlocked_at
medals             character_id, medal_id, event, rank, awarded_at
teams / clubs      id, world_id, type, name;  memberships(character_id, role)
discipline_log     character_id, offense, points, at
yearbook_entries   owner_id, author_id, message, created_at
event_log          id, character_id, type, payload(jsonb), at   -- append-only
reports / mutes    reporter_id, target_id, reason, status       -- moderation
```

Static content (quests, items, NPCs, questions) stays in YAML and is loaded at server start, not stored in the DB.

---

## 20. Safety, privacy & legal

**Players may be children,** quite possibly real Daçka students, some of whom have really lost a parent. Plan for that from day one.

**Privacy law:** **KVKK** (Turkey), plus **GDPR** for EU players.
- Ask for birth year at sign-up.
- Under 13: parental consent required, and **Safe Chat** mode (preset phrases only) by default.
- Collect the minimum personal data.

**Chat safety:**
- Profanity filter in Turkish and English
- Report, mute and block on every player
- Rate limiting
- Moderator dashboard
- No sharing of phone numbers or links (pattern filter)

**Content rules:**
- Romance stays innocent: hanging out and holding hands under 16, plus hugs and a kiss on the cheek from 16. **No sexual content at any age.** Player-to-player romance is limited by real-age band (§10.7).
- Backstory content is respectful and can be toned down (§5.2).
- Fights stay cartoonish, with no weapons or injuries beyond a bandage.
- Bullying of real players is designed out (§8.3).

**Name and brand:**
- The game and the school are called **Daçka**. Use no official logo or emblem; make an original crest instead.
- The campus layout and the "Daçka" nickname are still clearly recognizable. That's fine for a community or fan project, but **before a public or commercial launch, contact Darüşşafaka Cemiyeti**. An endorsement could also become a partnership with the alumni association.

---

## 21. Roadmap

| Milestone | Goal | Contents |
|---|---|---|
| **M0: Pre-production** | Plan locked | Finalize this GDD, confirm the room locations (§4.2), art style test (one character + the Eğitim Binası façade with orange fins) |
| **M1: Single-player vertical slice** | "It feels like Daçka" | Character creator (incl. Your Story), start at the Ana Kapı, fog-of-war discovery, outdoor campus + 3 buildings (Eğitim Binası ortaokul wing + Kütüphane, your dorm, Yemekhane), movement, campus clock, 1 lesson minigame, dining hall, needs, server save |
| **M2: Multiplayer foundation** | "I can see my friends" | Accounts, campus world, zone rooms, other players, chat with filters, relationships |
| **M3: Year 1 complete** | One full year playable | Quest engine + Year 1 missions, timetable, homework, karne, NPC schedules, Year Gate, summer transition |
| **M4: Closed alpha** | Real cohort test | ~20–30 testers as one cohort, telemetry, balance XP and needs |
| **M5: Years 2–5** | Middle school | Clubs, sports, tournaments, fights, elections, night stealth, romance stage 1, Big Exam |
| **M6: Years 6–10** | High school + ending | Moving Up (lise wing and upper dorm floors), prep year, tracks, mentoring, council, romance 16+, university exam, graduation, yearbook, endings |
| **M7: Launch & live ops** | Public | Moderation tools, admission windows, alumni mode, seasonal events |

**Strategy:** build Year 1 **really well** before anything else. If one year is fun with friends, the other nine are content production.

---

## 22. Open questions for you

**Answered in v0.2:**
- Campus layout (aerial render)
- Prep year
- Name (Daçka)
- Backstory with skills
- Romance

**Answered in v0.3:**
- Romance from Year 4, any genders
- Combined dorms facing each other and one academic building
- No football field
- Start at the main gate with discovery
- New layout: dorms in the north corners with a dorm plaza between them, the academic building + library in the center-west, the dining hall in the center-east, the infirmary at floor −1 of the girls' dorm

**Answered in v0.5:**
- Year 1 missions
- Player romance: within ±2 years of real age (with the 18 hard line)
- Pool exists

**Still open:**
1. **Year 2–10 missions:** want to define them like Year 1? I can draft each year in the same format for you to edit.
2. **Traditions:** which real traditions, events, slang and school songs should be in the game?
3. **Players:** who do you most want playing: current students, alumni or the general public?
4. **Monetization:** fully free and non-commercial, or cosmetic purchases later?
5. **Team:** are you building this alone? Who makes the art and music?
6. **Tone:** is the playful approach to fights and night-time mischief right?
