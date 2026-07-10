import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'

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

  // The entitlement write is what grants or revokes paid service, so it runs
  // synchronously and any failure returns 500. Stripe retries a non-2xx webhook
  // for hours; deferring this to after() would return 200, and a transient DB
  // blip would then silently strand a customer who paid, with no redelivery.
  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'customer.subscription.updated'
    ) {
      await handleSubscriptionEvent(event)
    } else if (
      event.type === 'customer.subscription.deleted' ||
      event.type === 'invoice.payment_failed'
    ) {
      await handleCancellation(event)
    }
  } catch (err) {
    console.error('Stripe webhook handler failed:', err)
    return Response.json({ error: 'Handler failed, retry' }, { status: 500 })
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

/**
 * The subscription id on an invoice moved between Stripe API versions: older
 * ones expose `invoice.subscription`, newer ones nest it under
 * `parent.subscription_details.subscription`. Read whichever is present so the
 * handler works regardless of the account's pinned API version.
 */
function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const i = inv as unknown as {
    subscription?: string | { id?: string } | null
    parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null
  }
  const direct = i.subscription
  if (typeof direct === 'string') return direct
  if (direct && typeof direct === 'object' && direct.id) return direct.id
  const nested = i.parent?.subscription_details?.subscription
  if (typeof nested === 'string') return nested
  if (nested && typeof nested === 'object' && nested.id) return nested.id
  return null
}

async function handleCancellation(event: Stripe.Event) {
  let customerId: string | null = null
  let reason: string = event.type

  if (event.type === 'customer.subscription.deleted') {
    // A truly ended subscription. Revoke service.
    const sub = event.data.object as Stripe.Subscription
    customerId = sub.customer as string
  } else if (event.type === 'invoice.payment_failed') {
    // A failed charge is NOT a cancellation. Stripe keeps the subscription
    // active and dunning-retries for days, and this event also fires when the
    // Starter -> Pro upgrade proration invoice declines while the base plan is
    // still fully paid. Revoking here would cancel service the customer is still
    // entitled to and that Stripe would have recovered on its own. Only pause if
    // the subscription itself has actually reached a dead state.
    const inv = event.data.object as Stripe.Invoice
    customerId = inv.customer as string
    const subId = invoiceSubscriptionId(inv)
    if (!subId) return

    let sub: Stripe.Subscription
    try {
      sub = await getStripe().subscriptions.retrieve(subId)
    } catch {
      // Can't confirm the state: leave entitlement untouched rather than risk a
      // wrongful cancellation. Stripe will fire subscription.deleted if it dies.
      return
    }
    if (sub.status !== 'canceled' && sub.status !== 'unpaid') return
    reason = `invoice.payment_failed (subscription ${sub.status})`
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
          ? 'Delivery paused: subscription lapsed after repeated failed payments'
          : 'Delivery paused: subscription cancelled',
      details: JSON.stringify({ reason }),
    },
  })
}
