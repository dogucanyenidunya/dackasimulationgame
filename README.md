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

### Sign-in emails

Work mail scanners (such as Outlook Safe Links) open links before the player does, so a link that signs in on opening gets used up. Sign-in therefore uses a code, and the link only opens the game, where the player presses **Sign in**.

1. **SMTP.** Authentication → Emails → SMTP Settings: turn on custom SMTP (for example Gmail with an app password: host `smtp.gmail.com`, port `465`). Supabase's built-in sender is limited to 2 emails an hour and doesn't let you edit templates. After saving, raise the limit under Authentication → Rate Limits.
2. **Templates.** In both **Magic Link** and **Confirm signup**, show `{{ .Token }}` (the code) and link to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`. Don't use `{{ .ConfirmationURL }}`.

### Note emails ("a friend left you a note")

Sent by the Edge Function [supabase/functions/note-email](supabase/functions/note-email/index.ts): who left a note, never what it says, at most one email a day per player, with a "stop these emails" link. The Auth SMTP settings above can't send these, so the function sends through Gmail itself.

1. **Deploy the function** with JWT verification **off** (players can unsubscribe without signing in). Either Edge Functions → Deploy a new function → Via editor, name it `note-email`, paste the file and switch off "Verify JWT"; or with the Supabase CLI: `supabase functions deploy note-email --no-verify-jwt --project-ref <project-ref>`.
2. **Secrets** (Edge Functions → Secrets): `SMTP_USER` (the Gmail address), `SMTP_PASS` (its 16-letter app password, no spaces), `WEBHOOK_SECRET` (any long random text) and `SITE_URL` (the game's address).
3. **Webhook.** Database → Webhooks → Create: table `notes`, event **Insert**, type **Supabase Edge Functions**, function `note-email`, method POST, and add an HTTP header `x-webhook-secret` with the same value as `WEBHOOK_SECRET`.

Without these steps notes still work in the game; only the emails are missing.

### Waitlist and launch
Before launch, players sign in, make their character and wait in a lobby (their place on the list, a countdown, who's waiting, their invite link). Owners and testers play as usual. The lobby turns into "The gates are open!" the moment an owner opens the game.
1. **Add yourself first.** Running [supabase/schema.sql](supabase/schema.sql) adds the waitlist, and the game is **closed** for everyone else from then on. In the SQL Editor, straight after it:
   ```sql
   insert into public.staff (user_id, role) select id, 'owner' from auth.users where email = 'YOUR EMAIL'
   on conflict (user_id) do update set role = excluded.role;
   ```
   Friends who should keep playing before launch: the same with `'tester'`. (They need to have signed in once, so their account exists.)
2. **Opening the game.** Signed in as an owner, the title screen shows a 🔑 panel: how many are waiting, a launch date for the lobby's countdown, and **Open to everyone** (and **Close** again). Or in the dashboard: Table Editor → `game_settings` → `is_open`.
3. Until the SQL has been run, the game works as before (nobody waits). The switch is enforced by the game itself, so it keeps people out of the campus, not a determined coder out of a public website.

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
- **Daily care.** The title screen shows your character, how they're doing, and three small acts of care: 🥪 a kumanya, 📞 a call from home, ✉️ a note to a friend. While you're away in real life, mood, energy and health drift down slowly, but never below 45 and never for the first 24 hours after you last cared for them or came to campus. Grades, friendships and missions never change ([care.ts](apps/client/src/game/care.ts)). Solo players get the first two.
  - **Notes are switched off for now** (`NOTES_ENABLED` in [care.ts](apps/client/src/ui/care.ts)): the note button, pigeonhole and email switch are hidden. The database side and the email function stay in place for when they come back.
  - Notes reach a friend's pigeonhole straight away, and they get an email about it (see **Note emails** above). Only friends can leave notes: 30 a day in all and 5 a day to the same friend. Anyone can be blocked from their note, which ends the friendship and stops notes and friend requests either way. Stored in the `notes`, `blocks` and `email_prefs` tables, written only through database functions.
- Saves are stored per account in the `saves` table, protected by row-level security.
