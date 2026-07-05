'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

function BloomMark() {
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#059669" />
      <g fill="#ffffff">
        <circle cx="22.5" cy="16" r="3.6" />
        <circle cx="19.25" cy="10.7" r="3.6" />
        <circle cx="12.75" cy="10.7" r="3.6" />
        <circle cx="9.5" cy="16" r="3.6" />
        <circle cx="12.75" cy="21.3" r="3.6" />
        <circle cx="19.25" cy="21.3" r="3.6" />
      </g>
      <circle cx="16" cy="16" r="3.8" fill="#fdba8c" />
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
      className={`sticky top-0 z-50 transition-all duration-200 ${
        scrolled ? 'bg-white/70 backdrop-blur-md border-b border-border shadow-sm' : 'bg-transparent border-b border-transparent'
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
          <Link href="/setup" className="btn-primary text-sm py-2 px-4">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  )
}
