import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { generateWeeklyContent } from '@/lib/gemini'
import { allowRequest, LIMITS } from '@/lib/ratelimit'

export const maxDuration = 60

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

    // Free preview is one-time per business (cost control): reuse the sample they
    // already got. Paying (active) businesses regenerate fresh content each week.
    const existing =
      business.subscriptionStatus === 'active'
        ? await db.weeklyContent.findFirst({ where: { businessId, weekOf } })
        : await db.weeklyContent.findFirst({ where: { businessId }, orderBy: { createdAt: 'desc' } })
    if (existing) {
      return Response.json({ content: existing })
    }

    // Only real (paid) generations past this point are rate limited.
    if (!(await allowRequest(request, 'generate', LIMITS.generate))) {
      return Response.json(
        { error: 'Too many previews from your network today. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    const c = await generateWeeklyContent({
      name: business.name,
      type: business.type,
      city: business.city,
      description: business.description,
      brandVoice: business.brandVoice,
      promotions: business.promotions,
    })

    const ownerGavePromo = !!business.promotions && business.promotions.trim().length > 0

    const saved = await db.weeklyContent.create({
      data: {
        businessId,
        weekOf,
        post1: c.post1,
        post2: c.post2,
        post3: c.post3,
        newsletterSubject: c.newsletterSubject,
        newsletterHtml: c.newsletterHtml,
        weeklyTheme: c.weeklyTheme,
        featuredPromotion: c.featuredPromotion,
        subjectVariants: JSON.stringify(c.subjectVariants),
        reasoning: c.reasoning,
        qaScore: c.qaScore,
        regenerated: c.regenerated,
        rejectedQaScore: c.rejectedQaScore,
        model: c.model,
        tokensUsed: c.tokensUsed,
        latencyMs: c.latencyMs,
      },
    })

    await db.agentLog.create({
      data: {
        businessId,
        action: 'generated_content',
        summary: `Wrote 3 posts + newsletter. Theme: ${c.weeklyTheme || 'weekly update'}`.slice(0, 200),
        details: JSON.stringify({
          weekOf,
          weeklyTheme: c.weeklyTheme,
          featuredPromotion: c.featuredPromotion,
          chosenSubject: c.chosenSubject,
          subjectVariants: c.subjectVariants,
          reasoning: c.reasoning,
          model: c.model,
          tokensUsed: c.tokensUsed,
          latencyMs: c.latencyMs,
        }),
      },
    })

    if (!ownerGavePromo && c.featuredPromotion) {
      await db.agentLog.create({
        data: {
          businessId,
          action: 'decided_promotion',
          summary: `Chose this week's angle: ${c.featuredPromotion}`.slice(0, 200),
          details: JSON.stringify({ weekOf, featuredPromotion: c.featuredPromotion, reasoning: c.reasoning }),
        },
      })
    }

    if (c.qaScore !== null) {
      await db.agentLog.create({
        data: {
          businessId,
          action: c.regenerated ? 'qa_regenerated' : 'qa_review',
          summary: c.regenerated
            ? `Rejected its own draft (${c.rejectedQaScore}/100) and rewrote it. Accepted at ${c.qaScore}/100.`.slice(0, 200)
            : `Self-QA scored ${c.qaScore}/100${c.qaNotes ? '. ' + c.qaNotes : ''}`.slice(0, 200),
          details: JSON.stringify({
            weekOf,
            qaScore: c.qaScore,
            qaNotes: c.qaNotes,
            regenerated: c.regenerated,
            rejectedQaScore: c.rejectedQaScore,
            rejectedQaNotes: c.rejectedQaNotes,
            model: c.model,
          }),
        },
      })
    }

    return Response.json({ content: saved })
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 })
    console.error(err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
