// Supabase Edge Function: "a friend left you a note" emails (GDD §6.2.2).
//
// POST from the Database Webhook on INSERT into public.notes (header x-webhook-secret):
//   emails the recipient that a friend left them a note — who, never what — at most once every 20 hours,
//   and only if they haven't switched note emails off.
// POST {"unsubscribe": "<token>"} from the game: switches note emails off. The email's "stop" link opens the
//   game, which asks the player to press a button first, so a mail scanner opening the link changes nothing.
//
// Secrets (Edge Functions → Secrets): SMTP_USER, SMTP_PASS (the Gmail app password), WEBHOOK_SECRET, SITE_URL.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Deploy with JWT verification off (players can unsubscribe without signing in).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const SITE = env('SITE_URL') || 'https://dogucanyenidunya.github.io/dackasimulationgame/';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });
  const payload = await req.json().catch(() => null) as
    { unsubscribe?: string; type?: string; table?: string; record?: { sender: string; recipient: string } } | null;

  // the game's "stop these emails" button
  if (payload?.unsubscribe !== undefined) {
    const token = String(payload.unsubscribe);
    if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ ok: false }, 400);
    const { data, error } = await admin.rpc('unsubscribe_note_emails', { p_token: token });
    return json({ ok: !error && data === true }, error ? 500 : 200);
  }

  // everything else must come from the database webhook
  if (!env('WEBHOOK_SECRET') || req.headers.get('x-webhook-secret') !== env('WEBHOOK_SECRET')) {
    return json({ error: 'forbidden' }, 403);
  }
  const rec = payload?.record;
  if (payload?.type !== 'INSERT' || payload?.table !== 'notes' || !rec?.recipient) return json({ skipped: 'not a new note' });

  // at most one email every 20 hours, and none if switched off (the database decides, so two notes at once can't both send)
  const { data: token, error: claimError } = await admin.rpc('claim_note_email', { p_user: rec.recipient });
  if (claimError) return json({ error: claimError.message }, 500);
  if (!token) return json({ skipped: 'off or already emailed today' });

  const [{ data: user }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(rec.recipient),
    admin.from('profiles').select('name').eq('user_id', rec.sender).maybeSingle(),
  ]);
  const to = user?.user?.email;
  if (!to) return json({ skipped: 'no email' });
  const name = (profile?.name as string | undefined)?.trim() || '';

  const client = new SMTPClient({
    connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: env('SMTP_USER'), password: env('SMTP_PASS') } },
  });
  try {
    await client.send({
      from: `Daçka <${env('SMTP_USER')}>`,
      to,
      subject: name ? `✉️ ${name} sana bir not bıraktı` : '✉️ Bir arkadaşın sana bir not bıraktı',
      content: `${name || 'Bir arkadaşın'} sana bir not bıraktı. Okumak için Daçka'ya gel: ${SITE}\n\n${name || 'A friend'} left you a note. Come to Daçka to read it.\n\nBu e-postaları kapat / Stop these emails: ${unsubscribeUrl(token)}`,
      html: emailHtml(name, unsubscribeUrl(token)),
    });
  } catch (e) {
    // let the next note try again rather than waiting a day for an email that never went out
    await admin.from('email_prefs').update({ last_note_email_at: null }).eq('user_id', rec.recipient);
    return json({ error: String(e) }, 502);
  } finally {
    await client.close().catch(() => {});
  }
  return json({ sent: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

/** opens the game, which asks before switching anything off */
function unsubscribeUrl(token: string) {
  const u = new URL(SITE);
  u.searchParams.set('unsubscribe', token);
  return u.toString();
}

/** same look as the sign-in email; says who left the note, never what it says */
function emailHtml(name: string, unsubscribe: string) {
  const tr = esc(name || 'Bir arkadaşın');
  const en = esc(name || 'A friend');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1c2e28;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#f4f1e8;border-radius:14px;padding:32px 28px;text-align:center;">
      <tr><td>
        <div style="font-size:34px;font-weight:bold;color:#6b4a2b;letter-spacing:1px;">Daçka</div>
        <div style="font-size:44px;margin:18px 0 6px;">✉️</div>
        <div style="font-size:17px;color:#2f3a34;line-height:1.5;font-weight:bold;">${tr} posta kutuna bir not bıraktı.</div>
        <div style="font-size:14px;color:#6f7a72;margin:4px 0 22px;">${en} left a note in your pigeonhole.</div>
        <a href="${esc(SITE)}" style="display:inline-block;background:#7a5230;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 26px;border-radius:9px;">
          Notu oku · Read the note
        </a>
        <div style="font-size:12px;color:#8a918c;line-height:1.5;margin-top:26px;border-top:1px solid #e2dccb;padding-top:16px;">
          Günde en fazla bir e-posta gönderiyoruz.<br>We send at most one of these a day.<br><br>
          <a href="${esc(unsubscribe)}" style="color:#8a918c;">Bu e-postaları kapat · Stop these emails</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}
