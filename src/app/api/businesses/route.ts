import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

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

    const existing = await db.business.findUnique({ where: { ownerEmail: data.ownerEmail } })
    if (existing) {
      return Response.json({ businessId: existing.id })
    }

    const business = await db.business.create({ data })

    return Response.json({ businessId: business.id }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 })
    console.error(err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
