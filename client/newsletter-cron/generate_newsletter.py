"""
JUNK MAIL — WEEKLY NEWSLETTER GENERATOR
=========================================
Runs on Railway as a cron job every Sunday at 9:00 AM CT.
Cron expression: 0 14 * * 0  (14:00 UTC = 9:00 AM CT)

Workflow:
  1. Pull this week's Telegram messages from Supabase
  2. Send to Claude API → get structured JSON (all 7 sections)
  3. Store JSON in newsletter_issues table in Supabase
  4. Increment edition counter
  5. Render JSON → static HTML and commit to GitHub
  6. POST to Vercel deploy webhook → site rebuilds with new issue
  7. POST to OpenClaw social agent → posts announcement

RAILWAY ENV VARS (set in your Railway service):
  SUPABASE_URL
  SUPABASE_SERVICE_KEY
  ANTHROPIC_API_KEY
  GITHUB_TOKEN              (fine-grained, repo read/write)
  GITHUB_REPO               (owner/repo)
  VERCEL_DEPLOY_HOOK_URL    (from Vercel project settings → Git → Deploy Hooks)
  NEWSLETTER_BASE_URL       (https://yoursite.com/newsletter)

  NOTIFICATIONS (set one or more):
  TELEGRAM_BOT_TOKEN        (from @BotFather)
  TELEGRAM_CHAT_ID          (group or user chat ID)
  SLACK_WEBHOOK_URL         (from Slack Incoming Webhooks app)
  OPENCLAW_WEBHOOK_URL      (generic webhook — any agent or automation)
"""

import argparse
import base64
import html as html_mod
import json
import logging
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone

import anthropic
import requests
from supabase import create_client, Client

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)


def _fmt_long(d: date) -> str:
    """Portable 'June 5' / 'June 5, 2026' — works on Windows too (no %-d)."""
    return f"{d.strftime('%B')} {d.day}"


def _fmt_long_year(d: date) -> str:
    return f"{d.strftime('%B')} {d.day}, {d.year}"


def _fmt_short(d: date) -> str:
    """Portable 'Jun 5'."""
    return f"{d.strftime('%b')} {d.day}"


def _fmt_short_year(d: date) -> str:
    """Portable '5, 2026' (day, year) — used for the trailing half of date ranges."""
    return f"{d.day}, {d.year}"

# ── Clients ───────────────────────────────────────────────────────────────────
supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_KEY"],
)
claude = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# ── Config ────────────────────────────────────────────────────────────────────
VERCEL_HOOK        = os.environ.get("VERCEL_DEPLOY_HOOK_URL", "")
OPENCLAW_WEBHOOK   = os.environ.get("OPENCLAW_WEBHOOK_URL", "")
NEWSLETTER_BASE    = os.environ.get("NEWSLETTER_BASE_URL", "")
GITHUB_TOKEN       = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPO        = os.environ.get("GITHUB_REPO", "")
GITHUB_API         = "https://api.github.com"
MIN_MESSAGES       = 20   # abort if fewer messages than this (likely a bad week)

# Repo-relative output paths. Override via env if your repo lays things out differently.
NEWSLETTER_OUTPUT_DIR  = os.environ.get("NEWSLETTER_OUTPUT_DIR", "public/newsletter").rstrip("/")
NEWSLETTER_TEMPLATE_FILE = os.environ.get("NEWSLETTER_TEMPLATE_FILE", "newsletter-TEMPLATE.html")
TEMPLATE_PATH      = f"{NEWSLETTER_OUTPUT_DIR}/{NEWSLETTER_TEMPLATE_FILE}"
INDEX_PATH         = f"{NEWSLETTER_OUTPUT_DIR}/index.html"


def _telegram_link_base() -> str:
    """
    Base URL that a message_id can be appended to, or "" if links are impossible.

    Explicit TELEGRAM_LINK_BASE wins. Otherwise it is derived from TELEGRAM_GROUP,
    which the scraper already needs:

      @aijunkies      -> https://t.me/aijunkies       (public group, works for anyone)
      -1001234567890  -> https://t.me/c/1234567890    (private supergroup, members only)

    A plain group *title* yields nothing — Telegram has no URL form for it — so
    backlinks are silently omitted rather than rendered broken.
    """
    explicit = os.environ.get("TELEGRAM_LINK_BASE", "").strip().rstrip("/")
    if explicit:
        return explicit

    group = os.environ.get("TELEGRAM_GROUP", "").strip()
    if not group:
        return ""
    if group.startswith("@"):
        return f"https://t.me/{group[1:]}"
    if re.fullmatch(r"-100\d+", group):
        return f"https://t.me/c/{group[4:]}"
    if re.fullmatch(r"\d+", group):
        return f"https://t.me/c/{group}"
    return ""


TELEGRAM_LINK_BASE = _telegram_link_base()


def message_url(message_id) -> str:
    """Permalink to a single Telegram message, or "" if we cannot build one."""
    if not TELEGRAM_LINK_BASE or message_id in (None, ""):
        return ""
    try:
        return f"{TELEGRAM_LINK_BASE}/{int(message_id)}"
    except (TypeError, ValueError):
        return ""


def _thread_link_html(source_ids, label: str = "Read the thread") -> str:
    """
    Anchor pointing at the earliest cited message, so the reader lands at the
    start of the conversation and can scroll forward through it. Returns "" when
    there is nothing to link — callers strip the surrounding element in that case.
    """
    if not source_ids:
        return ""
    ids = []
    for sid in source_ids:
        try:
            ids.append(int(sid))
        except (TypeError, ValueError):
            continue
    if not ids:
        return ""
    url = message_url(min(ids))
    if not url:
        return ""
    return f'<a href="{_e(url)}" target="_blank" rel="noopener">{_e(label)} →</a>'


def issue_href(n: int) -> str:
    """
    Return the href for an issue. Relative by default so deployments don't
    depend on a specific domain; absolute only if NEWSLETTER_BASE_URL is set
    in the environment (read into NEWSLETTER_BASE above).
    """
    base = NEWSLETTER_BASE.rstrip("/")
    return (
        f"{base}/issue-{n:03d}.html"
        if base
        else f"/newsletter/issue-{n:03d}.html"
    )


# ═════════════════════════════════════════════════════════════════════════════
# STEP 1 — Pull messages from Supabase
# ═════════════════════════════════════════════════════════════════════════════

def get_week_range() -> tuple[date, date]:
    """Return (Sunday 7 days ago, Saturday yesterday) for the past week."""
    today = date.today()
    # Week runs Sunday → Saturday to match your newsletter cadence
    # Find last Sunday
    days_since_sunday = (today.weekday() + 1) % 7
    last_sunday = today - timedelta(days=days_since_sunday + 7)
    last_saturday = last_sunday + timedelta(days=6)
    return last_sunday, last_saturday


def fetch_messages(week_start: date, week_end: date) -> list[dict]:
    """Pull all messages from Supabase for the given date range."""
    log.info(f"Fetching messages: {week_start} → {week_end}")

    result = (
        supabase.table("telegram_messages")
        .select("*")
        .gte("timestamp", f"{week_start}T00:00:00+00:00")
        .lte("timestamp", f"{week_end}T23:59:59+00:00")
        .order("timestamp")
        .execute()
    )

    messages = result.data or []
    log.info(f"Found {len(messages)} messages")
    return messages


def format_messages_for_claude(messages: list[dict]) -> str:
    """Turn Supabase rows into a readable transcript for the Claude prompt."""
    lines = []
    for msg in messages:
        ts = msg.get("timestamp", "")[:16].replace("T", " ")
        sender = msg.get("sender_name", "Unknown")
        text = msg.get("message_text", "").strip()
        reactions = msg.get("reaction_count", 0)
        reply_text = msg.get("reply_to_text")
        mid = msg.get("message_id")

        if not text:
            continue

        # The id prefix is what lets Claude cite sources in source_ids, which
        # become the "Read the thread" backlinks in the rendered issue.
        line = f"#{mid} " if mid not in (None, "") else ""
        line += f"[{ts}] {sender}"
        if reply_text:
            line += f'\n  ↳ replying to: "{reply_text[:100]}"'
        line += f"\n  {text}"
        if reactions > 0:
            line += f"\n  ({reactions} reactions)"
        lines.append(line)

    return "\n\n".join(lines)


# ═════════════════════════════════════════════════════════════════════════════
# STEP 2 — Generate newsletter content via Claude API
# ═════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """
You are the writer of Junk Mail — the official weekly newsletter of the AI Junkies,
an inner-circle cohort created by Derrick Harper for people learning to build AI
voice agents, automations, and apps.

Your writing style:
- Peer-to-peer, direct, conversational. Never corporate or fluffy.
- Write like you were in the room. Reference real moments, real names, real quotes.
- Beginners should understand it. Advanced members should respect it.
- No recycled LinkedIn takes. No filler. Every sentence earns its place.
- "Faith over fear" is the energy. Celebrate the wins loudly.

You MUST respond with valid JSON only. No preamble, no markdown, no backticks.
The JSON must match this exact schema:

{
  "lede": {
    "opening": "Opening line that references something real from the week",
    "body": "2-3 sentences setting up the energy and what this issue covers"
  },
  "main_story": {
    "headline": "Punchy, specific headline. Not generic.",
    "deck": "One sentence: what is this and why does it matter right now?",
    "paragraphs": [
      "Paragraph 1: plain explanation, no jargon without definition",
      "Paragraph 2: one level deeper, what did the group actually say or do?",
      "Paragraph 3: the real talk — the mistake, the misconception, where people get stuck"
    ],
    "key_points": [
      {"title": "Point title", "body": "Short punchy explanation"},
      {"title": "Point title", "body": "Short punchy explanation"},
      {"title": "Point title", "body": "Short punchy explanation"}
    ],
    "biz_callout": "2-3 sentences connecting to a real business use case. Name the scenario. Make it concrete.",
    "source_ids": [123, 124, 125]
  },
  "second_story": {
    "headline": "Also This Week headline",
    "paragraphs": [
      "Para 1: what happened or was discussed",
      "Para 2: the insight or takeaway",
      "Para 3: quote from group, example, or edge case (optional — omit if nothing fits)"
    ],
    "source_ids": [126, 127]
  },
  "third_story": {
    "headline": "Worth Knowing headline",
    "paragraphs": [
      "Para 1: tight, 2-3 paragraphs max",
      "Para 2: practical angle"
    ],
    "source_ids": [128]
  },
  "hot_topic": {
    "headline": "The debate or question that blew up in the chat",
    "intro": "1-2 sentences on what sparked the conversation",
    "broader_point": "Why this matters beyond just this week",
    "voices": [
      {"name": "Member Name", "quote": "Their actual quote or close paraphrase", "message_id": 129},
      {"name": "Member Name", "quote": "Their actual quote or close paraphrase", "message_id": 130},
      {"name": "Member Name", "quote": "Their actual quote or close paraphrase", "message_id": 131}
    ],
    "source_ids": [129, 130, 131]
  },
  "quick_hits": [
    {"number": "01", "title": "Tip title", "body": "2-3 sentence actionable tip"},
    {"number": "02", "title": "Tip title", "body": "Tool rec, prompt hack, or workflow shortcut"},
    {"number": "03", "title": "Tip title", "body": "Feature update or group discussion worth revisiting"},
    {"number": "04", "title": "Tip title", "body": "AI news from the week relevant to the group"}
  ],
  "member_spotlight": [
    {
      "name": "First Name",
      "handle": "handle or descriptor",
      "is_new_member": false,
      "project_name": "Project name or null if not building",
      "body": "1-2 sentences. If building: name the project, keep it hype. If not: encouraging, make them feel seen."
    }
  ],
  "wins": [
    {
      "emoji": "🤝",
      "tag": "client",
      "tag_label": "New Client",
      "title": "Member Name — Project or Business",
      "body": "1-2 sentences on the win. Keep it hype but real."
    }
  ]
}

Rules:
- member_spotlight: 1-3 members. Omit the array entirely if there are no good candidates.
- wins: 1-6 wins. Omit the array entirely if there are no real wins this week.
- quick_hits: always exactly 4 items.
- All text fields: no HTML, no markdown, plain text only.
- Quotes in voices: use actual quotes from the chat when possible.
- Never invent wins or quotes. Only use what's in the messages.

Source attribution (source_ids and message_id):
- Every message in the transcript is prefixed with its id, like "#4821 [2026-07-20 14:03] Marcus".
- source_ids: the ids of the messages a section was actually built from. Readers
  click through to reread the conversation, so list the messages that carry the
  discussion — 1-5 ids per section, in chronological order (lowest id first).
- The FIRST id in source_ids matters most: it is where the reader lands. Choose
  the message that STARTS the relevant exchange, not a reply deep inside it.
- voices[].message_id: the id of the exact message that quote came from. Required
  for every voice — a quote you cannot attribute to a specific id does not belong
  in voices.
- Use only ids that appear in the transcript. Never guess, invent, or reuse the
  example ids in this schema. If a section genuinely has no identifiable source,
  omit its source_ids rather than inventing one — a missing link is fine, a wrong
  link sends the reader to an unrelated message.
""".strip()


def generate_newsletter(
    messages_text: str,
    issue_number: int,
    week_start: date,
    week_end: date,
) -> dict:
    """Call Claude API and return parsed newsletter JSON."""
    log.info(f"Calling Claude API for Issue #{issue_number}...")

    user_prompt = f"""
Issue #{issue_number:03d} | {_fmt_long(week_start)} – {_fmt_long_year(week_end)}

Here are this week's AI Junkies Telegram messages:

{messages_text}

Write the complete Junk Mail newsletter for this week. Return JSON only.
""".strip()

    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = response.content[0].text.strip()

    # Strip markdown fences if Claude added them anyway
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    content = json.loads(raw)
    log.info("Claude response parsed successfully")
    return content


# ═════════════════════════════════════════════════════════════════════════════
# STEP 3 — Store in Supabase + increment counter
# ═════════════════════════════════════════════════════════════════════════════

def save_issue(
    issue_number: int,
    week_start: date,
    week_end: date,
    content: dict,
) -> str:
    """Insert or update the newsletter_issues row. Returns the slug."""
    slug = f"issue-{issue_number:03d}"
    now  = datetime.now(timezone.utc).isoformat()

    supabase.table("newsletter_issues").upsert({
        "issue_number": issue_number,
        "slug":         slug,
        "week_start":   week_start.isoformat(),
        "week_end":     week_end.isoformat(),
        "status":       "generated",
        "content_json": content,
        "generated_at": now,
    }, on_conflict="issue_number").execute()

    log.info(f"Saved Issue #{issue_number} ({slug}) to Supabase")
    return slug


def increment_counter(next_issue: int) -> None:
    supabase.table("newsletter_config").update({
        "current_issue": next_issue + 1,
        "last_run":      date.today().isoformat(),
    }).eq("id", 1).execute()
    log.info(f"Counter updated → next issue will be #{next_issue + 1}")


def mark_published(issue_number: int) -> None:
    supabase.table("newsletter_issues").update({
        "status":       "published",
        "published_at": datetime.now(timezone.utc).isoformat(),
    }).eq("issue_number", issue_number).execute()


# ═════════════════════════════════════════════════════════════════════════════
# STEP 4 — Render HTML and commit to GitHub
# ═════════════════════════════════════════════════════════════════════════════

def _gh_headers() -> dict:
    return {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }


def _gh_get_file(path: str) -> tuple[str, str]:
    """Fetch a file from GitHub. Returns (content, sha)."""
    url = f"{GITHUB_API}/repos/{GITHUB_REPO}/contents/{path}"
    resp = requests.get(url, headers=_gh_headers(), timeout=15)
    resp.raise_for_status()
    data = resp.json()
    content = base64.b64decode(data["content"]).decode("utf-8")
    return content, data["sha"]


def _gh_put_file(path: str, content: str, message: str, sha: str | None = None) -> None:
    """Create or update a file on GitHub."""
    url = f"{GITHUB_API}/repos/{GITHUB_REPO}/contents/{path}"
    payload = {
        "message": message,
        "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
    }
    if sha:
        payload["sha"] = sha
    resp = requests.put(url, headers=_gh_headers(), json=payload, timeout=15)
    resp.raise_for_status()


def _e(s: str | None) -> str:
    """HTML-escape a string."""
    return html_mod.escape(str(s)) if s else ""


def render_issue_html(
    content: dict,
    issue_number: int,
    week_start: date,
    week_end: date,
) -> str:
    """Render newsletter JSON into full HTML using the template from GitHub."""
    template, _ = _gh_get_file(TEMPLATE_PATH)

    num = f"{issue_number:03d}"
    date_range = f"{_fmt_short(week_start)}–{_fmt_short_year(week_end)}"
    h = template

    # Meta
    h = h.replace(
        "<title>Junk Mail — Issue #[NUMBER] | AI Junkies Inner Circle</title>",
        f"<title>Junk Mail — Issue #{num} — {date_range} | AI Junkies Inner Circle</title>",
    )
    h = h.replace("[#]", num)
    h = h.replace("[NUMBER]", num)
    h = h.replace("[DATE RANGE]", date_range)

    # Lede
    lede = content.get("lede", {})
    h = h.replace(
        "<strong>Hey Junkies 👋</strong> — [Opening. Reference something real from the week — a moment, a quote, a vibe from the chat.]",
        f'<strong>Hey Junkies 👋</strong> — {_e(lede.get("opening", ""))}',
    )
    h = h.replace(
        "[What's the energy? What should members be locked in on this week? Keep it direct, peer-to-peer.]",
        _e(lede.get("body", "")),
    )

    # Main story
    ms = content.get("main_story", {})
    h = h.replace("[HEADLINE — punchy, specific, not generic]", _e(ms.get("headline", "")))
    h = h.replace("[One sentence: what is this and why does it matter right now?]", _e(ms.get("deck", "")))

    paras = ms.get("paragraphs", ["", "", ""])
    h = h.replace("[Para 1 — Plain explanation. No jargon without a quick definition. Write for the person who's heard the term but doesn't fully get it.]", _e(paras[0] if len(paras) > 0 else ""))
    h = h.replace("[Para 2 — One level deeper. How does it actually work in practice? What did Derrick or the group say or do?]", _e(paras[1] if len(paras) > 1 else ""))
    h = h.replace("[Para 3 — The real talk. What's the mistake? Where do people get stuck?]", _e(paras[2] if len(paras) > 2 else ""))

    for i, kp in enumerate(ms.get("key_points", [])[:3]):
        h = h.replace(
            f'Key point {i+1}:</strong> [Short punchy takeaway]',
            f'{_e(kp["title"])}:</strong> {_e(kp["body"])}',
        )

    h = h.replace(
        "[2–3 sentences. Name the scenario. Concrete enough that someone thinks \"that's me.\"]",
        _e(ms.get("biz_callout", "")),
    )

    # Second story
    ss = content.get("second_story", {})
    ss_paras = ss.get("paragraphs", ["", "", ""])
    h = h.replace("[SECOND STORY HEADLINE]", _e(ss.get("headline", "")))
    h = h.replace("[Para 1 — What happened or was discussed? Set it up plainly.]", _e(ss_paras[0] if len(ss_paras) > 0 else ""))
    h = h.replace("[Para 2 — The insight or takeaway. What should the reader do with this?]", _e(ss_paras[1] if len(ss_paras) > 1 else ""))
    h = h.replace("[Para 3 — Optional. Quote from the group, specific example, or edge case.]", _e(ss_paras[2] if len(ss_paras) > 2 else ""))

    # Third story
    ts = content.get("third_story", {})
    ts_paras = ts.get("paragraphs", ["", ""])
    h = h.replace("[THIRD STORY HEADLINE]", _e(ts.get("headline", "")))
    h = h.replace("[Para 1 — Keep this tight. 2–3 paragraphs max.]", _e(ts_paras[0] if len(ts_paras) > 0 else ""))
    h = h.replace("[Para 2 — Practical angle. How does it connect to what the group is building?]", _e(ts_paras[1] if len(ts_paras) > 1 else ""))

    # Hot topic
    ht = content.get("hot_topic", {})
    h = h.replace("[THE DEBATE OR QUESTION HEADLINE]", _e(ht.get("headline", "")))
    h = h.replace("[1–2 sentences framing the conversation. What was the debate or moment that got people talking?]", _e(ht.get("intro", "")))
    h = h.replace("[The broader point — why does this matter beyond just this week?]", _e(ht.get("broader_point", "")))

    voices_html = ""
    for v in ht.get("voices", []):
        # The member's name links straight to the message the quote came from.
        name_html = _e(v["name"])
        v_url = message_url(v.get("message_id"))
        if v_url:
            name_html = (
                f'<a href="{_e(v_url)}" target="_blank" rel="noopener">{name_html}</a>'
            )
        voices_html += (
            f'      <div class="voice-item">\n'
            f'        <div class="voice-name">{name_html}</div>\n'
            f'        "{_e(v["quote"])}"\n'
            f"      </div>\n"
        )
    h = re.sub(
        r'<div class="voices">.*?</div>\s*</div>',
        f'<div class="voices">\n{voices_html}    </div>',
        h,
        flags=re.DOTALL,
    )

    # ── "Read the thread" backlinks ───────────────────────────────────────────
    # Each story section carries a placeholder. Fill it when the section cites a
    # source, otherwise strip the whole <p> so no empty element is left behind.
    # Issues generated before source_ids existed simply render without links.
    hot_ids = ht.get("source_ids") or [
        v.get("message_id") for v in ht.get("voices", []) if v.get("message_id")
    ]
    for token, source_ids in (
        ("MAIN", ms.get("source_ids")),
        ("SECOND", ss.get("source_ids")),
        ("THIRD", ts.get("source_ids")),
        ("HOT", hot_ids),
    ):
        anchor = _thread_link_html(source_ids)
        placeholder = f"[THREAD LINK — {token}]"
        if anchor:
            h = h.replace(placeholder, anchor)
        else:
            h = re.sub(
                r'\s*<p class="thread-link">' + re.escape(placeholder) + r"</p>",
                "",
                h,
            )

    # Quick hits
    tips_html = ""
    for qh in content.get("quick_hits", []):
        tips_html += (
            f'    <div class="tip-card">\n'
            f'      <div class="tip-number">{_e(qh["number"])}</div>\n'
            f'      <strong>{_e(qh["title"])}</strong>\n'
            f'      <p>{_e(qh["body"])}</p>\n'
            f"    </div>\n"
        )
    h = re.sub(
        r'<div class="tips-grid">.*?</div>\s*</div>',
        f'<div class="tips-grid">\n{tips_html}  </div>',
        h,
        flags=re.DOTALL,
    )

    # Member spotlight
    members_html = ""
    for m in content.get("member_spotlight", []):
        accent = "orange" if m.get("is_new_member") else ""
        handle_text = _e(m.get("handle", ""))
        if m.get("is_new_member"):
            handle_text += " · New Member 🎉"
        members_html += (
            f'    <div class="member-card" data-content-item>\n'
            f'      <div class="member-card-accent {accent}"></div>\n'
            f'      <div class="member-card-body">\n'
            f'        <div class="member-name">{_e(m["name"])}</div>\n'
            f'        <div class="member-handle">{handle_text}</div>\n'
            f'        <p>{_e(m["body"])}</p>\n'
            f"      </div>\n"
            f"    </div>\n"
        )
    h = re.sub(
        r'<div class="member-grid" data-content-container>.*?</div>\s*</div>\s*</div>',
        f'<div class="member-grid" data-content-container>\n{members_html}  </div>',
        h,
        flags=re.DOTALL,
    )

    # Wins
    wins_html = ""
    for w in content.get("wins", []):
        tag = _e(w.get("tag", "other"))
        wins_html += (
            f'    <div class="win-item" data-content-item>\n'
            f'      <div class="win-emoji">{w.get("emoji", "🏆")}</div>\n'
            f"      <div>\n"
            f'        <span class="win-tag {tag}">{_e(w.get("tag_label", "Win"))}</span>\n'
            f'        <span class="win-title">{_e(w["title"])}</span>\n'
            f'        <p>{_e(w["body"])}</p>\n'
            f"      </div>\n"
            f"    </div>\n"
        )
    h = re.sub(
        r'<div class="wins-list" data-content-container>.*?</div>\s*</div>\s*</div>',
        f'<div class="wins-list" data-content-container>\n{wins_html}  </div>',
        h,
        flags=re.DOTALL,
    )

    return h


def update_index_html(
    issue_number: int,
    week_start: date,
    week_end: date,
    content: dict,
) -> None:
    """Add the new issue row to the newsletter index and update the count."""
    index_path = INDEX_PATH
    index_html, index_sha = _gh_get_file(index_path)

    num = f"{issue_number:03d}"
    date_range = f"{_fmt_short(week_start)}–{_fmt_short_year(week_end)}"
    headline = _e(content.get("main_story", {}).get("headline", ""))

    # Build topic line from stories
    main_topic = content.get("main_story", {}).get("headline", "")
    second_topic = content.get("second_story", {}).get("headline", "")
    third_topic = content.get("third_story", {}).get("headline", "")
    topic_line = f"Main Story: {_e(main_topic)} · {_e(second_topic)} · {_e(third_topic)}"

    new_row = (
        f'\n    <!-- ISSUE {num} — newest first -->\n'
        f'    <a class="issue-row" href="{issue_href(issue_number)}">\n'
        f'      <div class="issue-num">{num}</div>\n'
        f'      <div class="issue-meta">\n'
        f'        <div class="issue-date">{date_range}</div>\n'
        f'        <div class="issue-title">{headline}</div>\n'
        f'        <div class="issue-topic">{topic_line}</div>\n'
        f"      </div>\n"
        f'      <div class="issue-arrow">→</div>\n'
        f"    </a>\n"
    )

    # Insert after <div class="issue-list">
    index_html = index_html.replace(
        '<div class="issue-list">',
        f'<div class="issue-list">{new_row}',
        1,
    )

    # Update count
    old_count = re.search(r'<span id="count">(\d+)</span>', index_html)
    if old_count:
        index_html = index_html.replace(
            old_count.group(0),
            f'<span id="count">{issue_number}</span>',
        )

    _gh_put_file(
        index_path,
        index_html,
        f"Update newsletter index for Issue #{num}",
        sha=index_sha,
    )
    log.info(f"Updated index.html with Issue #{num}")


def publish_html_to_github(
    content: dict,
    issue_number: int,
    week_start: date,
    week_end: date,
) -> None:
    """Render issue HTML and commit both files to GitHub."""
    if not GITHUB_TOKEN:
        log.warning("GITHUB_TOKEN not set — skipping HTML publish to GitHub")
        return

    num = f"{issue_number:03d}"
    issue_path = f"{NEWSLETTER_OUTPUT_DIR}/issue-{num}.html"

    # Render and commit the issue HTML
    issue_html = render_issue_html(content, issue_number, week_start, week_end)
    _gh_put_file(
        issue_path,
        issue_html,
        f"Add Junk Mail Issue #{num} — {_fmt_short(week_start)}–{_fmt_short_year(week_end)}",
    )
    log.info(f"Committed {issue_path} to GitHub")

    # Update the index
    update_index_html(issue_number, week_start, week_end, content)


# ═════════════════════════════════════════════════════════════════════════════
# STEP 5 — Trigger Vercel deploy (rebuilds from new GitHub commit)
# ═════════════════════════════════════════════════════════════════════════════

def trigger_vercel_deploy() -> None:
    if not VERCEL_HOOK:
        log.warning("VERCEL_DEPLOY_HOOK_URL not set — skipping deploy trigger")
        return
    resp = requests.post(VERCEL_HOOK, timeout=10)
    if resp.ok:
        log.info("Vercel deploy triggered ✓")
    else:
        log.error(f"Vercel deploy trigger failed: {resp.status_code} {resp.text}")


# ═════════════════════════════════════════════════════════════════════════════
# STEP 6 — Notify (Telegram, Slack, or generic webhook)
# ═════════════════════════════════════════════════════════════════════════════

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID", "")
SLACK_WEBHOOK_URL  = os.environ.get("SLACK_WEBHOOK_URL", "")


def _build_notify_message(issue_number: int, slug: str, content: dict) -> str:
    """Build the notification message used across all channels."""
    issue_url = f"{NEWSLETTER_BASE}/{slug}"
    headline = content.get("main_story", {}).get("headline", "")
    wins = content.get("wins", [])
    win_lines = "\n".join(f"  - {w.get('title', '')}" for w in wins[:3])
    msg = (
        f"🗞️ Newsletter Issue #{issue_number:03d} is live!\n\n"
        f"This week: {headline}\n"
    )
    if win_lines:
        msg += f"\nTop wins:\n{win_lines}\n"
    msg += f"\nRead it → {issue_url}"
    return msg


def notify_telegram(issue_number: int, slug: str, content: dict) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        log.info("Telegram not configured — skipping")
        return
    msg = _build_notify_message(issue_number, slug, content)
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    resp = requests.post(url, json={
        "chat_id": TELEGRAM_CHAT_ID,
        "text": msg,
        "parse_mode": "HTML",
        "disable_web_page_preview": False,
    }, timeout=10)
    if resp.ok:
        log.info("Telegram notification sent ✓")
    else:
        log.error(f"Telegram notify failed: {resp.status_code} {resp.text}")


def notify_slack(issue_number: int, slug: str, content: dict) -> None:
    if not SLACK_WEBHOOK_URL:
        log.info("Slack not configured — skipping")
        return
    msg = _build_notify_message(issue_number, slug, content)
    resp = requests.post(SLACK_WEBHOOK_URL, json={"text": msg}, timeout=10)
    if resp.ok:
        log.info("Slack notification sent ✓")
    else:
        log.error(f"Slack notify failed: {resp.status_code} {resp.text}")


def notify_webhook(issue_number: int, slug: str, content: dict) -> None:
    if not OPENCLAW_WEBHOOK:
        log.info("Generic webhook not configured — skipping")
        return
    issue_url = f"{NEWSLETTER_BASE}/{slug}"
    headline = content.get("main_story", {}).get("headline", "")
    wins = content.get("wins", [])
    payload = {
        "event":        "newsletter_published",
        "issue_number": issue_number,
        "issue_url":    issue_url,
        "main_headline": headline,
        "top_wins":     [w.get("title", "") for w in wins[:3]],
        "message":      _build_notify_message(issue_number, slug, content),
    }
    resp = requests.post(OPENCLAW_WEBHOOK, json=payload, timeout=10)
    if resp.ok:
        log.info("Webhook notification sent ✓")
    else:
        log.error(f"Webhook notify failed: {resp.status_code} {resp.text}")


def send_notifications(issue_number: int, slug: str, content: dict) -> None:
    """Send notifications to all configured channels."""
    notify_telegram(issue_number, slug, content)
    notify_slack(issue_number, slug, content)
    notify_webhook(issue_number, slug, content)


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════

def run(
    issue_number: int | None = None,
    week_start: date | None = None,
    week_end: date | None = None,
    auto_increment: bool = True,
    skip_notify: bool = False,
    dry_run: bool = False,
):
    log.info("═" * 60)
    log.info("JUNK MAIL — Weekly Newsletter Generator")
    log.info("═" * 60)

    if issue_number is None:
        config = supabase.table("newsletter_config").select("*").eq("id", 1).single().execute()
        issue_number = config.data["current_issue"]
    log.info(f"Generating Issue #{issue_number}")

    if week_start is None:
        week_start, week_end = get_week_range()
    elif week_end is None:
        week_end = week_start + timedelta(days=6)
    log.info(f"Week: {week_start} → {week_end}")

    messages = fetch_messages(week_start, week_end)
    if len(messages) < MIN_MESSAGES:
        log.warning(f"Only {len(messages)} messages found (min: {MIN_MESSAGES}). Aborting.")
        sys.exit(0)

    messages_text = format_messages_for_claude(messages)
    log.info(f"Formatted {len(messages)} messages ({len(messages_text)} chars) for Claude")

    content = generate_newsletter(messages_text, issue_number, week_start, week_end)

    # Stamp the resolved link base into the payload. The static HTML builds its
    # backlinks here at render time, but the React issue page reads content_json
    # straight from Supabase — carrying the base with the issue lets it build the
    # same links with no separate frontend config to keep in sync with
    # TELEGRAM_GROUP. If the group ever changes, both sides move together.
    if TELEGRAM_LINK_BASE:
        content["telegram_link_base"] = TELEGRAM_LINK_BASE

    if dry_run:
        log.info("DRY RUN — printing generated JSON and exiting (no DB writes, no commit, no deploy).")
        print(json.dumps(content, indent=2))
        return

    slug = save_issue(issue_number, week_start, week_end, content)

    if auto_increment:
        increment_counter(issue_number)
    else:
        log.info("auto_increment=False — leaving newsletter_config.current_issue alone")

    publish_html_to_github(content, issue_number, week_start, week_end)

    trigger_vercel_deploy()

    import time
    time.sleep(30)
    mark_published(issue_number)

    if not skip_notify:
        send_notifications(issue_number, slug, content)
    else:
        log.info("skip_notify=True — not sending Telegram/Slack/webhook notifications")

    log.info("═" * 60)
    log.info(f"Issue #{issue_number} complete — {NEWSLETTER_BASE}/{slug}")
    log.info("═" * 60)


def _cli() -> None:
    p = argparse.ArgumentParser(prog="generate_newsletter")
    p.add_argument("--issue-number", type=int, default=None,
                   help="Force issue number (skips reading newsletter_config.current_issue).")
    p.add_argument("--week-start", type=str, default=None,
                   help="Force week start (YYYY-MM-DD). End defaults to start+6 unless --week-end given.")
    p.add_argument("--week-end", type=str, default=None,
                   help="Force week end (YYYY-MM-DD). Inclusive.")
    p.add_argument("--no-increment", action="store_true",
                   help="Skip incrementing newsletter_config.current_issue (use for backfill runs).")
    p.add_argument("--no-notify", action="store_true",
                   help="Skip Telegram/Slack/webhook notifications (use for silent backfills).")
    p.add_argument("--dry-run", action="store_true",
                   help="Generate content and print JSON; skip Supabase writes, GitHub commit, Vercel deploy.")
    args = p.parse_args()

    ws = date.fromisoformat(args.week_start) if args.week_start else None
    we = date.fromisoformat(args.week_end) if args.week_end else None

    auto_inc = not args.no_increment
    if args.issue_number is not None and not args.no_increment:
        log.info("Forced --issue-number without --no-increment; the counter will still be bumped.")

    run(
        issue_number=args.issue_number,
        week_start=ws,
        week_end=we,
        auto_increment=auto_inc,
        skip_notify=args.no_notify,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    _cli()
