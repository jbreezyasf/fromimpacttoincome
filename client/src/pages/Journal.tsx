/*
 * DESIGN: Signal & Noise — Warm editorial, forest green + burnt orange + cream
 * Journal: Asymmetric grid with featured post + card list
 */
import Layout from "@/components/Layout";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { journalPosts } from "@/lib/journal-data";
import { motion } from "framer-motion";

const categories = ["All", "Mindset", "Strategy", "Business", "AI & Tools"];

export default function Journal() {
  return (
    <Layout>
      {/* Header */}
      <section
        className="py-20"
        style={{ background: "var(--brand-cream)" }}
      >
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="font-mono-label mb-3 block" style={{ color: "var(--brand-orange)" }}>
              The Journal
            </span>
            <h1
              className="font-display font-bold leading-tight mb-4"
              style={{
                fontSize: "clamp(2.2rem, 5vw, 4rem)",
                color: "var(--brand-ink)",
                letterSpacing: "-0.02em",
              }}
            >
              Ideas worth sitting with.
            </h1>
            <p className="text-lg max-w-xl" style={{ color: "var(--brand-ink-muted)" }}>
              Frameworks, reflections, and honest thinking for founders at the intersection of impact and income.
            </p>
          </motion.div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mt-10">
            {categories.map((cat, i) => (
              <span
                key={cat}
                className="font-mono-label px-4 py-1.5 rounded-sm cursor-pointer transition-all duration-200"
                style={{
                  background: i === 0 ? "var(--brand-green)" : "transparent",
                  color: i === 0 ? "var(--brand-cream)" : "var(--brand-ink-muted)",
                  border: "1.5px solid",
                  borderColor: i === 0 ? "var(--brand-green)" : "var(--border)",
                  fontSize: "0.62rem",
                }}
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="container">
        <hr className="section-rule" />
      </div>

      {/* Posts grid */}
      <section className="py-16" style={{ background: "var(--brand-cream)" }}>
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {journalPosts.map((post, i) => (
              <Link key={post.slug} href={`/journal/${post.slug}`}>
                <motion.article
                  className="card-lift rounded-sm overflow-hidden h-full flex flex-col"
                  style={{
                    background: "oklch(0.99 0.008 85)",
                    boxShadow: "0 2px 16px oklch(0.15 0.01 65 / 0.06)",
                    border: "1px solid var(--border)",
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.07 }}
                >
                  {post.featured && (
                    <div
                      className="px-6 py-2 font-mono-label"
                      style={{
                        background: "var(--brand-green)",
                        color: "var(--brand-cream)",
                        fontSize: "0.58rem",
                        letterSpacing: "0.12em",
                      }}
                    >
                      ★ Featured Entry
                    </div>
                  )}
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="tag-pill">{post.category}</span>
                    </div>
                    <h2
                      className="font-display font-semibold mb-2 leading-snug"
                      style={{ fontSize: "1.15rem", color: "var(--brand-ink)" }}
                    >
                      {post.title}
                    </h2>
                    <p
                      className="font-display italic text-sm mb-3"
                      style={{ color: "var(--brand-green)" }}
                    >
                      {post.subtitle}
                    </p>
                    <p
                      className="text-sm leading-relaxed mb-4 flex-1"
                      style={{ color: "var(--brand-ink-muted)" }}
                    >
                      {post.excerpt}
                    </p>
                    <div
                      className="flex items-center justify-between mt-auto pt-4"
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <span className="font-mono-label" style={{ color: "var(--brand-ink-muted)", fontSize: "0.58rem" }}>
                        {post.date}
                      </span>
                      <div
                        className="flex items-center gap-1 font-mono-label group"
                        style={{ color: "var(--brand-orange)", fontSize: "0.58rem" }}
                      >
                        {post.readTime}
                        <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </motion.article>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
