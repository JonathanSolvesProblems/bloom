import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const schema = z.object({
  businessId: z.string().cuid(),
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId, email } = schema.parse(body)

    const business = await db.business.findUnique({ where: { id: businessId } })
    if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })

    await db.subscriber.upsert({
      where: { businessId_email: { businessId, email } },
      update: {},
      create: { businessId, email },
    })

    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues[0]?.message }, { status: 400 })
    console.error(err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
