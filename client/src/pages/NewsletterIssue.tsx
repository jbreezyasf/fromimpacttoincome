/*
 * Junk Mail — single issue. Renders the Supabase content_json for one issue
 * into the "Signal & Noise" dark layout (mirrors the issue-005 design).
 * Standalone, noindex, not linked in site navigation.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  formatDateRange,
  messageUrl,
  threadUrl,
  type NewsletterContent,
  type NewsletterIssueRow,
  type SourceIds,
} from "@/lib/newsletter-types";

const C = {
  cream: "#FAF7F2",
  ink: "#1E1B18",
  inkCard: "#26231F",
  orange: "#C4622D",
  orangeLight: "#D4824D",
  greenLight: "#2A5240",
  textBody: "#C2BDB7",
  textMuted: "#8A857E",
  textDim: "#5E5A54",
  border: "rgba(255,255,255,0.08)",
};

const winTagColor: Record<string, string> = {
  client: C.orangeLight,
  build: C.greenLight,
  speaking: "#6BAE8C",
  other: C.textDim,
};

function SectionRule() {
  return <div style={{ height: 1, background: C.border, margin: "0 32px" }} />;
}

/**
 * "Read the thread →" backlink into the Telegram conversation a section came
 * from. Renders nothing when the issue predates source attribution or when no
 * link base is configured, so older issues are unaffected.
 */
function ThreadLink({
  base,
  sourceIds,
}: {
  base?: string;
  sourceIds?: SourceIds;
}) {
  const href = threadUrl(base, sourceIds);
  if (!href) return null;
  return (
    <p style={{ marginTop: 18 }}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: C.orange,
          textDecoration: "none",
          borderBottom: `1px solid ${C.orange}59`,
          paddingBottom: 2,
        }}
      >
        Read the thread →
      </a>
    </p>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "32px 32px 0",
        fontFamily: "'DM Mono', monospace",
        fontSize: 9,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: C.orange,
        marginBottom: 2,
      }}
    >
      {children}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 12,
        color: C.textDim,
        textAlign: "center",
        padding: "120px 32px",
        background: C.ink,
        minHeight: "100vh",
      }}
    >
      {children}
      <div style={{ marginTop: 16 }}>
        <Link href="/newsletter" style={{ color: C.orangeLight }}>
          ← Back to all issues
        </Link>
      </div>
    </div>
  );
}

export default function NewsletterIssue() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const [issue, setIssue] = useState<NewsletterIssueRow | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState("error");
      return;
    }
    setState("loading");
    supabase
      .from("newsletter_issues")
      .select("issue_number, slug, week_start, week_end, status, content_json, published_at")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setState("error");
          return;
        }
        if (!data || !(data as NewsletterIssueRow).content_json) {
          setState("missing");
          return;
        }
        setIssue(data as NewsletterIssueRow);
        setState("ready");
      });
  }, [slug]);

  useEffect(() => {
    if (issue) {
      document.title = `Junk Mail — Issue #${String(issue.issue_number).padStart(
        3,
        "0",
      )} | AI Junkies Inner Circle`;
    }
  }, [issue]);

  if (state === "loading") return <Centered>Loading issue…</Centered>;
  if (state === "error") return <Centered>Newsletter is temporarily unavailable.</Centered>;
  if (state === "missing" || !issue) return <Centered>Issue not found.</Centered>;

  const c: NewsletterContent = issue.content_json ?? {};
  const num = String(issue.issue_number).padStart(3, "0");
  const dateLabel = formatDateRange(issue.week_start, issue.week_end);
  const members = c.member_spotlight ?? [];
  const wins = c.wins ?? [];

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: C.ink,
        color: C.textBody,
        fontSize: 15,
        lineHeight: 1.75,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* HEADER */}
        <header
          style={{
            padding: "20px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${C.border}`,
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "rgba(30,27,24,0.95)",
            backdropFilter: "blur(12px)",
          }}
        >
          <a href="/" style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 15, color: C.cream, display: "block", lineHeight: 1.2 }}>
              From Impact to Income
            </span>
            <span style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 11, color: C.orange, display: "block", lineHeight: 1.2 }}>
              AI Junkies Inner Circle
            </span>
          </a>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "'DM Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: C.textDim,
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.textDim }} />
            Members Only
          </div>
        </header>

        {/* HERO */}
        <section style={{ padding: "64px 32px 48px" }}>
          <span
            style={{
              display: "inline-block",
              fontFamily: "'DM Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: C.orange,
              color: C.cream,
              padding: "4px 10px",
              borderRadius: 2,
              marginBottom: 20,
            }}
          >
            AI Junkies Newsletter
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "3.5rem", color: "rgba(255,255,255,0.08)", lineHeight: 1 }}>
              {num}
            </div>
            <div style={{ width: 1, height: 48, background: C.border }} />
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textDim }}>
              {dateLabel}
            </div>
          </div>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 700,
              fontSize: "clamp(2.2rem,6vw,3.4rem)",
              color: C.cream,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              marginBottom: 16,
            }}
          >
            Junk <em style={{ fontStyle: "italic", color: C.orange }}>Mail</em>
          </h1>
          {c.lede?.opening && (
            <p style={{ fontSize: 15, lineHeight: 1.75, color: C.textMuted, maxWidth: 560 }}>
              <strong style={{ color: C.cream, fontWeight: 600 }}>{c.lede.opening}</strong>
            </p>
          )}
          {c.lede?.body && (
            <p style={{ fontSize: 15, lineHeight: 1.75, color: C.textMuted, maxWidth: 560, marginTop: 12 }}>
              {c.lede.body}
            </p>
          )}
        </section>

        {/* ① MAIN STORY */}
        {c.main_story && (
          <>
            <SectionRule />
            <SectionLabel>① Main Story</SectionLabel>
            <div style={{ padding: "14px 32px 32px" }}>
              {c.main_story.headline && (
                <h2
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontWeight: 700,
                    fontSize: "clamp(1.5rem,3.5vw,2rem)",
                    color: C.cream,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.15,
                    marginBottom: 12,
                  }}
                >
                  {c.main_story.headline}
                </h2>
              )}
              {c.main_story.deck && (
                <p
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontStyle: "italic",
                    fontSize: "1rem",
                    color: C.textMuted,
                    marginBottom: 18,
                    lineHeight: 1.6,
                  }}
                >
                  {c.main_story.deck}
                </p>
              )}
              {(c.main_story.paragraphs ?? []).map((p, i) => (
                <p key={i} style={{ color: C.textBody, marginBottom: 14, fontSize: 15 }}>
                  {p}
                </p>
              ))}
              {c.main_story.key_points && c.main_story.key_points.length > 0 && (
                <ul style={{ paddingLeft: 20, marginBottom: 14 }}>
                  {c.main_story.key_points.map((kp, i) => (
                    <li key={i} style={{ marginBottom: 8, color: C.textBody }}>
                      <strong style={{ color: C.cream }}>{kp.title}</strong> {kp.body}
                    </li>
                  ))}
                </ul>
              )}
              <ThreadLink base={c.telegram_link_base} sourceIds={c.main_story.source_ids} />
            </div>
            {c.main_story.biz_callout && (
              <div
                style={{
                  margin: "0 32px 28px",
                  borderLeft: `3px solid ${C.orange}`,
                  background: "rgba(196,98,45,0.08)",
                  padding: "16px 20px",
                  borderRadius: "0 3px 3px 0",
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 9,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: C.orange,
                    fontWeight: 500,
                    marginBottom: 8,
                  }}
                >
                  💼 How does this apply to your business?
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: C.textBody }}>
                  {c.main_story.biz_callout}
                </p>
              </div>
            )}
          </>
        )}

        {/* ② SECOND STORY */}
        {c.second_story?.headline && (
          <>
            <SectionRule />
            <SectionLabel>② Also This Week</SectionLabel>
            <div style={{ padding: "14px 32px 32px" }}>
              <h3
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 600,
                  fontSize: "1.25rem",
                  color: C.cream,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.25,
                  marginBottom: 10,
                }}
              >
                {c.second_story.headline}
              </h3>
              {(c.second_story.paragraphs ?? []).map((p, i) => (
                <p key={i} style={{ color: C.textBody, marginBottom: 14, fontSize: 15 }}>
                  {p}
                </p>
              ))}
              <ThreadLink base={c.telegram_link_base} sourceIds={c.second_story.source_ids} />
            </div>
          </>
        )}

        {/* ③ THIRD STORY */}
        {c.third_story?.headline && (
          <>
            <SectionRule />
            <SectionLabel>③ Worth Knowing</SectionLabel>
            <div style={{ padding: "14px 32px 32px" }}>
              <h3
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 600,
                  fontSize: "1.25rem",
                  color: C.cream,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.25,
                  marginBottom: 10,
                }}
              >
                {c.third_story.headline}
              </h3>
              {(c.third_story.paragraphs ?? []).map((p, i) => (
                <p key={i} style={{ color: C.textBody, marginBottom: 14, fontSize: 15 }}>
                  {p}
                </p>
              ))}
              <ThreadLink base={c.telegram_link_base} sourceIds={c.third_story.source_ids} />
            </div>
          </>
        )}

        {/* ④ HOT TOPIC */}
        {c.hot_topic?.headline && (
          <>
            <SectionRule />
            <SectionLabel>④ Hot Topic</SectionLabel>
            <div
              style={{
                margin: "0 32px 32px",
                background: C.inkCard,
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                padding: 24,
                marginTop: 14,
              }}
            >
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: C.orange,
                  marginBottom: 10,
                }}
              >
                🔥 From the Group Chat
              </div>
              <h3
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 700,
                  fontSize: "1.4rem",
                  color: C.cream,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  marginBottom: 12,
                }}
              >
                {c.hot_topic.headline}
              </h3>
              {c.hot_topic.intro && (
                <p style={{ fontSize: 14, lineHeight: 1.75, color: C.textBody, marginBottom: 12 }}>
                  {c.hot_topic.intro}
                </p>
              )}
              {c.hot_topic.broader_point && (
                <p style={{ fontSize: 14, lineHeight: 1.75, color: C.textBody, marginBottom: 12 }}>
                  {c.hot_topic.broader_point}
                </p>
              )}
              {c.hot_topic.voices && c.hot_topic.voices.length > 0 && (
                <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  {c.hot_topic.voices.map((v, i) => (
                    <div
                      key={i}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        borderLeft: `2px solid ${C.orange}`,
                        padding: "10px 14px",
                        borderRadius: "0 2px 2px 0",
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        color: C.textBody,
                        fontStyle: "italic",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 9,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: C.orange,
                          marginBottom: 5,
                          fontStyle: "normal",
                        }}
                      >
                        {messageUrl(c.telegram_link_base, v.message_id) ? (
                          <a
                            href={messageUrl(c.telegram_link_base, v.message_id)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "inherit",
                              textDecoration: "none",
                              borderBottom: `1px dotted ${C.orange}`,
                            }}
                          >
                            {v.name}
                          </a>
                        ) : (
                          v.name
                        )}
                      </div>
                      {v.quote}
                    </div>
                  ))}
                </div>
              )}
              <ThreadLink
                base={c.telegram_link_base}
                sourceIds={
                  c.hot_topic.source_ids ??
                  (c.hot_topic.voices ?? [])
                    .map((v) => v.message_id)
                    .filter((id): id is number => typeof id === "number")
                }
              />
            </div>
          </>
        )}

        {/* ⑤ QUICK HITS */}
        {c.quick_hits && c.quick_hits.length > 0 && (
          <>
            <SectionRule />
            <SectionLabel>⑤ Quick Hits</SectionLabel>
            <div
              style={{
                padding: "14px 32px 32px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {c.quick_hits.map((q, i) => (
                <div
                  key={i}
                  style={{
                    background: C.inkCard,
                    border: `1px solid ${C.border}`,
                    borderRadius: 3,
                    padding: 18,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Fraunces', serif",
                      fontWeight: 700,
                      fontSize: "2.2rem",
                      color: "rgba(255,255,255,0.07)",
                      lineHeight: 1,
                      marginBottom: 6,
                    }}
                  >
                    {q.number}
                  </div>
                  <strong
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.cream,
                      marginBottom: 6,
                      lineHeight: 1.3,
                    }}
                  >
                    {q.title}
                  </strong>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: C.textMuted }}>{q.body}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ⑥ MEMBER SPOTLIGHT */}
        {members.length > 0 && (
          <>
            <SectionRule />
            <SectionLabel>⑥ Member Spotlight</SectionLabel>
            <div
              style={{
                padding: "14px 32px 32px",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}
            >
              {members.map((m, i) => (
                <div
                  key={i}
                  style={{
                    background: C.inkCard,
                    border: `1px solid ${C.border}`,
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ height: 3, background: m.is_new_member ? C.orange : "#1C3A2E" }} />
                  <div style={{ padding: 14 }}>
                    <div
                      style={{
                        fontFamily: "'Fraunces', serif",
                        fontWeight: 700,
                        fontSize: "1rem",
                        color: C.cream,
                        marginBottom: 2,
                        lineHeight: 1.2,
                      }}
                    >
                      {m.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 9,
                        letterSpacing: "0.08em",
                        color: C.textDim,
                        marginBottom: 8,
                      }}
                    >
                      {m.is_new_member ? "New Member 🎉" : (m.handle ?? "AI Junkies Member")}
                    </div>
                    <p style={{ fontSize: 12.5, lineHeight: 1.6, color: C.textMuted }}>{m.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ⑦ WINS */}
        {wins.length > 0 && (
          <>
            <SectionRule />
            <SectionLabel>⑦ Wins This Week</SectionLabel>
            <div style={{ padding: "14px 32px 32px", display: "flex", flexDirection: "column", gap: 10 }}>
              {wins.map((w, i) => (
                <div
                  key={i}
                  style={{
                    background: C.inkCard,
                    border: `1px solid ${C.border}`,
                    borderRadius: 3,
                    padding: "16px 18px",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: 14,
                    alignItems: "start",
                  }}
                >
                  <div style={{ fontSize: 18, lineHeight: 1, marginTop: 2 }}>{w.emoji ?? "🏆"}</div>
                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 8.5,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        padding: "2px 7px",
                        borderRadius: 2,
                        marginBottom: 5,
                        border: "1px solid currentColor",
                        color: winTagColor[w.tag ?? "other"] ?? C.textDim,
                      }}
                    >
                      {w.tag_label ?? w.tag ?? "Win"}
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: C.cream,
                        marginBottom: 3,
                        display: "block",
                      }}
                    >
                      {w.title}
                    </span>
                    <p style={{ fontSize: 13, lineHeight: 1.65, color: C.textMuted }}>{w.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* FOOTER */}
        <footer
          style={{
            padding: "32px 32px 40px",
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <span
              style={{
                fontFamily: "'Fraunces', serif",
                fontWeight: 700,
                fontSize: "1.1rem",
                color: C.cream,
                display: "block",
                marginBottom: 4,
              }}
            >
              Junk Mail
            </span>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 9,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: C.textDim,
                lineHeight: 1.8,
              }}
            >
              AI Junkies Weekly · Inner Circle Edition
              <br />
              Curated by Derrick Harper
            </div>
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.textDim,
              textAlign: "right",
              lineHeight: 1.9,
            }}
          >
            Issue #{num} · {dateLabel}
            <br />
            For AI Junkies members only
            <br />
            <Link href="/newsletter" style={{ color: C.textMuted, textDecoration: "none" }}>
              ← All issues
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
