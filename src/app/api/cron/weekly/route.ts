import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { generateWeeklyContent } from '@/lib/gemini'
import { Resend } from 'resend'

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
      const existing = await db.weeklyContent.findFirst({
        where: { businessId: business.id, weekOf },
      })

      let content = existing
      if (!content) {
        const result = await generateWeeklyContent({
          name: business.name,
          type: business.type,
          city: business.city,
          description: business.description,
          brandVoice: business.brandVoice,
          promotions: business.promotions,
        })

        content = await db.weeklyContent.create({
          data: {
            businessId: business.id,
            weekOf,
            post1: result.post1,
            post2: result.post2,
            post3: result.post3,
            newsletterSubject: result.newsletterSubject,
            newsletterHtml: result.newsletterHtml,
          },
        })

        await db.agentLog.create({
          data: {
            businessId: business.id,
            action: 'generated_content',
            summary: `Auto-generated weekly content for week of ${weekOf}`,
            details: JSON.stringify({ weekOf, newsletterSubject: result.newsletterSubject }),
          },
        })
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
            summary: `Sent newsletter to ${emailList.length} subscribers for week of ${weekOf}`,
            details: JSON.stringify({ weekOf, recipients: emailList.length, subject: content.newsletterSubject }),
          },
        })
        sent++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${business.name}: ${msg}`)
      console.error(`Failed for business ${business.id}:`, err)
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
