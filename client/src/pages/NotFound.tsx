import Layout from "@/components/Layout";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <Layout>
      <section
        className="min-h-[70vh] flex items-center"
        style={{ background: "var(--brand-cream)" }}
      >
        <div className="container">
          <div className="max-w-lg">
            <div
              className="font-display font-bold mb-4 leading-none"
              style={{
                fontSize: "clamp(5rem, 15vw, 12rem)",
                color: "oklch(0.90 0.015 85)",
                letterSpacing: "-0.04em",
              }}
            >
              404
            </div>
            <h1
              className="font-display font-semibold mb-4"
              style={{ fontSize: "1.8rem", color: "var(--brand-ink)" }}
            >
              This page doesn't exist yet.
            </h1>
            <p className="text-base mb-8" style={{ color: "var(--brand-ink-muted)" }}>
              Maybe it's in the works. Maybe it never will be. Either way, the journal is a good place to start.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/">
                <button
                  className="flex items-center gap-2 px-5 py-2.5 font-mono-label transition-all duration-200 hover:opacity-90"
                  style={{
                    background: "var(--brand-green)",
                    color: "var(--brand-cream)",
                    borderRadius: "4px",
                    fontSize: "0.68rem",
                    letterSpacing: "0.1em",
                  }}
                >
                  <ArrowLeft size={12} />
                  Back Home
                </button>
              </Link>
              <Link href="/journal">
                <button
                  className="flex items-center gap-2 px-5 py-2.5 font-mono-label transition-all duration-200"
                  style={{
                    border: "1.5px solid var(--brand-green)",
                    color: "var(--brand-green)",
                    borderRadius: "4px",
                    fontSize: "0.68rem",
                    letterSpacing: "0.1em",
                    background: "transparent",
                  }}
                >
                  Read the Journal
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
