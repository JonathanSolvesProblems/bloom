'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import ThemeToggle from './ThemeToggle'

/**
 * The mark is the product: a rhythm of visits, and then the one that stops.
 *
 * Five ticks at an even beat, the last one missing and circled in pencil. It is
 * the same idea as the wall on the homepage, shrunk to 32px, and it means the
 * logo is a diagram rather than decoration. The old mark was a generic emerald
 * app-icon flower that could have belonged to any product on earth.
 */
function BloomMark() {
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7" aria-hidden>
      <g stroke="var(--ink)" strokeWidth="2" strokeLinecap="round">
        <line x1="3" y1="10" x2="3" y2="22" />
        <line x1="9" y1="10" x2="9" y2="22" />
        <line x1="15" y1="10" x2="15" y2="22" />
        <line x1="21" y1="10" x2="21" y2="22" />
      </g>
      {/* Where the fifth visit should have been. */}
      <ellipse cx="27.5" cy="16" rx="4" ry="6.5" fill="none" stroke="var(--pencil)" strokeWidth="1.6" />
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
