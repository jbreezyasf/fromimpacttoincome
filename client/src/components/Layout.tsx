/*
 * DESIGN: Signal & Noise — Warm editorial, forest green + burnt orange + cream
 * Layout: Sticky top nav, full-width footer with left-anchored brand mark
 */
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Journal", href: "/journal" },
  { label: "About", href: "/about" },
  { label: "Podcast", href: "/podcast" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--brand-cream)" }}>
      {/* NAV */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "oklch(0.975 0.012 85 / 0.96)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid oklch(0.88 0.018 85)" : "1px solid transparent",
        }}
      >
        <div className="container">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <Link href="/">
              <div className="flex flex-col leading-none group">
                <span
                  className="font-display font-bold text-lg tracking-tight"
                  style={{ color: "var(--brand-green)" }}
                >
                  From Impact
                </span>
                <span
                  className="font-display font-light italic text-sm"
                  style={{ color: "var(--brand-orange)" }}
                >
                  to Income
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span
                    className="font-mono-label link-underline transition-colors"
                    style={{
                      color: location === link.href ? "var(--brand-green)" : "var(--brand-ink-muted)",
                      fontWeight: location === link.href ? "600" : "400",
                    }}
                  >
                    {link.label}
                  </span>
                </Link>
              ))}
              <Link href="/journal">
                <span
                  className="font-mono-label px-4 py-2 rounded-sm transition-all duration-200"
                  style={{
                    background: "var(--brand-green)",
                    color: "var(--brand-cream)",
                    fontSize: "0.65rem",
                    letterSpacing: "0.1em",
                  }}
                >
                  Read Latest
                </span>
              </Link>
            </nav>

            {/* Mobile toggle */}
            <button
              className="md:hidden p-2 rounded"
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{ color: "var(--brand-green)" }}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div
            className="md:hidden border-t"
            style={{
              background: "oklch(0.975 0.012 85 / 0.98)",
              borderColor: "var(--border)",
            }}
          >
            <div className="container py-4 flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span
                    className="font-mono-label block py-2"
                    style={{ color: "var(--brand-green)" }}
                  >
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* PAGE CONTENT */}
      <main className="flex-1 pt-16">{children}</main>

      {/* FOOTER */}
      <footer
        style={{
          background: "var(--brand-green-dark, oklch(0.18 0.06 155))",
          color: "oklch(0.85 0.015 85)",
        }}
      >
        <div className="container py-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Brand column */}
            <div className="md:col-span-2">
              <div className="mb-4">
                <div className="font-display font-bold text-2xl" style={{ color: "var(--brand-cream)" }}>
                  From Impact to Income
                </div>
                <div className="font-display italic text-base mt-1" style={{ color: "var(--brand-orange-light, oklch(0.72 0.12 55))" }}>
                  For founders who refuse to choose.
                </div>
              </div>
              <p className="text-sm leading-relaxed max-w-sm" style={{ color: "oklch(0.72 0.015 85)" }}>
                A journal at the intersection of purpose and profit. Ideas, frameworks, and honest reflections for founders building businesses that matter.
              </p>
            </div>

            {/* Links column */}
            <div>
              <div className="font-mono-label mb-4" style={{ color: "var(--brand-orange-light, oklch(0.72 0.12 55))" }}>
                Navigate
              </div>
              <div className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href}>
                    <span className="text-sm link-underline" style={{ color: "oklch(0.72 0.015 85)" }}>
                      {link.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <hr className="my-8 border-none" style={{ height: "1px", background: "oklch(1 0 0 / 0.1)" }} />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="font-mono-label" style={{ color: "oklch(0.55 0.01 85)", fontSize: "0.6rem" }}>
              © {new Date().getFullYear()} From Impact to Income — All rights reserved
            </span>
            <span className="font-mono-label" style={{ color: "oklch(0.55 0.01 85)", fontSize: "0.6rem" }}>
              Built for founders. Written with intention.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
