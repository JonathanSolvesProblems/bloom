import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { generateWeeklyContent } from '@/lib/gemini'
import { Resend } from 'resend'

export const maxDuration = 60

function getMondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekOf = getMondayOf(new Date())

  const businesses = await db.business.findMany({
    where: { subscriptionStatus: 'active' },
    include: { subscribers: true },
  })

  let generated = 0
  let sent = 0
  const errors: string[] = []

  for (const business of businesses) {
    try {
      let content = await db.weeklyContent.findFirst({
        where: { businessId: business.id, weekOf },
      })

      if (!content) {
        const c = await generateWeeklyContent({
          name: business.name,
          type: business.type,
          city: business.city,
          description: business.description,
          brandVoice: business.brandVoice,
          promotions: business.promotions,
        })

        const ownerGavePromo = !!business.promotions && business.promotions.trim().length > 0

        content = await db.weeklyContent.create({
          data: {
            businessId: business.id,
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
            model: c.model,
            tokensUsed: c.tokensUsed,
            latencyMs: c.latencyMs,
          },
        })

        await db.agentLog.create({
          data: {
            businessId: business.id,
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
              businessId: business.id,
              action: 'decided_promotion',
              summary: `Chose this week's angle: ${c.featuredPromotion}`.slice(0, 200),
              details: JSON.stringify({ weekOf, featuredPromotion: c.featuredPromotion, reasoning: c.reasoning }),
            },
          })
        }

        if (c.qaScore !== null) {
          await db.agentLog.create({
            data: {
              businessId: business.id,
              action: 'qa_review',
              summary: `Self-QA scored ${c.qaScore}/100${c.qaNotes ? '. ' + c.qaNotes : ''}`.slice(0, 200),
              details: JSON.stringify({ weekOf, qaScore: c.qaScore, qaNotes: c.qaNotes, model: c.model }),
            },
          })
        }

        generated++
      }

      if (!content.newsletterSent && business.subscribers.length > 0) {
        const resend = new Resend(process.env.RESEND_API_KEY!)
        const emailList = business.subscribers.map((s: { email: string }) => s.email)
        const fromDomain = process.env.RESEND_FROM_DOMAIN ?? 'bloom.ai'
        const fromEmail = `${business.name} <newsletter@${fromDomain}>`

        await resend.batch.send(
          emailList.map((to: string) => ({
            from: fromEmail,
            to,
            subject: content!.newsletterSubject,
            html: content!.newsletterHtml,
          }))
        )

        await db.weeklyContent.update({
          where: { id: content.id },
          data: {
            newsletterSent: true,
            newsletterSentAt: new Date(),
            subscriberCount: emailList.length,
          },
        })

        await db.agentLog.create({
          data: {
            businessId: business.id,
            action: 'sent_newsletter',
            summary: `Emailed newsletter to ${emailList.length} subscribers`,
            details: JSON.stringify({ weekOf, recipients: emailList.length, subject: content.newsletterSubject }),
          },
        })
        sent++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${business.name}: ${msg}`)
      console.error(`Failed for business ${business.id}:`, err)
      try {
        await db.agentLog.create({
          data: {
            businessId: business.id,
            action: 'agent_error',
            summary: `Weekly run failed: ${msg}`.slice(0, 200),
            details: JSON.stringify({ weekOf, error: msg }),
          },
        })
      } catch {
        /* logging must never crash the run */
      }
    }
  }

  return Response.json({
    ok: true,
    weekOf,
    businesses: businesses.length,
    generated,
    sent,
    errors,
  })
}
