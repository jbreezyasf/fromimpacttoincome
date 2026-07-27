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
    python backfill_sources.py --survey               # which issues are linkable
    python backfill_sources.py --issue 16 --dry-run   # inspect, write nothing
    python backfill_sources.py --issue 1-15           # batch: write + commit
    python backfill_sources.py --issue all            # every issue

--issue accepts one number, an inclusive range, a comma list, or "all". In a
batch each issue is independent: one failure is reported and the rest continue,
and the Vercel deploy fires once at the end rather than once per commit.
Re-running is idempotent, so partial progress is safe to keep.

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
    raise ValueError("merge would alter published content")


def survey() -> None:
    """
    Report which issues can be backfilled. No Claude calls, no writes.

    Early telegram_messages rows predate the Telethon scraper — setup_scraper_schema.sql
    adds message_id via ALTER TABLE — so older weeks may hold messages with no ids
    and nothing to link to. Run this before spending model calls on a batch.
    """
    rows = (
        gen.supabase.table("newsletter_issues")
        .select("issue_number, slug, week_start, week_end, status, content_json")
        .order("issue_number")
        .execute()
    ).data or []

    log.info(f"{len(rows)} issues. Link base: {gen.TELEGRAM_LINK_BASE or '(none)'}\n")
    header = f"{'#':>3}  {'week':<23} {'msgs':>5} {'w/ids':>6}  {'linked':<7} {'verdict'}"
    log.info(header)
    log.info("-" * len(header))

    ready = []
    for r in rows:
        ws = date.fromisoformat(r["week_start"])
        we = date.fromisoformat(r["week_end"])
        msgs = gen.fetch_messages(ws, we)
        with_ids = sum(1 for m in msgs if m.get("message_id") is not None)

        content = r.get("content_json") or {}
        already = any(
            (content.get(k) or {}).get("source_ids") for k in STORY_SECTIONS
        )

        if with_ids == 0:
            verdict = "SKIP — no message ids for this week"
        elif already:
            verdict = "done — already has links"
        else:
            verdict = "ready"
            ready.append(r["issue_number"])

        log.info(
            f"{r['issue_number']:>3}  {str(ws) + ' → ' + str(we):<23} "
            f"{len(msgs):>5} {with_ids:>6}  {'yes' if already else 'no':<7} {verdict}"
        )

    log.info("")
    if ready:
        log.info(f"{len(ready)} issue(s) ready: {ready}")
        log.info(f"Preview them with:  --issue {min(ready)}-{max(ready)} --dry-run")
    else:
        log.info("No issues are both linkable and unlinked.")


def parse_issue_arg(raw: str) -> list[int]:
    """Accept '16', '1-15', or 'all'. Returns issue numbers, ascending."""
    raw = raw.strip().lower()
    if raw == "all":
        rows = (
            gen.supabase.table("newsletter_issues")
            .select("issue_number").order("issue_number").execute()
        ).data or []
        return [r["issue_number"] for r in rows]
    if "," in raw:
        return sorted({int(x) for x in raw.split(",") if x.strip()})
    if "-" in raw:
        lo, hi = raw.split("-", 1)
        return list(range(int(lo), int(hi) + 1))
    return [int(raw)]


def backfill_one(issue: int, dry_run: bool, no_commit: bool, deploy: bool = True) -> str:
    """Backfill a single issue. Returns a one-word outcome for the batch summary."""

    class _Args:
        pass

    args = _Args()
    args.issue, args.dry_run, args.no_commit, args.deploy = issue, dry_run, no_commit, deploy

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
        log.warning(f"Issue #{args.issue}: no message ids for that week — skipping.")
        return "skipped"
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
        return "preview"

    # ── 6. Write ──────────────────────────────────────────────────────────────
    gen.supabase.table("newsletter_issues").update(
        {"content_json": merged}
    ).eq("issue_number", args.issue).execute()
    log.info(f"\nUpdated newsletter_issues.content_json for issue #{args.issue}.")

    if args.no_commit:
        log.info("--no-commit — HTML not committed, no deploy triggered.")
        return "supabase-only"

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
    if args.deploy:
        gen.trigger_vercel_deploy()
    log.info("Done.")
    return "applied"


def main() -> None:
    p = argparse.ArgumentParser(prog="backfill_sources")
    p.add_argument("--issue", type=str,
                   help="Issue number (16), an inclusive range (1-15), or 'all'.")
    p.add_argument("--survey", action="store_true",
                   help="Report which issues are linkable. No model calls, no writes.")
    p.add_argument("--dry-run", action="store_true",
                   help="Print the attribution and the HTML diff; write nothing.")
    p.add_argument("--no-commit", action="store_true",
                   help="Update Supabase but do not commit HTML or deploy.")
    args = p.parse_args()

    if not gen.TELEGRAM_LINK_BASE:
        log.error("No Telegram link base — set TELEGRAM_GROUP or TELEGRAM_LINK_BASE.")
        sys.exit(1)

    if args.survey:
        survey()
        return
    if not args.issue:
        p.error("one of --issue or --survey is required")

    issues = parse_issue_arg(args.issue)
    batch = len(issues) > 1
    if batch:
        log.info(f"Backfilling {len(issues)} issues: {issues}\n")

    # One issue failing must not abandon the rest — each is independent, and a
    # re-run is idempotent, so partial progress is safe to keep.
    results: list[tuple[int, str]] = []
    for n in issues:
        log.info("=" * 70)
        try:
            # In a batch the Vercel deploy fires once at the end rather than
            # once per issue, to avoid a rebuild per commit.
            outcome = backfill_one(n, args.dry_run, args.no_commit, deploy=not batch)
        except SystemExit:
            raise
        except Exception as exc:  # noqa: BLE001
            log.error(f"Issue #{n} FAILED: {exc}")
            outcome = f"failed: {exc}"
        results.append((n, outcome or "unknown"))

    if not batch:
        return

    log.info("\n" + "=" * 70)
    log.info("BATCH SUMMARY")
    log.info("=" * 70)
    for n, outcome in results:
        log.info(f"  #{n:>3}  {outcome}")

    applied = sum(1 for _, o in results if o == "applied")
    failed = [n for n, o in results if o.startswith("failed")]
    log.info("")
    log.info(f"applied={applied}  skipped={sum(1 for _, o in results if o == 'skipped')}  "
             f"preview={sum(1 for _, o in results if o == 'preview')}  failed={len(failed)}")
    if failed:
        log.info(f"Re-run just the failures with: --issue {','.join(map(str, failed))}")
    if applied and not args.dry_run and not args.no_commit:
        gen.trigger_vercel_deploy()


if __name__ == "__main__":
    main()
