"""
Railway cron entrypoint — runs the Telegram scraper, then the newsletter
generator, every Sunday morning. Both scripts default to "the week that
just ended" (Sun → Sat) so no args are needed.

If the scraper fails, the generator is skipped (no point summarizing stale data).
"""
import subprocess
import sys


def _run(label: str, args: list[str]) -> None:
    print(f"\n>>> {label}: {' '.join(args)}\n", flush=True)
    rc = subprocess.run([sys.executable, *args], check=False).returncode
    if rc != 0:
        print(f"\n!!! {label} exited with code {rc} — aborting.\n", flush=True)
        sys.exit(rc)


def main() -> None:
    _run("Step 1/2 — Telegram scraper", ["scrape_telegram.py"])
    _run("Step 2/2 — Newsletter generator", ["generate_newsletter.py"])


if __name__ == "__main__":
    main()
