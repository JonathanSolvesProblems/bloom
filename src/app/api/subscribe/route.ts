import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { allowRequest } from '@/lib/ratelimit'

const schema = z.object({
  businessId: z.string().cuid(),
  email: z.string().email(),
})

// A public signup form. Cap sign-ups per network per day so nobody can script
// it to bomb a stranger's inbox with confirmations, and cap the list size so a
// single business cannot be inflated to a spam vector.
const SUBSCRIBE_PER_DAY = 20
const MAX_SUBSCRIBERS_PER_BUSINESS = 5000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId, email } = schema.parse(body)

    // Never attach subscribers to the comped demo business. Its whole safety
    // rests on staying at zero subscribers so it can never email on the owner's
    // Resend quota. Report success so the endpoint is not a probe.
    if (businessId === process.env.DEMO_BUSINESS_ID) {
      return Response.json({ ok: true })
    }

    if (!(await allowRequest(request, 'subscribe', SUBSCRIBE_PER_DAY))) {
      return Response.json({ error: 'Too many sign-ups from your network today. Please try again tomorrow.' }, { status: 429 })
    }

    const business = await db.business.findUnique({ where: { id: businessId } })
    if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })

    // Only count toward the cap when this is a genuinely new address.
    const already = await db.subscriber.findUnique({
      where: { businessId_email: { businessId, email } },
      select: { id: true },
    })
    if (!already) {
      const count = await db.subscriber.count({ where: { businessId } })
      if (count >= MAX_SUBSCRIBERS_PER_BUSINESS) {
        // Do not reveal the cap; report success so the form is never a probe.
        return Response.json({ ok: true })
      }
      await db.subscriber.create({ data: { businessId, email } })
    }

    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues[0]?.message }, { status: 400 })
    console.error(err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
