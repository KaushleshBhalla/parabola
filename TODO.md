# Things to fix

Outstanding items that only Kaushlesh can do — Claude can't set account
secrets, click Discord's consent screens, or verify things live in Discord.
Check items off as they're done; add new ones as they come up.

## Infra / setup

- [ ] **Set `CRON_SECRET`** — neither `/api/cron/expire-deadlines` nor
      `/api/cron/meeting-reminders` is authenticated yet (both skip the check
      when the env var is unset, so they currently work but are open to
      anyone who finds the URL). Generate a random string, add it as
      `CRON_SECRET` in Vercel → Project Settings → Environment Variables
      (Production), and add the *same* value as a GitHub Actions repo secret
      also named `CRON_SECRET` (Settings → Secrets and variables → Actions).
      No code change needed — both endpoints already check for it.
- [ ] **Confirm the bot is a real member of your test server** — re-invited
      via the corrected link (`https://discord.com/oauth2/authorize?client_id=1543380430831624222&permissions=0&scope=bot%20applications.commands`)
      after the `integration_types_config` fix. Check it shows up in the
      server's member list (as Offline is fine/expected) rather than just
      having its commands registered.
- [ ] **Check `CLERK_WEBHOOK_SIGNING_SECRET`** — not set in Vercel
      production as of this check. If the Clerk webhook
      (`app/api/webhooks/clerk/route.ts`) is meant to be live, it's likely
      failing signature verification right now. Worth confirming whether
      it's even configured on Clerk's side (an endpoint has to be added in
      the Clerk dashboard for this to matter at all).
- [ ] **Enable "Server Members Intent" for the bot** — required for
      `/teammates` to work at all. Confirmed live: the guild-members API
      call currently returns `403 Missing Access`, and the app's `flags`
      don't have this intent bit set — this is a Developer Portal-only
      toggle, not something settable via the API. Go to
      [discord.com/developers/applications](https://discord.com/developers/applications)
      → Parabola → Bot → scroll to **Privileged Gateway Intents** → turn on
      **Server Members Intent** → Save Changes. No code change needed once
      it's on.
- [ ] **Enable "Message Content Intent" for the bot** — required for the
      "Ask AI" tab to read any Discord message text. Same portal page as
      above: **Bot → Privileged Gateway Intents → Message Content Intent →
      on → Save**. Without it, fetched messages come back with empty
      content and the AI has nothing to work with.
- [ ] **Check `ENCRYPTION_KEY` is set in Vercel production — this one's not
      confirmed, check it yourself in the dashboard.** A CLI check for this
      came back inconclusive (the CLI login had expired when it ran, so the
      "not found" result can't be trusted either way). Go to Vercel →
      Project → Settings → Environment Variables → search `ENCRYPTION_KEY`
      → confirm it's set for **Production**. It's already in `.env.local`.
      Two things now depend on it: the existing `/link` Discord flow (its
      token signing), and the new "Ask AI" feature's bring-your-own-key
      storage (each user's Gemini/Groq key, stored AES-256-GCM encrypted).
      If it's missing, add it in Vercel with the same value as `.env.local`
      and redeploy. No server-wide AI key is needed — users get their own
      free key via the in-app guide at `/blog/free-ai-api-keys`.

## Known limitations (not bugs — just what the current plan allows)

- [ ] **Meeting reminders are ~5-minutes-approximate, not exact** — driven
      by a GitHub Actions workflow polling every 5 minutes
      (`.github/workflows/meeting-reminders.yml`), since Vercel's Hobby plan
      cron only runs once a day. GitHub's own scheduler can also slip by a
      few minutes under load. Getting real precision means moving off
      Hobby-tier scheduling (Vercel Pro's per-minute cron, or a dedicated
      scheduler like Upstash QStash).
- [ ] **Deadline-expiry-to-Backlog only runs once a day**
      (`/api/cron/expire-deadlines`) — same Hobby-plan cron ceiling. An
      hour-based deadline (`2hr` in `/assign`) can only ever be caught at
      the next daily sweep, not the instant it lapses.
