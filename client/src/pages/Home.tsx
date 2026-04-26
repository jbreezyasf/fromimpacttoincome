/*
 * DESIGN: Signal & Noise — Warm editorial, forest green + burnt orange + cream
 * Home: Full-bleed hero with left-anchored text, featured post, journal grid preview
 */
import { Link } from "wouter";
import { ArrowRight, BookOpen, Mic } from "lucide-react";
import Layout from "@/components/Layout";
import { getMostRecentPost, getSortedPosts } from "@/lib/journal-data";
import { motion } from "framer-motion";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663029871813/NLdW3NYdfwKAqCQQ2BmWFs/hero-bg-W7CrqvEnVR2d9kvpPoTNWj.webp";
const JOURNAL_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663029871813/NLdW3NYdfwKAqCQQ2BmWFs/journal-feature-WHgjhuStGBBkyP3xGBBNyc.webp";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
        transition: { duration: 0.55, delay: i * 0.1 },
  }),
};

// Always reflects the newest entry — no manual flag needed.
// When you add a new post with a later dateISO, this updates automatically.
const featured = getMostRecentPost();
const recentPosts = getSortedPosts()
  .filter((p) => p.slug !== featured.slug)
  .slice(0, 3);

export default function Home() {
  return (
    <Layout>
      {/* ── HERO ── */}
      <section
        className="relative min-h-[92vh] flex items-center overflow-hidden"
        style={{ background: "var(--brand-cream)" }}
      >
        {/* Background image — right side */}
        <div
          className="absolute inset-y-0 right-0 w-full md:w-3/5 pointer-events-none"
          style={{
            backgroundImage: `url(${HERO_BG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.22,
          }}
        />
        {/* Gradient fade from left */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, var(--brand-cream) 40%, transparent 80%)",
          }}
        />

        <div className="container relative z-10">
          <div className="max-w-2xl">
            {/* Eyebrow */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0}
              className="mb-6"
            >
              <span className="tag-pill-outline">A Journal for Founders</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={1}
              className="font-display font-bold leading-[1.05] mb-6"
              style={{
                fontSize: "clamp(2.8rem, 6vw, 5.5rem)",
                color: "var(--brand-ink)",
                letterSpacing: "-0.02em",
              }}
            >
              You don't have to{" "}
              <span
                className="italic"
                style={{ color: "var(--brand-green)" }}
              >
                choose
              </span>{" "}
              between impact{" "}
              <span style={{ color: "var(--brand-orange)" }}>and</span> income.
            </motion.h1>

            {/* Sub */}
            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={2}
              className="text-lg leading-relaxed mb-10 max-w-lg"
              style={{ color: "var(--brand-ink-muted)" }}
            >
              A journal at the intersection of purpose and profit — for founders
              building businesses that matter and learning to make them pay.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={3}
              className="flex flex-wrap gap-4"
            >
              <Link href="/journal">
                <button
                  className="flex items-center gap-2 px-6 py-3 font-mono-label transition-all duration-200 hover:opacity-90 active:scale-95"
                  style={{
                    background: "var(--brand-green)",
                    color: "var(--brand-cream)",
                    borderRadius: "4px",
                    fontSize: "0.7rem",
                    letterSpacing: "0.1em",
                  }}
                >
                  <BookOpen size={14} />
                  Read the Journal
                </button>
              </Link>
              <Link href="/about">
                <button
                  className="flex items-center gap-2 px-6 py-3 font-mono-label transition-all duration-200 hover:bg-opacity-10 active:scale-95"
                  style={{
                    border: "1.5px solid var(--brand-green)",
                    color: "var(--brand-green)",
                    borderRadius: "4px",
                    fontSize: "0.7rem",
                    letterSpacing: "0.1em",
                    background: "transparent",
                  }}
                >
                  About This Project
                  <ArrowRight size={13} />
                </button>
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          <div
            className="w-px h-10 animate-pulse"
            style={{ background: "var(--brand-green)" }}
          />
        </motion.div>
      </section>

      {/* ── FEATURED POST ── */}
      <section className="py-20" style={{ background: "oklch(0.96 0.012 85)" }}>
        <div className="container">
          <div className="flex items-center gap-4 mb-10">
            <hr className="section-rule flex-1" />
            <span className="font-mono-label" style={{ color: "var(--brand-orange)" }}>
              Featured
            </span>
          </div>

          <Link href={`/journal/${featured.slug}`}>
            <motion.div
              className="grid grid-cols-1 md:grid-cols-5 gap-0 rounded-sm overflow-hidden card-lift cursor-pointer"
              style={{
                background: "var(--brand-cream)",
                boxShadow: "0 4px 24px oklch(0.15 0.01 65 / 0.07)",
              }}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              {/* Image */}
              <div
                className="md:col-span-2 min-h-[260px] md:min-h-[380px]"
                style={{
                  backgroundImage: `url(${JOURNAL_IMG})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              {/* Content */}
              <div className="md:col-span-3 p-8 md:p-12 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-5">
                  <span className="tag-pill">{featured.category}</span>
                  <span className="font-mono-label" style={{ color: "var(--brand-ink-muted)", fontSize: "0.6rem" }}>
                    {featured.date} · {featured.readTime}
                  </span>
                </div>
                <h2
                  className="font-display font-bold mb-3 leading-tight"
                  style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)", color: "var(--brand-ink)" }}
                >
                  {featured.title}
                </h2>
                <p
                  className="font-display italic mb-4 text-base"
                  style={{ color: "var(--brand-green)" }}
                >
                  {featured.subtitle}
                </p>
                <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--brand-ink-muted)" }}>
                  {featured.excerpt}
                </p>
                <div
                  className="flex items-center gap-2 font-mono-label group"
                  style={{ color: "var(--brand-orange)", fontSize: "0.68rem" }}
                >
                  Read Full Entry
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </motion.div>
          </Link>
        </div>
      </section>

      {/* ── RECENT JOURNAL ENTRIES ── */}
      <section className="py-20" style={{ background: "var(--brand-cream)" }}>
        <div className="container">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="font-mono-label mb-2" style={{ color: "var(--brand-orange)" }}>
                Recent Entries
              </div>
              <h2
                className="font-display font-bold leading-tight"
                style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", color: "var(--brand-ink)" }}
              >
                From the Journal
              </h2>
            </div>
            <Link href="/journal">
              <span
                className="hidden sm:flex items-center gap-2 font-mono-label link-underline"
                style={{ color: "var(--brand-green)", fontSize: "0.68rem" }}
              >
                All entries <ArrowRight size={12} />
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentPosts.map((post, i) => (
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
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                >
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="tag-pill-outline">{post.category}</span>
                    </div>
                    <h3
                      className="font-display font-semibold mb-2 leading-snug"
                      style={{ fontSize: "1.15rem", color: "var(--brand-ink)" }}
                    >
                      {post.title}
                    </h3>
                    <p
                      className="text-sm leading-relaxed mb-4 flex-1"
                      style={{ color: "var(--brand-ink-muted)" }}
                    >
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between mt-auto pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                      <span className="font-mono-label" style={{ color: "var(--brand-ink-muted)", fontSize: "0.58rem" }}>
                        {post.date}
                      </span>
                      <span className="font-mono-label" style={{ color: "var(--brand-orange)", fontSize: "0.58rem" }}>
                        {post.readTime}
                      </span>
                    </div>
                  </div>
                </motion.article>
              </Link>
            ))}
          </div>

          <div className="mt-8 sm:hidden text-center">
            <Link href="/journal">
              <span
                className="font-mono-label"
                style={{ color: "var(--brand-green)", fontSize: "0.68rem" }}
              >
                View all entries →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── PODCAST TEASER ── */}
      <section
        className="py-20 relative overflow-hidden"
        style={{ background: "var(--brand-green)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `url(${HERO_BG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="container relative z-10">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-5">
              <Mic size={18} style={{ color: "var(--brand-orange-light, oklch(0.72 0.12 55))" }} />
              <span className="font-mono-label" style={{ color: "var(--brand-orange-light, oklch(0.72 0.12 55))" }}>
                Coming Soon
              </span>
            </div>
            <h2
              className="font-display font-bold leading-tight mb-4"
              style={{
                fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
                color: "var(--brand-cream)",
              }}
            >
              The Podcast is Taking Shape
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "oklch(0.82 0.015 85)" }}>
              Real conversations with founders navigating the intersection of impact and income. No fluff, no highlight reels — just honest talk about what it actually takes.
            </p>
            <Link href="/podcast">
              <button
                className="flex items-center gap-2 px-6 py-3 font-mono-label transition-all duration-200 hover:opacity-90 active:scale-95"
                style={{
                  background: "var(--brand-orange)",
                  color: "var(--brand-cream)",
                  borderRadius: "4px",
                  fontSize: "0.7rem",
                  letterSpacing: "0.1em",
                }}
              >
                Stay in the Loop
                <ArrowRight size={13} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── MANIFESTO STRIP ── */}
      <section className="py-16" style={{ background: "var(--brand-cream)" }}>
        <div className="container">
          <div className="rule-left max-w-2xl">
            <p
              className="font-display italic leading-relaxed"
              style={{
                fontSize: "clamp(1.1rem, 2.2vw, 1.5rem)",
                color: "var(--brand-ink)",
              }}
            >
              "The founders who will matter most in the next decade are the ones
              who figured out that building well and doing good are not competing
              priorities — they're compounding ones."
            </p>
            <div className="mt-4 font-mono-label" style={{ color: "var(--brand-orange)", fontSize: "0.62rem" }}>
              From Impact to Income
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
