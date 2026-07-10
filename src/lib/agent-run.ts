import { db } from './db'
import { generateWeeklyContent, QA_THRESHOLD, type PriorWeek } from './gemini'
import { Resend } from 'resend'

type BusinessProfile = {
  name: string
  type: string
  city: string
  description: string
  brandVoice: string
  promotions?: string | null
  contentLanguage?: string | null
}

/**
 * A rewrite is a second full generation (~25s), too slow to run inside an
 * interactive preview request. Run it after the response instead: the visitor
 * gets the first draft immediately, and if the agent rejects its own work the
 * stored content is upgraded in place, so whoever opens the shared link later
 * sees the better version. The qa_regenerated event still lands in /agent.
 */
export async function rewriteInBackground(input: {
  businessId: string
  contentId: string
  weekOf: string
  business: BusinessProfile
  priorWeek: PriorWeek | null
  rejectedScore: number
  rejectedNotes: string
}): Promise<void> {
  try {
    const retry = await generateWeeklyContent(input.business, input.priorWeek, {
      allowRewrite: false,
      critique: input.rejectedNotes || 'Too generic; not specific to this business.',
    })

    // Only replace the draft if the rewrite genuinely scored better. Either way
    // the attempt is recorded: a silent no-op would make a broken rewrite look
    // identical to a rewrite that simply did not help.
    const improved = (retry.qaScore ?? -1) > input.rejectedScore

    if (improved) {
      await db.weeklyContent.update({
        where: { id: input.contentId },
        data: {
          post1: retry.post1,
          post2: retry.post2,
          post3: retry.post3,
          newsletterSubject: retry.newsletterSubject,
          newsletterHtml: retry.newsletterHtml,
          weeklyTheme: retry.weeklyTheme,
          featuredPromotion: retry.featuredPromotion,
          subjectVariants: JSON.stringify(retry.subjectVariants),
          reasoning: retry.reasoning,
          qaScore: retry.qaScore,
          regenerated: true,
          rejectedQaScore: input.rejectedScore,
          model: retry.model,
          tokensUsed: retry.tokensUsed,
          latencyMs: retry.latencyMs,
        },
      })
    }

    await db.agentLog.create({
      data: {
        businessId: input.businessId,
        action: 'qa_regenerated',
        summary: improved
          ? `Rejected its own draft (${input.rejectedScore}/100) and rewrote it. Accepted at ${retry.qaScore}/100.`.slice(0, 200)
          : `Rejected its own draft (${input.rejectedScore}/100), rewrote it, but the rewrite scored ${retry.qaScore}/100 so it kept the original.`.slice(0, 200),
        details: JSON.stringify({
          weekOf: input.weekOf,
          threshold: QA_THRESHOLD,
          improved,
          rejectedQaScore: input.rejectedScore,
          rejectedQaNotes: input.rejectedNotes,
          qaScore: retry.qaScore,
          qaNotes: retry.qaNotes,
          model: retry.model,
        }),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Background rewrite failed:', err)
    try {
      await db.agentLog.create({
        data: {
          businessId: input.businessId,
          action: 'agent_error',
          summary: `Background rewrite failed: ${msg}`.slice(0, 200),
          details: JSON.stringify({ weekOf: input.weekOf, error: msg }),
        },
      })
    } catch {
      /* logging must never crash the background task */
    }
  }
}

/** Monday (UTC date string) of the week the given date falls in. */
export function getMondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return ''
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Resend allows 5 requests/second per team and answers 429 beyond that. The
 * weekly fan-out can easily exceed that, so treat a rate limit as transient.
 */
async function sendBatchWithRetry(
  resend: Resend,
  payload: Parameters<Resend['batch']['send']>[0]
): Promise<string[]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await resend.batch.send(payload)
    if (!error) {
      // Keep the provider message ids. Acceptance is not delivery, and without
      // these we can never check afterwards whether mail actually landed.
      const rows = (data as { data?: { id: string }[] } | null)?.data ?? []
      return rows.map((r) => r.id).filter(Boolean)
    }

    const msg = error.message ?? JSON.stringify(error)
    const rateLimited = /rate.?limit|too many requests|\b429\b/i.test(msg)
    if (!rateLimited || attempt === 3) throw new Error(`Resend send failed: ${msg}`)
    await sleep(1000 * 2 ** attempt)
  }
  return []
}

// A French newsletter ending in an English "Unsubscribe" reads as machine output,
// and in Quebec the commercial communication is expected to be in French.
const UNSUB_COPY: Record<string, { line: (b: string) => string; link: string }> = {
  en: { line: (b) => `You are receiving this because you subscribed to updates from ${b}.`, link: 'Unsubscribe' },
  fr: { line: (b) => `Vous recevez ce courriel parce que vous êtes abonné aux nouvelles de ${b}.`, link: 'Se désabonner' },
  es: { line: (b) => `Recibes este correo porque te suscribiste a las novedades de ${b}.`, link: 'Cancelar suscripción' },
  pt: { line: (b) => `Você recebe este e-mail porque se inscreveu nas novidades de ${b}.`, link: 'Cancelar inscrição' },
  it: { line: (b) => `Ricevi questa email perché ti sei iscritto agli aggiornamenti di ${b}.`, link: 'Annulla iscrizione' },
  de: { line: (b) => `Du erhältst diese E-Mail, weil du Neuigkeiten von ${b} abonniert hast.`, link: 'Abmelden' },
}

function withUnsubscribe(html: string, unsubUrl: string, businessName: string, lang?: string | null): string {
  const copy = UNSUB_COPY[(lang || 'en').toLowerCase()] ?? UNSUB_COPY.en
  return `${html}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
<p style="font-size:12px;line-height:1.5;color:#6b7280;text-align:center;font-family:sans-serif">
  ${copy.line(businessName)}<br />
  <a href="${unsubUrl}" style="color:#6b7280">${copy.link}</a>
</p>`
}

/**
 * Run the weekly agent for exactly ONE business: generate the week's content if
 * it does not exist yet, then email the newsletter to its subscribers.
 *
 * Designed to be invoked once per business (one serverless invocation each) so
 * the work never has to fit a single function's time budget. Idempotent: safe
 * to call twice for the same week.
 */
export async function runWeeklyForBusiness(businessId: string): Promise<{ generated: boolean; sent: number }> {
  const weekOf = getMondayOf(new Date())

  const business = await db.business.findUnique({
    where: { id: businessId },
    include: { subscribers: true },
  })
  if (!business) throw new Error('Business not found')
  if (business.subscriptionStatus !== 'active') {
    throw new Error('Business is not an active subscriber; refusing to deliver paid work')
  }

  let content = await db.weeklyContent.findFirst({ where: { businessId, weekOf } })
  let generated = false

  if (!content) {
    // Week-to-week memory: the agent sees what it ran last week so it does not
    // repeat the same theme or subject line.
    const prior = await db.weeklyContent.findFirst({
      where: { businessId, weekOf: { not: weekOf } },
      orderBy: { createdAt: 'desc' },
      select: { weeklyTheme: true, newsletterSubject: true },
    })

    const c = await generateWeeklyContent(
      {
        name: business.name,
        type: business.type,
        city: business.city,
        description: business.description,
        brandVoice: business.brandVoice,
        promotions: business.promotions,
        contentLanguage: business.contentLanguage,
      },
      prior ? { weeklyTheme: prior.weeklyTheme, chosenSubject: prior.newsletterSubject } : null
    )
    const ownerGavePromo = !!business.promotions && business.promotions.trim().length > 0

    try {
      content = await db.weeklyContent.create({
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
      generated = true
    } catch {
      // A concurrent invocation won the @@unique([businessId, weekOf]) race.
      content = await db.weeklyContent.findFirst({ where: { businessId, weekOf } })
      if (!content) throw new Error('Failed to persist weekly content')
    }

    if (generated) {
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
              threshold: QA_THRESHOLD,
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
        // Never hide a broken gate. If the agent could not critique itself, say so.
        await db.agentLog.create({
          data: {
            businessId,
            action: 'qa_failed',
            summary: 'Self-QA could not score this run; content shipped ungated',
            details: JSON.stringify({ weekOf, model: c.model }),
          },
        })
      }
    }
  }

  let sent = 0
  if (!content.newsletterSent && business.subscribers.length > 0) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY is not set; cannot send newsletter')

    // Refuse to send from an unverified domain. Resend returns an error object
    // rather than throwing, so silently "succeeding" here would tell the
    // customer their newsletter went out when nothing was delivered.
    const fromDomain = process.env.RESEND_FROM_DOMAIN
    if (!fromDomain) throw new Error('RESEND_FROM_DOMAIN is not set; refusing to send from an unverified domain')

    const base = appBaseUrl()
    if (!base) throw new Error('No app base URL; cannot build unsubscribe links')

    const resend = new Resend(apiKey)
    const from = `${business.name} <newsletter@${fromDomain}>`

    const messageIds: string[] = []

    // Resend's batch endpoint accepts at most 100 messages per call.
    for (const group of chunk(business.subscribers, 100)) {
      const payload = group.map((s: { id: string; email: string }) => {
        const unsubUrl = `${base}/api/unsubscribe?s=${s.id}`
        return {
          from,
          to: s.email,
          subject: content!.newsletterSubject,
          html: withUnsubscribe(content!.newsletterHtml, unsubUrl, business.name, business.contentLanguage),
          headers: { 'List-Unsubscribe': `<${unsubUrl}>` },
        }
      })

      const ids = await sendBatchWithRetry(resend, payload)
      messageIds.push(...ids)
      sent += group.length
    }

    await db.weeklyContent.update({
      where: { id: content.id },
      data: { newsletterSent: true, newsletterSentAt: new Date(), subscriberCount: sent },
    })

    await db.agentLog.create({
      data: {
        businessId,
        action: 'sent_newsletter',
        summary: `Emailed newsletter to ${sent} subscribers`,
        details: JSON.stringify({
          weekOf,
          recipients: sent,
          subject: content.newsletterSubject,
          // Provider ids: acceptance only. Delivery is confirmed separately.
          messageIds,
        }),
      },
    })
  }

  return { generated, sent }
}
