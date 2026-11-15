# Daçka

A top-down boarding-school life simulation set on a campus inspired by Darüşşafaka. You arrive at the main gate at 9, carry your bag to the dorm, register, get your class, make friends, survive etüt and lights-out, and work through the year.

**Play:** https://dogucanyenidunya.github.io/dackasimulationgame/

- Turkish and English
- Sign in with your email (a magic link, no password) to keep your save in the cloud and see your friends on campus live, with chat and emotes
- Or play solo without an account; the game is then saved in your browser

The full design is in [GAME_DESIGN.md](GAME_DESIGN.md).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk (Shift to run) |
| E | Talk / interact / enter |
| M | Big map |
| F | Friends and your invite link (when online) |
| Enter | Chat (when online) |
| Esc | Close a panel |

## Run locally

```bash
cd apps/client
npm install
npm run dev
```

Opens on http://localhost:5173. Without Supabase settings it runs single-player.

## Online setup (one time)

1. **Supabase project.** Create a free project at supabase.com. In the **SQL Editor**, run [supabase/schema.sql](supabase/schema.sql).
2. **Auth URLs.** Go to Authentication → URL Configuration:
   - Site URL: `https://dogucanyenidunya.github.io/dackasimulationgame/`
   - Redirect URLs: add the same URL, plus `http://localhost:5173/**` for local testing.
3. **Keys.** Copy the **Project URL** and the **anon / publishable** key from Project Settings → API. These two are meant to be public. **Never use or share the `service_role` / secret key.**
4. **GitHub variables.** In the repo, go to Settings → Secrets and variables → Actions → **Variables** and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. **Pages.** Go to Settings → Pages → Source and choose **GitHub Actions**. Every push to `main` builds and deploys the game.

For online play locally, copy `apps/client/.env.example` to `apps/client/.env.local` and fill in the same two values.

## How multiplayer works (stage 1)

- Everyone online is in one shared campus channel (Supabase Realtime). Presence shows who is here, and broadcasts carry positions, chat and emotes.
- You only see players who are in the same place as you: the campus, the dining hall, the classroom, or your dorm (girls' and boys' dorms are separate).
- Walk up to another player and press E for the same kinds of things you can do with a classmate: chat, share a simit, tell a joke, give a nickname, borrow 5 ₺, send a reaction, or play a two-player game together. **Yetimball** (tetherball): take turns hitting the ball; the right angle and the right strength wind the rope further your way, and whoever has it wound all the way round at the end of a round wins. Rock-paper-scissors is best of three.
- **Shared campus clock (stage 2).** Signed in and past registration weekend, everyone sees the same weekday and time ([worldClock.ts](apps/client/src/game/worldClock.ts)). It's worked out from real time (a campus day is about 24 real minutes), so it needs no server and keeps running when nobody is playing. Your day count and progress stay your own.
  - Nothing skips time online: sleep, lessons, meals and other actions last as long as they take on the campus clock (a night is about 4 minutes), with a Stop button. Menus don't pause it and fast time (T) is off.
  - Coming back after a break, your clock jumps forward to the campus time, with no penalties for the time you missed. Switching to another tab or app pauses the game (solo too); pressing Continue catches up the same way.
  - Solo play and the registration weekend keep their own clock, as before.
- **Friends and invite links.** Press F (or 🤝) to get your personal invite link. A friend who opens it and signs in becomes your friend straight away. You can also walk up to any player on campus, press E and choose **Add friend**; they accept from their own friends list. Friends show with a gold ★ over their head, and the list shows which friends are online and where. Making a new link switches the old one off.
  - Stored in the `profiles`, `invites` and `friendships` tables. Players can't write them directly: everything goes through database functions that check who is asking. If you set up Supabase before this was added, run [supabase/schema.sql](supabase/schema.sql) again (it's safe to re-run).
- Saves are stored per account in the `saves` table, protected by row-level security.
