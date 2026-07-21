import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { parseBookingCsv } from '@/lib/import-csv'
import { assessAll, summarize } from '@/lib/retention'
import { publicBaseUrl } from '@/lib/config'
import { sampleCsv } from '@/app/api/sample-csv/route'
import { xlsxToCsv, looksLikeXlsx } from '@/lib/xlsx'

export const maxDuration = 60

/** A booking export should never be this big; refuse rather than chew on it. */
const MAX_BYTES = 5 * 1024 * 1024
const MAX_CLIENTS = 5000

/**
 * Import a booking-history CSV and turn it into the client book the retention
 * agent watches. Owner-token gated: this is the business's real customer list,
 * the most sensitive data in the product.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData()
  const token = form.get('t')?.toString() ?? ''
  const businessId = form.get('businessId')?.toString() ?? ''
  const file = form.get('file')
  // One-click "try it with sample data": seed the built-in sample book without
  // making a new owner download a CSV and upload it back. The follow-up sample
  // (a client rebooked) uses sample=2, so a demo can show a save land.
  const sample = form.get('sample')?.toString() ?? ''

  const business = await db.business.findUnique({ where: { id: businessId } })
  // 404 rather than 403 so the route never confirms a business exists.
  if (!business || !token || token !== business.dashboardToken) {
    return new Response('Not found', { status: 404 })
  }

  const origin = publicBaseUrl(request)
  const back = (params: string) =>
    `${origin}/dashboard/${businessId}/clients?t=${encodeURIComponent(token)}&${params}`

  let text: string
  if (sample === '1' || sample === '2') {
    text = sampleCsv(sample === '2')
  } else {
    if (!(file instanceof File) || file.size === 0) {
      return Response.redirect(back('import_error=nofile'), 303)
    }
    if (file.size > MAX_BYTES) {
      return Response.redirect(back('import_error=toobig'), 303)
    }
    // Spreadsheets (Excel, Numbers, Google Sheets exports) are the common case a
    // salon owner actually has, so read those too rather than making them convert
    // to CSV first. Detect by name or by the zip magic bytes, since a renamed
    // file lies about its type.
    const isXlsx = /\.xlsx$/i.test(file.name) || (await looksLikeXlsx(file))
    try {
      text = isXlsx ? await xlsxToCsv(file) : await file.text()
    } catch (err) {
      console.error('Spreadsheet read failed:', err)
      return Response.redirect(
        back('import_error=I%20could%20not%20read%20that%20file.%20Try%20exporting%20it%20as%20CSV.'),
        303
      )
    }
  }

  const result = parseBookingCsv(text)

  if (result.error) {
    return Response.redirect(back(`import_error=${encodeURIComponent(result.error)}`), 303)
  }
  if (!result.clients.length) {
    return Response.redirect(back('import_error=norows'), 303)
  }

  // If a book is over the cap, keep the most recently active clients rather than
  // an arbitrary slice: a blind slice(0, N) kept whoever happened to appear first
  // in the file and could drop the newest first-timers, who are the exact cohort
  // on the 30-day cliff that this product exists to catch.
  const clients =
    result.clients.length > MAX_CLIENTS
      ? [...result.clients].sort((a, b) => b.lastVisitAt.getTime() - a.lastVisitAt.getTime()).slice(0, MAX_CLIENTS)
      : result.clients

  // Everyone the agent wrote to who has now booked again. Keyed by email, which is
  // the actual unique constraint: two clients can share a display name, and
  // crediting both for one save would inflate the only number here that is
  // supposed to be measured rather than estimated.
  const cameBackEmails: string[] = []

  // Read the whole existing book once. Asking the database per client would be
  // thousands of sequential round-trips to Neon, and a shop with a real client
  // list would blow the 60s limit before it saw a single result.
  const prior = await db.client.findMany({
    where: { businessId },
    select: {
      email: true,
      firstVisitAt: true,
      lastVisitAt: true,
      visitCount: true,
      lastService: true,
      avgSpend: true,
      cadenceDays: true,
      winBackSentAt: true,
      recoveredAt: true,
    },
  })
  const priorByEmail = new Map(prior.map((p) => [p.email, p]))

  // MERGE, never overwrite. An export is a window, not the truth: the UI tells
  // owners to "export a shorter date range" when a file is too big, and invites a
  // fresh upload any time. Taking the file at face value would rewrite a 20-visit
  // regular as a first-timer the moment someone uploaded last month only, and the
  // agent would then write to her saying she came once and never rebooked. Her
  // real history is not recoverable, because only the aggregate is stored.
  const writes = clients.map((c) => {
    const existing = priorByEmail.get(c.email)

    // Recovery is MEASURED, not claimed, and the measure has to be a visit that
    // happened AFTER the agent wrote to her. Comparing visit counts instead would
    // fire on any wider export (12 months where 3 were imported before), crediting
    // a save that never happened.
    const cameBack =
      !!existing &&
      !!existing.winBackSentAt &&
      !existing.recoveredAt &&
      c.lastVisitAt > existing.lastVisitAt &&
      c.lastVisitAt > existing.winBackSentAt
    if (cameBack) cameBackEmails.push(c.email)

    const isNewer = !existing || c.lastVisitAt >= existing.lastVisitAt

    return db.client.upsert({
      where: { businessId_email: { businessId, email: c.email } },
      create: {
        businessId,
        email: c.email,
        name: c.name,
        firstVisitAt: c.firstVisitAt,
        lastVisitAt: c.lastVisitAt,
        visitCount: c.visitCount,
        lastService: c.lastService,
        avgSpend: c.avgSpend,
        cadenceDays: c.cadenceDays,
      },
      update: {
        name: c.name,
        // Widen the window in both directions, never narrow it.
        firstVisitAt: existing && existing.firstVisitAt < c.firstVisitAt ? existing.firstVisitAt : c.firstVisitAt,
        lastVisitAt: existing && existing.lastVisitAt > c.lastVisitAt ? existing.lastVisitAt : c.lastVisitAt,
        // Worst case this undercounts (a partial export), which is the safe
        // direction: it can never invent visits that did not happen.
        visitCount: existing ? Math.max(existing.visitCount, c.visitCount) : c.visitCount,
        // A single-visit window yields no cadence; keep what we already knew.
        cadenceDays: c.cadenceDays ?? existing?.cadenceDays ?? null,
        // Only the more recent export knows what she last had done.
        lastService: isNewer ? c.lastService : (existing?.lastService ?? ''),
        avgSpend: c.avgSpend > 0 ? c.avgSpend : (existing?.avgSpend ?? 0),
        ...(cameBack ? { recoveredAt: new Date() } : {}),
      },
    })
  })

  // Batched rather than all at once: 5,000 concurrent upserts would exhaust the
  // connection pool, and Neon would start refusing them.
  const BATCH = 25
  for (let i = 0; i < writes.length; i += BATCH) {
    await Promise.all(writes.slice(i, i + BATCH))
  }

  const stored = await db.client.findMany({ where: { businessId } })
  const assessed = assessAll(stored)
  const summary = summarize(assessed)

  await db.agentLog.create({
    data: {
      businessId,
      action: 'imported_clients',
      summary: `Read ${clients.length} clients from the booking history. ${summary.critical} are slipping away right now, about $${summary.revenueAtRisk.toLocaleString()} a year at risk.`.slice(0, 200),
      details: JSON.stringify({
        clients: clients.length,
        visitsParsed: result.visitsParsed,
        rowsSkipped: result.rowsSkipped,
        columnsUsed: result.columnsUsed,
        critical: summary.critical,
        atRisk: summary.atRisk,
        revenueAtRisk: summary.revenueAtRisk,
        cameBack: cameBackEmails.length,
      }),
    },
  })

  const recovered = assessed.filter((a) => cameBackEmails.includes(a.email))

  if (recovered.length) {
    // Worth its own entry in the feed: a save is the only thing here the agent
    // can be judged on, and it is proven by the owner's own fresh export.
    const value = recovered.reduce((sum, a) => sum + a.assessment.annualValue, 0)
    await db.agentLog.create({
      data: {
        businessId,
        action: 'client_recovered',
        // Public feed. Names and the recovered amount belong to the business, so
        // this says what happened without saying who or how much.
        summary:
          recovered.length === 1
            ? 'A client I wrote to has booked again. The save is confirmed by the owner\'s own booking export.'
            : `${recovered.length} clients I wrote to have booked again, confirmed by the owner's own booking export.`,
        details: JSON.stringify({ clients: recovered.map((a) => a.email), annualValue: value }),
      },
    })
  }

  const won = recovered.length
    ? `&recovered=${encodeURIComponent(recovered.map((a) => a.name).join(', '))}`
    : ''
  return Response.redirect(back(`imported=${clients.length}${won}`), 303)
}
