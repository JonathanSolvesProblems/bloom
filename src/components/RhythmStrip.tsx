/**
 * One client's rhythm, drawn: their visits as ticks, then the gap since the last
 * one, circled in pencil when the gap has outgrown the rhythm.
 *
 * HONESTY NOTE, which is the whole reason this is safe to draw: Bloom stores an
 * aggregate per client (first visit, last visit, count, median cadence), not the
 * individual dates. So the ticks are spaced at their MEDIAN cadence rather than
 * plotted from real appointments. It is a diagram of the rhythm, not a history,
 * and it is exactly what the risk call is made against, which is why it is worth
 * showing. The caption says so rather than letting it imply more than it knows.
 *
 * A server component: no interactivity, so nothing ships to the browser.
 */

const LOOKBACK = 180

export default function RhythmStrip({
  cadenceDays,
  daysSince,
  visitCount,
  alarm,
}: {
  cadenceDays: number | null
  daysSince: number
  visitCount: number
  /** Draw the pencil ring around the gap. */
  alarm: boolean
}) {
  const pct = (d: number) => ((LOOKBACK - d) / LOOKBACK) * 100

  // Walk back from the last visit at their own tempo, never inventing more
  // visits than they actually made.
  const ticks: number[] = []
  if (daysSince <= LOOKBACK) ticks.push(daysSince)
  if (cadenceDays && cadenceDays > 0) {
    for (let d = daysSince + cadenceDays; d <= LOOKBACK && ticks.length < visitCount; d += cadenceDays) {
      ticks.push(d)
    }
  }

  const gapStart = pct(Math.min(daysSince, LOOKBACK))
  const ringW = Math.max(100 - gapStart, 4)

  return (
    <div className="mt-3 max-w-md">
      <div className="relative h-6">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-rule" />
        {ticks.map((d) => (
          <span
            key={d}
            className="absolute top-1/2 -translate-y-1/2 w-px h-2.5 bg-ink"
            style={{ left: `${pct(d)}%` }}
          />
        ))}
        {alarm && (
          <svg
            className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <ellipse
              cx={gapStart + ringW / 2}
              cy="12"
              rx={ringW / 2}
              ry="9"
              fill="none"
              stroke="var(--pencil)"
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
        {/* Today. The right edge of the book. */}
        <span className="absolute right-0 top-0 bottom-0 w-px bg-ink" />
      </div>
      <p className="font-mono text-[10px] text-muted mt-1">
        {cadenceDays
          ? `every ~${cadenceDays} days · ${daysSince} since the last`
          : `one visit · ${daysSince} days ago`}
      </p>
    </div>
  )
}
