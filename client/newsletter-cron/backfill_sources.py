"""
BACKFILL SOURCE ATTRIBUTION
===========================
Adds "Read the thread" backlinks to an issue that was generated before source
attribution existed — WITHOUT rewriting a single word of its content.

The generator writes source_ids as a side effect of composing the newsletter.
This script does the opposite: it takes finished prose and works backwards,
asking Claude only "which messages is this passage describing?" The published
text is an input here, never an output.

Every write is guarded:
  * The merged content_json is compared field-by-field against the original.
    Any change to any prose field aborts the run before anything is written.
  * Returned ids are checked against the message ids that actually exist in
    that issue's week. Ids Claude invented are dropped, not linked.
  * status, issue_number, week dates and newsletter_config.current_issue are
    never touched — this is not a republish.

Usage:
    python backfill_sources.py --issue 16 --dry-run   # inspect, write nothing
    python backfill_sources.py --issue 16             # write + commit + deploy

Requires the same env as generate_newsletter.py: SUPABASE_URL,
SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY, plus TELEGRAM_GROUP for the link base
and GITHUB_TOKEN/GITHUB_REPO to commit the re-rendered HTML.
"""

import argparse
import copy
import difflib
import json
import logging
import sys
from datetime import date

import generate_newsletter as gen

log = logging.getLogger("backfill")
logging.basicConfig(level=logging.INFO, format="%(message)s")

# Keys this script is allowed to introduce. Anything else differing between the
# original and merged payload is a content change and aborts the run.
ATTRIBUTION_KEYS = {"source_ids", "message_id", "telegram_link_base"}

STORY_SECTIONS = ("main_story", "second_story", "third_story", "hot_topic")

ATTRIBUTION_PROMPT = """
You are matching finished newsletter copy back to the group chat messages it was
written from. You are NOT writing or editing the newsletter. Return ids only.

For each section below, identify which Telegram messages that section was based
on. Every message in the transcript is prefixed with its id, like
"#4821 [2026-07-20 14:03] Marcus".

Return valid JSON only. No preamble, no markdown, no backticks:

{
  "main_story":   {"source_ids": [123, 124]},
  "second_story": {"source_ids": [125]},
  "third_story":  {"source_ids": [126]},
  "hot_topic":    {"source_ids": [127, 128], "voice_message_ids": [127, 128, 129]}
}

Rules:
- Use ONLY ids that appear in the transcript. Never invent one.
- 1-5 ids per section, chronological (lowest first).
- The FIRST id is where the reader lands when they click through. Choose the
  message that STARTS the relevant exchange, not a reply deep inside it.
- voice_message_ids: one id per quoted voice, in the SAME ORDER as the voices
  listed below. Use the message each quote actually came from. If you cannot
  place a quote, use null in that position.
- If a section has no identifiable source, omit its source_ids. A missing link
  is fine. A wrong link sends the reader to an unrelated message, which is worse
  than no link at all.
""".strip()


def _section_digest(content: dict) -> str:
    """The prose Claude needs to see in order to match it against messages."""
    out = []
    for key in STORY_SECTIONS:
        sec = content.get(key) or {}
        if not sec:
            continue
        out.append(f"## {key}")
        if sec.get("headline"):
            out.append(f"headline: {sec['headline']}")
        if sec.get("deck"):
            out.append(f"deck: {sec['deck']}")
        for para in sec.get("paragraphs", []) or []:
            out.append(para)
        if sec.get("intro"):
            out.append(sec["intro"])
        if sec.get("broader_point"):
            out.append(sec["broader_point"])
        for i, v in enumerate(sec.get("voices", []) or []):
            out.append(f"voice[{i}] {v.get('name', '')}: \"{v.get('quote', '')}\"")
        out.append("")
    return "\n".join(out)


def _ask_claude(content: dict, messages: list[dict]) -> dict:
    transcript = gen.format_messages_for_claude(messages)
    user_prompt = (
        f"{_section_digest(content)}\n\n"
        f"--- TRANSCRIPT ---\n\n{transcript}\n\n"
        "Return the attribution JSON."
    )
    log.info("Asking Claude to attribute sources (content is read-only input)...")
    resp = gen.claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=ATTRIBUTION_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )
    raw = resp.content[0].text.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(raw)


def _clean_ids(raw_ids, valid: set[int]) -> list[int]:
    """Keep only ids that really exist in this week, deduped, chronological."""
    out = []
    for rid in raw_ids or []:
        try:
            n = int(rid)
        except (TypeError, ValueError):
            continue
        if n in valid and n not in out:
            out.append(n)
    return sorted(out)


def _assert_content_unchanged(original: dict, merged: dict) -> None:
    """Abort unless merged differs from original ONLY by attribution keys."""

    def strip(node):
        if isinstance(node, dict):
            return {k: strip(v) for k, v in node.items() if k not in ATTRIBUTION_KEYS}
        if isinstance(node, list):
            return [strip(v) for v in node]
        return node

    before, after = strip(original), strip(merged)
    if before == after:
        return

    log.error("ABORT — the merge would alter published content, not just add links.")
    for line in difflib.unified_diff(
        json.dumps(before, indent=2, sort_keys=True).splitlines(),
        json.dumps(after, indent=2, sort_keys=True).splitlines(),
        fromfile="published", tofile="merged", lineterm="",
    ):
        log.error(line)
    sys.exit(1)


def main() -> None:
    p = argparse.ArgumentParser(prog="backfill_sources")
    p.add_argument("--issue", type=int, required=True, help="Issue number, e.g. 16")
    p.add_argument("--dry-run", action="store_true",
                   help="Print the attribution and the HTML diff; write nothing.")
    p.add_argument("--no-commit", action="store_true",
                   help="Update Supabase but do not commit HTML or deploy.")
    args = p.parse_args()

    # ── 1. The published issue ────────────────────────────────────────────────
    res = (
        gen.supabase.table("newsletter_issues")
        .select("*").eq("issue_number", args.issue).single().execute()
    )
    row = res.data
    if not row:
        log.error(f"No newsletter_issues row for issue_number={args.issue}")
        sys.exit(1)

    content = row["content_json"]
    slug = row["slug"]
    week_start = date.fromisoformat(row["week_start"])
    week_end = date.fromisoformat(row["week_end"])
    log.info(f"Issue #{args.issue} ({slug}) — {week_start} → {week_end}, status={row['status']}")

    if not gen.TELEGRAM_LINK_BASE:
        log.error("No Telegram link base — set TELEGRAM_GROUP or TELEGRAM_LINK_BASE.")
        sys.exit(1)
    log.info(f"Link base: {gen.TELEGRAM_LINK_BASE}")

    # ── 2. That week's messages ───────────────────────────────────────────────
    messages = gen.fetch_messages(week_start, week_end)
    valid_ids = {int(m["message_id"]) for m in messages if m.get("message_id") is not None}
    if not valid_ids:
        log.error("No message_ids for that week — nothing to link to.")
        sys.exit(1)
    log.info(f"{len(messages)} messages, {len(valid_ids)} with ids")

    # ── 3. Attribution ────────────────────────────────────────────────────────
    attribution = _ask_claude(content, messages)

    merged = copy.deepcopy(content)
    merged["telegram_link_base"] = gen.TELEGRAM_LINK_BASE
    summary = []

    for key in STORY_SECTIONS:
        if not merged.get(key):
            continue
        ids = _clean_ids((attribution.get(key) or {}).get("source_ids"), valid_ids)
        if ids:
            merged[key]["source_ids"] = ids
            summary.append(f"  {key:<14} -> {gen.message_url(ids[0])}  (from {ids})")
        else:
            summary.append(f"  {key:<14} -> no usable source, left unlinked")

    voices = (merged.get("hot_topic") or {}).get("voices") or []
    voice_ids = (attribution.get("hot_topic") or {}).get("voice_message_ids") or []
    for i, voice in enumerate(voices):
        vid = _clean_ids([voice_ids[i]] if i < len(voice_ids) else [], valid_ids)
        if vid:
            voice["message_id"] = vid[0]
            summary.append(f"  voice {voice.get('name', '?'):<8} -> {gen.message_url(vid[0])}")
        else:
            summary.append(f"  voice {voice.get('name', '?'):<8} -> unattributed, name left plain")

    log.info("\nAttribution:")
    for line in summary:
        log.info(line)

    # ── 4. Guard ──────────────────────────────────────────────────────────────
    _assert_content_unchanged(content, merged)
    log.info("\nContent check: published text is byte-identical, only links added.")

    # ── 5. HTML diff ──────────────────────────────────────────────────────────
    new_html = gen.render_issue_html(merged, args.issue, week_start, week_end)
    issue_path = f"{gen.NEWSLETTER_OUTPUT_DIR}/{slug}.html"
    try:
        # Keep the sha. The Contents API REQUIRES the current blob sha to update
        # an existing file and returns 422 without it. The weekly generator never
        # hits this because it creates new issue files; a backfill always
        # rewrites one that already exists.
        old_html, old_sha = gen._gh_get_file(issue_path)
    except Exception:  # noqa: BLE001
        old_html, old_sha = "", None

    if old_html:
        diff = list(difflib.unified_diff(
            old_html.splitlines(), new_html.splitlines(),
            fromfile=f"{slug}.html (live)", tofile=f"{slug}.html (backfilled)",
            lineterm="", n=1,
        ))
        added = sum(1 for d in diff if d.startswith("+") and not d.startswith("+++"))
        removed = sum(1 for d in diff if d.startswith("-") and not d.startswith("---"))
        log.info(f"\nHTML diff: +{added} / -{removed} lines")
        for line in diff[:120]:
            log.info(line)
        if len(diff) > 120:
            log.info(f"... {len(diff) - 120} more diff lines")

    if args.dry_run:
        log.info("")
        log.info("=" * 70)
        log.info("DRY RUN — NOTHING WAS WRITTEN.")
        log.info("Supabase is unchanged and no HTML was committed.")
        log.info("Re-run without --dry-run (uncheck `dry_run` in the workflow)")
        log.info("to apply the links shown above.")
        log.info("=" * 70)
        return

    # ── 6. Write ──────────────────────────────────────────────────────────────
    gen.supabase.table("newsletter_issues").update(
        {"content_json": merged}
    ).eq("issue_number", args.issue).execute()
    log.info(f"\nUpdated newsletter_issues.content_json for issue #{args.issue}.")

    if args.no_commit:
        log.info("--no-commit — HTML not committed, no deploy triggered.")
        return

    # Re-read the sha immediately before writing, so a commit that landed while
    # this run was talking to Claude does not cause a stale-sha rejection.
    try:
        _, put_sha = gen._gh_get_file(issue_path)
    except Exception:  # noqa: BLE001
        put_sha = old_sha

    try:
        gen._gh_put_file(
            issue_path, new_html,
            f"Add source backlinks to Junk Mail Issue #{args.issue:03d} (content unchanged)",
            sha=put_sha,
        )
    except Exception as exc:  # noqa: BLE001
        log.error(f"Failed to commit {issue_path}: {exc}")
        log.error("Supabase WAS updated — content_json now carries the links.")
        log.error("Re-running is safe: the merge is idempotent and re-verifies content.")
        raise
    log.info(f"Committed {issue_path}.")
    gen.trigger_vercel_deploy()
    log.info("Done.")


if __name__ == "__main__":
    main()
