// Mirrors the content_json shape documented in supabase_schema.sql for the
// newsletter_issues table.

// Telegram message ids a section was written from. Absent on issues generated
// before source attribution existed, so every consumer must treat it as optional.
export type SourceIds = number[];

export interface NewsletterContent {
  lede?: { opening?: string; body?: string };
  main_story?: {
    headline?: string;
    deck?: string;
    paragraphs?: string[];
    key_points?: { title: string; body: string }[];
    biz_callout?: string;
    source_ids?: SourceIds;
  };
  second_story?: { headline?: string; paragraphs?: string[]; source_ids?: SourceIds };
  third_story?: { headline?: string; paragraphs?: string[]; source_ids?: SourceIds };
  hot_topic?: {
    headline?: string;
    intro?: string;
    broader_point?: string;
    voices?: { name: string; quote: string; message_id?: number }[];
    source_ids?: SourceIds;
  };
  quick_hits?: { number: string; title: string; body: string }[];
  member_spotlight?: {
    name: string;
    handle?: string;
    is_new?: boolean;
    project_name?: string | null;
    body: string;
  }[];
  wins?: {
    emoji?: string;
    tag?: string;
    tag_label?: string;
    title: string;
    body: string;
  }[];
}

export interface NewsletterIssueRow {
  issue_number: number;
  slug: string;
  week_start: string;
  week_end: string;
  status: string;
  content_json: NewsletterContent | null;
  published_at: string | null;
}

// Base URL a Telegram message id is appended to, e.g. https://t.me/c/1234567890.
// Mirrors _telegram_link_base() in client/newsletter-cron/generate_newsletter.py.
// Unset means the site renders no backlinks at all, rather than broken ones.
const TELEGRAM_LINK_BASE = (
  (import.meta.env.VITE_TELEGRAM_LINK_BASE as string | undefined) ?? ""
).replace(/\/+$/, "");

/** Permalink to one Telegram message, or null if we cannot build one. */
export function messageUrl(id?: number | null): string | null {
  if (!TELEGRAM_LINK_BASE || id == null || !Number.isFinite(id)) return null;
  return `${TELEGRAM_LINK_BASE}/${id}`;
}

/**
 * Permalink for a whole section. Points at the earliest cited message so the
 * reader lands where the conversation starts and can scroll forward.
 */
export function threadUrl(ids?: SourceIds): string | null {
  const valid = (ids ?? []).filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  if (valid.length === 0) return null;
  return messageUrl(Math.min(...valid));
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
  if (s.getMonth() !== e.getMonth()) {
    return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
  }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.getDate()}, ${e.getFullYear()}`;
}
