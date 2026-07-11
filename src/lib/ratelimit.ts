import { NextRequest } from 'next/server'
import { db } from './db'

/**
 * Resolve the client IP from a source the caller cannot forge.
 *
 * `x-vercel-forwarded-for` is only trustworthy on Vercel, which sets it and
 * strips any client-supplied copy. Bloom also runs self-hosted behind Traefik,
 * where nothing strips it, so honouring it off-platform would let a caller mint
 * a fresh rate-limit bucket on every request and drain the paid Gemini quota.
 *
 * `x-real-ip` is overwritten by both proxies with the real peer address, and the
 * app is never reachable except through one of them. A raw `x-forwarded-for` can
 * be PREPENDED by the caller, so the leftmost entry is attacker controlled; the
 * rightmost hop is the one our proxy appended.
 */
const ON_VERCEL = process.env.VERCEL === '1'

function clientIp(request: NextRequest): string {
  if (ON_VERCEL) {
    const vercelIp = request.headers.get('x-vercel-forwarded-for')
    if (vercelIp) return vercelIp.split(',')[0].trim()
  }

  // Off Vercel (behind Traefik), `x-real-ip` is client-suppliable: Traefik does
  // not overwrite it by default, so a caller could rotate it per request and mint
  // a fresh rate-limit bucket each time. Only the RIGHTMOST X-Forwarded-For hop is
  // trustworthy, since Traefik appends the real peer address last.
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const hops = xff.split(',').map((h) => h.trim()).filter(Boolean)
    if (hops.length) return hops[hops.length - 1]
  }

  // Only trust x-real-ip on Vercel, which sets it itself.
  if (ON_VERCEL) {
    const realIp = request.headers.get('x-real-ip')
    if (realIp) return realIp.trim()
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

/**
 * A GLOBAL, per-day ceiling across all callers, so a distributed attack from many
 * IPs (each under the per-IP cap) still cannot run up the Gemini bill. This is the
 * absolute cap on free-preview spend for a day; paid generations do not use it.
 * Fails open on a DB error (the Vertex quota and the cloud budget are the hard
 * backstops); returns true while under the cap.
 */
export async function underGlobalCap(bucket: string, perDayCap: number): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10)
  const key = `global:${bucket}:${day}`
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

// Absolute daily ceiling on FREE previews across everyone. At roughly $0.01 of
// Gemini per preview, the default 500 caps free-preview spend near $5/day even
// under a distributed attack. Lower it with FREE_PREVIEW_DAILY_CAP if you want a
// tighter ceiling while testing.
export const GLOBAL_LIMITS = {
  generate: Number(process.env.FREE_PREVIEW_DAILY_CAP) || 500,
}
