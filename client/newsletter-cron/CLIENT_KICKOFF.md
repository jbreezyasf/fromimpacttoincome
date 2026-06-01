# Client Kickoff — Newsletter Pipeline

One-page punch list for standing up the automated newsletter for a new client. Full detail in [SETUP_GUIDE.md](SETUP_GUIDE.md). **Target time end-to-end: ~3 hours** (mostly waiting on Vercel builds and DNS).

---

## 1. Pre-Kickoff — Info to collect from the client

- [ ] **Source platform** (Telegram default — Skool/Discord/Slack/GHL/Facebook → see [COMMUNITY_CONNECTORS.md](COMMUNITY_CONNECTORS.md))
- [ ] **Group/channel name + invite** — you need to be in it as a user (not a bot) to scrape
- [ ] **Publish cadence** — default Sun 9 AM client-local
- [ ] **Newsletter name + tagline** (e.g. "Junk Mail" for AI Junkies)
- [ ] **Voice samples** — 2-3 past posts/emails so you can write the Claude system prompt right
- [ ] **Brand assets** — logo, hex colors, fonts (or CSS tokens), one example issue or competitor reference
- [ ] **Public URL** — `https://<client-domain>/newsletter/` is the target

---

## 2. Accounts & Access — confirm before building

| Service        | What you need                                | Who creates? | Free?              |
|----------------|----------------------------------------------|--------------|--------------------|
| Telegram       | Personal user account that's IN the group    | Client       | Yes                |
| Supabase       | Project (free tier fine for < 50 issues/yr)  | You          | Yes                |
| Anthropic      | API key with payment method                  | Client       | **No** — ~$0.10/issue with Sonnet 4.6 |
| GitHub         | Repo for the rendered HTML                   | You          | Yes                |
| Vercel         | Project pointed at the GitHub repo           | You          | Yes                |
| Railway        | Project for the weekly cron                  | You          | Yes (trial)        |

> **One billing note** — Railway's free trial lasts ~30 days. Either bill the client direct or include $5/mo in your service fee.

---

## 3. Credentials to gather (paste straight into `.env`)

- [ ] `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (service_role JWT, not anon)
- [ ] `ANTHROPIC_API_KEY` (client's, billed to them)
- [ ] `TELEGRAM_API_ID` + `TELEGRAM_API_HASH` (from my.telegram.org)
- [ ] `TELEGRAM_GROUP` (chat id or @username)
- [ ] `GITHUB_TOKEN` (fine-grained PAT, Contents Read+Write on the newsletter repo only)
- [ ] `VERCEL_DEPLOY_HOOK_URL` (from Vercel → Settings → Git → Deploy Hooks)
- [ ] `NEWSLETTER_BASE_URL` (public URL where issues live)
- [ ] *(optional)* `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` for ship pings
- [ ] *(optional)* `SLACK_WEBHOOK_URL` for team Slack

---

## 4. Build (in this order)

- [ ] Fork or copy `client/newsletter-cron/` + `client/public/newsletter/` templates into the client's repo
- [ ] Run the 3 SQL blocks from SETUP_GUIDE Step 2 in client's Supabase (creates `newsletter_config`, `newsletter_issues`, `telegram_messages`)
- [ ] Customize `client/public/newsletter/junk-mail-TEMPLATE.html` — brand colors, fonts, logo, footer. **Keep all `[BRACKET]` placeholders verbatim** — they're the render seams
- [ ] Customize `SYSTEM_PROMPT` in `generate_newsletter.py` — voice, brand references ("Junk Mail" → client's name), section schema if changing
- [ ] If you changed the section schema, also update `render_issue_html()` to match

---

## 5. Test locally (do this BEFORE Railway)

- [ ] `cd client/newsletter-cron && pip install -r requirements.txt`
- [ ] Copy `.env.example` → `.env`, fill in everything
- [ ] `python scrape_telegram.py auth` — do the SMS dance, paste session string back into `.env`
- [ ] `python scrape_telegram.py backfill --start YYYY-MM-DD --end YYYY-MM-DD` for last full Sun→Sat
- [ ] `python generate_newsletter.py --week-start YYYY-MM-DD --issue-number 1 --dry-run` — read the JSON, sanity check voice + section content
- [ ] Iterate on the prompt until the dry-run output is good
- [ ] Drop `--dry-run` to publish issue #1 for real → check the live URL renders correctly

---

## 6. Deploy (Railway)

- [ ] railway.app → New Project → from GitHub repo
- [ ] Service → Settings → **Root Directory** = `client/newsletter-cron`
- [ ] Service → Variables → Raw editor → paste all env vars from `.env` (skip comment lines)
- [ ] Verify Service shows cron schedule `0 14 * * 0` (adjust for client timezone — SETUP_GUIDE Step 9d has the table)
- [ ] Deployments → **Run now** for a manual test. If the past week is already done + scraped, generator may abort with "Only X messages found" — that's fine, means the early-exit guard works
- [ ] *(optional)* Add Telegram bot ship-ping channel — get bot token from @BotFather, get chat id from getUpdates

---

## 7. Handoff to client

- [ ] Share live URL + first published issue
- [ ] Share the GitHub repo (read access) — they can see HTML history if they want
- [ ] Show them: how to read Supabase `newsletter_issues` (every published issue + its content_json is there)
- [ ] Show them: how to manually re-run from Railway dashboard if a Sunday gets skipped
- [ ] Show them: how to pause/edit by toggling the Railway service off
- [ ] Send a 60-second Loom: "where the prompt lives" so they can request voice tweaks without you having to babysit
- [ ] Set a calendar reminder 11 months out to rotate the GitHub PAT

---

## Minimum viable to ship

If you're under time pressure and need to launch with fewer bells:

1. Steps 1–6, skip the optional notification channels
2. Use the existing `junk-mail-TEMPLATE.html` with just the logo + a color swap — pixel-perfect branding can come in v2
3. Use the existing `SYSTEM_PROMPT`, adjust only the brand name + 1-2 voice rules
4. Ship issue #1 manually, let Railway take over for #2

You can ship in ~90 minutes this way. The cleanup work (custom template, refined prompt, notifications) is fine as v1.1 the following week.

---

## Common reasons to renegotiate scope

- **Source group is < 20 msgs/week** → MIN_MESSAGES guard aborts. Either lower the threshold or switch to bi-weekly cadence.
- **Source group has multiple languages** → Claude prompt needs to specify which language(s) and how to handle code-switching. Adds ~1 hr.
- **Client wants email delivery, not just web** → Add Resend/Postmark/SendGrid integration. Adds ~3 hrs + their email-sender domain setup.
- **Client wants member name anonymization or moderation** → Adds a redaction pass before Claude. Adds ~2 hrs.
- **Client wants white-label per-cohort issues** → Schema change to `cohort_id` on every row + per-cohort prompts. Days of work, charge for it.
