# Newsletter generator

Generates the weekly Junk Mail issue from Telegram messages already stored in
Supabase. Reads `telegram_messages` for the target week, asks Claude to produce
`content_json` matching the documented shape, and upserts the row into
`newsletter_issues`.

## Required GitHub secrets

Add these in **GitHub → Repo Settings → Secrets and variables → Actions**:

| Secret | What it is |
| --- | --- |
| `SUPABASE_SERVICE_KEY` | Service-role key (Supabase → Project Settings → API). Server-side only. **The one genuinely required secret.** |
| `SUPABASE_URL` | Optional. Defaults to `https://owtljqjastcewgqqntdu.supabase.co`; set it only if the project moves. |
| `ANTHROPIC_API_KEY` | API key from console.anthropic.com |
| `VERCEL_DEPLOY_HOOK_URL` | Optional. Vercel → Project → Settings → Git → Deploy Hooks |

> Add these under **Settings → Secrets and variables → Actions**. The
> *Dependabot* and *Codespaces* tabs on that same page are separate stores that
> workflows cannot read, and a value saved under *Variables* is `vars.X`, not
> `secrets.X`. A run whose logs show a secret as blank rather than `***` is
> almost always one of those, or a name mismatch — the **Preflight — secret
> visibility** step in `newsletter-ensure.yml` prints a present/absent table so
> you can tell which without guessing.

This script writes the new issue with `status='generated'` (a human flips it to
`published`). It does **not** render or commit the static HTML — see the
runner map below for which pipeline does what.

## Who runs the newsletter

Three pieces, in order of who does the real work:

| Runner | When | What it does |
| --- | --- | --- |
| **Railway cron** (`client/newsletter-cron/`) | Sun 14:00 UTC (9:00 AM CT) | **Primary.** Scrape Telegram → Claude → Supabase row → render + commit HTML → Vercel deploy → notify. |
| **Newsletter Weekly Ensure** (`.github/workflows/newsletter-ensure.yml`) | Sun 9:30 AM CT | **Safety net.** Unpause Supabase, verify Railway actually shipped, rerun the same Python pipeline if not, redeploy Vercel. |
| **Supabase Keepalive** (`.github/workflows/supabase-keepalive.yml`) | Daily 13:17 UTC | Reads one row so the free-tier project never idles into a pause. |

`weekly-newsletter.yml` (this TypeScript script) is now **manual-only**. It
used to run on its own Sunday schedule, which meant two schedulers generating
the same issue. It is kept for targeted backfills of a `newsletter_issues` row.

### Why 9:30 AM CT takes two cron lines

GitHub cron is UTC and has no DST, so `newsletter-ensure.yml` fires at both
14:30 and 15:30 UTC and a guard job exits unless the local Chicago hour is
`09`. 14:30 UTC is 9:30 during CDT, 15:30 UTC during CST — exactly one of the
two runs proceeds on any given Sunday. GitHub's scheduler also queues runs 5–15
minutes late under load, which is why the guard checks the hour and not the
exact minute.

### Extra secrets for the safety net

| Secret | What it is |
| --- | --- |
| `IMPACT_NEWSLETTER` | **Already configured.** The Supabase Management API token, used to unpause a paused project. The workflow reads `SUPABASE_ACCESS_TOKEN` first and falls back to this name, so renaming it to the conventional name later needs no code change. |
| `SUPABASE_PROJECT_REF` | Rarely needed. The ref is derived from `SUPABASE_URL`, and falls back to the project's known ref (`owtljqjastcewgqqntdu`) if that URL is a custom domain. Set this only if the project ever moves. |
| `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_GROUP`, `TELEGRAM_SESSION_STRING` | Optional. Let the fallback re-scrape Telegram when Railway never ran. Without them it generates from whatever `telegram_messages` rows already exist. |
| `NEWSLETTER_BASE_URL` | Optional. Public base URL for links in notifications. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SLACK_WEBHOOK_URL`, `OPENCLAW_WEBHOOK_URL` | Optional notification channels. |

The fallback commits HTML with the built-in `GITHUB_TOKEN` (the job requests
`contents: write`), so no personal access token is needed for that part.

## Manual run from GitHub UI

GitHub → **Actions** → **Weekly Newsletter** → **Run workflow**. Inputs:

- `week_start` — Monday of the target week, e.g. `2026-05-17`. Blank = current ISO week.
- `issue` — override issue number. Blank = use `newsletter_config.current_issue`.
- `publish` — check to set `status='published'` and hit the Vercel deploy hook.
- `dry_run` — check to print JSON without writing to Supabase.

## Local run

```bash
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... ANTHROPIC_API_KEY=... \
  pnpm generate:newsletter --week-start 2026-05-17 --issue 7 --dry-run
```

Drop `--dry-run` to actually write. Add `--publish` to publish immediately.

## Message backlinks

Each story section ends with a **Read the thread →** link into the Telegram
conversation it was written from, and every quoted member's name in *From the
Group Chat* links to their exact message. Readers use these to reread the full
exchange or grab links that were shared in the chat.

How it works:

- Messages are fed to Claude prefixed with their id (`#4821 [2026-07-20 14:03] Marcus`).
- Claude returns `source_ids` on each story and a `message_id` on each voice.
- A section links to its **earliest** cited id, so the reader lands where the
  conversation starts rather than mid-thread.
- The base URL is derived from `TELEGRAM_GROUP` — `@name` → `https://t.me/name`,
  `-100123…` → `https://t.me/c/123…`. Override with `TELEGRAM_LINK_BASE` only if
  the group is identified by a plain title, which has no URL form.

The React issue page (`/newsletter/<slug>`) reads the same fields from Supabase
and needs `VITE_TELEGRAM_LINK_BASE` set in Vercel to render its links.

Attribution is best-effort by design: a section with no `source_ids` renders
with no link rather than a guessed one, and the 16 issues generated before this
existed are unaffected. Private-group (`t.me/c/…`) links open in the Telegram
app and only work for members.

## Telegram ingestion

This script does **not** scrape Telegram. It assumes `telegram_messages` is
populated by a separate Telethon worker (presumably running on Railway or on
your Mac). If the table is empty for the target week, the script exits with
an error before calling Claude.
