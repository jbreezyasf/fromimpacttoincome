# ⚠ This Is Not the Setup Guide You're Looking For

This repository (`fromimpacttoincome`) contains the **production deployment** of the newsletter pipeline for one specific client. If you're standing up a new newsletter for any client, **do not follow this directory** — use the public template instead:

## 👉 https://github.com/jbreezyasf/newsletter-pipeline

That repo has:

- A click-once **"Use this template"** button that creates a fresh client repo for you
- The full step-by-step `SETUP_GUIDE.md` (10 steps, plain-language, written for operators at any level)
- The one-page `CLIENT_KICKOFF.md` checklist
- Generic HTML templates with `[NEWSLETTER NAME]` / `[COMMUNITY NAME]` / `[HOST NAME]` placeholders
- The same scripts as this repo, just at the repo root instead of nested under `client/newsletter-cron/`

---

## What Lives In This Directory

For maintainers of *this specific* client deployment only:

| File                       | Purpose                                                              |
|----------------------------|----------------------------------------------------------------------|
| `scrape_telegram.py`       | Telethon scraper (canonical version mirrors the template repo)       |
| `generate_newsletter.py`   | Generator with path overrides for this repo's `client/public/newsletter/` layout |
| `run_weekly.py`            | Railway cron entrypoint                                              |
| `requirements.txt`         | Pinned deps                                                          |
| `railway.toml`             | Cron schedule (`0 14 * * 0`)                                         |
| `Profile`                  | Procfile fallback                                                    |
| `.env.example`             | Production env-var template — values match Railway's configured paths |
| `setup_scraper_schema.sql` | One-time schema additions, already applied                           |

The Railway service for this client sets `NEWSLETTER_OUTPUT_DIR=client/public/newsletter` and `NEWSLETTER_TEMPLATE_FILE=junk-mail-TEMPLATE.html` to keep the existing file paths in place. New clients use the generic defaults shipped in the template repo.

---

If you ever need to improve the pipeline itself, do it in the template repo first — that's the canonical source. Then cherry-pick any changes that apply here.
