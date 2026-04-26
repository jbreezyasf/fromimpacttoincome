/*
 * DESIGN: Signal & Noise — Warm editorial, forest green + burnt orange + cream
 * Newsletter: Hidden page for AI Junkies — not in nav or footer
 * Access: Direct URL only (/newsletter)
 */
import { Link } from "wouter";
import { ArrowRight, Lock } from "lucide-react";
import { newsletterIssues } from "@/lib/newsletter-data";
import { motion } from "framer-motion";

// Intentionally NO Layout wrapper — this page has its own minimal chrome
export default function Newsletter() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--brand-ink, oklch(0.15 0.01 65))" }}
    >
      {/* Minimal header */}
      <header
        className="py-5 px-6 flex items-center justify-between"
        style={{ borderBottom: "1px solid oklch(1 0 0 / 0.08)" }}
      >
        <Link href="/">
          <div className="flex flex-col leading-none">
            <span className="font-display font-bold text-base" style={{ color: "var(--brand-cream)" }}>
              From Impact to Income
            </span>
            <span className="font-display italic text-xs" style={{ color: "var(--brand-orange)" }}>
              AI Junkies Inner Circle
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Lock size={12} style={{ color: "oklch(0.55 0.01 85)" }} />
          <span className="font-mono-label" style={{ color: "oklch(0.55 0.01 85)", fontSize: "0.58rem" }}>
            Members Only
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-6 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="tag-pill mb-6 inline-block" style={{ background: "var(--brand-orange)" }}>
            AI Junkies Newsletter
          </span>
          <h1
            className="font-display font-bold leading-tight mb-5"
            style={{
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              color: "var(--brand-cream)",
              letterSpacing: "-0.02em",
            }}
          >
            The Inner Circle
          </h1>
          <p className="text-base leading-relaxed max-w-xl" style={{ color: "oklch(0.68 0.015 85)" }}>
            Deeper thinking. Less noise. Each issue goes further than the journal — into the specific frameworks, tools, and honest reflections that don't make it to the public feed.
          </p>
        </motion.div>
      </section>

      {/* Divider */}
      <div className="px-6 max-w-3xl mx-auto">
        <hr style={{ height: "1px", background: "oklch(1 0 0 / 0.1)", border: "none" }} />
      </div>

      {/* Issues list */}
      <section className="py-12 px-6 max-w-3xl mx-auto">
        <div className="font-mono-label mb-8" style={{ color: "var(--brand-orange)", fontSize: "0.62rem" }}>
          All Issues — {newsletterIssues.length} Published
        </div>

        <div className="space-y-4">
          {newsletterIssues.map((issue, i) => (
            <Link key={issue.slug} href={`/newsletter/${issue.slug}`}>
              <motion.div
                className="group flex items-start gap-5 p-6 rounded-sm cursor-pointer transition-all duration-200"
                style={{
                  background: "oklch(0.20 0.008 65)",
                  border: "1px solid oklch(1 0 0 / 0.07)",
                }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                whileHover={{ borderColor: "oklch(0.58 0.14 42 / 0.4)" }}
              >
                {/* Issue number */}
                <div
                  className="font-display font-bold text-3xl leading-none flex-shrink-0 mt-1"
                  style={{ color: "oklch(0.35 0.01 65)" }}
                >
                  {issue.issue}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="font-mono-label mb-2" style={{ color: "oklch(0.55 0.01 85)", fontSize: "0.58rem" }}>
                    {issue.date}
                  </div>
                  <h2
                    className="font-display font-semibold mb-2 leading-snug"
                    style={{ fontSize: "1.1rem", color: "var(--brand-cream)" }}
                  >
                    {issue.title}
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: "oklch(0.62 0.012 65)" }}>
                    {issue.preview}
                  </p>
                </div>
                {/* Arrow */}
                <ArrowRight
                  size={16}
                  className="flex-shrink-0 mt-1 transition-transform group-hover:translate-x-1"
                  style={{ color: "var(--brand-orange)" }}
                />
              </motion.div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer note */}
      <div className="py-10 px-6 max-w-3xl mx-auto">
        <hr style={{ height: "1px", background: "oklch(1 0 0 / 0.08)", border: "none", marginBottom: "1.5rem" }} />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="font-mono-label" style={{ color: "oklch(0.38 0.01 65)", fontSize: "0.58rem" }}>
            This page is not linked publicly. Share with intention.
          </span>
          <Link href="/">
            <span className="font-mono-label link-underline" style={{ color: "oklch(0.55 0.01 85)", fontSize: "0.58rem" }}>
              ← Back to main site
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
