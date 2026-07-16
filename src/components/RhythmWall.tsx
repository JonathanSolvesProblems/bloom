'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A page of the appointment book.
 *
 * Each row is one client. Each tick is one visit. The space after the last tick
 * is how long they have been gone. That is the entire product, drawn.
 *
 * The argument the picture makes, which no headline can make as fast: AISHA and
 * JANE were both last in 44 days ago. Their gaps are the SAME WIDTH. But Aisha's
 * ticks are far apart, so her gap looks like her normal spacing and she is fine.
 * Jane's ticks are tight, so the identical gap is visibly double her rhythm and
 * she is going. Any rule of the form "flag anyone past 60 days" treats these two
 * rows identically and is wrong about one of them. You can see that in about a
 * second, without reading anything.
 *
 * The motion is the same argument in time: every row draws at its OWN tempo, so
 * you watch fast rhythms and slow rhythms fill the page at different speeds
 * before anything is flagged.
 */

const WINDOW_DAYS = 250

type Row = {
  name: string
  /** Days between visits. The row's tempo, and the thing risk is judged against. */
  cadence: number
  /** Days since the last visit. */
  gap: number
  state: 'ok' | 'slipping' | 'first'
  /** Shown at the right of the row once the row has finished drawing. */
  note: string
}

const ROWS: Row[] = [
  { name: 'Priya R.', cadence: 35, gap: 28, state: 'ok', note: 'on rhythm' },
  // The matched pair. Same gap, opposite verdicts, and the only difference is
  // the spacing of their own ticks.
  { name: 'Aisha B.', cadence: 56, gap: 44, state: 'ok', note: 'on rhythm' },
  { name: 'Jane W.', cadence: 28, gap: 44, state: 'slipping', note: '44 days' },
  { name: 'Marcus D.', cadence: 21, gap: 44, state: 'slipping', note: '44 days' },
  { name: 'Elena S.', cadence: 35, gap: 47, state: 'ok', note: 'drifting' },
  // Came once and never rebooked. One tick, then nothing. The cliff.
  { name: 'Nina K.', cadence: 0, gap: 18, state: 'first', note: '12 days left' },
  { name: 'Freda L.', cadence: 0, gap: 3, state: 'first', note: 'too early' },
]

/** Visit days-ago for a row, newest first, back to the edge of the window. */
function visits(row: Row): number[] {
  if (row.cadence <= 0) return [row.gap]
  const out: number[] = []
  for (let d = row.gap; d <= WINDOW_DAYS; d += row.cadence) out.push(d)
  return out
}

const pct = (daysAgo: number) => ((WINDOW_DAYS - daysAgo) / WINDOW_DAYS) * 100

export default function RhythmWall() {
  const ref = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)
  const [instant, setInstant] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInstant(true)
      setStarted(true)
      return
    }
    const el = ref.current
    if (!el) return
    // Draw when it is actually looked at, not on mount behind the fold.
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setStarted(true)),
      { threshold: 0.25 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className="select-none">
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-ink">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          Appointment book · last 8 months
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">Today</span>
      </div>

      <div className="space-y-0">
        {ROWS.map((row, i) => (
          <RhythmRow key={row.name} row={row} index={i} started={started} instant={instant} />
        ))}
      </div>

      <p className="mt-4 pt-3 border-t border-rule font-mono text-[10px] leading-relaxed text-ink-soft">
        Aisha and Jane were both last in 44 days ago.
        <br />
        Only one of them is leaving.
      </p>
    </div>
  )
}

function RhythmRow({ row, index, started, instant }: { row: Row; index: number; started: boolean; instant: boolean }) {
  const days = visits(row)
  // Oldest tick first, so the row inks in left to right the way it was written.
  const ordered = [...days].reverse()

  // Each row runs at its own tempo: a 21-day regular fills faster than a 56-day
  // one. The eye reads that as rhythm before it reads any of the labels.
  const tickMs = Math.max(45, row.cadence * 2.6)
  const rowDelay = index * 90
  const drawnMs = rowDelay + ordered.length * tickMs
  const [marked, setMarked] = useState(instant)

  useEffect(() => {
    if (instant || !started) return
    const t = setTimeout(() => setMarked(true), drawnMs + 260)
    return () => clearTimeout(t)
  }, [started, drawnMs, instant])

  const isAlarm = row.state === 'slipping' || (row.state === 'first' && row.gap > 7)
  const showRing = marked && isAlarm

  return (
    <div className="relative grid grid-cols-[4.5rem_1fr_4.5rem] sm:grid-cols-[5.5rem_1fr_5rem] items-center gap-2 h-8 border-b border-rule">
      <span
        className={`font-mono text-[11px] truncate transition-colors duration-300 ${
          showRing ? 'text-pencil font-semibold' : 'text-ink-soft'
        }`}
      >
        {row.name}
      </span>

      <div className="relative h-full">
        {/* The line the visits are written on. */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-rule" />

        {ordered.map((d, i) => (
          <span
            key={d}
            className="absolute top-1/2 -translate-y-1/2 w-px bg-ink"
            style={{
              left: `${pct(d)}%`,
              height: row.state === 'first' ? 15 : 11,
              transformOrigin: 'center',
              opacity: started ? undefined : 0,
              animation: instant
                ? 'none'
                : started
                  ? `inkTick 0.24s cubic-bezier(0.3,1.5,0.5,1) ${rowDelay + i * tickMs}ms both`
                  : 'none',
            }}
          />
        ))}

        {/* The gap. Not drawn, just left empty, which is the point: the thing
            that costs the money is the absence of a mark. */}
        {showRing && (
          <svg
            className="circle-mark absolute inset-0 w-full h-full overflow-visible pointer-events-none"
            // x runs 0-100 so the path can be written in the same percentage
            // space as the ticks; y is the 32px row. Stretching the box would
            // distort the stroke, hence non-scaling-stroke on the path.
            viewBox="0 0 100 32"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d={ring(pct(row.gap))}
              fill="none"
              stroke="var(--pencil)"
              strokeWidth="1.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>

      <span
        className={`font-mono text-[10px] text-right transition-opacity duration-500 ${
          marked ? 'opacity-100' : 'opacity-0'
        } ${isAlarm ? 'text-pencil' : 'text-ink-soft'}`}
      >
        {row.note}
      </span>
    </div>
  )
}

/**
 * A hand-drawn ring around the empty space between the last visit and today.
 * Built from two arcs that overshoot where they meet, because a ring drawn in one
 * motion never closes cleanly, and a perfect ellipse would look printed.
 */
function ring(fromPct: number): string {
  const x1 = fromPct
  const x2 = 100
  const cx = (x1 + x2) / 2
  const rx = Math.max((x2 - x1) / 2, 3)
  return [
    `M ${cx} 3`,
    `C ${cx - rx * 1.1} 2, ${cx - rx * 1.15} 29, ${cx} 29`,
    `C ${cx + rx * 1.15} 30, ${cx + rx * 1.05} 3, ${cx - rx * 0.15} 4.5`,
  ].join(' ')
}
