#!/usr/bin/env -S node --experimental-strip-types
/*
 * Weekly newsletter generator.
 *
 * Reads telegram_messages for the target ISO week, asks Claude to produce a
 * content_json matching the documented shape, and upserts the row into
 * newsletter_issues. By default writes status='generated' so a human flips it
 * to 'published'. Pass --publish to publish in one shot.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY   (service role, server-side only)
 *   ANTHROPIC_API_KEY
 * Optional env:
 *   VERCEL_DEPLOY_HOOK_URL (POSTed after publish to rebuild the site)
 *   ANTHROPIC_MODEL        (defaults to claude-opus-4-7)
 *
 * Flags:
 *   --week-start YYYY-MM-DD  Monday of the target week (default: Monday of current ISO week)
 *   --issue N                Override issue number (default: newsletter_config.current_issue)
 *   --publish                Set status='published' and hit the Vercel deploy hook
 *   --dry-run                Print content_json, write nothing to Supabase
 */

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    weekStart: get("--week-start"),
    issueOverride: get("--issue"),
    publish: args.includes("--publish"),
    dryRun: args.includes("--dry-run"),
  };
}

function mondayOfISOWeek(d: Date): Date {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  return m;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function slugFor(issueNumber: number): string {
  return `issue-${String(issueNumber).padStart(3, "0")}`;
}

interface TelegramMessage {
  message_id: number;
  sender_name: string | null;
  message_text: string;
  reply_to_text: string | null;
  reaction_count: number | null;
  has_media: boolean | null;
  media_type: string | null;
  timestamp: string;
}

const SYSTEM_PROMPT = `You are the editor of "Junk Mail", the AI Junkies Inner Circle weekly newsletter.
Voice: direct, no fluff, builder-energy. Member-first. No marketing speak.
You will receive raw Telegram messages from one week of the AI Junkies group chat.
Your job: synthesize them into the structured JSON shape provided in the user message.
Rules:
- Use real member names from the messages. Do not invent members or quotes.
- Quote members directly when their wording matters; paraphrase only if needed.
- Skip placeholder/test messages. Skip purely social chatter unless it's the story.
- If a section has nothing real to report, omit it (use null or empty array).
- Output ONLY valid JSON. No prose before or after. No markdown fences.`;

function userPrompt(weekStart: string, weekEnd: string, issueNumber: number, messages: TelegramMessage[]): string {
  return `Week: ${weekStart} to ${weekEnd}
Issue number: ${issueNumber}

Produce content_json with exactly this shape (omit a field entirely if there is no real material for it):

{
  "lede": { "opening": "Hey Junkies 👋 — ...", "body": "2-3 sentence setup" },
  "main_story": {
    "headline": "Punchy headline",
    "deck": "One italic framing sentence",
    "paragraphs": ["para1", "para2", "para3"],
    "key_points": [{ "title": "Point title.", "body": "Point explanation." }],
    "biz_callout": "How this applies to a member's business"
  },
  "second_story": { "headline": "...", "paragraphs": ["..."] },
  "third_story":  { "headline": "...", "paragraphs": ["..."] },
  "hot_topic": {
    "headline": "The debate or question",
    "intro": "What sparked it",
    "broader_point": "Why it matters",
    "voices": [{ "name": "Member Name", "quote": "Their actual quote or paraphrase" }]
  },
  "quick_hits": [
    { "number": "01", "title": "...", "body": "2-3 sentence tip" }
  ],
  "member_spotlight": [
    { "name": "First Name", "handle": "descriptor or null", "is_new": false, "project_name": "Name or null", "body": "1-2 sentence spotlight" }
  ],
  "wins": [
    { "emoji": "💰", "tag": "client", "tag_label": "New Client", "title": "Member — Project", "body": "1-2 sentences" }
  ]
}

tag values must be one of: "client", "build", "speaking", "other".

Raw messages (${messages.length} total):
${JSON.stringify(messages, null, 2)}`;
}

async function main() {
  const args = parseArgs();

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseKey = requireEnv("SUPABASE_SERVICE_KEY");
  const anthropicKey = requireEnv("ANTHROPIC_API_KEY");

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const weekStartDate = args.weekStart
    ? new Date(args.weekStart + "T00:00:00Z")
    : mondayOfISOWeek(new Date());
  const weekStart = isoDate(weekStartDate);
  const weekEnd = isoDate(addDays(weekStartDate, 6));

  let issueNumber: number;
  if (args.issueOverride) {
    issueNumber = Number(args.issueOverride);
  } else {
    const { data: cfg, error: cfgErr } = await supabase
      .from("newsletter_config")
      .select("current_issue")
      .eq("id", 1)
      .single();
    if (cfgErr || !cfg) {
      console.error("Could not read newsletter_config:", cfgErr);
      process.exit(1);
    }
    issueNumber = cfg.current_issue;
  }
  const slug = slugFor(issueNumber);

  console.log(`Generating ${slug} for week ${weekStart} → ${weekEnd}`);

  const { data: messages, error: msgErr } = await supabase
    .from("telegram_messages")
    .select("message_id, sender_name, message_text, reply_to_text, reaction_count, has_media, media_type, timestamp")
    .eq("week_start", weekStart)
    .order("timestamp", { ascending: true });

  if (msgErr) {
    console.error("Failed to read telegram_messages:", msgErr);
    process.exit(1);
  }
  if (!messages || messages.length === 0) {
    console.error(`No telegram_messages found for week_start=${weekStart}. Aborting.`);
    process.exit(1);
  }
  console.log(`Loaded ${messages.length} messages.`);

  const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7";
  const response = await anthropic.messages.create({
    model,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: userPrompt(weekStart, weekEnd, issueNumber, messages as TelegramMessage[]) },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.error("Claude returned no text block.");
    process.exit(1);
  }
  const raw = textBlock.text.trim().replace(/^```(?:json)?\s*/, "").replace(/```$/, "");

  let contentJson: unknown;
  try {
    contentJson = JSON.parse(raw);
  } catch (e) {
    console.error("Claude output was not valid JSON:");
    console.error(raw);
    process.exit(1);
  }

  if (args.dryRun) {
    console.log("--- DRY RUN: content_json ---");
    console.log(JSON.stringify(contentJson, null, 2));
    return;
  }

  const status = args.publish ? "published" : "generated";
  const nowIso = new Date().toISOString();
  const row = {
    issue_number: issueNumber,
    slug,
    week_start: weekStart,
    week_end: weekEnd,
    status,
    content_json: contentJson,
    generated_at: nowIso,
    ...(args.publish ? { published_at: nowIso } : {}),
  };

  const { error: upsertErr } = await supabase
    .from("newsletter_issues")
    .upsert(row, { onConflict: "issue_number" });
  if (upsertErr) {
    console.error("Failed to upsert newsletter_issues:", upsertErr);
    process.exit(1);
  }
  console.log(`Wrote ${slug} with status=${status}.`);

  const { error: cfgUpdErr } = await supabase
    .from("newsletter_config")
    .update({ current_issue: issueNumber + 1, last_run: isoDate(new Date()) })
    .eq("id", 1);
  if (cfgUpdErr) {
    console.warn("Wrote issue but failed to bump newsletter_config:", cfgUpdErr);
  }

  if (args.publish) {
    const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
    if (hookUrl) {
      const res = await fetch(hookUrl, { method: "POST" });
      console.log(`Vercel deploy hook → ${res.status}`);
    } else {
      console.log("VERCEL_DEPLOY_HOOK_URL not set; skipping rebuild.");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
