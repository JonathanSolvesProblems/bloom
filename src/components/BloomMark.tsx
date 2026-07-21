/**
 * The logo, in one place.
 *
 * A bloom with a gap where the fifth petal was, and the petal falling away in
 * pencil. It is the product stated as a mark: a rhythm that has lost one. Shared
 * so every screen shows the same thing, instead of the emerald app-icon that used
 * to sit on the interior pages and could have belonged to anything.
 */
export default function BloomMark({ className = 'w-7 h-7' }: { className?: string }) {
  const held = [0, 72, 144, 288]
  return (
    <svg viewBox="0 0 32 32" className={`${className} shrink-0`} aria-hidden>
      <g transform="translate(13 13)">
        <g fill="none" stroke="var(--ink)" strokeWidth="1.7" strokeLinejoin="round">
          {held.map((deg) => (
            <ellipse key={deg} cx="0" cy="-6" rx="3.2" ry="5" transform={`rotate(${deg})`} />
          ))}
        </g>
        <circle r="2.3" fill="var(--ink)" />
      </g>
      <ellipse cx="24" cy="24" rx="2.9" ry="4.6" fill="var(--pencil)" transform="rotate(34 24 24)" />
    </svg>
  )
}
