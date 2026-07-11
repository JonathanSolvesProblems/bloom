import { NextRequest } from 'next/server'
import { z } from 'zod'
import { after } from '@/lib/after'
import { db } from '@/lib/db'
import { generateWeeklyContent, QA_THRESHOLD } from '@/lib/gemini'
import { rewriteInBackground } from '@/lib/agent-run'
import { brandEmail } from '@/lib/email-template'
import { allowRequest, underGlobalCap, LIMITS, GLOBAL_LIMITS } from '@/lib/ratelimit'

// The response lands in ~25s, but the background rewrite runs inside this same
// invocation via after() and counts against maxDuration. Give it headroom.
export const maxDuration = 120

const schema = z.object({ businessId: z.string().cuid() })

type Brand = { name: string; brandColor: string; logoUrl: string }

/** Render the stored newsletter body in the business's branding for display. */
function branded<T extends { newsletterHtml: string }>(content: T, b: Brand): T {
  return { ...content, newsletterHtml: brandEmail(content.newsletterHtml, b) }
}

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

    const business = await db.business.findUnique({ where: { id: businessId } })
    if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })
    const weekOf = getMondayOf(new Date())

    // Reuse this week's content if it already exists, for both free and paid.
    // Keying on weekOf (not just businessId) means editing promotions clears the
    // current-week row (see the promotions route), so a re-preview reflects the
    // edit instead of silently returning last time's stale sample.
    const brand: Brand = { name: business.name, brandColor: business.brandColor, logoUrl: business.logoUrl }

    // Cost control: a free/inactive business gets ONE sample, reused forever
    // (editing promotions clears it so a re-preview regenerates, see the
    // promotions route). Only paying businesses regenerate fresh each week.
    const existing =
      business.subscriptionStatus === 'active'
        ? await db.weeklyContent.findFirst({ where: { businessId, weekOf } })
        : await db.weeklyContent.findFirst({ where: { businessId }, orderBy: { createdAt: 'desc' } })
    if (existing) {
      return Response.json({ content: branded(existing, brand) })
    }

    // Only real (paid) generations past this point are rate limited.
    if (!(await allowRequest(request, 'generate', LIMITS.generate))) {
      return Response.json(
        { error: 'Too many previews from your network today. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    // Hard daily ceiling on FREE previews across everyone, so a distributed
    // attack cannot run up the bill. Paying businesses are never blocked here.
    if (
      business.subscriptionStatus !== 'active' &&
      !(await underGlobalCap('generate', GLOBAL_LIMITS.generate))
    ) {
      return Response.json(
        { error: 'The free preview is at capacity for today. Please check back tomorrow.' },
        { status: 429 }
      )
    }

    const profile = {
      name: business.name,
      type: business.type,
      city: business.city,
      description: business.description,
      brandVoice: business.brandVoice,
      promotions: business.promotions,
      contentLanguage: business.contentLanguage,
    }

    // Keep the interactive preview fast: never rewrite inside the request.
    const c = await generateWeeklyContent(profile, null, { allowRewrite: false })

    const ownerGavePromo = !!business.promotions && business.promotions.trim().length > 0

    let saved
    try {
      saved = await db.weeklyContent.create({
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
    } catch (e) {
      // A second concurrent preview click won the @@unique([businessId, weekOf])
      // race. Return the row it created instead of surfacing a 500 on the very
      // top of the funnel.
      if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
        const now = await db.weeklyContent.findFirst({ where: { businessId, weekOf } })
        if (now) return Response.json({ content: branded(now, brand) })
      }
      throw e
    }

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
    } else if (c.qaFailed) {
      await db.agentLog.create({
        data: {
          businessId,
          action: 'qa_failed',
          summary: 'Self-QA could not score this run; content shipped ungated',
          details: JSON.stringify({ weekOf, model: c.model }),
        },
      })
    }

    // The agent judged its own draft below the bar: reject and rewrite it after
    // the response, upgrading the stored content in place.
    if (c.qaScore !== null && c.qaScore < QA_THRESHOLD) {
      after(
        rewriteInBackground({
          businessId,
          contentId: saved.id,
          weekOf,
          business: profile,
          priorWeek: null,
          rejectedScore: c.qaScore,
          rejectedNotes: c.qaNotes,
        })
      )
    }

    return Response.json({ content: branded(saved, brand) })
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 })
    console.error(err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
