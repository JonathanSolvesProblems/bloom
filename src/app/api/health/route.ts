import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * A trivial query that wakes the serverless database.
 *
 * Neon suspends its compute after a few minutes idle, so the first query after a
 * quiet spell pays a cold-start of a few seconds. The setup page pings this on
 * load, so by the time the owner finishes typing their name the database is warm
 * and their signup is fast instead of the multi-second wait the test video caught.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 503 })
  }
}
