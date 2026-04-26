/*
 * DESIGN: Signal & Noise — Dark mode variant for newsletter inner circle
 * NewsletterIssue: Single issue reading view, no public nav
 */
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { getIssueBySlug, newsletterIssues } from "@/lib/newsletter-data";
import { motion } from "framer-motion";
import { Streamdown } from "streamdown";

export default function NewsletterIssue() {
  const params = useParams<{ issue: string }>();
  const issue = getIssueBySlug(params.issue ?? "");

  if (!issue) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--brand-ink, oklch(0.15 0.01 65))" }}
      >
        <div className="text-center">
          <h1 className="font-display font-bold text-2xl mb-4" style={{ color: "var(--brand-cream)" }}>
            Issue not found
          </h1>
          <Link href="/newsletter">
            <span className="font-mono-label" style={{ color: "var(--brand-orange)" }}>
              ← Back to Newsletter
            </span>
          </Link>
        </div>
      </div>
    );
  }

  const currentIndex = newsletterIssues.findIndex((i) => i.slug === issue.slug);
  const prevIssue = currentIndex < newsletterIssues.length - 1 ? newsletterIssues[currentIndex + 1] : null;
  const nextIssue = currentIndex > 0 ? newsletterIssues[currentIndex - 1] : null;

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--brand-ink, oklch(0.15 0.01 65))" }}
    >
      {/* Minimal header */}
      <header
        className="py-5 px-6 flex items-center justify-between sticky top-0 z-50"
        style={{
          background: "oklch(0.15 0.01 65 / 0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid oklch(1 0 0 / 0.08)",
        }}
      >
        <Link href="/newsletter">
          <span
            className="flex items-center gap-2 font-mono-label link-underline"
            style={{ color: "oklch(0.62 0.012 65)", fontSize: "0.62rem" }}
          >
            <ArrowLeft size={12} />
            All Issues
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Lock size={12} style={{ color: "oklch(0.45 0.01 85)" }} />
          <span className="font-mono-label" style={{ color: "oklch(0.45 0.01 85)", fontSize: "0.58rem" }}>
            AI Junkies
          </span>
        </div>
      </header>

      {/* Issue header */}
      <section className="py-16 px-6 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <span
              className="font-display font-bold text-5xl leading-none"
              style={{ color: "oklch(0.28 0.01 65)" }}
            >
              {issue.issue}
            </span>
            <div
              className="w-px self-stretch"
              style={{ background: "oklch(1 0 0 / 0.1)" }}
            />
            <div>
              <span className="tag-pill" style={{ background: "var(--brand-orange)" }}>
                Issue {issue.issue}
              </span>
              <div className="font-mono-label mt-1.5" style={{ color: "oklch(0.52 0.01 85)", fontSize: "0.58rem" }}>
                {issue.date}
              </div>
            </div>
          </div>
          <h1
            className="font-display font-bold leading-tight mb-5"
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              color: "var(--brand-cream)",
              letterSpacing: "-0.02em",
            }}
          >
            {issue.title}
          </h1>
          <p className="text-base leading-relaxed" style={{ color: "oklch(0.65 0.012 65)" }}>
            {issue.preview}
          </p>
        </motion.div>
      </section>

      {/* Divider */}
      <div className="px-6 max-w-2xl mx-auto">
        <hr style={{ height: "1px", background: "oklch(1 0 0 / 0.1)", border: "none" }} />
      </div>

      {/* Body */}
      <section className="py-12 px-6 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="newsletter-body"
        >
          <div
            style={{
              color: "oklch(0.78 0.012 65)",
              lineHeight: "1.85",
              fontSize: "1rem",
            }}
          >
            <Streamdown className="newsletter-content">{issue.body}</Streamdown>
          </div>
        </motion.div>
      </section>

      {/* Prev / Next */}
      {(prevIssue || nextIssue) && (
        <section className="py-10 px-6 max-w-2xl mx-auto">
          <hr style={{ height: "1px", background: "oklch(1 0 0 / 0.08)", border: "none", marginBottom: "1.5rem" }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {prevIssue && (
              <Link href={`/newsletter/${prevIssue.slug}`}>
                <div
                  className="p-5 rounded-sm cursor-pointer transition-all duration-200 hover:border-orange-500"
                  style={{
                    background: "oklch(0.20 0.008 65)",
                    border: "1px solid oklch(1 0 0 / 0.07)",
                  }}
                >
                  <div className="flex items-center gap-2 font-mono-label mb-2" style={{ color: "oklch(0.52 0.01 85)", fontSize: "0.58rem" }}>
                    <ArrowLeft size={11} /> Previous Issue
                  </div>
                  <div className="font-display font-semibold text-sm" style={{ color: "var(--brand-cream)" }}>
                    {prevIssue.title}
                  </div>
                </div>
              </Link>
            )}
            {nextIssue && (
              <Link href={`/newsletter/${nextIssue.slug}`}>
                <div
                  className="p-5 rounded-sm cursor-pointer transition-all duration-200 sm:text-right"
                  style={{
                    background: "oklch(0.20 0.008 65)",
                    border: "1px solid oklch(1 0 0 / 0.07)",
                  }}
                >
                  <div className="flex items-center justify-end gap-2 font-mono-label mb-2" style={{ color: "oklch(0.52 0.01 85)", fontSize: "0.58rem" }}>
                    Next Issue <ArrowRight size={11} />
                  </div>
                  <div className="font-display font-semibold text-sm" style={{ color: "var(--brand-cream)" }}>
                    {nextIssue.title}
                  </div>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Footer note */}
      <div className="py-8 px-6 max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="font-mono-label" style={{ color: "oklch(0.35 0.01 65)", fontSize: "0.56rem" }}>
            AI Junkies Inner Circle — Not for public distribution
          </span>
          <Link href="/">
            <span className="font-mono-label link-underline" style={{ color: "oklch(0.48 0.01 65)", fontSize: "0.58rem" }}>
              ← Main site
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
