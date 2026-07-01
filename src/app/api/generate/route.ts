import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { generateWeeklyContent } from '@/lib/gemini'

const schema = z.object({ businessId: z.string().cuid() })

function getMondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId } = schema.parse(body)

    const business = await db.business.findUniqueOrThrow({ where: { id: businessId } })

    const weekOf = getMondayOf(new Date())

    const existing = await db.weeklyContent.findFirst({
      where: { businessId, weekOf },
    })
    if (existing) {
      return Response.json({ content: existing })
    }

    const content = await generateWeeklyContent({
      name: business.name,
      type: business.type,
      city: business.city,
      description: business.description,
      brandVoice: business.brandVoice,
      promotions: business.promotions,
    })

    const saved = await db.weeklyContent.create({
      data: {
        businessId,
        weekOf,
        post1: content.post1,
        post2: content.post2,
        post3: content.post3,
        newsletterSubject: content.newsletterSubject,
        newsletterHtml: content.newsletterHtml,
      },
    })

    await db.agentLog.create({
      data: {
        businessId,
        action: 'generated_content',
        summary: `Generated weekly content for week of ${weekOf}`,
        details: JSON.stringify({ weekOf, newsletterSubject: content.newsletterSubject }),
      },
    })

    return Response.json({ content: saved })
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 })
    console.error(err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
