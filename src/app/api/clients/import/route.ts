import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { parseBookingCsv } from '@/lib/import-csv'
import { assessAll, summarize } from '@/lib/retention'
import { publicBaseUrl } from '@/lib/config'

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

  const business = await db.business.findUnique({ where: { id: businessId } })
  // 404 rather than 403 so the route never confirms a business exists.
  if (!business || !token || token !== business.dashboardToken) {
    return new Response('Not found', { status: 404 })
  }

  const origin = publicBaseUrl(request)
  const back = (params: string) =>
    `${origin}/dashboard/${businessId}/clients?t=${encodeURIComponent(token)}&${params}`

  if (!(file instanceof File) || file.size === 0) {
    return Response.redirect(back('import_error=nofile'), 303)
  }
  if (file.size > MAX_BYTES) {
    return Response.redirect(back('import_error=toobig'), 303)
  }

  const text = await file.text()
  const result = parseBookingCsv(text)

  if (result.error) {
    return Response.redirect(back(`import_error=${encodeURIComponent(result.error)}`), 303)
  }
  if (!result.clients.length) {
    return Response.redirect(back('import_error=norows'), 303)
  }

  const clients = result.clients.slice(0, MAX_CLIENTS)

  // Everyone the agent wrote to who has now booked again. This is the payoff, and
  // the only number here that is measured rather than estimated.
  const cameBackNames: string[] = []

  // Read the whole existing book once. Asking the database per client would be
  // thousands of sequential round-trips to Neon, and a shop with a real client
  // list would blow the 60s limit before it saw a single result.
  const prior = await db.client.findMany({
    where: { businessId },
    select: { email: true, visitCount: true, winBackSentAt: true, recoveredAt: true },
  })
  const priorByEmail = new Map(prior.map((p) => [p.email, p]))

  // Upsert so re-importing a fresh export updates the book rather than duplicating
  // it. A client who booked again since the last import gets a new lastVisitAt and
  // visitCount, which is exactly how a win-back gets marked as recovered below.
  const writes = clients.map((c) => {
    const existing = priorByEmail.get(c.email)

    // Recovery is MEASURED, not claimed: they were sent a win-back, and now the
    // fresh export shows a visit they did not have before.
    const cameBack =
      !!existing && !!existing.winBackSentAt && !existing.recoveredAt && c.visitCount > existing.visitCount
    if (cameBack) cameBackNames.push(c.name)

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
        firstVisitAt: c.firstVisitAt,
        lastVisitAt: c.lastVisitAt,
        visitCount: c.visitCount,
        lastService: c.lastService,
        avgSpend: c.avgSpend,
        cadenceDays: c.cadenceDays,
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
        cameBack: cameBackNames.length,
      }),
    },
  })

  if (cameBackNames.length) {
    // Worth its own entry in the feed: a save is the only thing here the agent
    // can be judged on, and it is proven by the owner's own fresh export.
    const value = assessed
      .filter((a) => cameBackNames.includes(a.name))
      .reduce((sum, a) => sum + a.assessment.annualValue, 0)
    await db.agentLog.create({
      data: {
        businessId,
        action: 'client_recovered',
        summary: `${cameBackNames.join(', ')} booked again after I reached out. About $${value.toLocaleString()} a year saved.`.slice(0, 200),
        details: JSON.stringify({ clients: cameBackNames, annualValue: value }),
      },
    })
  }

  const won = cameBackNames.length ? `&recovered=${encodeURIComponent(cameBackNames.join(', '))}` : ''
  return Response.redirect(back(`imported=${clients.length}${won}`), 303)
}
