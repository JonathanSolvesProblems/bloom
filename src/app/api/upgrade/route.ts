import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { PLANS } from '../checkout/route'

/**
 * Move an active Starter subscription up to Pro.
 *
 * This swaps the price on the existing subscription rather than opening a second
 * checkout, which would leave the owner paying $49 and $99 at the same time.
 * Stripe prorates the difference and emits `customer.subscription.updated`, and
 * the webhook is what actually flips `tier` to pro. POST only: a GET could be
 * fired by a link prefetch and silently charge someone.
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

  const origin = request.nextUrl.origin
  const dashboard = `${origin}/dashboard/${businessId}?t=${encodeURIComponent(business.dashboardToken)}`

  if (business.tier === 'pro' && business.subscriptionStatus === 'active') {
    return Response.redirect(`${dashboard}&upgraded=1`, 303)
  }

  // Nothing to upgrade from: send them through normal checkout instead.
  if (!business.stripeSubscriptionId || business.subscriptionStatus !== 'active') {
    return Response.redirect(`${origin}/api/checkout?businessId=${businessId}&plan=pro`, 303)
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  let subscription: Stripe.Subscription
  try {
    subscription = await stripe.subscriptions.retrieve(business.stripeSubscriptionId)
  } catch {
    return Response.redirect(`${origin}/api/checkout?businessId=${businessId}&plan=pro`, 303)
  }

  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return Response.redirect(`${origin}/api/checkout?businessId=${businessId}&plan=pro`, 303)
  }

  const item = subscription.items.data[0]
  if (!item) return Response.redirect(`${origin}/api/checkout?businessId=${businessId}&plan=pro`, 303)

  // Prices are created ad hoc, the same way checkout does it, so there is no
  // dashboard-managed price catalogue to keep in sync with the code.
  const price = await stripe.prices.create({
    currency: 'usd',
    unit_amount: PLANS.pro.amount,
    recurring: { interval: 'month' },
    product_data: { name: PLANS.pro.name },
  })

  await stripe.subscriptions.update(subscription.id, {
    items: [{ id: item.id, price: price.id }],
    proration_behavior: 'always_invoice',
    metadata: { businessId, plan: 'pro' },
  })

  return Response.redirect(`${dashboard}&upgraded=1`, 303)
}
