import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { after } from '@/lib/after'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'customer.subscription.updated'
  ) {
    after(handleSubscriptionEvent(event))
  }

  if (
    event.type === 'customer.subscription.deleted' ||
    event.type === 'invoice.payment_failed'
  ) {
    after(handleCancellation(event))
  }

  return Response.json({ received: true })
}

type Plan = 'starter' | 'pro'

/** Trust the stamped metadata; fall back to the amount if an old sub lacks it. */
function planOf(sub: Stripe.Subscription): Plan {
  const meta = sub.metadata?.plan
  if (meta === 'starter' || meta === 'pro') return meta
  const amount = sub.items?.data?.[0]?.price?.unit_amount ?? 9900
  return amount <= 4900 ? 'starter' : 'pro'
}

async function handleSubscriptionEvent(event: Stripe.Event) {
  let businessId: string | null = null
  let subscriptionId: string | null = null
  let customerId: string | null = null
  let plan: Plan = 'pro'
  // Only Stripe's real subscription status may grant paid delivery. A bare
  // `customer.subscription.updated` also fires for past_due, unpaid, paused and
  // cancellation transitions, so treating it as an activation would revive
  // non-paying accounts.
  let entitled = false

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    businessId = session.metadata?.businessId ?? null
    subscriptionId = session.subscription as string
    customerId = session.customer as string
    entitled = session.payment_status === 'paid' || session.status === 'complete'
    const m = session.metadata?.plan
    plan = m === 'starter' ? 'starter' : 'pro'
  } else if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    subscriptionId = sub.id
    customerId = sub.customer as string
    const business = await db.business.findFirst({ where: { stripeCustomerId: customerId } })
    businessId = business?.id ?? null
    entitled = sub.status === 'active' || sub.status === 'trialing'
    plan = planOf(sub)
  }

  if (!businessId) return

  await db.business.update({
    where: { id: businessId },
    data: {
      tier: entitled ? plan : 'free',
      subscriptionStatus: entitled ? 'active' : 'inactive',
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
    },
  })

  await db.agentLog.create({
    data: {
      businessId,
      action: entitled ? 'subscription_activated' : 'paused_delivery',
      summary: entitled
        ? plan === 'pro'
          ? 'Pro activated: weekly content plus automatic newsletter delivery'
          : 'Starter activated: weekly content written for you every Monday'
        : 'Delivery paused: subscription is no longer in good standing',
      details: JSON.stringify({ event: event.type, plan }),
    },
  })
}

async function handleCancellation(event: Stripe.Event) {
  let customerId: string | null = null

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    customerId = sub.customer as string
  } else if (event.type === 'invoice.payment_failed') {
    const inv = event.data.object as Stripe.Invoice
    customerId = inv.customer as string
  }

  if (!customerId) return

  const business = await db.business.findFirst({ where: { stripeCustomerId: customerId } })
  if (!business) return

  await db.business.update({
    where: { id: business.id },
    data: { subscriptionStatus: 'inactive', tier: 'free' },
  })

  await db.agentLog.create({
    data: {
      businessId: business.id,
      action: 'paused_delivery',
      summary:
        event.type === 'invoice.payment_failed'
          ? 'Delivery paused: payment failed'
          : 'Delivery paused: subscription cancelled',
      details: JSON.stringify({ reason: event.type }),
    },
  })
}
