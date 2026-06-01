# Client Kickoff — Newsletter Pipeline

One-page checklist for standing up the automated newsletter for a new client. Full technical detail in the companion *Setup Guide*. **Target time end-to-end: ~3 hours** (mostly waiting on Vercel builds and DNS).

---

## 1. Pre-Kickoff — Info to collect from the client

- [ ] **Source platform** (Telegram is the default; Skool / Discord / Slack / GHL / Facebook are covered in the *Community Connectors* guide)
- [ ] **Group/channel name + invite** — you need to be in it as a user (not a bot) to scrape
- [ ] **Publish cadence** — default Sun 9 AM client-local
- [ ] **Newsletter name + tagline** (the masthead and one-line positioning)
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

> **Billing note** — Railway moves to ~$5/month after the ~30-day free trial. Decide upfront whose account owns the recurring cost.

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

- [ ] Fork or copy `newsletter-cron/` + `public/newsletter/` templates into the client's repo
- [ ] Run the 3 SQL blocks from SETUP_GUIDE Step 2 in client's Supabase (creates `newsletter_config`, `newsletter_issues`, `telegram_messages`)
- [ ] Customize the HTML template file (currently `public/newsletter/junk-mail-TEMPLATE.html` — rename if desired) — brand colors, fonts, logo, footer. **Keep all `[BRACKET]` placeholders verbatim** — they're the render seams
- [ ] Customize `SYSTEM_PROMPT` in `generate_newsletter.py` — voice, brand name, host name, section schema if changing
- [ ] If you changed the section schema, also update `render_issue_html()` to match

---

## 5. Test locally (do this BEFORE Railway)

- [ ] `cd newsletter-cron && pip install -r requirements.txt`
- [ ] Copy `.env.example` → `.env`, fill in everything
- [ ] `python scrape_telegram.py auth` — do the SMS dance, paste session string back into `.env`
- [ ] `python scrape_telegram.py backfill --start YYYY-MM-DD --end YYYY-MM-DD` for last full Sun→Sat
- [ ] `python generate_newsletter.py --week-start YYYY-MM-DD --issue-number 1 --dry-run` — read the JSON, sanity check voice + section content
- [ ] Iterate on the prompt until the dry-run output is good
- [ ] Drop `--dry-run` to publish issue #1 for real → check the live URL renders correctly

---

## 6. Deploy (Railway)

- [ ] railway.app → New Project → from GitHub repo
- [ ] Service → Settings → **Root Directory** = `newsletter-cron`
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
- [ ] Send a short Loom showing where the system prompt lives, so they can self-serve voice tweaks or know exactly what to request
- [ ] Set a calendar reminder 11 months out to rotate the GitHub PAT before it expires

---

## Minimum viable to ship

When the timeline is tight and a v1 needs to go out fast:

1. Steps 1–6, skip the optional notification channels
2. Use the existing HTML template with just the logo + a color swap — pixel-perfect branding can land in v2
3. Use the existing `SYSTEM_PROMPT`, adjust only the brand name and 1–2 voice rules
4. Ship issue #1 manually, let Railway take over from issue #2 onward

This path ships in ~90 minutes. The polish work (custom template, refined prompt, notifications) lands cleanly as v1.1 the following week.

---

## Optional add-ons that change the timeline

These are real capabilities people ask for, with realistic effort estimates so you can scope them properly.

- **Source group is < 20 msgs/week** → the `MIN_MESSAGES` guard aborts publication. Lower the threshold or switch to a bi-weekly cadence.
- **Multilingual community** → the Claude prompt needs explicit language rules and code-switching handling. Adds ~1 hour.
- **Email delivery in addition to web** → wire in Resend / Postmark / SendGrid plus the client's sender-domain setup. Adds ~3 hours.
- **Member name anonymization or content moderation** → add a redaction/filter pass before Claude. Adds ~2 hours.
- **White-label per-cohort issues** → schema changes (cohort id on every row) + per-cohort prompts and templates. Multi-day project.
