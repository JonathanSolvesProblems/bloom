import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { allowRequest, LIMITS } from '@/lib/ratelimit'

const schema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1),
  city: z.string().max(100).default(''),
  province: z.string().max(50).default(''),
  country: z.string().max(3).default('CA'),
  // Optional now. The flagship is the retention radar, which needs none of this;
  // a description is only used for weekly content, so collecting it up front gated
  // a spreadsheet analysis behind a marketing question. Prompted for later, in the
  // dashboard, only when the owner turns content on.
  description: z.string().max(1000).default(''),
  brandVoice: z.enum(['friendly', 'professional', 'casual', 'bold', 'elegant']).default('friendly'),
  contentLanguage: z.enum(['en', 'fr', 'es', 'pt', 'it', 'de']).default('en'),
  // Optional at signup so the radar stays frictionless. Required before any email
  // can send (enforced in the send path), and editable in the dashboard, so a new
  // owner is never blocked from seeing who is slipping.
  mailingAddress: z.string().max(200).optional(),
  promotions: z.string().max(500).optional(),
  ownerName: z.string().min(1).max(100),
  ownerEmail: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = schema.parse(body)

    // Run the two independent reads together to shave a round trip off signup. The
    // rate limit still gates the RESPONSE: if the caller is over the limit we return
    // 429 and discard the lookup, so this is not an email -> account oracle.
    const [allowed, existing] = await Promise.all([
      allowRequest(request, 'business', LIMITS.business),
      db.business.findUnique({ where: { ownerEmail: data.ownerEmail } }),
    ])
    if (!allowed) {
      return Response.json(
        { error: 'Too many signups from your network today. Please try again tomorrow.' },
        { status: 429 }
      )
    }
    if (existing) {
      // This email already has an account. Never re-issue the dashboardToken here
      // (knowing an email must not grant access). Signal `existing` so the setup
      // flow can send the returning owner to recover their dashboard link instead
      // of silently discarding their new input and showing a stale preview.
      return Response.json({ existing: true })
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
