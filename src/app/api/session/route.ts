import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

export const SESSION_COOKIE = 'bloom_session'
const NINETY_DAYS = 60 * 60 * 24 * 90

/**
 * Remember which dashboard this browser belongs to.
 *
 * Bloom has no passwords on purpose: the owner is a salon owner, not someone who
 * wants another login to lose. The dashboard link IS the credential. What was
 * missing is that the link had to be kept by hand, so coming back to the site
 * meant the marketing page and no way in.
 *
 * This stores the same credential in an httpOnly cookie, which is strictly safer
 * than the URL it already travels in: script cannot read it, and it does not sit
 * in browser history or a referrer header. Emailing the link (/recover) stays the
 * way in on a new device.
 */
export async function POST(request: NextRequest) {
  const { businessId, token } = await request.json().catch(() => ({}))
  if (typeof businessId !== 'string' || typeof token !== 'string') {
    return Response.json({ ok: false }, { status: 400 })
  }

  // Only ever remember a pair that actually authenticates, so a forged call
  // cannot plant a session for a business it does not hold the token for.
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { dashboardToken: true },
  })
  if (!business || business.dashboardToken !== token) {
    return Response.json({ ok: false }, { status: 404 })
  }

  const jar = await cookies()
  jar.set(SESSION_COOKIE, `${businessId}:${token}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: NINETY_DAYS,
  })
  return Response.json({ ok: true })
}

/** Sign out on this device. The account and its data are untouched. */
export async function DELETE() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
  return Response.json({ ok: true })
}
