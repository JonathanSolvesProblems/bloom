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
  /** Rows that were a cancellation or no-show, so deliberately not counted. */
  cancelledSkipped?: number
  /** Which way the date column was read, so the UI can say so and be corrected. */
  dateOrder?: 'iso' | 'dmy' | 'mdy'
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

/**
 * Money, in whatever way the owner's country writes it.
 *
 * "165,50" is a hundred and sixty five euros fifty, not sixteen thousand. Stripping
 * every non-digit turned it into 16550, which annualised one French-Canadian client
 * to $201,358 and blew out the "revenue at risk" figure the whole paywall rests on.
 */
function parsePrice(raw: string): number {
  if (!raw) return 0
  let s = raw.replace(/[^0-9.,-]/g, '').trim()
  if (!s) return 0

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma > -1 && lastDot > -1) {
    // Both present: whichever comes last is the decimal separator.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma > -1) {
    // Only commas. Exactly two trailing digits reads as a decimal separator
    // ("165,50"); anything else is a thousands separator ("1,234", "1,234,567").
    const tail = s.length - lastComma - 1
    s = tail === 2 ? s.replace(',', '.') : s.replace(/,/g, '')
  }

  const n = Number.parseFloat(s)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** Rows that are not a visit. A no-show is the opposite of one. */
const NOT_A_VISIT = /cancel|no.?show|void|refund|declin|abandon|deleted|removed/i

type DateOrder = 'iso' | 'dmy' | 'mdy'

/**
 * Work out whether the whole column is DD/MM or MM/DD, ONCE, from every row.
 *
 * `new Date("04/09/2026")` silently reads American, so a UK, EU or French-Canadian
 * export lost every row whose day exceeded 12: an eight-visit regular arrived as
 * `visitCount: 1` and the agent then wrote to her saying she came once and never
 * came back. Deciding per row is not possible (04/09 is valid either way), so the
 * order is inferred from the one column and applied uniformly.
 */
function detectDateOrder(samples: string[]): DateOrder {
  let sawDayFirst = false
  let sawMonthFirst = false
  for (const raw of samples) {
    const m = raw.trim().match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/)
    if (!m) continue
    const a = Number(m[1])
    const b = Number(m[2])
    if (m[1].length === 4) return 'iso'
    if (a > 12 && b <= 12) sawDayFirst = true
    else if (b > 12 && a <= 12) sawMonthFirst = true
  }
  // Ambiguous columns (every value <= 12) fall back to month-first, which is what
  // the platforms most of these exports come from emit.
  if (sawDayFirst && !sawMonthFirst) return 'dmy'
  return 'mdy'
}

function parseDate(raw: string, order: DateOrder): Date | null {
  if (!raw) return null
  const s = raw.trim()

  const m = s.match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/)
  let d: Date
  if (m && m[1].length !== 4) {
    const first = Number(m[1])
    const second = Number(m[2])
    let year = Number(m[3])
    if (year < 100) year += year < 70 ? 2000 : 1900
    const day = order === 'dmy' ? first : second
    const month = order === 'dmy' ? second : first
    // Local noon, so a timezone shift can never roll the date onto another day.
    d = new Date(year, month - 1, day, 12)
    if (d.getMonth() !== month - 1 || d.getDate() !== day) return null
  } else {
    d = new Date(s)
  }

  if (Number.isNaN(d.getTime())) return null
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
  // A cancellation is not a visit, and counting one hides the exact client this
  // product exists to catch: someone who no-showed three weeks ago reads as "on
  // rhythm" and never surfaces.
  const statusCol = findColumn(headers, ['status', 'state', 'appointmentstatus'])

  const columnsUsed = { email: emailCol, date: dateCol, name: nameCol, service: serviceCol, price: priceCol, status: statusCol }

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
  let notAVisit = 0

  // Decided once, from the whole column, before any row is read.
  const dateOrder = detectDateOrder(rows.map((r) => r[dateCol] ?? ''))

  for (const row of rows) {
    const email = (row[emailCol] ?? '').trim().toLowerCase()
    const date = parseDate(row[dateCol] ?? '', dateOrder)
    // No email or no usable date means the agent could never act on it.
    if (!email || !email.includes('@') || !date || date > now) {
      skipped++
      continue
    }
    if (statusCol && NOT_A_VISIT.test(row[statusCol] ?? '')) {
      notAVisit++
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

  return {
    clients: aggregate(visits),
    visitsParsed: visits.length,
    rowsSkipped: skipped,
    cancelledSkipped: notAVisit,
    dateOrder,
    columnsUsed,
  }
}

/** Local calendar day, not UTC: toISOString on a local Date shifts the day for
 *  anyone west of Greenwich, which merged or split same-day appointments. */
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

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
