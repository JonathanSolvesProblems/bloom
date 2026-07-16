/**
 * A realistic booking export, so anyone can see the radar work in ten seconds
 * without having to dig their real one out of Fresha first.
 *
 * It is generated rather than stored as a static file because every risk call is
 * relative to today. A fixed CSV would drift: the first-timer inside the 30-day
 * cliff today would read as long gone in two months, and the demo would quietly
 * stop making its own point.
 */

export const dynamic = 'force-dynamic'

type Visit = { name: string; email: string; service: string; price: number; daysAgo: number }

const SERVICES: Record<string, number> = {
  'Cut and colour': 165,
  'Balayage': 240,
  'Root touch-up': 95,
  'Cut and style': 75,
  'Blow dry': 45,
  'Highlights': 190,
  'Beard trim': 30,
}

/** Someone who comes every `cadence` days, `count` times, ending `lastSeen` days ago. */
function regular(name: string, service: string, cadence: number, count: number, lastSeen: number): Visit[] {
  const price = SERVICES[service]
  return Array.from({ length: count }, (_, i) => ({
    name,
    email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@example.com`,
    service,
    // A little price drift, because real books are never perfectly uniform.
    price: price + (i % 3) * 5,
    daysAgo: lastSeen + (count - 1 - i) * cadence,
  }))
}

function buildRows(): Visit[] {
  return [
    // On rhythm: a 5-week regular seen 4 weeks ago. The radar must leave her alone.
    ...regular('Priya Raman', 'Cut and colour', 35, 6, 28),
    // The thesis, as a matched pair. Both were last in 44 days ago, so any
    // "flag anyone past 30/60 days" rule treats them identically and gets one of
    // them wrong. Judged against their OWN rhythms the calls invert:
    // Aisha is an 8-week regular, so 44 days is early. She is fine, leave her alone.
    ...regular('Aisha Bello', 'Highlights', 56, 4, 44),
    // Jane is a 4-week regular, so the same 44 days means she is slipping away.
    ...regular('Jane Whitfield', 'Root touch-up', 28, 8, 44),
    // Slipping away: a 3-week regular now 6 weeks out, double his own rhythm.
    ...regular('Marcus Doyle', 'Beard trim', 21, 11, 44),
    // Drifting: a 5-week regular at 7 weeks. Not an emergency yet, worth a nudge.
    ...regular('Elena Sokolov', 'Cut and style', 35, 7, 47),
    // The flagship case: came once, 18 days ago, never rebooked. 12 days left on
    // the cliff. Highest priority in the system, and the one nobody watches.
    { name: 'Nina Kowalski', email: 'nina.kowalski@example.com', service: 'Balayage', price: 240, daysAgo: 18 },
    // Another first-timer, day 24. The window is nearly shut.
    { name: 'Tom Ashby', email: 'tom.ashby@example.com', service: 'Cut and style', price: 75, daysAgo: 24 },
    // Too early: first visit 3 days ago. Contacting her now would be pestering.
    { name: 'Freda Lam', email: 'freda.lam@example.com', service: 'Blow dry', price: 45, daysAgo: 3 },
    // Long gone: one visit, 5 months ago. Worth one honest attempt, not a priority.
    { name: 'Colin Grady', email: 'colin.grady@example.com', service: 'Cut and style', price: 75, daysAgo: 154 },
  ]
}

function toDate(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  const rows = buildRows()
    .sort((a, b) => b.daysAgo - a.daysAgo)
    // Deliberately messy headers and column order: this is what a real export looks
    // like, and the importer is supposed to cope with it.
    .map((v) => `${toDate(v.daysAgo)},${v.name},${v.email},${v.service},${v.price.toFixed(2)},Completed`)

  const csv = ['Appointment Date,Client Name,Client Email,Service,Total,Status', ...rows].join('\r\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="sample-bookings.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
