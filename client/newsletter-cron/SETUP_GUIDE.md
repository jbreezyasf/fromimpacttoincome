# Automated Newsletter Pipeline — Setup Guide

A step-by-step guide for spinning up a fully automated weekly community newsletter for any client. The pipeline scrapes a community chat, summarizes it with Claude, publishes a static HTML page, and pings the team — every Sunday morning, with zero manual editing.

The default flow assumes **Telegram** as the source platform. For Skool, Discord, Slack, GHL, Facebook, etc., see [COMMUNITY_CONNECTORS.md](COMMUNITY_CONNECTORS.md) — the rest of this guide still applies, you just swap out which scraper feeds the messages table.

---

## What This Builds

```
┌──────────────┐    ┌──────────────┐    ┌────────────┐    ┌────────┐    ┌────────┐
│  Telegram    │ →  │  Supabase    │ →  │  Claude    │ →  │ GitHub │ →  │ Vercel │
│  group chat  │    │  messages    │    │  generator │    │ commit │    │ deploy │
└──────────────┘    └──────────────┘    └────────────┘    └────────┘    └────────┘
   scrape_telegram.py            generate_newsletter.py            run_weekly.py orchestrates both
```

Every Sunday morning, a Railway cron job runs `run_weekly.py` which:

1. Scrapes the past week's Telegram messages into Supabase (idempotent — safe to retry).
2. Reads those messages, sends them to Claude with a structured prompt, gets back a JSON newsletter (7 sections: lede, main story, second story, third story, hot topic, quick hits, member spotlight, wins).
3. Saves the JSON to Supabase, bumps the issue counter.
4. Renders the JSON into static HTML using your template, commits it to GitHub.
5. Triggers a Vercel deploy hook so the site rebuilds with the new issue.
6. Marks the issue published, then pings any configured notification channels (Telegram bot, Slack, custom webhook).

No human in the loop until something breaks.

---

## Prerequisites

| Service     | What You Need                              | Free Tier? |
|-------------|--------------------------------------------|------------|
| Python 3.10+ | Local — for the one-time Telegram auth dance | n/a       |
| Telegram    | A user account that's already in the group | Yes        |
| Supabase    | A project (any tier)                       | Yes        |
| Anthropic   | API key from console.anthropic.com         | No (paid)  |
| GitHub      | A repo to host the rendered HTML           | Yes        |
| Vercel      | A project pointed at the GitHub repo       | Yes        |
| Railway    | An account for the weekly cron             | Yes (trial) |

---

## Step 1 — Clone the Pipeline Code

```bash
git clone https://github.com/jbreezyasf/fromimpacttoincome.git
cd fromimpacttoincome/client/newsletter-cron
```

All the scripts live in this directory. You'll customize the HTML template and the Claude prompt — the rest of the code can stay as-is.

If you're building for a new client, fork the repo or copy the `client/newsletter-cron/` directory into your client's repo and adjust paths.

---

## Step 2 — Supabase Tables

Create a new Supabase project (or use an existing one) and run these in the SQL editor.

### `newsletter_config` — single-row config

```sql
CREATE TABLE newsletter_config (
  id            INT PRIMARY KEY DEFAULT 1,
  current_issue INT NOT NULL DEFAULT 1,
  last_run      DATE
);

INSERT INTO newsletter_config (id, current_issue) VALUES (1, 1);
```

### `newsletter_issues` — one row per published issue

```sql
CREATE TABLE newsletter_issues (
  id            SERIAL PRIMARY KEY,
  issue_number  INT UNIQUE NOT NULL,
  slug          TEXT NOT NULL,
  week_start    DATE,
  week_end      DATE,
  status        TEXT DEFAULT 'draft',
  content_json  JSONB,
  generated_at  TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### `telegram_messages` — raw scraped messages

```sql
CREATE TABLE telegram_messages (
  id             SERIAL PRIMARY KEY,
  message_id     BIGINT UNIQUE NOT NULL,    -- Telegram's own message id; required for idempotent backfill
  timestamp      TIMESTAMPTZ NOT NULL,
  sender_name    TEXT,
  message_text   TEXT NOT NULL,
  reaction_count INT DEFAULT 0,
  reply_to_text  TEXT,
  week_start     DATE,                       -- the scraper computes this from the message's timestamp
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX telegram_messages_timestamp_idx ON telegram_messages(timestamp);
```

> **Why `message_id UNIQUE`?** The scraper upserts on this column. Without the unique constraint, repeated runs would create duplicate rows. The provided `setup_scraper_schema.sql` file is a no-op when these constraints already exist, so it's safe to run against any pre-existing schema.

Different platform than Telegram? Use the `community_messages` schema in [COMMUNITY_CONNECTORS.md](COMMUNITY_CONNECTORS.md) and update `fetch_messages()` in `generate_newsletter.py` to query that table instead.

---

## Step 3 — Telegram Credentials

The scraper uses **MTProto** via Telethon, which logs in as a real user (not a bot). Bots can't read full message history; user sessions can.

1. Go to https://my.telegram.org/apps (sign in with the user account that's in the group).
2. Click **"Create new application"** — fill in any app title and short name.
3. Copy:
   - **App api_id** → goes into `TELEGRAM_API_ID`
   - **App api_hash** → goes into `TELEGRAM_API_HASH`

You also need to identify the source group:
- Open Telegram in a desktop client, go to the group, click the title.
- Note the `@username` if it has one, OR get the numeric chat id from the URL (`https://web.telegram.org/k/#-1003120599051` → `-1003120599051`).
- Either form works as `TELEGRAM_GROUP`.

---

## Step 4 — GitHub Fine-Grained PAT

The generator commits the rendered HTML and updated index page directly to GitHub via API.

1. github.com → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
2. **Name**: `newsletter-cron-<client>`.
3. **Expiration**: 1 year (set a calendar reminder to rotate).
4. **Repository access**: Only select repositories → pick the newsletter repo only.
5. **Permissions** → Repository permissions → **Contents: Read and Write**.
6. Generate, copy the token. You'll paste it into `GITHUB_TOKEN`.

---

## Step 5 — Vercel Project + Deploy Hook

1. Create a Vercel project pointed at the GitHub repo. Standard static-site or Next.js setup is fine — Vercel just needs to serve the rendered HTML files in `client/public/newsletter/`.
2. Project Settings → Git → **Deploy Hooks** → Create Hook.
3. Hook name: `newsletter-cron`, branch: `main`.
4. Copy the URL. You'll paste it into `VERCEL_DEPLOY_HOOK_URL`.

---

## Step 6 — HTML Template

The generator renders a JSON newsletter into HTML by string-replacing placeholders in a template file. The template lives at:

```
client/public/newsletter/junk-mail-TEMPLATE.html
```

It uses placeholders like `[#]`, `[DATE RANGE]`, `[HEADLINE — punchy, specific, not generic]`, `[Para 1 — ...]` that get swapped out at render time. There's also a `client/public/newsletter/index.html` listing page that gets a new `<a class="issue-row">` block prepended for each new issue.

**To customize for your client:**

1. Copy `junk-mail-TEMPLATE.html` and edit the CSS, fonts, header/footer to match the client's brand. **Keep all the placeholders in square brackets verbatim** — they're the seams the renderer cuts on. Don't rename them.
2. Same for `index.html`: keep `<div class="issue-list">` and `<span id="count">…</span>` markers in place.
3. If you change a section's structure significantly (e.g., remove the "voices" subsection from hot topic), you'll also need to update the corresponding renderer function in `generate_newsletter.py`. Search for the placeholder string and you'll find the line.

---

## Step 7 — Local Setup (one-time)

This is where you do the Telegram auth dance and prove the pipeline works end-to-end before deploying.

### 7a. Install Python dependencies

From `client/newsletter-cron/`:

```bash
pip install -r requirements.txt
```

The requirements pin:
- `anthropic==0.25.0`
- `supabase==2.10.0` (older 2.4.x breaks with newer httpx)
- `telethon==1.36.0`
- `python-dotenv==1.0.1`
- `requests==2.31.0`
- `websockets==15.0.1` is needed transitively; `supabase` may pull a newer one, pin if needed

### 7b. Create your `.env`

Copy `.env.example` to `.env` and fill in everything. `.env` is gitignored at the repo root.

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role JWT, not the anon key>
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_API_ID=<from my.telegram.org>
TELEGRAM_API_HASH=<from my.telegram.org>
TELEGRAM_GROUP=<@username or numeric chat id>
TELEGRAM_SESSION_STRING=     # blank for now — you'll fill this after auth
GITHUB_TOKEN=<fine-grained PAT>
GITHUB_REPO=<owner>/<repo>
VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/...
NEWSLETTER_BASE_URL=https://<site>/newsletter
```

> **Watch out** — when you paste a multi-line value (like the Supabase JWT) into `.env`, make sure it lands on the **same line** as `SUPABASE_SERVICE_KEY=`. Some editors will hard-wrap long lines or split on paste, and dotenv silently treats line-2 as garbage.

### 7c. Telegram one-time auth

```bash
python scrape_telegram.py auth
```

You'll be prompted for:
1. Your phone number (the user account that's in the group)
2. The SMS code Telegram sends
3. Your 2FA password if enabled

When it finishes, it prints a `TELEGRAM_SESSION_STRING` — a single ~350-char base64-ish blob. Copy the whole thing into `.env`:

```
TELEGRAM_SESSION_STRING=1ApWapzMBu5lZRb9_xhSXjOyV...
```

> **Important:** session strings often end in trailing `=` padding chars. Copy/paste from terminals sometimes drops them. The scraper auto-pads if needed, so don't worry if your string is one or two chars shorter than expected.

### 7d. Backfill the past week

```bash
python scrape_telegram.py backfill --start 2026-MM-DD --end 2026-MM-DD
```

Use a Sunday-to-Saturday range. You should see something like:

```
Resolved entity: <YOUR GROUP NAME>
Collected 537 messages from Telegram
Upserted 537 / 537
```

If you see `null value in column "<something>" of relation "telegram_messages"`, the existing table has a NOT NULL column the scraper doesn't write. Either make the column nullable, or add it to the row dict in `_scrape_range()`.

### 7e. Generate the issue locally

```bash
python generate_newsletter.py --week-start 2026-MM-DD --issue-number 1 --dry-run
```

`--dry-run` calls Claude and prints the generated JSON, but skips Supabase writes, GitHub commits, and Vercel deploys. Use it to validate the prompt and content quality before publishing.

When the JSON looks good, drop `--dry-run` to publish for real:

```bash
python generate_newsletter.py --week-start 2026-MM-DD --issue-number 1
```

Successful output ends with `Issue #1 complete — https://<site>/newsletter/issue-001`. Check the rendered HTML in your browser. Compare to a working reference: https://fromimpacttoincome.com/newsletter/issue-007.html

---

## Step 8 — Customize the Claude Prompt

Open `generate_newsletter.py` and find the `SYSTEM_PROMPT` constant. This is where you set the voice, structure, and rules for your client's newsletter.

Things you'll typically edit:

- **Voice/tone** — replace the "AI Junkies" peer-to-peer style with whatever fits the client.
- **Brand references** — "Junk Mail", "Derrick Harper", "AI Junkies" → your client's equivalents.
- **JSON schema** — add or remove sections (e.g., add a "Tool of the Week" section). If you change the schema, also add a render block in `render_issue_html()` so the new section makes it into HTML.
- **Rules** — minimums/maximums on wins, spotlight members, quick hits.

The schema in the prompt and the placeholders in the HTML template are coupled. Change one without changing the other and you'll get unfilled `[Para 1 — ...]` placeholders in production.

---

## Step 9 — Railway Deploy

### 9a. Create a service

1. railway.app → New Project → **Deploy from GitHub repo** → select your repo.
2. Once the service exists: Service → Settings → Source → **Root Directory**: `client/newsletter-cron`.
3. Service → Settings → look for a **Cron Schedule** field. The provided `railway.toml` declares:

   ```toml
   [deploy]
   cronSchedule = "0 14 * * 0"
   startCommand = "python run_weekly.py"
   ```

   Railway should pick this up automatically. If it shows the service as a long-running worker instead, change service type to **Cron**.

### 9b. Set env vars

Service → Variables → use the **Raw Editor** and paste everything from your local `.env` except comment lines. Minimum required:

```
SUPABASE_URL
SUPABASE_SERVICE_KEY
ANTHROPIC_API_KEY
TELEGRAM_API_ID
TELEGRAM_API_HASH
TELEGRAM_SESSION_STRING
TELEGRAM_GROUP
GITHUB_TOKEN
GITHUB_REPO
VERCEL_DEPLOY_HOOK_URL
NEWSLETTER_BASE_URL
```

### 9c. Manual test run

Service → Deployments → **Run now**. Watch the logs:

```
>>> Step 1/2 — Telegram scraper: scrape_telegram.py
... (scraper output)
>>> Step 2/2 — Newsletter generator: generate_newsletter.py
... (generator output)
```

If the previous Sunday's week is empty (newly deployed mid-week, group quiet, etc.), the generator exits early with `Only X messages found (min: 20). Aborting.` That's expected — wait for Sunday.

### 9d. Cron schedule cheat sheet

`railway.toml` ships with `0 14 * * 0` (Sun 14:00 UTC = Sun 9:00 AM Central, when CDT is active). Adjust for your client:

| Client timezone | 9 AM Local (CDT/EDT/PDT)          | 9 AM Local (CST/EST/PST)         |
|-----------------|-----------------------------------|----------------------------------|
| US Central      | `0 14 * * 0`                      | `0 15 * * 0`                     |
| US Eastern      | `0 13 * * 0`                      | `0 14 * * 0`                     |
| US Pacific      | `0 16 * * 0`                      | `0 17 * * 0`                     |
| UK             | `0 8 * * 0`                       | `0 9 * * 0`                      |

(Day-of-week: `0` = Sunday, `1` = Monday, … `6` = Saturday. All times are UTC.)

---

## Step 10 — Notifications (optional)

The generator pings every channel that's configured. Set any/all of these in Railway env:

### Telegram bot ping

1. Message [@BotFather](https://t.me/BotFather) → `/newbot`, follow prompts.
2. Copy the bot token → `TELEGRAM_BOT_TOKEN`.
3. Add the bot to the group/channel you want it to post in (a different channel than your source group is usually nice — the source group has its own vibe).
4. Get the chat id: send any message in the target channel, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates`. Find `"chat": {"id": -100XXX}`. That's `TELEGRAM_CHAT_ID`. Include the `-100` prefix for groups.

### Slack

1. https://api.slack.com/apps → Create New App → From Scratch.
2. **Incoming Webhooks** → Activate → Add New Webhook to Workspace → pick a channel.
3. Copy the URL → `SLACK_WEBHOOK_URL`.

### Generic webhook (AI agent, n8n, Make, Zapier)

Set `OPENCLAW_WEBHOOK_URL` to any endpoint that accepts a POST. The payload is:

```json
{
  "event": "newsletter_published",
  "issue_number": 6,
  "issue_url": "https://yoursite.com/newsletter/issue-006",
  "main_headline": "This Week's Big Story",
  "top_wins": ["Win 1", "Win 2", "Win 3"],
  "message": "🗞️ Newsletter Issue #006 is live!..."
}
```

---

## Customization Checklist

When setting this up for a new client, the punch list is:

- [ ] Fork or copy the `client/newsletter-cron/` directory + HTML templates into the client's repo
- [ ] Create Supabase tables (Step 2)
- [ ] Customize `junk-mail-TEMPLATE.html` with the client's brand
- [ ] Customize `SYSTEM_PROMPT` in `generate_newsletter.py` for the client's voice
- [ ] Get Telegram API_ID / API_HASH from my.telegram.org
- [ ] Decide on the source group; get its `@username` or chat id
- [ ] Create GitHub fine-grained PAT (repo write)
- [ ] Create Vercel project + deploy hook
- [ ] Local: install deps, fill `.env`, run `scrape_telegram.py auth`, backfill last week, run generator once
- [ ] Railway: create service, set root dir, paste env vars, verify cron schedule
- [ ] Optional: set up notifications
- [ ] Set the cron timezone offset to match the client's timezone

---

## Troubleshooting

These are the issues we've hit and fixed (or know how to fix). Check these first.

| Symptom                                                            | Fix                                                                                                                                            |
|--------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| `binascii.Error: Incorrect padding` from `StringSession.decode`    | Your `TELEGRAM_SESSION_STRING` lost trailing `=` chars in copy/paste. The scraper auto-restores padding; if you still hit this, re-run `auth`. |
| `Client.__init__() got an unexpected keyword argument 'proxy'`     | `supabase` package is too old for installed `httpx`. Upgrade: `pip install --upgrade supabase==2.10.0`.                                       |
| `ModuleNotFoundError: No module named 'websockets.asyncio'`        | `websockets` is too old. Pin: `pip install "websockets>=13,<16"`.                                                                              |
| `null value in column "X" of relation "telegram_messages"`         | Existing table has a NOT NULL column the scraper doesn't write. Either make it nullable or add it to the row dict in `_scrape_range()`.        |
| `ValueError: Invalid format string` on `%-d`                       | Running on Windows. The committed code uses portable `_fmt_long/_fmt_short` helpers — make sure you pulled the latest, then `pip install`.    |
| `UnicodeEncodeError: 'charmap' codec` on Windows console           | Cosmetic logging error on Windows cp1252. Already fixed via `sys.stdout.reconfigure(encoding='utf-8')` at the top of both scripts.            |
| `Only X messages found (min: 20). Aborting.`                       | Fewer than 20 messages in the target week. Lower `MIN_MESSAGES` in `generate_newsletter.py`, or wait for more activity.                       |
| HTML doesn't appear on the site                                    | Confirm `GITHUB_TOKEN` has Contents: Read+Write on the right repo. Confirm `VERCEL_DEPLOY_HOOK_URL` is for the `main` branch.                |
| Telegram notification fails                                        | Bot must be a member of the target group, and `TELEGRAM_CHAT_ID` must include the `-100` prefix for groups.                                   |
| Claude returns invalid JSON                                        | Check Railway logs. The script strips markdown fences, but unusual formatting may need handling. Usually a one-week blip.                     |
| Cron didn't fire                                                   | Confirm `railway.toml` is in the service root dir (i.e., Railway "Root Directory" = `client/newsletter-cron`) and the cron expression is valid. |

### Re-running a missed week manually

If a Sunday cron fails and you want to publish from your laptop:

```bash
# Backfill the missed week first (idempotent — safe if already scraped)
python scrape_telegram.py backfill --start 2026-MM-DD --end 2026-MM-DD

# Then publish, forcing the week and issue number
python generate_newsletter.py --week-start 2026-MM-DD --issue-number N
```

If you don't want the manual run to bump `newsletter_config.current_issue` (because the next Railway run will do it), add `--no-increment`.

---

## File Structure

```
client/newsletter-cron/
├── scrape_telegram.py        # Telethon scraper (auth / backfill / default modes)
├── generate_newsletter.py    # Claude → JSON → HTML → GitHub → Vercel
├── run_weekly.py             # Railway cron entrypoint: scrape → generate
├── requirements.txt          # Pinned Python deps
├── railway.toml              # Cron schedule + startCommand
├── Profile                   # Procfile-style worker definition (Railway fallback)
├── setup_scraper_schema.sql  # One-time schema additions for telegram_messages
├── .env.example              # Template for local secrets
├── .env                      # Local secrets (gitignored)
├── SETUP_GUIDE.md            # This file
└── COMMUNITY_CONNECTORS.md   # Addendum: Skool, Discord, Slack, GHL, Facebook

client/public/newsletter/
├── index.html                # Listing page (auto-updated by generator)
├── junk-mail-TEMPLATE.html   # Template the generator renders into
├── issue-001.html            # Published issues
├── issue-002.html
└── …
```

---

## Key Architectural Decisions (and Why)

| Decision                                                      | Why                                                                                                                                            |
|---------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| User-account MTProto via Telethon, not a bot                  | Bots can't read full message history. User session = full read access to any group the account is in.                                          |
| Session string stored as env var, not a session file          | Railway containers are ephemeral. A file-based session would re-prompt for SMS every run; a string is portable.                                |
| Upsert on `message_id`, not `(timestamp, sender)`             | Telegram messages have a stable per-chat id. Upsert is idempotent → backfills + manual re-runs never duplicate rows.                          |
| Generator commits HTML via GitHub API, not Vercel build step  | Keeps the source of truth (`newsletter_issues.content_json`) and the public HTML in sync via a commit on every publish.                       |
| Vercel deploy hook fires after the GitHub commit              | Gives Vercel a fresh commit to build, so the new issue actually appears on the live site.                                                     |
| Claude prompt forces JSON output, no markdown fences          | Lets the renderer string-replace deterministically without parsing markdown.                                                                   |
| Counter lives in `newsletter_config.current_issue`            | Survives container restarts. The script bumps it after every successful publish unless `--no-increment` is passed.                            |
| `MIN_MESSAGES = 20` abort                                     | If a week is too quiet, the generator would produce thin content. Better to skip than ship something embarrassing.                            |

---

## Manual Run From Local Machine

When you need to fire the whole pipeline by hand (debugging, re-running, building a new client):

```bash
cd client/newsletter-cron
pip install -r requirements.txt
# Make sure .env is filled in
python run_weekly.py
```

Or run just one piece:

```bash
python scrape_telegram.py                                     # default: last full Sun-Sat
python scrape_telegram.py backfill --start 2026-05-17 --end 2026-05-23
python generate_newsletter.py --week-start 2026-05-17 --issue-number 7 --dry-run
python generate_newsletter.py --week-start 2026-05-17 --issue-number 7
```
