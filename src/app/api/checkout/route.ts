import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { publicBaseUrl } from '@/lib/config'

export type Plan = 'starter' | 'pro'

/**
 * The tiers differ on one real capability: whether the agent sends the
 * newsletter for you. Starter writes the week; Pro also delivers it.
 */
export const PLANS: Record<Plan, { amount: number; name: string; description: string }> = {
  starter: {
    amount: 4900,
    name: 'Bloom Starter: AI Marketing Agent',
    description: 'Three social posts and a newsletter written for you every Monday, ready to publish.',
  },
  pro: {
    amount: 9900,
    name: 'Bloom Pro: AI Marketing Agent',
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

  // A subscriber who lands here again would otherwise buy a second subscription
  // and be charged twice. Send them back to the dashboard, where changing plan
  // goes through /api/upgrade and modifies the one they already have.
  if (business.subscriptionStatus === 'active' && business.stripeSubscriptionId) {
    return Response.redirect(
      `${origin}/dashboard/${businessId}?t=${encodeURIComponent(business.dashboardToken)}`,
      303
    )
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: business.ownerEmail,
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
