"""
JUNK MAIL — TELEGRAM SCRAPER (Telethon MTProto)
================================================
Pulls messages from the AI Junkies Telegram group and writes them
to Supabase `telegram_messages`. Designed to run as a sibling cron
to generate_newsletter.py so the generator always has fresh content.

USAGE
-----
First-time auth (interactive — phone + SMS code):
    python scrape_telegram.py auth

Default weekly run (Sun → Sat of the week that just ended):
    python scrape_telegram.py

Explicit backfill range (inclusive, UTC):
    python scrape_telegram.py backfill --start 2026-05-17 --end 2026-05-30

ENV VARS
--------
    TELEGRAM_API_ID            from my.telegram.org
    TELEGRAM_API_HASH          from my.telegram.org
    TELEGRAM_SESSION_STRING    output of `auth` subcommand (skip for `auth`)
    TELEGRAM_GROUP             group title, @username, or numeric id
    SUPABASE_URL
    SUPABASE_SERVICE_KEY

SUPABASE SCHEMA NOTE
--------------------
`telegram_messages` must have a `message_id BIGINT UNIQUE` column for
idempotent backfill. If it does not exist yet, run once in SQL editor:

    ALTER TABLE telegram_messages ADD COLUMN IF NOT EXISTS message_id BIGINT;
    CREATE UNIQUE INDEX IF NOT EXISTS telegram_messages_message_id_key
        ON telegram_messages(message_id);
"""

import argparse
import asyncio
import logging
import os
import sys
from datetime import date, datetime, timedelta, timezone

from supabase import create_client, Client
from telethon import TelegramClient
from telethon.sessions import StringSession

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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)


# ── Env ───────────────────────────────────────────────────────────────────────

def _require_env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        log.error(f"Missing required env var: {name}")
        sys.exit(2)
    return val


API_ID = int(_require_env("TELEGRAM_API_ID")) if os.environ.get("TELEGRAM_API_ID") else None
API_HASH = os.environ.get("TELEGRAM_API_HASH", "")
GROUP = os.environ.get("TELEGRAM_GROUP", "")


def _supabase() -> Client:
    return create_client(
        _require_env("SUPABASE_URL"),
        _require_env("SUPABASE_SERVICE_KEY"),
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _week_range_last_full() -> tuple[date, date]:
    """Last Sunday → Saturday — matches generate_newsletter.get_week_range()."""
    today = date.today()
    days_since_sunday = (today.weekday() + 1) % 7
    last_sunday = today - timedelta(days=days_since_sunday + 7)
    last_saturday = last_sunday + timedelta(days=6)
    return last_sunday, last_saturday


def _parse_date(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def _resolve_group_arg(g: str):
    """Telethon accepts int (chat id), '@username', or full title string."""
    g = g.strip()
    if not g:
        log.error("TELEGRAM_GROUP not set")
        sys.exit(2)
    try:
        return int(g)
    except ValueError:
        return g


def _reaction_count(msg) -> int:
    if not getattr(msg, "reactions", None):
        return 0
    results = getattr(msg.reactions, "results", None) or []
    return sum(getattr(r, "count", 0) for r in results)


def _week_start_for(ts: datetime) -> date:
    """Most recent Sunday on/before ts (UTC). Matches the generator's Sun-Sat week."""
    d = ts.astimezone(timezone.utc).date()
    days_since_sunday = (d.weekday() + 1) % 7
    return d - timedelta(days=days_since_sunday)


def _sender_display(sender) -> str:
    if sender is None:
        return "Unknown"
    parts = [getattr(sender, "first_name", "") or "", getattr(sender, "last_name", "") or ""]
    name = " ".join(p for p in parts if p).strip()
    if name:
        return name
    uname = getattr(sender, "username", None)
    if uname:
        return f"@{uname}"
    return f"id:{getattr(sender, 'id', 'unknown')}"


# ── Auth (run once) ───────────────────────────────────────────────────────────

async def cmd_auth() -> None:
    """Interactive login — prints session string to copy into env."""
    if not API_ID or not API_HASH:
        log.error("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set")
        sys.exit(2)
    print("\n=== Telegram Auth ===")
    print("You will be asked for your phone number, then the SMS code Telegram sends.")
    print("If you have 2FA enabled, you will also be asked for your password.\n")
    async with TelegramClient(StringSession(), API_ID, API_HASH) as client:
        await client.start()
        session_str = client.session.save()
        me = await client.get_me()
        print("\n=== Logged in as ===")
        print(f"  {me.first_name} {me.last_name or ''} (@{me.username or 'no-username'})")
        print("\n=== TELEGRAM_SESSION_STRING (copy into env / Railway vars) ===")
        print(session_str)
        print("=" * 60)


# ── Scrape ────────────────────────────────────────────────────────────────────

async def _scrape_range(start: date, end: date) -> int:
    """Pull messages from [start 00:00 UTC, end 23:59:59 UTC] and upsert."""
    if not API_ID or not API_HASH:
        log.error("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set")
        sys.exit(2)
    session_str = _require_env("TELEGRAM_SESSION_STRING")
    # Restore trailing `=` padding if copy/paste dropped it. Telethon's
    # StringSession is `1` + urlsafe_b64(...), so the body length mod 4 must be 0.
    body_len = len(session_str) - 1
    pad = (-body_len) % 4
    if pad:
        log.info(f"Session string missing {pad} byte(s) of base64 padding; restoring.")
        session_str = session_str + ("=" * pad)
    group = _resolve_group_arg(GROUP)

    start_dt = datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc)
    end_dt = datetime.combine(end, datetime.max.time(), tzinfo=timezone.utc)

    log.info(f"Scraping {group!r} from {start_dt.isoformat()} → {end_dt.isoformat()}")

    rows: list[dict] = []
    reply_cache: dict[int, str] = {}

    async with TelegramClient(StringSession(session_str), API_ID, API_HASH) as client:
        entity = await client.get_entity(group)
        log.info(f"Resolved entity: {getattr(entity, 'title', entity)}")

        # iter_messages walks newest → oldest. Stop once we cross start_dt.
        async for msg in client.iter_messages(entity, offset_date=end_dt + timedelta(seconds=1)):
            if msg.date is None:
                continue
            ts = msg.date.astimezone(timezone.utc)
            if ts < start_dt:
                break
            if ts > end_dt:
                continue
            text = (msg.message or "").strip()
            if not text:
                continue

            sender = await msg.get_sender()
            reply_to_text = None
            if msg.reply_to_msg_id:
                rid = msg.reply_to_msg_id
                if rid in reply_cache:
                    reply_to_text = reply_cache[rid]
                else:
                    try:
                        replied = await client.get_messages(entity, ids=rid)
                        if replied and replied.message:
                            reply_to_text = replied.message.strip()
                            reply_cache[rid] = reply_to_text
                    except Exception as e:  # noqa: BLE001
                        log.debug(f"could not fetch reply target {rid}: {e}")

            rows.append({
                "message_id": int(msg.id),
                "timestamp": ts.isoformat(),
                "sender_name": _sender_display(sender),
                "message_text": text,
                "reaction_count": _reaction_count(msg),
                "reply_to_text": reply_to_text,
                "week_start": _week_start_for(ts).isoformat(),
            })

    log.info(f"Collected {len(rows)} messages from Telegram")
    if not rows:
        return 0

    sb = _supabase()
    # Upsert in chunks of 500 on message_id to keep payloads small and idempotent.
    CHUNK = 500
    for i in range(0, len(rows), CHUNK):
        batch = rows[i : i + CHUNK]
        sb.table("telegram_messages").upsert(batch, on_conflict="message_id").execute()
        log.info(f"Upserted {i + len(batch)} / {len(rows)}")
    return len(rows)


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    p = argparse.ArgumentParser(prog="scrape_telegram")
    sub = p.add_subparsers(dest="cmd")

    sub.add_parser("auth", help="Interactive login — prints session string")

    bf = sub.add_parser("backfill", help="Scrape an explicit date range")
    bf.add_argument("--start", required=True, help="YYYY-MM-DD (UTC, inclusive)")
    bf.add_argument("--end", required=True, help="YYYY-MM-DD (UTC, inclusive)")

    args = p.parse_args()

    if args.cmd == "auth":
        asyncio.run(cmd_auth())
        return

    if args.cmd == "backfill":
        start = _parse_date(args.start)
        end = _parse_date(args.end)
        if end < start:
            log.error("--end must be >= --start")
            sys.exit(2)
        asyncio.run(_scrape_range(start, end))
        return

    # Default: last full Sun → Sat
    start, end = _week_range_last_full()
    log.info(f"No subcommand — defaulting to last full week: {start} → {end}")
    asyncio.run(_scrape_range(start, end))


if __name__ == "__main__":
    main()
