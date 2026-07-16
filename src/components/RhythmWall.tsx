'use client'

import { useEffect, useRef, useState } from 'react'
import Bloom from './Bloom'

/**
 * The garden. One row per client, one bloom per visit, and the bare stem after
 * the last bloom is how long they have been gone.
 *
 * The argument the picture makes, which no headline can make as fast: AISHA and
 * JANE were both last in 44 days ago, so their bare stems are exactly the same
 * length. But Aisha flowers every 8 weeks, so that stretch is just her normal
 * spacing and she is fine. Jane flowers every 4 weeks, so the identical stretch
 * is double her rhythm and she is going. Any rule of the form "flag anyone past
 * 60 days" treats these two rows the same and is wrong about one of them. You can
 * see it in about a second, without reading anything.
 *
 * Motion carries the same argument: every row flowers at its OWN tempo, so fast
 * and slow rhythms fill the page at visibly different speeds. Then the stems of
 * the ones who are drifting go bare, and their petals start to drop.
 */

const WINDOW_DAYS = 250

type Row = {
  name: string
  /** Days between visits. The row's tempo, and what risk is judged against. */
  cadence: number
  /** Days since the last visit. */
  gap: number
  state: 'ok' | 'slipping' | 'first'
  note: string
}

const ROWS: Row[] = [
  { name: 'Priya R.', cadence: 35, gap: 28, state: 'ok', note: 'on rhythm' },
  // The matched pair. Same bare stem, opposite verdicts, and the only difference
  // is how far apart their own blooms sit.
  { name: 'Aisha B.', cadence: 56, gap: 44, state: 'ok', note: 'on rhythm' },
  { name: 'Jane W.', cadence: 28, gap: 44, state: 'slipping', note: '44 days' },
  { name: 'Marcus D.', cadence: 21, gap: 44, state: 'slipping', note: '44 days' },
  { name: 'Elena S.', cadence: 35, gap: 47, state: 'ok', note: 'drifting' },
  // Flowered once and never again. One bloom, then bare stem. The cliff.
  { name: 'Nina K.', cadence: 0, gap: 18, state: 'first', note: '12 days left' },
  { name: 'Freda L.', cadence: 0, gap: 3, state: 'first', note: 'too early' },
]

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
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setStarted(true)),
      { threshold: 0.2 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className="select-none">
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-ink">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          The book · last 8 months
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">Today</span>
      </div>

      <div>
        {ROWS.map((row, i) => (
          <GardenRow key={row.name} row={row} index={i} started={started} instant={instant} />
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

function GardenRow({ row, index, started, instant }: { row: Row; index: number; started: boolean; instant: boolean }) {
  const days = visits(row)
  // Oldest first, so the row flowers left to right the way it was lived.
  const ordered = [...days].reverse()

  // Each row runs at its own tempo. Capped so the whole wall resolves in about a
  // second and a half: the labels used to arrive so late that anyone glancing at
  // the page saw a half-empty grid and no verdicts at all.
  const tickMs = Math.min(90, Math.max(34, row.cadence * 1.5))
  const rowDelay = index * 55
  const drawnMs = rowDelay + ordered.length * tickMs
  const [marked, setMarked] = useState(instant)

  useEffect(() => {
    if (instant) {
      setMarked(true)
      return
    }
    if (!started) return
    const t = setTimeout(() => setMarked(true), drawnMs + 180)
    return () => clearTimeout(t)
  }, [started, drawnMs, instant])

  const isAlarm = row.state === 'slipping' || (row.state === 'first' && row.gap > 7)
  const show = marked && isAlarm
  const lastPct = pct(Math.min(row.gap, WINDOW_DAYS))

  return (
    <div className="relative grid grid-cols-[4.5rem_1fr_4.5rem] sm:grid-cols-[5.5rem_1fr_5rem] items-center gap-2 h-9 border-b border-rule">
      <span
        className={`font-mono text-[11px] truncate transition-colors duration-300 ${
          show ? 'text-pencil font-semibold' : 'text-ink-soft'
        }`}
      >
        {row.name}
      </span>

      <div className="relative h-full">
        {/* The stem they have already lived: green, because it happened. */}
        <div
          className="absolute top-1/2 h-px bg-leaf/45"
          style={{ left: 0, width: `${lastPct}%`, transformOrigin: 'left' }}
        />

        {/* The stem since their last bloom. It draws itself so you watch the gap
            open, and it is pink only when the gap has outgrown their rhythm. */}
        <div
          className={`absolute top-1/2 h-px ${show ? 'bg-pencil' : 'bg-leaf/45'}`}
          style={{
            left: `${lastPct}%`,
            right: 0,
            transformOrigin: 'left',
            animation: instant ? 'none' : started ? `stemWilt 0.5s ease-out ${drawnMs}ms both` : 'none',
          }}
        />

        {ordered.map((d, i) => {
          const isLast = i === ordered.length - 1
          const state = show && isLast ? 'fading' : 'full'
          return (
            // Two spans on purpose. The outer one does the centring, the inner one
            // does the animation: bloomOpen sets `transform`, which would silently
            // overwrite a translate(-50%,-50%) on the same element and leave every
            // flower hanging below and right of its own stem.
            <span
              key={d}
              className="absolute top-1/2 leading-none"
              style={{ left: `${pct(d)}%`, transform: 'translate(-50%, -50%)' }}
            >
              <span
                className="block"
                style={{
                  opacity: started ? undefined : 0,
                  animation: instant
                    ? 'none'
                    : started
                      ? `bloomOpen 0.34s cubic-bezier(0.3,1.5,0.5,1) ${rowDelay + i * tickMs}ms both`
                      : 'none',
                }}
              >
                <Bloom size={11} state={state} color={show && isLast ? 'var(--pencil)' : 'var(--ink)'} />
              </span>
            </span>
          )
        })}

        {/* Petals coming off the ones who are leaving. One per drifting row, from
            that row's last bloom. This is the only ambient motion on the site and
            it is still saying something. */}
        {show && !instant && (
          <>
            <Petal left={lastPct} drift={-9} spin={-150} dur={3.6} delay={0} />
            <Petal left={lastPct} drift={7} spin={190} dur={4.4} delay={1.7} />
          </>
        )}
      </div>

      <span
        className={`font-mono text-[10px] text-right transition-opacity duration-300 ${
          marked ? 'opacity-100' : 'opacity-0'
        } ${isAlarm ? 'text-pencil' : 'text-ink-soft'}`}
      >
        {row.note}
      </span>
    </div>
  )
}

function Petal({
  left,
  drift,
  spin,
  dur,
  delay,
}: {
  left: number
  drift: number
  spin: number
  dur: number
  delay: number
}) {
  return (
    <span
      className="petal-fall absolute top-1/2 pointer-events-none"
      style={
        {
          left: `${left}%`,
          '--drift': `${drift}px`,
          '--spin': `${spin}deg`,
          '--fall-dur': `${dur}s`,
          '--fall-delay': `${delay}s`,
        } as React.CSSProperties
      }
    >
      <svg width="5" height="8" viewBox="0 0 5 8" aria-hidden="true">
        <ellipse cx="2.5" cy="4" rx="2" ry="3.6" fill="var(--pencil)" opacity="0.75" />
      </svg>
    </span>
  )
}
