# Automated Newsletter Pipeline — Setup Guide

This guide walks you through setting up a fully automated weekly newsletter that pulls community messages, generates content with AI, publishes static HTML to your site, and notifies your team when it's done.

---

## What This Does

Every week on a schedule you choose, this pipeline:

1. Pulls messages from a Supabase table (e.g. Telegram chat logs, Discord messages, community posts)
2. Sends them to the Claude API to generate a structured newsletter (JSON)
3. Stores the generated content in Supabase
4. Renders the JSON into a static HTML page using your template
5. Commits the HTML + updated index to GitHub via the API
6. Triggers a Vercel deploy so the site rebuilds with the new issue
7. Sends notifications to Telegram, Slack, and/or a custom webhook

No manual editing. No copy-pasting. Runs hands-free on Railway.

---

## Prerequisites

| Service     | What You Need                          | Free Tier? |
|-------------|----------------------------------------|------------|
| Railway     | Account + project                      | Yes (trial)|
| Supabase    | Project with tables (see below)        | Yes        |
| GitHub      | Repo with your site code               | Yes        |
| Vercel      | Project linked to your GitHub repo     | Yes        |
| Anthropic   | API key for Claude                     | No         |

---

## Step 1 — Supabase Tables

Create these two tables in your Supabase project.

### `newsletter_config`

```sql
CREATE TABLE newsletter_config (
  id            INT PRIMARY KEY DEFAULT 1,
  current_issue INT NOT NULL DEFAULT 1,
  last_run      DATE
);

INSERT INTO newsletter_config (id, current_issue) VALUES (1, 1);
```

### `newsletter_issues`

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

### Message Source Table

You need a table that holds the raw messages the newsletter is generated from. The default script expects `telegram_messages` with these columns:

| Column         | Type        | Description                     |
|----------------|-------------|---------------------------------|
| timestamp      | TIMESTAMPTZ | When the message was sent       |
| sender_name    | TEXT        | Display name of the sender      |
| message_text   | TEXT        | The message content             |
| reaction_count | INT         | Number of reactions (optional)  |
| reply_to_text  | TEXT        | Text being replied to (optional)|

Adapt the table name and column names in `generate_newsletter.py` → `fetch_messages()` if your source is different (Discord, Slack export, etc.).

---

## Step 2 — HTML Template

Create your newsletter HTML template at:

```
client/public/newsletter/junk-mail-TEMPLATE.html
```

The template uses placeholder text that gets replaced by the renderer. Key placeholders:

- `[#]` → issue number (e.g. `006`)
- `[NUMBER]` → same, used in footer
- `[DATE RANGE]` → e.g. `May 10–16, 2026`
- `[HEADLINE — punchy, specific, not generic]` → main story headline
- `[Para 1 — ...]`, `[Para 2 — ...]`, etc. → story paragraphs
- `[SECOND STORY HEADLINE]`, `[THIRD STORY HEADLINE]` → secondary stories
- `[THE DEBATE OR QUESTION HEADLINE]` → hot topic section
- Member spotlight and wins sections use `data-content-item` attributes and are rebuilt dynamically

See the existing template in this repo for the full structure. Copy it and customize the CSS/branding for your client.

### Index Page

Create `client/public/newsletter/index.html` — a listing page for all issues. The script automatically:
- Inserts a new `<a class="issue-row">` block at the top of the list
- Updates the `<span id="count">` with the new total

---

## Step 3 — Claude Prompt

The system prompt in `generate_newsletter.py` defines the newsletter's voice, structure, and JSON schema. Customize it for your client:

- **Voice/tone** — adjust the writing style instructions
- **Sections** — add/remove sections from the JSON schema (the renderer needs to match)
- **Rules** — set minimums for wins, spotlights, tips, etc.

The JSON schema the prompt returns must match what `render_issue_html()` expects. If you add a new section to the prompt, add the corresponding rendering logic.

---

## Step 4 — Railway Setup

### 4a. Create a Service

1. Go to [railway.app](https://railway.app) → your project
2. Click **New Service** → **GitHub Repo** → select your repo
3. Set the **Root Directory** to `client/newsletter-cron`
4. Railway will detect the `Profile` (Procfile) which runs: `worker: python generate_newsletter.py`

### 4b. Environment Variables

Add these in the Railway service **Variables** tab:

| Variable                | Required | Description                                      |
|-------------------------|----------|--------------------------------------------------|
| `SUPABASE_URL`          | Yes      | Your Supabase project URL                        |
| `SUPABASE_SERVICE_KEY`  | Yes      | Supabase service role key (not anon)             |
| `ANTHROPIC_API_KEY`     | Yes      | Claude API key from console.anthropic.com        |
| `GITHUB_TOKEN`          | Yes      | Fine-grained PAT with repo read/write            |
| `GITHUB_REPO`           | Yes      | `owner/repo` (e.g. `jbreezyasf/mysite`)          |
| `VERCEL_DEPLOY_HOOK_URL`| Yes      | From Vercel → Project Settings → Git → Deploy Hooks |
| `NEWSLETTER_BASE_URL`   | Yes      | e.g. `https://yoursite.com/newsletter`            |

### 4c. Cron Schedule

Create a `railway.toml` in the `client/newsletter-cron/` directory:

```toml
[deploy]
cronSchedule = "0 14 * * 0"
```

This runs every **Sunday at 2:00 PM UTC** (9:00 AM CDT). Adjust for your timezone:

| Timezone | 9 AM Local  | Cron Expression   |
|----------|-------------|-------------------|
| EST/EDT  | 9 AM        | `0 13 * * 0` (EDT) / `0 14 * * 0` (EST) |
| CST/CDT  | 9 AM        | `0 14 * * 0` (CDT) / `0 15 * * 0` (CST) |
| PST/PDT  | 9 AM        | `0 16 * * 0` (PDT) / `0 17 * * 0` (PST) |
| UTC      | 9 AM        | `0 9 * * 0`  |

Change the day: `0` = Sunday, `1` = Monday, ... `6` = Saturday.

---

## Step 5 — GitHub Token

Create a fine-grained Personal Access Token:

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. **Repository access**: select only your newsletter repo
3. **Permissions**: Contents → Read and Write
4. Copy the token → add as `GITHUB_TOKEN` in Railway

---

## Step 6 — Vercel Deploy Hook

1. Go to Vercel → your project → Settings → Git → Deploy Hooks
2. Create a hook named `newsletter-cron` for the `main` branch
3. Copy the URL → add as `VERCEL_DEPLOY_HOOK_URL` in Railway

---

## Step 7 — Notifications

Set one or more of these in Railway env vars. All are optional — the script sends to every channel that's configured.

### Telegram

1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → follow prompts
2. Copy the bot token → `TELEGRAM_BOT_TOKEN`
3. Add the bot to your group chat
4. Get the chat ID:
   - Send a message in the group
   - Visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Find `"chat": {"id": -100XXXXXXXXXX}` → that's your `TELEGRAM_CHAT_ID`
5. Set both vars in Railway

### Slack

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From Scratch
2. Incoming Webhooks → Activate → Add New Webhook to Workspace
3. Pick the channel → copy the webhook URL → `SLACK_WEBHOOK_URL`

### Custom Webhook (Agent, n8n, Make, Zapier, etc.)

Set `OPENCLAW_WEBHOOK_URL` to any endpoint that accepts a POST with this JSON:

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

Use this to trigger your AI agent, automation platform, or any other service.

---

## File Structure

```
client/newsletter-cron/
├── generate_newsletter.py    # Main script (runs on Railway)
├── requirements.txt          # Python dependencies
├── Profile                   # Railway Procfile
├── railway.toml              # Cron schedule
└── SETUP_GUIDE.md            # This file

client/public/newsletter/
├── index.html                # Issue listing page (auto-updated)
├── junk-mail-TEMPLATE.html   # HTML template for rendering
├── issue-001.html            # Generated issues
├── issue-002.html
└── ...
```

---

## Customization Checklist

When setting this up for a new client:

- [ ] Fork or copy this repo
- [ ] Create Supabase tables (Step 1)
- [ ] Customize the HTML template with client branding/CSS
- [ ] Customize the Claude system prompt (voice, sections, JSON schema)
- [ ] Update `render_issue_html()` if you changed the JSON schema
- [ ] Update `fetch_messages()` if the message source table is different
- [ ] Create Railway service + set env vars
- [ ] Create Vercel deploy hook
- [ ] Create GitHub fine-grained token
- [ ] Set up notification channel(s)
- [ ] Set the cron schedule in `railway.toml`
- [ ] Test with a manual run: `railway run -- python generate_newsletter.py`

---

## Manual Run

To trigger a newsletter outside the cron schedule:

**From Railway dashboard:** Redeploy the service manually.

**From local machine:**

```bash
cd client/newsletter-cron
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
railway run -- python generate_newsletter.py
```

---

## Troubleshooting

| Problem                        | Fix                                                        |
|--------------------------------|------------------------------------------------------------|
| Script aborts with "Only X messages" | Fewer than 20 messages that week. Lower `MIN_MESSAGES` or wait for more activity. |
| HTML not appearing on site     | Check that `GITHUB_TOKEN` has write access and `GITHUB_REPO` is correct. |
| Vercel didn't rebuild          | Verify `VERCEL_DEPLOY_HOOK_URL` is set and the hook is for the `main` branch. |
| Telegram notification failed   | Ensure the bot is added to the group and `TELEGRAM_CHAT_ID` includes the `-100` prefix for groups. |
| Claude returns invalid JSON    | Check Railway logs. The script strips markdown fences, but unusual formatting may need handling. |
| Cron didn't fire               | Confirm `railway.toml` is in the service's root directory and the cron expression is valid. |
