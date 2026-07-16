import Papa from 'papaparse'
import { computeCadenceDays } from './retention'

/**
 * Turn a booking-history CSV export into per-client history.
 *
 * Every booking platform exports a different shape (Fresha, Square, Vagaro,
 * Booksy, Google Calendar), so nothing here assumes fixed column names. It finds
 * the columns it needs by matching header keywords. That is deliberate: the whole
 * point is that an owner can try this in two minutes with the export they already
 * have, without migrating their booking system to us.
 */

export type ParsedVisit = {
  name: string
  email: string
  service: string
  date: Date
  price: number
}

export type ClientAggregate = {
  name: string
  email: string
  firstVisitAt: Date
  lastVisitAt: Date
  visitCount: number
  lastService: string
  avgSpend: number
  cadenceDays: number | null
}

export type ImportResult = {
  clients: ClientAggregate[]
  visitsParsed: number
  rowsSkipped: number
  /** Which CSV column was used for each field, so the UI can show its work. */
  columnsUsed: Record<string, string | null>
  error?: string
}

/** Find the first header whose name contains any of these keywords. */
function findColumn(headers: string[], keywords: string[], exclude: string[] = []): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  for (const kw of keywords) {
    const hit = headers.find((h) => {
      const n = norm(h)
      return n.includes(kw) && !exclude.some((x) => n.includes(x))
    })
    if (hit) return hit
  }
  return null
}

function parsePrice(raw: string): number {
  if (!raw) return 0
  const cleaned = raw.replace(/[^0-9.-]/g, '')
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function parseDate(raw: string): Date | null {
  if (!raw) return null
  const d = new Date(raw.trim())
  if (Number.isNaN(d.getTime())) return null
  // Guard against nonsense far-future/far-past rows.
  const year = d.getFullYear()
  if (year < 2000 || year > 2100) return null
  return d
}

export function parseBookingCsv(text: string, now: Date = new Date()): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const rows = parsed.data ?? []
  if (!rows.length) {
    return { clients: [], visitsParsed: 0, rowsSkipped: 0, columnsUsed: {}, error: 'That file has no rows I can read.' }
  }

  // Papa's meta.fields is the parsed header row. Object.keys(rows[0]) is NOT the
  // same thing: it only lists fields present in that one row, so an export whose
  // first appointment has no service or price would hide those columns, and one
  // that omits a trailing empty email would get the whole file rejected.
  const headers = parsed.meta?.fields?.length ? parsed.meta.fields : Object.keys(rows[0] ?? {})
  // Email is the only truly required column: it is the identity key and the only
  // way the agent can reach the client later.
  const emailCol = findColumn(headers, ['email', 'mail'])
  const dateCol = findColumn(headers, ['date', 'when', 'starttime', 'appointment', 'createdat'])
  const nameCol = findColumn(headers, ['clientname', 'customername', 'fullname', 'name'], ['service', 'staff', 'employee', 'business'])
  const serviceCol = findColumn(headers, ['service', 'item', 'treatment', 'description', 'title'])
  const priceCol = findColumn(headers, ['price', 'amount', 'total', 'paid', 'revenue', 'value'])

  const columnsUsed = { email: emailCol, date: dateCol, name: nameCol, service: serviceCol, price: priceCol }

  if (!emailCol) {
    return {
      clients: [],
      visitsParsed: 0,
      rowsSkipped: rows.length,
      columnsUsed,
      error: 'I could not find an email column. Export your appointment history with client emails included.',
    }
  }
  if (!dateCol) {
    return {
      clients: [],
      visitsParsed: 0,
      rowsSkipped: rows.length,
      columnsUsed,
      error: 'I could not find a date column. The export needs the date of each appointment.',
    }
  }

  const visits: ParsedVisit[] = []
  let skipped = 0

  for (const row of rows) {
    const email = (row[emailCol] ?? '').trim().toLowerCase()
    const date = parseDate(row[dateCol] ?? '')
    // No email or no usable date means the agent could never act on it.
    if (!email || !email.includes('@') || !date || date > now) {
      skipped++
      continue
    }
    visits.push({
      email,
      name: (nameCol ? row[nameCol] : '')?.trim() || email.split('@')[0],
      service: (serviceCol ? row[serviceCol] : '')?.trim() || '',
      date,
      price: priceCol ? parsePrice(row[priceCol] ?? '') : 0,
    })
  }

  return { clients: aggregate(visits), visitsParsed: visits.length, rowsSkipped: skipped, columnsUsed }
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10)

/**
 * One appointment per client per day.
 *
 * Square, Fresha and Vagaro all export a ROW PER LINE ITEM, so a single visit for
 * "Cut" plus "Colour" arrives as two rows. Counting those as two visits is not a
 * rounding error, it silently breaks the most important case in the product: a
 * first-timer with a two-service appointment gets visitCount 2, so she is read as
 * a returning regular instead of someone sitting on the 30-day cliff, and the one
 * client the agent most needed to catch never surfaces.
 *
 * Same-day line items are merged: their prices sum (that is what the visit was
 * worth) and their services join (that is what she had done).
 */
function mergeSameDay(list: ParsedVisit[]): ParsedVisit[] {
  const byDay = new Map<string, ParsedVisit[]>()
  for (const v of list) {
    const k = dayKey(v.date)
    const items = byDay.get(k)
    if (items) items.push(v)
    else byDay.set(k, [v])
  }

  return [...byDay.values()].map((items) => {
    const services = [...new Set(items.map((i) => i.service).filter(Boolean))]
    return {
      ...items[0],
      // The appointment is worth the sum of its line items, not the average.
      price: items.reduce((s, i) => s + i.price, 0),
      service: services.join(' and '),
    }
  })
}

/** Collapse a visit list into one row per client, with their own rhythm. */
export function aggregate(visits: ParsedVisit[]): ClientAggregate[] {
  const byEmail = new Map<string, ParsedVisit[]>()
  for (const v of visits) {
    const list = byEmail.get(v.email)
    if (list) list.push(v)
    else byEmail.set(v.email, [v])
  }

  const out: ClientAggregate[] = []
  for (const [email, rawList] of byEmail) {
    const list = mergeSameDay(rawList)
    list.sort((a, b) => a.date.getTime() - b.date.getTime())
    const first = list[0]
    const last = list[list.length - 1]
    const paid = list.filter((v) => v.price > 0)
    const avgSpend = paid.length ? paid.reduce((s, v) => s + v.price, 0) / paid.length : 0

    out.push({
      email,
      // Prefer the most recent spelling of their name.
      name: last.name || first.name,
      firstVisitAt: first.date,
      lastVisitAt: last.date,
      visitCount: list.length,
      lastService: last.service,
      avgSpend: Math.round(avgSpend * 100) / 100,
      cadenceDays: computeCadenceDays(list.map((v) => v.date)),
    })
  }
  return out
}
