import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { publicBaseUrl } from '@/lib/config'

/**
 * Cancel an active subscription. The site promises "cancel in one click
 * anytime", so this is that click.
 *
 * Cancels at period end rather than immediately: the customer already paid for
 * the current period and should keep the content they are owed until it lapses.
 * Stripe then fires customer.subscription.deleted at period end, and the webhook
 * flips tier to free. POST only, token-authenticated like /api/upgrade, so a
 * link prefetch can never cancel someone's plan.
 */
export async function POST(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get('businessId')
  const token = request.nextUrl.searchParams.get('t')
  if (!businessId || !token) return Response.json({ error: 'Missing parameters' }, { status: 400 })

  const business = await db.business.findUnique({ where: { id: businessId } })
  // 404 rather than 403 so the route never confirms a business exists.
  if (!business || token !== business.dashboardToken) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const dashboard = `${publicBaseUrl(request)}/dashboard/${businessId}?t=${encodeURIComponent(business.dashboardToken)}`

  if (!business.stripeSubscriptionId) {
    return Response.redirect(`${dashboard}&cancelled=1`, 303)
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  try {
    await stripe.subscriptions.update(business.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })
  } catch {
    return Response.redirect(`${dashboard}&cancel_error=1`, 303)
  }

  await db.agentLog.create({
    data: {
      businessId,
      action: 'paused_delivery',
      summary: 'Cancellation scheduled: service continues until the end of the paid period.',
      details: JSON.stringify({ scheduled: true }),
    },
  })

  return Response.redirect(`${dashboard}&cancelled=1`, 303)
}
