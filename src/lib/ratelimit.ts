import { NextRequest } from 'next/server'
import { db } from './db'

function clientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
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

// Generous defaults: comfortably above real use (including founder-led preview
// sales at ~5-7/day) while stopping scripted abuse of the paid Gemini calls.
export const LIMITS = {
  generate: 25,
  business: 25,
}
