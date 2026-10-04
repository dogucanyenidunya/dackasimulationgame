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
- Each player still has their own clock and progress. A shared world clock is planned for stage 2.
- Saves are stored per account in the `saves` table, protected by row-level security.
