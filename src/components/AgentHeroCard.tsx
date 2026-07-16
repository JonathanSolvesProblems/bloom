'use client'

import { useEffect, useState } from 'react'
import { Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react'

/**
 * The hero visual has to show the thing the headline promises. It used to type out
 * Instagram captions, which was the old product and read as a contradiction next
 * to "the clients you are about to lose".
 *
 * So it shows one save, end to end: the verdict, the note, the result. The middle
 * line is real output from the model, kept verbatim rather than polished, because
 * the whole claim is that this is what an owner would actually send.
 */
const LINES = [
  {
    label: 'What I noticed',
    text: 'Jane comes in about every 28 days. It has been 44. She is not on holiday, she is drifting, and at $1,295 a year she is worth a two-line email.',
  },
  {
    label: 'What I wrote her',
    text: 'Hi Jane, I was thinking about your last cut and colour and how well it turned out. If you are due a refresh, I would love to get you back in the chair. Wildflower Studio',
  },
  {
    label: 'What happened',
    text: 'Jane booked for Thursday. That is one client, $1,295 a year, who was quietly on her way out the door.',
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
  const isVerdict = lineIdx === 0
  const isResult = lineIdx === 2

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
          Bloom agent · watching
        </div>
      </div>

      <div
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full mb-3 ${
          isVerdict ? 'text-red-500 bg-red-500/10' : 'text-brand-teal-text bg-brand-teal/10'
        }`}
      >
        {isVerdict ? <AlertTriangle className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
        {line.label}
      </div>

      <p className="min-h-[7.5rem] sm:min-h-[6.5rem] text-[15px] leading-relaxed text-foreground">
        {typed}
        {!complete && <span className="caret" />}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        {!complete ? (
          <span className="inline-flex items-center gap-1.5 text-muted font-medium font-mono">Thinking…</span>
        ) : isResult ? (
          <span className="inline-flex items-center gap-1.5 text-brand-emerald font-medium">
            <CheckCircle2 className="w-4 h-4" /> Won back
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-brand-emerald font-medium">
            <CheckCircle2 className="w-4 h-4" /> One client, one note
          </span>
        )}
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1.5 text-muted font-mono">28-day rhythm · 44 days out</span>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted">
        <span>gemini-2.5-flash</span>
        <span>~1,240 tokens · 3.1s</span>
      </div>
    </div>
  )
}
