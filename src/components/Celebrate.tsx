'use client'

import { useEffect, useState } from 'react'

const COLORS = ['#059669', '#10b981', '#22d3ee', '#f59e0b', '#8b5cf6']
const PIECES = 44
/** Longest fall plus longest delay, after which the DOM nodes are pointless. */
const LIFETIME_MS = 2600

type Piece = { id: number; x: number; dx: number; dy: number; rot: number; dur: number; delay: number; c: string }

function build(): Piece[] {
  return Array.from({ length: PIECES }, (_, id) => ({
    id,
    x: Math.random() * 100,
    // Drift outward from wherever it spawned, so the burst spreads instead of
    // falling in a curtain.
    dx: (Math.random() - 0.5) * 220,
    dy: 160 + Math.random() * 220,
    rot: Math.random() * 720 - 360,
    dur: 1.5 + Math.random() * 0.9,
    delay: Math.random() * 0.25,
    c: COLORS[id % COLORS.length],
  }))
}

/**
 * A one-shot confetti burst over its container. Mounts, plays once, and removes
 * itself: it is a moment, not a state, and leaving 44 absolutely-positioned
 * nodes parked on the page afterwards would be litter.
 *
 * Motion is CSS-driven so the global reduced-motion block can switch it off.
 */
export default function Celebrate() {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    // Built in the effect, never during render: Math.random() on the server would
    // disagree with the client and hydration would blow up.
    setPieces(build())
    const t = setTimeout(() => setPieces([]), LIFETIME_MS)
    return () => clearTimeout(t)
  }, [])

  if (!pieces.length) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={
            {
              '--x': `${p.x}%`,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rot}deg`,
              '--dur': `${p.dur}s`,
              '--delay': `${p.delay}s`,
              '--c': p.c,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
