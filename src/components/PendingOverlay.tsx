'use client'

import { useEffect, useState } from 'react'

/**
 * A full-screen "working" state, shown while something that takes a few seconds is
 * in flight: creating an account, drafting a note, reading a book.
 *
 * The test video showed these waits happening with no feedback at all, so a click
 * felt broken. This gives the wait a face: the bloom pulses, and the message says
 * what is actually happening. When more than one message is passed it steps
 * through them, but only over honest stages (reading, then writing), never faked.
 */
export default function PendingOverlay({ messages }: { messages: string | string[] }) {
  const list = Array.isArray(messages) ? messages : [messages]
  const [i, setI] = useState(0)

  useEffect(() => {
    if (list.length < 2) return
    // Advance but hold on the last message, since we do not know exactly when the
    // navigation will land and do not want to loop back to the start.
    const t = setInterval(() => setI((n) => Math.min(n + 1, list.length - 1)), 1500)
    return () => clearInterval(t)
  }, [list.length])

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-background/92 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
    >
      <svg viewBox="0 0 32 32" className="w-12 h-12 bloom-pulse" aria-hidden>
        <g transform="translate(13 13)">
          <g fill="none" stroke="var(--ink)" strokeWidth="1.7" strokeLinejoin="round">
            {[0, 72, 144, 288].map((deg) => (
              <ellipse key={deg} cx="0" cy="-6" rx="3.2" ry="5" transform={`rotate(${deg})`} />
            ))}
          </g>
          <circle r="2.3" fill="var(--ink)" />
        </g>
        <ellipse cx="24" cy="24" rx="2.9" ry="4.6" fill="var(--pencil)" transform="rotate(34 24 24)" />
      </svg>
      <p className="font-mono text-sm text-ink-soft">{list[i]}</p>
    </div>
  )
}
