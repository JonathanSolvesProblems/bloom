import { NextRequest } from 'next/server'
import { after } from '@/lib/after'
import { db } from '@/lib/db'
import { runWeeklyForBusiness, sleep } from '@/lib/agent-run'

// Hobby and Pro both allow 300s. The run itself is ~55s; the rest is headroom
// for the stagger delay that keeps us under Resend's 5 req/s limit.
export const maxDuration = 300

/**
 * Worker: runs the weekly agent for a single business.
 *
 * Responds 202 immediately and finishes the ~20s job in the background of this
 * invocation, so the dispatching cron never has to wait. Every business gets
 * its own function and its own time budget, which is what lets delivery scale
 * past the handful that fit in one 60s cron.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return Response.json({ error: 'Server misconfigured: CRON_SECRET unset' }, { status: 500 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const businessId = typeof body.businessId === 'string' ? body.businessId : ''
  if (!businessId) return Response.json({ error: 'Missing businessId' }, { status: 400 })

  // The dispatcher staggers workers so the herd does not trip Resend's 5 req/s
  // team limit or Vertex quota all at once.
  const delayMs = typeof body.delayMs === 'number' ? Math.min(Math.max(body.delayMs, 0), 240_000) : 0

  after(
    (async () => {
      if (delayMs) await sleep(delayMs)
      await runWeeklyForBusiness(businessId)
    })().catch(async (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Weekly run failed for ${businessId}:`, err)
      try {
        await db.agentLog.create({
          data: {
            businessId,
            action: 'agent_error',
            summary: `Weekly run failed: ${msg}`.slice(0, 200),
            details: JSON.stringify({ error: msg }),
          },
        })
      } catch {
        /* logging must never crash the worker */
      }
    })
  )

  return Response.json({ accepted: true, businessId }, { status: 202 })
}
