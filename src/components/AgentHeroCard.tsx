'use client'

import { useEffect, useState } from 'react'
import { Sparkles, CheckCircle2, CalendarClock } from 'lucide-react'

const LINES = [
  {
    label: 'Instagram caption',
    text: "Rainy Monday? We've got you. All lattes are $1 off until noon, the cozy corner is open, and today's playlist is pure jazz. Bring someone who needs a slow morning.",
  },
  {
    label: 'Newsletter subject line',
    text: 'Your week just got 90 minutes lighter',
  },
  {
    label: 'Google Business post',
    text: 'New autumn menu is live: maple oat latte, pumpkin loaf, and a $6 soup-and-coffee combo. Open until 6pm all week. Come warm up.',
  },
]

export default function AgentHeroCard() {
  const [lineIdx, setLineIdx] = useState(0)
  const [chars, setChars] = useState(0)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useEffect(() => {
    // A setTimeout typewriter is JS, so the reduced-motion CSS block cannot stop
    // it. Show the finished text and never cycle.
    if (reduced) {
      setChars(LINES[lineIdx].text.length)
      return
    }
    const line = LINES[lineIdx]
    if (chars < line.text.length) {
      const t = setTimeout(() => setChars((c) => c + 1), 22)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setChars(0)
      setLineIdx((i) => (i + 1) % LINES.length)
    }, 1900)
    return () => clearTimeout(t)
  }, [chars, lineIdx, reduced])

  const line = LINES[lineIdx]
  const typed = line.text.slice(0, chars)
  const complete = chars >= line.text.length

  return (
    <div className="glass relative rounded-2xl shadow-xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-coral/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-accent-peach" />
          <span className="w-2.5 h-2.5 rounded-full bg-brand-emerald/70" />
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-emerald opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-emerald" />
          </span>
          Bloom agent · running
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-teal-text bg-brand-teal/10 px-2.5 py-1 rounded-full mb-3">
        <Sparkles className="w-3 h-3" />
        {line.label}
      </div>

      <p className="min-h-[7.5rem] sm:min-h-[6.5rem] text-[15px] leading-relaxed text-foreground">
        {typed}
        {!complete && <span className="caret" />}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        {complete ? (
          <span className="inline-flex items-center gap-1.5 text-brand-emerald font-medium">
            <CheckCircle2 className="w-4 h-4" /> Ready to publish
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted font-medium font-mono">Writing…</span>
        )}
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1.5 text-muted font-mono">
          <CalendarClock className="w-3.5 h-3.5" />
          Newsletter queued · Monday 9:00am
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted">
        <span>gemini-2.5-flash</span>
        <span>~1,240 tokens · 3.1s</span>
      </div>
    </div>
  )
}
