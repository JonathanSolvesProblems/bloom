/**
 * One visit, as a bloom.
 *
 * Deliberately drawn rather than illustrated: five petals struck from one ellipse
 * rotated in fifths, a hairline outline, and a seeded centre. That is how a
 * botanical plate renders a flower, and it is the opposite of the soft gradient
 * petal shape that every generated "floral" page reaches for. At 11px it still
 * reads as a flower, which is the only test that matters here.
 *
 * `state` is not decoration either. It is the risk call:
 *   full   - open, on rhythm
 *   fading - past their rhythm, petals thinning
 *   gone   - dropped, only the calyx left
 */
export type BloomState = 'full' | 'fading' | 'gone'

const PETALS = [0, 72, 144, 216, 288]

export default function Bloom({
  size = 11,
  state = 'full',
  color = 'var(--ink)',
  className = '',
}: {
  size?: number
  state?: BloomState
  color?: string
  className?: string
}) {
  // A dropped flower keeps two petals, so a lost client still reads as something
  // that was alive rather than as an empty dot.
  const petals = state === 'gone' ? PETALS.slice(0, 2) : PETALS
  const open = state === 'full' ? 1 : state === 'fading' ? 0.82 : 0.55

  return (
    <svg
      width={size}
      height={size}
      viewBox="-12 -12 24 24"
      className={className}
      aria-hidden="true"
      // block, not inline: an inline SVG sits on the text baseline and carries
      // descender space, which pushed every bloom below the stem it is meant to
      // be sitting on.
      style={{ overflow: 'visible', display: 'block' }}
    >
      <g fill="none" stroke={color} strokeWidth={state === 'gone' ? 1.1 : 1.3} strokeLinejoin="round">
        {petals.map((deg, i) => (
          <ellipse
            key={deg}
            cx="0"
            cy={-5.4 * open}
            rx={2.9 * open}
            ry={4.6 * open}
            // Each petal nudged off its exact fifth: a real flower is not
            // rotationally perfect, and the eye reads perfect symmetry as clip-art.
            transform={`rotate(${deg + (i % 2 ? 3 : -2)})`}
            opacity={state === 'fading' && i > 2 ? 0.45 : 1}
          />
        ))}
      </g>
      <circle cx="0" cy="0" r={state === 'gone' ? 1.5 : 2.1} fill={color} />
    </svg>
  )
}
