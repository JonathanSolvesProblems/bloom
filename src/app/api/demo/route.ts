import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { publicBaseUrl } from '@/lib/config'

/**
 * Password gate for the demo account. On the right password, it opens a
 * pre-seeded Pro business so anyone (me, or a judge) can explore the paid
 * features without going through Stripe. The demo business id and password live
 * in env; the dashboard token is looked up here so it never sits in env.
 *
 * POST only, so the password is never in a URL or browser history.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData()
  const password = form.get('password')?.toString() ?? ''
  const expected = process.env.DEMO_PASSWORD
  const demoId = process.env.DEMO_BUSINESS_ID
  const origin = publicBaseUrl(request)

  if (!expected || !demoId || password !== expected) {
    return Response.redirect(`${origin}/demo?error=1`, 303)
  }

  const biz = await db.business.findUnique({ where: { id: demoId }, select: { dashboardToken: true } })
  if (!biz) return Response.redirect(`${origin}/demo?error=1`, 303)

  return Response.redirect(`${origin}/dashboard/${demoId}?t=${encodeURIComponent(biz.dashboardToken)}`, 303)
}
