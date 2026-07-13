/*
 * Junk Mail — newsletter archive index. Standalone dark "Signal & Noise"
 * design, intentionally NOT wrapped in the site Layout and not linked in
 * site navigation. Reads published issues from Supabase newsletter_issues.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { formatDateRange, type NewsletterIssueRow } from "@/lib/newsletter-types";

const C = {
  cream: "#FAF7F2",
  ink: "#1E1B18",
  inkCard: "#26231F",
  orange: "#C4622D",
  textBody: "#C2BDB7",
  textMuted: "#8A857E",
  textDim: "#5E5A54",
  border: "rgba(255,255,255,0.08)",
};

export default function Newsletter() {
  const [issues, setIssues] = useState<NewsletterIssueRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    document.title = "Junk Mail | AI Junkies Inner Circle";
    if (!isSupabaseConfigured) {
      setState("error");
      return;
    }
    supabase
      .from("newsletter_issues")
      .select("issue_number, slug, week_start, week_end, status, content_json, published_at")
      .eq("status", "published")
      .order("issue_number", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setState("error");
          return;
        }
        setIssues((data ?? []) as NewsletterIssueRow[]);
        setState("ready");
      });
  }, []);

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: C.ink,
        color: C.textBody,
        minHeight: "100vh",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <header
        style={{
          padding: "18px 32px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <a href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 15, color: C.cream, display: "block" }}>
            From Impact to Income
          </span>
          <span style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 11, color: C.orange }}>
            AI Junkies Inner Circle
          </span>
        </a>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: C.textDim,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.textDim }} />
          Members Only
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
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
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 700,
              fontSize: "clamp(2.4rem,6vw,3.8rem)",
              color: C.cream,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              marginBottom: 16,
            }}
          >
            The Inner <em style={{ fontStyle: "italic", color: C.orange }}>Circle</em>
          </h1>
          <p style={{ fontSize: 15, color: C.textMuted, maxWidth: 520, lineHeight: 1.7 }}>
            Deeper thinking. Less noise. Each issue goes further than the feed — the specific
            frameworks, builds, wins, and honest conversations that don&apos;t make it to the public.
          </p>
        </section>

        <div style={{ height: 1, background: C.border, margin: "0 32px" }} />

        <div
          style={{
            padding: "24px 32px 0",
            fontFamily: "'DM Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: C.orange,
          }}
        >
          {state === "ready" ? `All Issues — ${issues.length} Published` : "All Issues"}
        </div>

        <div style={{ padding: "16px 32px 48px", display: "flex", flexDirection: "column", gap: 10 }}>
          {state === "loading" && (
            <div style={{ padding: 24, fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.textDim }}>
              Loading issues…
            </div>
          )}

          {state === "error" && (
            <div
              style={{
                border: `1px dashed ${C.border}`,
                borderRadius: 3,
                padding: 24,
                textAlign: "center",
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                color: C.textDim,
              }}
            >
              Newsletter archive is temporarily unavailable.
            </div>
          )}

          {state === "ready" && issues.length === 0 && (
            <div
              style={{
                border: `1px dashed ${C.border}`,
                borderRadius: 3,
                padding: 24,
                textAlign: "center",
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                color: C.textDim,
              }}
            >
              New issues every week — check back Monday
            </div>
          )}

          {state === "ready" &&
            issues.map((issue) => (
              <Link
                key={issue.slug}
                href={`/newsletter/${issue.slug}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "56px 1fr 20px",
                    alignItems: "center",
                    gap: 18,
                    background: C.inkCard,
                    border: `1px solid ${C.border}`,
                    borderRadius: 3,
                    padding: "20px 22px",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Fraunces', serif",
                      fontWeight: 700,
                      fontSize: "2.2rem",
                      color: "rgba(255,255,255,0.1)",
                      lineHeight: 1,
                    }}
                  >
                    {String(issue.issue_number).padStart(3, "0")}
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: C.textDim,
                        marginBottom: 4,
                      }}
                    >
                      {formatDateRange(issue.week_start, issue.week_end)}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Fraunces', serif",
                        fontWeight: 600,
                        fontSize: "1rem",
                        color: C.cream,
                        lineHeight: 1.3,
                        marginBottom: 4,
                      }}
                    >
                      {issue.content_json?.main_story?.headline ?? `Issue #${issue.issue_number}`}
                    </div>
                    <div style={{ fontSize: 12.5, color: C.textMuted }}>
                      {issue.content_json?.main_story?.deck ?? ""}
                    </div>
                  </div>
                  <div style={{ color: C.orange, fontSize: 16, lineHeight: 1 }}>→</div>
                </div>
              </Link>
            ))}
        </div>
      </div>

      <footer
        style={{
          padding: "24px 32px 40px",
          borderTop: `1px solid ${C.border}`,
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "1rem", color: C.cream }}>
            Junk Mail
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.textDim,
            }}
          >
            AI Junkies Weekly · Curated by Derrick Harper
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.textDim,
            }}
          >
            For AI Junkies members only · Not for public distribution
          </div>
          <a
            href="/"
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.textMuted,
              textDecoration: "none",
            }}
          >
            ← Main site
          </a>
        </div>
      </footer>
    </div>
  );
}
