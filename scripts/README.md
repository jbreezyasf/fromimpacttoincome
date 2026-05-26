# Newsletter generator

Generates the weekly Junk Mail issue from Telegram messages already stored in
Supabase. Reads `telegram_messages` for the target week, asks Claude to produce
`content_json` matching the documented shape, and upserts the row into
`newsletter_issues`.

## Required GitHub secrets

Add these in **GitHub → Repo Settings → Secrets and variables → Actions**:

| Secret | What it is |
| --- | --- |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Service-role key (Supabase → Project Settings → API). Server-side only. |
| `ANTHROPIC_API_KEY` | API key from console.anthropic.com |
| `VERCEL_DEPLOY_HOOK_URL` | Optional. Vercel → Project → Settings → Git → Deploy Hooks |

The weekly GitHub Action lives at `.github/workflows/weekly-newsletter.yml`
and runs every **Sunday at 15:00 UTC (11 AM ET)**. It uses the secrets above
and writes the new issue with `status='generated'` (a human flips it to
`published`).

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

## Telegram ingestion

This script does **not** scrape Telegram. It assumes `telegram_messages` is
populated by a separate Telethon worker (presumably running on Railway or on
your Mac). If the table is empty for the target week, the script exits with
an error before calling Claude.
