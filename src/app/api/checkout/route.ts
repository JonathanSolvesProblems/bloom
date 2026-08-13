import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { publicBaseUrl } from '@/lib/config'

export type Plan = 'starter' | 'pro'

/**
 * Both tiers include the retention agent (find the clients slipping away and
 * draft each a personal win-back note) plus the weekly content. The tiers differ
 * on one capability: whether the agent sends the newsletter for you. Starter
 * writes the week; Pro also delivers it.
 */
export const PLANS: Record<Plan, { amount: number; name: string; description: string }> = {
  starter: {
    amount: 4900,
    name: 'Bloom Starter: client retention agent',
    description: 'Finds the clients drifting away and drafts each a personal win-back note in your voice, plus a week of ready-to-publish social posts and a newsletter.',
  },
  pro: {
    amount: 9900,
    name: 'Bloom Pro: client retention agent',
    description: 'Everything in Starter, plus your newsletter emailed to your subscribers automatically.',
  },
}

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get('businessId')
  if (!businessId) return Response.json({ error: 'Missing businessId' }, { status: 400 })

  const requested = request.nextUrl.searchParams.get('plan')
  const plan: Plan = requested === 'starter' ? 'starter' : 'pro'
  const spec = PLANS[plan]

  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const origin = publicBaseUrl(request)

  // Reuse a single Stripe customer per business. This route is UNAUTHENTICATED
  // (businessId is public), so it must never echo the owner-only dashboard
  // token, and reusing one customer lets its existing subscriptions be checked
  // so a repeat checkout cannot open a second parallel subscription.
  let customerId = business.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({ email: business.ownerEmail, metadata: { businessId } })
    customerId = customer.id
    await db.business.update({ where: { id: businessId }, data: { stripeCustomerId: customerId } })
  }

  // Already paying? Do not sell a second subscription, and do not leak the token
  // to whoever holds the public businessId. Send them to the neutral recovery
  // page, which emails their dashboard link to the address on file.
  const existing = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 })
  if (existing.data.some((s) => s.status === 'active' || s.status === 'trialing')) {
    return Response.redirect(`${origin}/recover`, 303)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: spec.name, description: spec.description },
          unit_amount: spec.amount,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    metadata: { businessId, plan },
    // Stamp the plan on the subscription too, so later subscription.updated
    // events can tell Starter from Pro without guessing from the amount.
    subscription_data: { metadata: { businessId, plan } },
    // The owner-only token is required to open the dashboard. Handing it back on
    // the post-payment redirect is what lets them in (and bookmark it).
    success_url: `${origin}/dashboard/${businessId}?activated=1&t=${encodeURIComponent(business.dashboardToken)}`,
    cancel_url: `${origin}/preview/${businessId}`,
  })

  return Response.redirect(session.url!)
}
