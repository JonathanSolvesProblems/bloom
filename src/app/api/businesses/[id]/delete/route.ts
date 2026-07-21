import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'

/**
 * Delete a business and everything attached to it.
 *
 * The privacy policy promises an owner can delete their data at any time, and
 * this is the code that keeps that promise. It is also the answer to the single
 * biggest objection this product has: an owner is uploading their entire client
 * list, and they need to know they can take it back.
 *
 * POST + token-gated, so a link prefetch can never wipe an account. Cancels any
 * live subscription immediately (the account is being destroyed, not paused),
 * then deletes the children before the parent, since the schema has no cascade.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params
  const token = request.nextUrl.searchParams.get('t') ?? ''

  const business = await db.business.findUnique({ where: { id: businessId } })
  // 404 rather than 403 so the route never confirms a business exists.
  if (!business || !token || token !== business.dashboardToken) {
    return new Response('Not found', { status: 404 })
  }

  // Stop billing first. If this throws, do NOT delete: leaving the account intact
  // is far better than destroying the record while a subscription keeps charging a
  // card with nothing left to point it at.
  if (business.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      await stripe.subscriptions.cancel(business.stripeSubscriptionId)
    } catch (err) {
      // "No such subscription" means it is already gone, which is fine; anything
      // else is a real failure and must stop the delete.
      const msg = String((err as Error)?.message ?? err)
      if (!/No such subscription|resource_missing/i.test(msg)) {
        console.error('Delete blocked, could not cancel subscription:', err)
        return page(
          'Could not delete yet',
          'I could not cancel your subscription, so I have not deleted anything, to be safe. Please try again in a minute, or contact support.'
        )
      }
    }
  }

  // Children before parent, one transaction, so a half-delete cannot strand rows
  // that outlive the business they belonged to.
  await db.$transaction([
    db.client.deleteMany({ where: { businessId } }),
    db.subscriber.deleteMany({ where: { businessId } }),
    db.weeklyContent.deleteMany({ where: { businessId } }),
    db.agentLog.deleteMany({ where: { businessId } }),
    db.business.delete({ where: { id: businessId } }),
  ])

  return page(
    'Your account and data are deleted.',
    'Everything you uploaded is gone: your client list, your history, and your account. Nothing more will be sent to anyone. Thank you for trying Bloom.'
  )
}

/** A plain confirmation page. There is no dashboard to return to anymore. */
function page(title: string, body: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#151516;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#f1eee4">
  <div style="max-width:440px;padding:32px;text-align:center">
    <h1 style="font-size:1.4rem;margin:0 0 12px">${title}</h1>
    <p style="color:#9a968c;line-height:1.6;margin:0 0 24px">${body}</p>
    <a href="/" style="display:inline-block;background:#f1eee4;color:#151516;text-decoration:none;padding:12px 22px;border-radius:2px;font-weight:600">Back to home</a>
  </div>
</body></html>`
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
