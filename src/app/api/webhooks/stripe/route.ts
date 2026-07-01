import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { waitUntil } from '@vercel/functions'

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
    waitUntil(handleSubscriptionEvent(event))
  }

  if (
    event.type === 'customer.subscription.deleted' ||
    event.type === 'invoice.payment_failed'
  ) {
    waitUntil(handleCancellation(event))
  }

  return Response.json({ received: true })
}

async function handleSubscriptionEvent(event: Stripe.Event) {
  let businessId: string | null = null
  let subscriptionId: string | null = null
  let customerId: string | null = null

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    businessId = session.metadata?.businessId ?? null
    subscriptionId = session.subscription as string
    customerId = session.customer as string
  } else if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    subscriptionId = sub.id
    customerId = sub.customer as string
    const business = await db.business.findFirst({ where: { stripeCustomerId: customerId } })
    businessId = business?.id ?? null
  }

  if (!businessId) return

  await db.business.update({
    where: { id: businessId },
    data: {
      tier: 'pro',
      subscriptionStatus: 'active',
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
    },
  })

  await db.agentLog.create({
    data: {
      businessId,
      action: 'subscription_activated',
      summary: 'Pro subscription activated — weekly AI content delivery enabled',
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
}
