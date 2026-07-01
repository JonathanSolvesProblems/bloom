import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get('businessId')
  if (!businessId) return Response.json({ error: 'Missing businessId' }, { status: 400 })

  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const origin = request.nextUrl.origin

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: business.ownerEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Bloom Pro — AI Marketing Agent',
            description: 'Weekly AI-generated social posts, newsletter, and Google updates — delivered automatically.',
          },
          unit_amount: 9900,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    metadata: { businessId },
    success_url: `${origin}/dashboard/${businessId}?activated=1`,
    cancel_url: `${origin}/preview/${businessId}`,
  })

  return Response.redirect(session.url!)
}
