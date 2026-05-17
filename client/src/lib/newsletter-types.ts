// Mirrors the content_json shape documented in supabase_schema.sql for the
// newsletter_issues table.

export interface NewsletterContent {
  lede?: { opening?: string; body?: string };
  main_story?: {
    headline?: string;
    deck?: string;
    paragraphs?: string[];
    key_points?: { title: string; body: string }[];
    biz_callout?: string;
  };
  second_story?: { headline?: string; paragraphs?: string[] };
  third_story?: { headline?: string; paragraphs?: string[] };
  hot_topic?: {
    headline?: string;
    intro?: string;
    broader_point?: string;
    voices?: { name: string; quote: string }[];
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

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
  if (s.getMonth() !== e.getMonth()) {
    return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
  }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.getDate()}, ${e.getFullYear()}`;
}
