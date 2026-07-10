import { NextRequest } from 'next/server'
import { db } from './db'

/**
 * Resolve the client IP from a source the caller cannot forge.
 *
 * Vercel sets `x-vercel-forwarded-for` and `x-real-ip` itself and strips any
 * client-supplied copies, so those are trustworthy. A raw `x-forwarded-for` can
 * be PREPENDED by the caller, which means the leftmost entry is attacker
 * controlled; the rightmost hop is the one our edge appended.
 */
function clientIp(request: NextRequest): string {
  const vercelIp = request.headers.get('x-vercel-forwarded-for')
  if (vercelIp) return vercelIp.split(',')[0].trim()

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const hops = xff.split(',')
    return hops[hops.length - 1].trim()
  }
  return 'unknown'
}

/**
 * Per-IP, per-day rate limit backed by the database.
 * The day is baked into the key so buckets reset naturally at UTC midnight.
 * Fails OPEN on any error so a database hiccup never blocks a legitimate user.
 * The Google Cloud budget cap remains the hard ceiling on spend.
 *
 * Returns true if the request is allowed, false if the cap has been exceeded.
 */
export async function allowRequest(request: NextRequest, bucket: string, perDayCap: number): Promise<boolean> {
  const ip = clientIp(request)
  const day = new Date().toISOString().slice(0, 10)
  const key = `${bucket}:${ip}:${day}`
  try {
    const rl = await db.rateLimit.upsert({
      where: { key },
      create: { key, count: 1 },
      update: { count: { increment: 1 } },
    })
    return rl.count <= perDayCap
  } catch {
    return true
  }
}

/** Delete rate-limit buckets older than two days so the table cannot grow forever. */
export async function pruneRateLimits(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    const res = await db.rateLimit.deleteMany({ where: { createdAt: { lt: cutoff } } })
    return res.count
  } catch {
    return 0
  }
}

// Generous defaults: comfortably above real use (including founder-led preview
// sales at ~5-7/day) while stopping scripted abuse of the paid Gemini calls.
export const LIMITS = {
  generate: 25,
  business: 25,
}
