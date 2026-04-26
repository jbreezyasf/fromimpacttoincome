/*
 * DESIGN: Signal & Noise — Warm editorial, forest green + burnt orange + cream
 * JournalPost: Single post with left-anchored reading layout
 */
import Layout from "@/components/Layout";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getPostBySlug, journalPosts } from "@/lib/journal-data";
import { motion } from "framer-motion";
import { Streamdown } from "streamdown";

export default function JournalPost() {
  const params = useParams<{ slug: string }>();
  const post = getPostBySlug(params.slug ?? "");

  if (!post) {
    return (
      <Layout>
        <div className="container py-32 text-center">
          <h1 className="font-display font-bold text-3xl mb-4" style={{ color: "var(--brand-ink)" }}>
            Entry not found
          </h1>
          <Link href="/journal">
            <span className="font-mono-label" style={{ color: "var(--brand-green)" }}>
              ← Back to Journal
            </span>
          </Link>
        </div>
      </Layout>
    );
  }

  const currentIndex = journalPosts.findIndex((p) => p.slug === post.slug);
  const prevPost = currentIndex < journalPosts.length - 1 ? journalPosts[currentIndex + 1] : null;
  const nextPost = currentIndex > 0 ? journalPosts[currentIndex - 1] : null;

  return (
    <Layout>
      {/* Header */}
      <section
        className="py-20"
        style={{ background: "var(--brand-green)" }}
      >
        <div className="container">
          <Link href="/journal">
            <span
              className="flex items-center gap-2 font-mono-label mb-8 w-fit link-underline"
              style={{ color: "oklch(0.72 0.015 85)", fontSize: "0.62rem" }}
            >
              <ArrowLeft size={12} />
              Back to Journal
            </span>
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <div className="flex items-center gap-3 mb-5">
              <span className="tag-pill" style={{ background: "var(--brand-orange)" }}>
                {post.category}
              </span>
              <span className="font-mono-label" style={{ color: "oklch(0.65 0.015 85)", fontSize: "0.6rem" }}>
                {post.date} · {post.readTime}
              </span>
            </div>
            <h1
              className="font-display font-bold leading-tight mb-4"
              style={{
                fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
                color: "var(--brand-cream)",
                letterSpacing: "-0.02em",
              }}
            >
              {post.title}
            </h1>
            <p
              className="font-display italic text-xl"
              style={{ color: "oklch(0.82 0.015 85)" }}
            >
              {post.subtitle}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Body */}
      <section className="py-16" style={{ background: "var(--brand-cream)" }}>
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Article content */}
            <motion.div
              className="lg:col-span-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {/* Excerpt / lede */}
              <div className="rule-left mb-10">
                <p
                  className="font-display italic text-lg leading-relaxed"
                  style={{ color: "var(--brand-ink)" }}
                >
                  {post.excerpt}
                </p>
              </div>

              {/* Body */}
              <div
                className="journal-body text-base leading-relaxed space-y-5"
                style={{ color: "var(--brand-ink-muted)" }}
              >
              <div className="streamdown-wrapper">
                <Streamdown>{post.body}</Streamdown>
              </div>
              </div>
            </motion.div>

            {/* Sidebar */}
            <div className="lg:col-span-3 lg:col-start-10">
              <div className="sticky top-24 space-y-6">
                {/* Category */}
                <div
                  className="p-5 rounded-sm"
                  style={{
                    background: "oklch(0.96 0.012 85)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="font-mono-label mb-3" style={{ color: "var(--brand-orange)", fontSize: "0.6rem" }}>
                    Filed Under
                  </div>
                  <span className="tag-pill-outline">{post.category}</span>
                </div>

                {/* More entries */}
                <div
                  className="p-5 rounded-sm"
                  style={{
                    background: "var(--brand-green)",
                  }}
                >
                  <div className="font-mono-label mb-3" style={{ color: "var(--brand-orange-light, oklch(0.72 0.12 55))", fontSize: "0.6rem" }}>
                    Keep Reading
                  </div>
                  <Link href="/journal">
                    <button
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 font-mono-label transition-all duration-200 hover:opacity-90"
                      style={{
                        background: "var(--brand-orange)",
                        color: "var(--brand-cream)",
                        borderRadius: "4px",
                        fontSize: "0.62rem",
                        letterSpacing: "0.1em",
                      }}
                    >
                      All Entries
                      <ArrowRight size={11} />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Prev / Next */}
      <section
        className="py-12"
        style={{
          background: "oklch(0.96 0.012 85)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="container">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {prevPost && (
              <Link href={`/journal/${prevPost.slug}`}>
                <div
                  className="card-lift p-6 rounded-sm"
                  style={{
                    background: "var(--brand-cream)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center gap-2 font-mono-label mb-2" style={{ color: "var(--brand-ink-muted)", fontSize: "0.6rem" }}>
                    <ArrowLeft size={11} /> Previous Entry
                  </div>
                  <div className="font-display font-semibold text-sm" style={{ color: "var(--brand-ink)" }}>
                    {prevPost.title}
                  </div>
                </div>
              </Link>
            )}
            {nextPost && (
              <Link href={`/journal/${nextPost.slug}`}>
                <div
                  className="card-lift p-6 rounded-sm sm:text-right"
                  style={{
                    background: "var(--brand-cream)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center justify-end gap-2 font-mono-label mb-2" style={{ color: "var(--brand-ink-muted)", fontSize: "0.6rem" }}>
                    Next Entry <ArrowRight size={11} />
                  </div>
                  <div className="font-display font-semibold text-sm" style={{ color: "var(--brand-ink)" }}>
                    {nextPost.title}
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
