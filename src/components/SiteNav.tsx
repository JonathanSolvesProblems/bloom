'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import ThemeToggle from './ThemeToggle'

/**
 * The mark is the product, and the product is called Bloom.
 *
 * A stem with three blooms on it at an even beat, and a fourth that has dropped:
 * the petal is falling away and only the calyx is left. It is the homepage wall
 * shrunk to 32px, so the logo states the thesis rather than decorating it, and
 * it is the one moment the two inks appear together.
 *
 * The old mark was a generic emerald app-icon flower that could have belonged to
 * any product on earth.
 */
function BloomMark() {
  // Four petals held, one dropped. A rhythm of blooms would have been truer to
  // the wall, but three flowers at 28px collapse into a blob: at this size the
  // mark has to be one idea, and "a bloom losing a petal" is still the thesis.
  const held = [0, 72, 144, 288]
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7 shrink-0" aria-hidden>
      <g transform="translate(13 13)">
        <g fill="none" stroke="var(--ink)" strokeWidth="1.7" strokeLinejoin="round">
          {held.map((deg) => (
            <ellipse key={deg} cx="0" cy="-6" rx="3.2" ry="5" transform={`rotate(${deg})`} />
          ))}
        </g>
        <circle r="2.3" fill="var(--ink)" />
      </g>
      {/* The one that came off, mid-fall. The only pink in the mark. */}
      <ellipse cx="24" cy="24" rx="2.9" ry="4.6" fill="var(--pencil)" transform="rotate(34 24 24)" />
    </svg>
  )
}

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-200 ${
        scrolled ? 'bg-[var(--paper)] border-b border-ink' : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <BloomMark />
          <span className="font-display font-bold text-foreground text-lg tracking-tight">Bloom</span>
        </Link>
        <nav className="flex items-center gap-6">
          <a href="#how-it-works" className="text-sm text-muted hover:text-foreground transition-colors hidden sm:block">
            How it works
          </a>
          <a href="#proof" className="text-sm text-muted hover:text-foreground transition-colors hidden sm:block">
            The agent
          </a>
          <a href="#pricing" className="text-sm text-muted hover:text-foreground transition-colors hidden sm:block">
            Pricing
          </a>
          <ThemeToggle />
          <Link href="/setup" className="btn-primary text-sm py-2 px-4">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  )
}
