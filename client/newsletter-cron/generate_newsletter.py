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
  GITHUB_REPO               (jbreezyasf/fromimpacttoincome)
  VERCEL_DEPLOY_HOOK_URL    (from Vercel project settings → Git → Deploy Hooks)
  OPENCLAW_WEBHOOK_URL      (your OpenClaw agent webhook endpoint)
  NEWSLETTER_BASE_URL       (https://fromimpacttoincome.com/newsletter)
"""

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

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

# ── Clients ───────────────────────────────────────────────────────────────────
supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_KEY"],
)
claude = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# ── Config ────────────────────────────────────────────────────────────────────
VERCEL_HOOK        = os.environ.get("VERCEL_DEPLOY_HOOK_URL", "")
OPENCLAW_WEBHOOK   = os.environ.get("OPENCLAW_WEBHOOK_URL", "")
NEWSLETTER_BASE    = os.environ.get("NEWSLETTER_BASE_URL", "https://fromimpacttoincome.com/newsletter")
GITHUB_TOKEN       = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPO        = os.environ.get("GITHUB_REPO", "jbreezyasf/fromimpacttoincome")
GITHUB_API         = "https://api.github.com"
MIN_MESSAGES       = 20   # abort if fewer messages than this (likely a bad week)


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

        if not text:
            continue

        line = f"[{ts}] {sender}"
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
    "biz_callout": "2-3 sentences connecting to a real business use case. Name the scenario. Make it concrete."
  },
  "second_story": {
    "headline": "Also This Week headline",
    "paragraphs": [
      "Para 1: what happened or was discussed",
      "Para 2: the insight or takeaway",
      "Para 3: quote from group, example, or edge case (optional — omit if nothing fits)"
    ]
  },
  "third_story": {
    "headline": "Worth Knowing headline",
    "paragraphs": [
      "Para 1: tight, 2-3 paragraphs max",
      "Para 2: practical angle"
    ]
  },
  "hot_topic": {
    "headline": "The debate or question that blew up in the chat",
    "intro": "1-2 sentences on what sparked the conversation",
    "broader_point": "Why this matters beyond just this week",
    "voices": [
      {"name": "Member Name", "quote": "Their actual quote or close paraphrase"},
      {"name": "Member Name", "quote": "Their actual quote or close paraphrase"},
      {"name": "Member Name", "quote": "Their actual quote or close paraphrase"}
    ]
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
Issue #{issue_number:03d} | {week_start.strftime('%B %-d')} – {week_end.strftime('%B %-d, %Y')}

Here are this week's AI Junkies Telegram messages:

{messages_text}

Write the complete Junk Mail newsletter for this week. Return JSON only.
""".strip()

    response = claude.messages.create(
        model="claude-opus-4-5",
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
    template, _ = _gh_get_file("client/public/newsletter/junk-mail-TEMPLATE.html")

    num = f"{issue_number:03d}"
    date_range = f"{week_start.strftime('%b %-d')}–{week_end.strftime('%-d, %Y')}"
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
        voices_html += (
            f'      <div class="voice-item">\n'
            f'        <div class="voice-name">{_e(v["name"])}</div>\n'
            f'        "{_e(v["quote"])}"\n'
            f"      </div>\n"
        )
    h = re.sub(
        r'<div class="voices">.*?</div>\s*</div>',
        f'<div class="voices">\n{voices_html}    </div>',
        h,
        flags=re.DOTALL,
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
    index_path = "client/public/newsletter/index.html"
    index_html, index_sha = _gh_get_file(index_path)

    num = f"{issue_number:03d}"
    date_range = f"{week_start.strftime('%b %-d')}–{week_end.strftime('%-d, %Y')}"
    headline = _e(content.get("main_story", {}).get("headline", ""))

    # Build topic line from stories
    main_topic = content.get("main_story", {}).get("headline", "")
    second_topic = content.get("second_story", {}).get("headline", "")
    third_topic = content.get("third_story", {}).get("headline", "")
    topic_line = f"Main Story: {_e(main_topic)} · {_e(second_topic)} · {_e(third_topic)}"

    new_row = (
        f'\n    <!-- ISSUE {num} — newest first -->\n'
        f'    <a class="issue-row" href="/newsletter/issue-{num}.html">\n'
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
    issue_path = f"client/public/newsletter/issue-{num}.html"

    # Render and commit the issue HTML
    issue_html = render_issue_html(content, issue_number, week_start, week_end)
    _gh_put_file(
        issue_path,
        issue_html,
        f"Add Junk Mail Issue #{num} — {week_start.strftime('%b %-d')}–{week_end.strftime('%-d, %Y')}",
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
# STEP 6 — Notify OpenClaw social agent
# ═════════════════════════════════════════════════════════════════════════════

def notify_openclaw(issue_number: int, slug: str, content: dict) -> None:
    if not OPENCLAW_WEBHOOK:
        log.warning("OPENCLAW_WEBHOOK_URL not set — skipping social post")
        return

    issue_url  = f"{NEWSLETTER_BASE}/{slug}"
    main_headline = content.get("main_story", {}).get("headline", "")
    wins       = content.get("wins", [])
    top_wins   = [w.get("title", "") for w in wins[:3]]

    payload = {
        "event":        "newsletter_published",
        "issue_number": issue_number,
        "issue_url":    issue_url,
        "main_headline": main_headline,
        "top_wins":     top_wins,
        "message": (
            f"🗞️ Junk Mail Issue #{issue_number:03d} is live!\n\n"
            f"This week: {main_headline}\n\n"
            f"Read it here: {issue_url}"
        ),
    }

    resp = requests.post(OPENCLAW_WEBHOOK, json=payload, timeout=10)
    if resp.ok:
        log.info("OpenClaw social agent notified ✓")
    else:
        log.error(f"OpenClaw notify failed: {resp.status_code} {resp.text}")


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════

def run():
    log.info("═" * 60)
    log.info("JUNK MAIL — Weekly Newsletter Generator")
    log.info("═" * 60)

    # Get current issue number
    config = supabase.table("newsletter_config").select("*").eq("id", 1).single().execute()
    issue_number = config.data["current_issue"]
    log.info(f"Generating Issue #{issue_number}")

    # Date range for this issue
    week_start, week_end = get_week_range()
    log.info(f"Week: {week_start} → {week_end}")

    # Fetch messages
    messages = fetch_messages(week_start, week_end)
    if len(messages) < MIN_MESSAGES:
        log.warning(f"Only {len(messages)} messages found (min: {MIN_MESSAGES}). Aborting.")
        sys.exit(0)

    # Format for Claude
    messages_text = format_messages_for_claude(messages)
    log.info(f"Formatted {len(messages)} messages ({len(messages_text)} chars) for Claude")

    # Generate content
    content = generate_newsletter(messages_text, issue_number, week_start, week_end)

    # Save to Supabase
    slug = save_issue(issue_number, week_start, week_end, content)

    # Increment counter
    increment_counter(issue_number)

    # Render HTML and commit to GitHub
    publish_html_to_github(content, issue_number, week_start, week_end)

    # Deploy (Vercel rebuilds from the new commit)
    trigger_vercel_deploy()

    # Wait a bit for Vercel to finish, then mark published
    import time
    time.sleep(30)
    mark_published(issue_number)

    # Notify OpenClaw
    notify_openclaw(issue_number, slug, content)

    log.info("═" * 60)
    log.info(f"Issue #{issue_number} complete — {NEWSLETTER_BASE}/{slug}")
    log.info("═" * 60)


if __name__ == "__main__":
    run()
