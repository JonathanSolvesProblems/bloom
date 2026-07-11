'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

function currentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export default function ThemeToggle() {
  // Read the theme the pre-paint script already applied, so the correct icon
  // paints immediately instead of flashing the wrong one after hydration.
  const [theme, setTheme] = useState<'light' | 'dark'>(currentTheme)

  useEffect(() => {
    setTheme(currentTheme())
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    // Persist to a cookie so the SERVER renders the right theme on the next load
    // (the reliable part), and to localStorage so the pre-paint script agrees.
    // A year-long cookie, path-wide, lax so it rides normal navigations.
    document.cookie = `theme=${next};path=/;max-age=31536000;samesite=lax`
    try {
      localStorage.setItem('theme', next)
    } catch {
      /* storage unavailable (private mode) */
    }
    setTheme(next)
    const root = document.documentElement
    root.setAttribute('data-theme', next)
    root.style.colorScheme = next
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      suppressHydrationWarning
      className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted hover:text-foreground hover:border-brand-teal/50 transition-colors"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
