import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { allowRequest, LIMITS } from '@/lib/ratelimit'

const schema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1),
  city: z.string().min(1).max(100),
  province: z.string().max(50).default(''),
  country: z.string().max(3).default('CA'),
  description: z.string().min(10).max(1000),
  brandVoice: z.enum(['friendly', 'professional', 'casual', 'bold', 'elegant']).default('friendly'),
  promotions: z.string().max(500).optional(),
  ownerName: z.string().min(1).max(100),
  ownerEmail: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = schema.parse(body)

    // Rate limit BEFORE the email lookup, otherwise this endpoint is an
    // unlimited email -> businessId oracle for any address an attacker guesses.
    if (!(await allowRequest(request, 'business', LIMITS.business))) {
      return Response.json(
        { error: 'Too many signups from your network today. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    const existing = await db.business.findUnique({ where: { ownerEmail: data.ownerEmail } })
    if (existing) {
      // Return the public id only. The dashboardToken is never re-issued here,
      // so knowing an owner's email can never grant dashboard access.
      return Response.json({ businessId: existing.id })
    }

    const business = await db.business.create({ data })

    return Response.json(
      { businessId: business.id, dashboardToken: business.dashboardToken },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 })
    console.error(err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
