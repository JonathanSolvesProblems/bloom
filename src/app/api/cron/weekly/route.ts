import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getMondayOf, appBaseUrl } from '@/lib/agent-run'
import { pruneRateLimits } from '@/lib/ratelimit'

export const maxDuration = 60

/**
 * Weekly dispatcher.
 *
 * Does no generation itself. It finds the active businesses that still need
 * this week's run and fans each one out to its own worker invocation, which
 * ACKs in milliseconds. That keeps this function fast regardless of how many
 * paying customers exist, instead of dying partway through a sequential loop.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return Response.json({ error: 'Server misconfigured: CRON_SECRET unset' }, { status: 500 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const base = appBaseUrl()
  if (!base) return Response.json({ error: 'Server misconfigured: no app base URL' }, { status: 500 })

  const weekOf = getMondayOf(new Date())

  // Oldest first, deterministically. An unordered findMany would silently
  // starve the same later signups every single week.
  const active = await db.business.findMany({
    where: { subscriptionStatus: 'active' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  const alreadyDelivered = await db.weeklyContent.findMany({
    where: { weekOf, newsletterSent: true },
    select: { businessId: true },
  })
  const done = new Set(alreadyDelivered.map((c: { businessId: string }) => c.businessId))
  const todo = active.filter((b: { id: string }) => !done.has(b.id))

  const results = await Promise.allSettled(
    todo.map((b: { id: string }) =>
      fetch(`${base}/api/cron/run-business`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${secret}` },
        body: JSON.stringify({ businessId: b.id }),
      })
    )
  )

  const dispatched = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.length - dispatched
  const pruned = await pruneRateLimits()

  return Response.json({ ok: true, weekOf, active: active.length, dispatched, failed, pruned })
}
