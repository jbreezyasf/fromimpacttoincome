# Community Connectors — Source Platform Addendum

This guide accompanies the main *Setup Guide* and covers how to pull community messages from different platforms into Supabase so the newsletter pipeline can use them.

The newsletter script reads from a single messages table. Your job is to get messages **into** that table from whatever platform your community lives on. Pick the connector(s) that match your client's setup.

---

## Unified Message Table

If pulling from multiple platforms (or planning to switch later), use this expanded schema instead of the default `telegram_messages` table:

```sql
CREATE TABLE community_messages (
  id             SERIAL PRIMARY KEY,
  source         TEXT NOT NULL,         -- 'telegram', 'skool', 'ghl', 'facebook', 'discord', 'slack'
  timestamp      TIMESTAMPTZ NOT NULL,
  sender_name    TEXT NOT NULL,
  message_text   TEXT NOT NULL,
  reaction_count INT DEFAULT 0,
  reply_to_text  TEXT,
  thread_title   TEXT,                  -- post/thread title (Skool, Facebook, GHL)
  channel_name   TEXT,                  -- channel or group name
  metadata       JSONB DEFAULT '{}',    -- platform-specific extras (likes, post type, etc.)
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cm_timestamp ON community_messages (timestamp);
CREATE INDEX idx_cm_source ON community_messages (source);
```

Then update `fetch_messages()` in `generate_newsletter.py` to query `community_messages` instead of `telegram_messages`.

---

## Skool

Skool has no official API. Two approaches:

### Option A — Browser automation (recommended)

Use a scheduled Python script with [Playwright](https://playwright.dev/python/) that logs into Skool, navigates the community feed, and scrapes posts/comments.

```python
# skool_connector.py
# Schedule on Railway ~1 hour before the newsletter cron

from playwright.sync_api import sync_playwright
from supabase import create_client
import os

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

def scrape_skool():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Login
        page.goto("https://www.skool.com/login")
        page.fill('input[name="email"]', os.environ["SKOOL_EMAIL"])
        page.fill('input[name="password"]', os.environ["SKOOL_PASSWORD"])
        page.click('button[type="submit"]')
        page.wait_for_url("**/community")

        # Navigate to your group
        page.goto(f"https://www.skool.com/{os.environ['SKOOL_GROUP_SLUG']}/community")

        # Scrape posts — inspect the actual DOM and adapt selectors
        posts = page.query_selector_all('[data-testid="post-card"]')
        for post in posts:
            title = post.query_selector(".post-title")
            body = post.query_selector(".post-body")
            author = post.query_selector(".post-author")
            time_el = post.query_selector("time")

            sb.table("community_messages").insert({
                "source": "skool",
                "timestamp": time_el.get_attribute("datetime") if time_el else None,
                "sender_name": author.inner_text() if author else "Unknown",
                "message_text": body.inner_text() if body else "",
                "thread_title": title.inner_text() if title else "",
                "channel_name": os.environ.get("SKOOL_GROUP_SLUG", ""),
            }).execute()

        browser.close()

if __name__ == "__main__":
    scrape_skool()
```

**Important:** Skool's DOM changes periodically. The CSS selectors above are examples — inspect the actual page and update them. Consider storing selectors in env vars so you can update without redeploying.

Add to `requirements.txt`:
```
playwright==1.49.0
```

Your Railway build command or Dockerfile needs: `playwright install chromium`

### Option B — Skool email digests

If the group sends email digests, forward them to an inbox you control, then parse with an email-to-webhook service (e.g. Mailgun inbound routes → Supabase Edge Function → insert).

### Env vars

| Variable           | Description                     |
|--------------------|---------------------------------|
| `SKOOL_EMAIL`      | Login email for Skool           |
| `SKOOL_PASSWORD`   | Login password                  |
| `SKOOL_GROUP_SLUG` | URL slug of the Skool group     |

---

## GoHighLevel (GHL)

GHL has a REST API for community posts and comments.

### Option A — GHL API (recommended)

```python
# ghl_connector.py
import requests, os
from datetime import datetime, timedelta, timezone
from supabase import create_client

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

GHL_API = "https://services.leadconnectorhq.com"
headers = {
    "Authorization": f"Bearer {os.environ['GHL_API_KEY']}",
    "Version": "2021-07-28",
}

def fetch_ghl_posts():
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    resp = requests.get(
        f"{GHL_API}/communities/groups/{os.environ['GHL_GROUP_ID']}/posts",
        headers=headers,
        params={"limit": 100},
        timeout=15,
    )
    resp.raise_for_status()

    for post in resp.json().get("posts", []):
        post_date = datetime.fromisoformat(post["createdAt"].replace("Z", "+00:00"))
        if post_date < cutoff:
            continue

        sb.table("community_messages").insert({
            "source": "ghl",
            "timestamp": post["createdAt"],
            "sender_name": post.get("authorName", "Unknown"),
            "message_text": post.get("content", ""),
            "thread_title": post.get("title", ""),
            "reaction_count": post.get("likeCount", 0),
            "channel_name": post.get("channelName", ""),
            "metadata": {"post_id": post["id"], "comment_count": post.get("commentCount", 0)},
        }).execute()

        # Fetch comments on each post
        comments_resp = requests.get(
            f"{GHL_API}/communities/groups/{os.environ['GHL_GROUP_ID']}/posts/{post['id']}/comments",
            headers=headers,
            timeout=15,
        )
        for comment in comments_resp.json().get("comments", []):
            sb.table("community_messages").insert({
                "source": "ghl",
                "timestamp": comment["createdAt"],
                "sender_name": comment.get("authorName", "Unknown"),
                "message_text": comment.get("content", ""),
                "thread_title": post.get("title", ""),
                "reply_to_text": post.get("content", "")[:100],
                "channel_name": post.get("channelName", ""),
            }).execute()

if __name__ == "__main__":
    fetch_ghl_posts()
```

### Option B — GHL Workflow Webhook

Set up a GHL workflow triggered by "Community Post Created" and "Community Comment Created" that POSTs to your Supabase REST endpoint:

```
POST https://<project>.supabase.co/rest/v1/community_messages
Headers:
  apikey: <supabase_anon_key>
  Authorization: Bearer <supabase_service_key>
  Content-Type: application/json
Body:
  {"source": "ghl", "timestamp": "{{post.createdAt}}", "sender_name": "{{post.authorName}}", ...}
```

This gives you real-time ingestion instead of batch scraping.

### Env vars

| Variable        | Description                              |
|-----------------|------------------------------------------|
| `GHL_API_KEY`   | GHL API key (Location or Agency level)   |
| `GHL_GROUP_ID`  | Community group ID from GHL              |

---

## Facebook Groups

Facebook's Graph API restricts group post access. Options ranked by reliability:

### Option A — Graph API (if you have access)

Requires a Facebook App with `groups_access_member_info` permission (restricted to certain app types). If approved:

```python
# facebook_connector.py
import requests, os
from datetime import datetime, timedelta, timezone
from supabase import create_client

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

def fetch_facebook_posts():
    group_id = os.environ["FB_GROUP_ID"]
    token = os.environ["FB_ACCESS_TOKEN"]
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    url = f"https://graph.facebook.com/v19.0/{group_id}/feed"
    params = {
        "access_token": token,
        "fields": "message,from,created_time,reactions.summary(true),comments{message,from,created_time}",
        "since": cutoff,
        "limit": 100,
    }

    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()

    for post in resp.json().get("data", []):
        if not post.get("message"):
            continue

        sb.table("community_messages").insert({
            "source": "facebook",
            "timestamp": post["created_time"],
            "sender_name": post.get("from", {}).get("name", "Unknown"),
            "message_text": post["message"],
            "reaction_count": post.get("reactions", {}).get("summary", {}).get("total_count", 0),
            "channel_name": f"facebook-{group_id}",
        }).execute()

        for comment in post.get("comments", {}).get("data", []):
            sb.table("community_messages").insert({
                "source": "facebook",
                "timestamp": comment["created_time"],
                "sender_name": comment.get("from", {}).get("name", "Unknown"),
                "message_text": comment.get("message", ""),
                "reply_to_text": post["message"][:100],
                "channel_name": f"facebook-{group_id}",
            }).execute()

if __name__ == "__main__":
    fetch_facebook_posts()
```

### Option B — Zapier / Make (easiest, no code)

This is the most practical path for most Facebook Groups since API access is restricted.

**Zapier:**
1. Trigger: **Facebook Groups → New Post in Group**
2. Action: **Webhooks → POST** to `https://<project>.supabase.co/rest/v1/community_messages`
3. Headers: `apikey: <anon_key>`, `Authorization: Bearer <service_key>`, `Content-Type: application/json`
4. Body: map the post fields to the table columns

**Make (Integromat):**
Same flow — Facebook Groups module → HTTP module → Supabase REST insert.

### Option C — Browser automation (last resort)

Same approach as Skool using Playwright. More fragile due to Facebook's anti-scraping measures. Only use if A and B aren't viable.

### Env vars

| Variable          | Description                                    |
|-------------------|------------------------------------------------|
| `FB_GROUP_ID`     | Facebook Group ID                              |
| `FB_ACCESS_TOKEN` | Long-lived token with group read access        |

---

## Discord

Discord has a well-documented bot API. Straightforward setup.

```python
# discord_connector.py
import requests, os
from datetime import datetime, timedelta, timezone
from supabase import create_client

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

DISCORD_TOKEN = os.environ["DISCORD_BOT_TOKEN"]
CHANNEL_IDS = os.environ.get("DISCORD_CHANNEL_IDS", "").split(",")

def fetch_discord_messages():
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    headers = {"Authorization": f"Bot {DISCORD_TOKEN}"}

    for channel_id in CHANNEL_IDS:
        channel_id = channel_id.strip()
        if not channel_id:
            continue

        url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
        params = {"limit": 100}
        all_messages = []

        while True:
            resp = requests.get(url, headers=headers, params=params, timeout=15)
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            all_messages.extend(batch)
            oldest = datetime.fromisoformat(batch[-1]["timestamp"])
            if oldest < cutoff:
                break
            params["before"] = batch[-1]["id"]

        for msg in all_messages:
            msg_time = datetime.fromisoformat(msg["timestamp"])
            if msg_time < cutoff:
                continue
            if msg.get("author", {}).get("bot"):
                continue

            sb.table("community_messages").insert({
                "source": "discord",
                "timestamp": msg["timestamp"],
                "sender_name": msg["author"].get("global_name") or msg["author"]["username"],
                "message_text": msg.get("content", ""),
                "reaction_count": sum(r.get("count", 0) for r in msg.get("reactions", [])),
                "channel_name": channel_id,
            }).execute()

if __name__ == "__main__":
    fetch_discord_messages()
```

### Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → New Application
2. Bot → Add Bot → copy the token
3. OAuth2 → URL Generator → select `bot` scope + `Read Message History` permission
4. Use the generated URL to invite the bot to your server
5. Right-click a channel → Copy Channel ID (enable Developer Mode in Discord settings first)

### Env vars

| Variable              | Description                              |
|-----------------------|------------------------------------------|
| `DISCORD_BOT_TOKEN`   | Bot token from Developer Portal          |
| `DISCORD_CHANNEL_IDS` | Comma-separated channel IDs to pull from |

---

## Slack

Use the Slack Web API with a bot token.

```python
# slack_connector.py
import requests, os
from datetime import datetime, timedelta, timezone
from supabase import create_client

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

SLACK_BOT_TOKEN = os.environ["SLACK_BOT_TOKEN"]
SLACK_CHANNEL_IDS = os.environ.get("SLACK_CHANNEL_IDS", "").split(",")

def fetch_slack_messages():
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    headers = {"Authorization": f"Bearer {SLACK_BOT_TOKEN}"}
    user_cache = {}

    for channel_id in SLACK_CHANNEL_IDS:
        channel_id = channel_id.strip()
        if not channel_id:
            continue

        resp = requests.get("https://slack.com/api/conversations.history", headers=headers, params={
            "channel": channel_id,
            "oldest": str(cutoff.timestamp()),
            "limit": 200,
        }, timeout=15)
        data = resp.json()

        for msg in data.get("messages", []):
            if msg.get("subtype"):
                continue

            user_id = msg.get("user", "")
            if user_id and user_id not in user_cache:
                user_resp = requests.get("https://slack.com/api/users.info", headers=headers, params={"user": user_id}, timeout=10)
                user_data = user_resp.json().get("user", {})
                user_cache[user_id] = user_data.get("real_name") or user_data.get("name", "Unknown")

            sb.table("community_messages").insert({
                "source": "slack",
                "timestamp": datetime.fromtimestamp(float(msg["ts"]), tz=timezone.utc).isoformat(),
                "sender_name": user_cache.get(user_id, "Unknown"),
                "message_text": msg.get("text", ""),
                "reaction_count": sum(r.get("count", 0) for r in msg.get("reactions", [])),
                "channel_name": channel_id,
            }).execute()

if __name__ == "__main__":
    fetch_slack_messages()
```

### Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From Scratch
2. OAuth & Permissions → add scopes: `channels:history`, `channels:read`, `users:read`
3. Install to Workspace → copy the Bot User OAuth Token
4. Invite the bot to each channel: `/invite @YourBot`
5. Get channel IDs: right-click channel name → View channel details → scroll to bottom

### Env vars

| Variable            | Description                                          |
|---------------------|------------------------------------------------------|
| `SLACK_BOT_TOKEN`   | Bot token with `channels:history`, `users:read`      |
| `SLACK_CHANNEL_IDS` | Comma-separated Slack channel IDs                    |

---

## Telegram (Default)

Already built in. See the main *Setup Guide* for the full Telegram path — it's the recommended default.

The pipeline ships with `scrape_telegram.py`, a Telethon (MTProto) scraper that logs in as a real Telegram user (NOT a bot) and pulls historical messages from a group. The orchestrator `run_weekly.py` runs the scraper and the generator in sequence every Sunday, so there's nothing for you to wire up beyond the env vars.

Why user-account MTProto and not a bot:
- Bots can't read message history they didn't witness live. A user account in the group has full read access to backfill any range.
- The one-time `python scrape_telegram.py auth` flow produces a session string that lives as an env var, so Railway runs unattended afterwards.

If you'd still rather use a bot (e.g., you want real-time ingestion via webhook instead of weekly batch), set up a bot via [@BotFather](https://t.me/BotFather), add it to the group, and point Telegram's webhook at a Supabase Edge Function that inserts into `telegram_messages` (or `community_messages` if multi-platform).

---

## Running Connectors

### Single platform

If the client uses only one platform, you can either:

1. **Run the connector as a separate Railway service** with its own cron, ~1 hour before the newsletter
2. **Add the connector call directly into `generate_newsletter.py`** before `fetch_messages()` so it runs inline

### Multiple platforms

If a client uses more than one platform (e.g. Skool + Discord), run each connector before the newsletter fires:

```toml
# In each connector's railway.toml
[deploy]
cronSchedule = "0 13 * * 0"   # 1 hour before newsletter (at 14:00 UTC)
```

Or create a single `ingest.py` that imports and calls each connector:

```python
# ingest.py — runs all connectors in sequence
from skool_connector import scrape_skool
from ghl_connector import fetch_ghl_posts
from discord_connector import fetch_discord_messages

if __name__ == "__main__":
    scrape_skool()
    fetch_ghl_posts()
    fetch_discord_messages()
```

The newsletter script doesn't care where messages came from — it reads everything in the messages table for the date range and feeds it all to Claude.

---

## Quick Reference

| Platform   | Best Method           | API Available? | Real-time Option?       |
|------------|-----------------------|----------------|-------------------------|
| Telegram   | Bot webhook/polling   | Yes            | Yes (webhook)           |
| Discord    | Bot API               | Yes            | Yes (gateway events)    |
| Slack      | Web API               | Yes            | Yes (Events API)        |
| GHL        | REST API or webhook   | Yes            | Yes (workflow webhook)  |
| Facebook   | Zapier/Make or API    | Limited        | Yes (via Zapier)        |
| Skool      | Browser automation    | No             | No (batch only)         |
