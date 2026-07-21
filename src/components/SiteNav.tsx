'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import ThemeToggle from './ThemeToggle'
import BloomMark from './BloomMark'

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
