/*
 * DESIGN: Signal & Noise — Warm editorial, forest green + burnt orange + cream
 * About: Left-anchored text with texture background, manifesto-style content
 */
import Layout from "@/components/Layout";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const TEXTURE_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663029871813/NLdW3NYdfwKAqCQQ2BmWFs/about-texture-gQZ7m7nYyTQyiDDQPtD2eN.webp";

export default function About() {
  return (
    <Layout>
      {/* Header */}
      <section
        className="relative py-24 overflow-hidden"
        style={{ background: "var(--brand-green)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${TEXTURE_BG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.12,
          }}
        />
        <div className="container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-2xl"
          >
            <span className="tag-pill mb-6 inline-block" style={{ background: "var(--brand-orange)" }}>
              About
            </span>
            <h1
              className="font-display font-bold leading-tight mb-6"
              style={{
                fontSize: "clamp(2.2rem, 5vw, 4rem)",
                color: "var(--brand-cream)",
                letterSpacing: "-0.02em",
              }}
            >
              This is a journal about the work that matters.
            </h1>
            <p
              className="text-lg leading-relaxed"
              style={{ color: "oklch(0.82 0.015 85)" }}
            >
              And the income that makes it sustainable.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main content */}
      <section className="py-20" style={{ background: "var(--brand-cream)" }}>
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Main text */}
            <motion.div
              className="lg:col-span-7"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="rule-left mb-10">
                <h2
                  className="font-display font-semibold"
                  style={{ fontSize: "1.5rem", color: "var(--brand-ink)" }}
                >
                  The premise is simple.
                </h2>
              </div>

              <div className="prose-style space-y-6" style={{ color: "var(--brand-ink-muted)" }}>
                <p className="text-base leading-relaxed">
                  Somewhere along the way, impact-driven founders got handed a story: that doing good and doing well are in tension. That if you really care about your mission, you shouldn't care too much about money. That profit is a compromise.
                </p>
                <p className="text-base leading-relaxed">
                  I don't believe that story. And I think it's done a lot of damage.
                </p>
                <p className="text-base leading-relaxed">
                  The founders who create the most lasting impact are the ones who built financially healthy businesses. Not because money was the goal — but because sustainability is the prerequisite for everything else. You can't serve your mission from a position of scarcity.
                </p>
                <p className="text-base leading-relaxed">
                  <em className="font-display" style={{ color: "var(--brand-ink)" }}>From Impact to Income</em> is a journal about navigating that intersection. It's about the mindset shifts, the business decisions, the frameworks, and the honest reflections that help founders build businesses that are both meaningful and financially strong.
                </p>
                <p className="text-base leading-relaxed">
                  It's also a place where I think out loud about where this is all going — the role of AI in founder workflows, the future of purpose-driven business, and what it actually looks like to build something that lasts.
                </p>
              </div>

              <div className="mt-12">
                <div className="rule-left">
                  <p
                    className="font-display italic text-xl leading-snug"
                    style={{ color: "var(--brand-ink)" }}
                  >
                    "Impact is the direction. Income is the engine. You need both — and you shouldn't have to apologize for either."
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Sidebar */}
            <motion.div
              className="lg:col-span-4 lg:col-start-9"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              {/* What you'll find */}
              <div
                className="p-7 rounded-sm mb-6"
                style={{
                  background: "oklch(0.96 0.012 85)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="font-mono-label mb-5" style={{ color: "var(--brand-orange)" }}>
                  What You'll Find Here
                </div>
                <ul className="space-y-4">
                  {[
                    { label: "Mindset", desc: "The mental models that separate thriving founders from struggling ones" },
                    { label: "Strategy", desc: "Practical frameworks for pricing, positioning, and growth" },
                    { label: "AI & Tools", desc: "How to use emerging tools without losing your edge" },
                    { label: "Honest Reflection", desc: "The stuff most founders don't talk about publicly" },
                  ].map((item) => (
                    <li key={item.label} className="flex gap-3">
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                        style={{ background: "var(--brand-orange)" }}
                      />
                      <div>
                        <div className="font-mono-label mb-0.5" style={{ color: "var(--brand-green)", fontSize: "0.62rem" }}>
                          {item.label}
                        </div>
                        <div className="text-sm" style={{ color: "var(--brand-ink-muted)" }}>
                          {item.desc}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div
                className="p-7 rounded-sm"
                style={{
                  background: "var(--brand-green)",
                }}
              >
                <div className="font-mono-label mb-3" style={{ color: "var(--brand-orange-light, oklch(0.72 0.12 55))" }}>
                  Start Reading
                </div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "oklch(0.82 0.015 85)" }}>
                  The journal is where the thinking lives. Start with the most recent entry or browse by topic.
                </p>
                <Link href="/journal">
                  <button
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 font-mono-label transition-all duration-200 hover:opacity-90"
                    style={{
                      background: "var(--brand-orange)",
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
            </motion.div>
          </div>
        </div>
      </section>

      {/* Podcast section */}
      <section className="py-16" style={{ background: "oklch(0.96 0.012 85)" }}>
        <div className="container">
          <div className="max-w-2xl">
            <span className="tag-pill-outline mb-4 inline-block">On the Horizon</span>
            <h2
              className="font-display font-bold mb-4 leading-tight"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)", color: "var(--brand-ink)" }}
            >
              The Podcast Direction
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: "var(--brand-ink-muted)" }}>
              This journal may evolve into a podcast — or it may stay a journal, or become both. The direction is still taking shape, and that's intentional. What I know for certain is that the conversation needs to happen. The format will follow the content.
            </p>
            <Link href="/podcast">
              <span
                className="flex items-center gap-2 font-mono-label link-underline w-fit"
                style={{ color: "var(--brand-green)", fontSize: "0.68rem" }}
              >
                Learn more about the podcast <ArrowRight size={12} />
              </span>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
