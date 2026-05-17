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
  5. POST to Vercel deploy webhook → site rebuilds with new issue
  6. POST to OpenClaw social agent → posts announcement

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

import json
import logging
import os
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
# STEP 4 — Trigger Vercel deploy
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
# STEP 5 — Notify OpenClaw social agent
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

    # Deploy
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
