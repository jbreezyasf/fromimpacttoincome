/*
 * DESIGN: Signal & Noise — Warm editorial, forest green + burnt orange + cream
 * Podcast: Coming soon placeholder with email capture feel
 */
import Layout from "@/components/Layout";
import { Mic, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663029871813/NLdW3NYdfwKAqCQQ2BmWFs/hero-bg-W7CrqvEnVR2d9kvpPoTNWj.webp";

export default function Podcast() {
  return (
    <Layout>
      {/* Hero */}
      <section
        className="relative min-h-[70vh] flex items-center overflow-hidden"
        style={{ background: "var(--brand-green)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${HERO_BG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.1,
          }}
        />
        <div className="container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-2xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <Mic size={20} style={{ color: "var(--brand-orange-light, oklch(0.72 0.12 55))" }} />
              <span className="tag-pill" style={{ background: "var(--brand-orange)" }}>
                Coming Soon
              </span>
            </div>
            <h1
              className="font-display font-bold leading-tight mb-6"
              style={{
                fontSize: "clamp(2.2rem, 5vw, 4rem)",
                color: "var(--brand-cream)",
                letterSpacing: "-0.02em",
              }}
            >
              The Podcast is Taking Shape
            </h1>
            <p
              className="text-lg leading-relaxed mb-8"
              style={{ color: "oklch(0.82 0.015 85)" }}
            >
              Real conversations with founders navigating the intersection of impact and income. No highlight reels. No polished narratives. Just honest talk about what it actually takes to build something that matters — and make it pay.
            </p>
            <div
              className="rule-left"
              style={{ borderColor: "var(--brand-orange)" }}
            >
              <p
                className="font-display italic text-base"
                style={{ color: "oklch(0.75 0.015 85)" }}
              >
                The direction is still taking shape. What I know is that the conversation needs to happen. The format will follow.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What to expect */}
      <section className="py-20" style={{ background: "var(--brand-cream)" }}>
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="font-mono-label mb-3 block" style={{ color: "var(--brand-orange)" }}>
                The Vision
              </span>
              <h2
                className="font-display font-bold leading-tight mb-6"
                style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", color: "var(--brand-ink)" }}
              >
                Conversations that go where most podcasts don't.
              </h2>
              <div className="space-y-4 text-base leading-relaxed" style={{ color: "var(--brand-ink-muted)" }}>
                <p>
                  Most founder podcasts are highlight reels. Success stories told in retrospect, with all the messy parts smoothed over. That's not what this will be.
                </p>
                <p>
                  The conversations I want to have are about the decisions that don't have clean answers. The moments where impact and income actually conflict. The pivots that felt like failures before they became strategies.
                </p>
                <p>
                  If that sounds like a conversation you want to be part of — either as a guest or a listener — stay close.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="space-y-4"
            >
              {[
                {
                  num: "01",
                  title: "Founder Stories",
                  desc: "The real arc — not the polished version. What it took, what it cost, what it taught.",
                },
                {
                  num: "02",
                  title: "The Business of Impact",
                  desc: "How purpose-driven founders price, position, and grow without compromising their mission.",
                },
                {
                  num: "03",
                  title: "AI & The Founder Edge",
                  desc: "How the smartest founders are using emerging tools to do more of what only they can do.",
                },
                {
                  num: "04",
                  title: "The Honest Debrief",
                  desc: "Solo episodes. Unfiltered reflections on what I'm learning, unlearning, and figuring out.",
                },
              ].map((item) => (
                <div
                  key={item.num}
                  className="flex gap-5 p-5 rounded-sm"
                  style={{
                    background: "oklch(0.96 0.012 85)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="font-display font-bold text-2xl leading-none flex-shrink-0 mt-0.5"
                    style={{ color: "var(--brand-orange)", opacity: 0.5 }}
                  >
                    {item.num}
                  </div>
                  <div>
                    <div className="font-display font-semibold mb-1" style={{ color: "var(--brand-ink)" }}>
                      {item.title}
                    </div>
                    <div className="text-sm" style={{ color: "var(--brand-ink-muted)" }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA to journal */}
      <section
        className="py-16"
        style={{
          background: "oklch(0.96 0.012 85)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="container">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <h3
                className="font-display font-semibold mb-2"
                style={{ fontSize: "1.3rem", color: "var(--brand-ink)" }}
              >
                While the podcast takes shape, the journal is live.
              </h3>
              <p className="text-sm" style={{ color: "var(--brand-ink-muted)" }}>
                The thinking that will eventually become conversations — read it first.
              </p>
            </div>
            <Link href="/journal">
              <button
                className="flex items-center gap-2 px-6 py-3 font-mono-label transition-all duration-200 hover:opacity-90 flex-shrink-0"
                style={{
                  background: "var(--brand-green)",
                  color: "var(--brand-cream)",
                  borderRadius: "4px",
                  fontSize: "0.68rem",
                  letterSpacing: "0.1em",
                }}
              >
                Read the Journal
                <ArrowRight size={12} />
              </button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
