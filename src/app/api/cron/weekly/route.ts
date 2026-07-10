import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getMondayOf, internalBaseUrl } from '@/lib/agent-run'
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

  const base = internalBaseUrl()
  if (!base) return Response.json({ error: 'Server misconfigured: no app base URL' }, { status: 500 })

  const weekOf = getMondayOf(new Date())

  // Oldest first, deterministically. An unordered findMany would silently
  // starve the same later signups every single week.
  const active = await db.business.findMany({
    where: { subscriptionStatus: 'active' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, tier: true },
  })

  const written = await db.weeklyContent.findMany({
    where: { weekOf },
    select: { businessId: true, newsletterSent: true },
  })

  // A week is finished when there is nothing left for the agent to do. For Pro
  // that means the newsletter went out; for Starter it means the content exists,
  // since Starter never sends and `newsletterSent` stays false forever. Keying
  // only on newsletterSent would re-dispatch every Starter business on each tick.
  const sent = new Set(written.filter((c) => c.newsletterSent).map((c) => c.businessId))
  const hasContent = new Set(written.map((c) => c.businessId))
  const todo = active.filter((b: { id: string; tier: string }) =>
    b.tier === 'pro' ? !sent.has(b.id) : !hasContent.has(b.id)
  )

  // Stagger the herd. Resend caps a team at 5 requests/second (429 beyond), and
  // Vertex quota is shared too, so spread the workers rather than firing every
  // business at the same instant. 1.5s apart keeps sends well under the cap.
  const STAGGER_MS = 1_500
  const MAX_DELAY_MS = 240_000

  const results = await Promise.allSettled(
    todo.map((b: { id: string }, i: number) =>
      fetch(`${base}/api/cron/run-business`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${secret}` },
        body: JSON.stringify({ businessId: b.id, delayMs: Math.min(i * STAGGER_MS, MAX_DELAY_MS) }),
      })
    )
  )

  const dispatched = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.length - dispatched
  const pruned = await pruneRateLimits()

  return Response.json({ ok: true, weekOf, active: active.length, dispatched, failed, pruned })
}
