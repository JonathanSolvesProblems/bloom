import { NextRequest } from 'next/server'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { draftWinBack } from '@/lib/gemini'
import { assess, businessCadence, contactState } from '@/lib/retention'
import { brandEmail } from '@/lib/email-template'
import { publicBaseUrl } from '@/lib/config'
import { appBaseUrl, esc, sanitizeSenderName } from '@/lib/agent-run'
import { allowForKey, underGlobalCap, LIMITS, GLOBAL_LIMITS } from '@/lib/ratelimit'

export const maxDuration = 60

/**
 * Addresses that can never receive mail: the IANA reserved domains (RFC 2606,
 * RFC 6761). The sample book is built from these on purpose, so anyone can try the
 * radar with fake people. Sending would hard bounce, and bounces are scored
 * against the sending domain every customer shares, so these are drafted and held.
 */
const UNDELIVERABLE = /@(example\.(com|org|net)|test|invalid|localhost)$/i

type StoredDraft = { subject: string; body: string; reasoning: string; model: string; tokensUsed: number }

/**
 * Win one specific client back, in two deliberate steps.
 *
 * `draft` (the default): the agent reads the client's real history and writes a
 * note, which is STORED and shown to the owner. Nothing is sent. This is the
 * whole trust story of a product that emails your clients: you see the exact words
 * before they go.
 *
 * `send`: the owner approves the stored draft and it goes out, once. `discard`
 * throws the draft away. Owner-token gated throughout.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData()
  const businessId = request.nextUrl.searchParams.get('businessId') ?? ''
  const token = request.nextUrl.searchParams.get('t') ?? ''
  const email = (form.get('email')?.toString() ?? '').trim().toLowerCase()
  const action = (form.get('action')?.toString() ?? 'draft').toLowerCase()

  const business = await db.business.findUnique({ where: { id: businessId }, include: { clients: true } })
  if (!business || !token || token !== business.dashboardToken) {
    return new Response('Not found', { status: 404 })
  }

  const origin = publicBaseUrl(request)
  // Every redirect carries the client's anchor so the page returns to the row the
  // owner was acting on, instead of dumping them back at the top of a long book.
  const back = (p: string, anchor?: string) =>
    `${origin}/dashboard/${businessId}/clients?t=${encodeURIComponent(token)}&${p}${anchor ? `#c-${anchor}` : ''}`

  const client = business.clients.find((c) => c.email === email)
  if (!client) return Response.redirect(back('import_error=Client%20not%20found'), 303)
  if (client.unsubscribedAt) {
    return Response.redirect(back('import_error=That%20client%20unsubscribed%2C%20so%20I%20will%20not%20contact%20them'), 303)
  }

  // ---- Discard a pending draft ----
  if (action === 'discard') {
    await db.client.update({ where: { id: client.id }, data: { winBackDraft: null, winBackDraftedAt: null } })
    return Response.redirect(back(`discarded=${encodeURIComponent(client.name)}`, client.id), 303)
  }

  // ---- Send an already-approved draft ----
  if (action === 'send') {
    if (!client.winBackDraft) return Response.redirect(back('import_error=Nothing%20to%20send%2C%20draft%20one%20first'), 303)
    const state = contactState(client)
    if (state.kind === 'capped' || state.kind === 'opted_out') {
      return Response.redirect(back('import_error=I%20will%20not%20write%20to%20them%20again'), 303)
    }

    let draft: StoredDraft
    try {
      draft = JSON.parse(client.winBackDraft)
    } catch {
      return Response.redirect(back('import_error=That%20draft%20was%20corrupted%2C%20write%20a%20new%20one'), 303)
    }

    const apiKey = process.env.RESEND_API_KEY
    const fromDomain = process.env.RESEND_FROM_DOMAIN
    if (!apiKey || !fromDomain) return Response.redirect(back('import_error=Sending%20is%20not%20configured%20yet'), 303)
    if (!business.mailingAddress?.trim()) {
      return Response.redirect(back('import_error=Add%20your%20business%20postal%20address%20first%2C%20anti-spam%20law%20requires%20it'), 303)
    }
    const base = appBaseUrl()
    if (!base) return Response.redirect(back('import_error=No%20app%20URL%20configured'), 303)

    const a = assess(client, businessCadence(business.clients))

    // Claim the DRAFT atomically, not the sent-timestamp: a follow-up legitimately
    // has an earlier winBackSentAt, so the draft is what proves this send has not
    // already happened. Two submits race, one clears the draft, the other finds
    // nothing to claim.
    const claim = await db.client.updateMany({
      where: { id: client.id, winBackDraft: { not: null } },
      data: {
        winBackSentAt: new Date(),
        winBackDraft: null,
        winBackDraftedAt: null,
        contactCount: { increment: 1 },
      },
    })
    if (claim.count === 0) return Response.redirect(back('import_error=Already%20sent'), 303)
    const releaseForRetry = () =>
      db.client.updateMany({
        where: { id: client.id },
        data: {
          winBackSentAt: client.winBackSentAt,
          contactCount: client.contactCount,
          winBackDraft: client.winBackDraft,
          winBackDraftedAt: client.winBackDraftedAt,
        },
      })

    // Sample address: keep the send claimed (so a later recovery still counts) but
    // do not put a guaranteed bounce through the shared domain.
    if (UNDELIVERABLE.test(client.email)) {
      await db.agentLog.create({
        data: {
          businessId,
          action: 'winback_drafted',
          summary: `Held the send to a sample client, the address is a reserved test one. ${a.reason}`.slice(0, 200),
          details: JSON.stringify({ risk: a.level, subject: draft.subject, body: draft.body, sent: false }),
        },
      })
      return Response.redirect(back(`drafted=${encodeURIComponent(client.name)}`, client.id), 303)
    }

    const unsubUrl = `${base}/api/unsubscribe?c=${client.id}`
    const html = `${brandEmail(draft.body, { name: business.name, brandColor: business.brandColor, logoUrl: business.logoUrl })}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
<p style="font-size:12px;line-height:1.5;color:#6b7280;text-align:center;font-family:sans-serif">
  ${esc(business.mailingAddress)}<br />
  <a href="${unsubUrl}" style="color:#6b7280">Unsubscribe</a>
</p>`

    try {
      const resend = new Resend(apiKey)
      const { error } = await resend.emails.send({
        from: `${sanitizeSenderName(business.name)} <hello@${fromDomain}>`,
        to: client.email,
        subject: draft.subject,
        html,
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })
      if (error) throw new Error(error.message ?? JSON.stringify(error))
    } catch (err) {
      await releaseForRetry()
      console.error('Win-back send failed:', err)
      return Response.redirect(back('import_error=Send%20failed%2C%20try%20again'), 303)
    }

    await db.agentLog.create({
      data: {
        businessId,
        action: 'winback_sent',
        // Public feed: never a name, address, or amount, only the situation.
        summary: `Wrote a personal note to a ${a.level === 'critical' ? 'client slipping away' : 'drifting client'}. ${a.reason}`.slice(0, 200),
        details: JSON.stringify({
          risk: a.level,
          daysSince: a.daysSince,
          annualValue: a.annualValue,
          subject: draft.subject,
          draftReasoning: draft.reasoning,
          model: draft.model,
          tokensUsed: draft.tokensUsed,
        }),
      },
    })
    return Response.redirect(back(`sent=${encodeURIComponent(client.name)}`, client.id), 303)
  }

  // ---- Draft (default): write a note and store it for the owner to review ----
  const state = contactState(client)
  if (state.kind === 'capped') {
    return Response.redirect(
      back('import_error=I%20have%20written%20to%20them%20twice%20already.%20I%20will%20not%20keep%20going.'),
      303
    )
  }
  if (state.kind === 'cooling') {
    return Response.redirect(
      back(
        `import_error=${encodeURIComponent(`I wrote to them recently. You can follow up in ${state.daysLeft} ${state.daysLeft === 1 ? 'day' : 'days'}, which gives them room to reply.`)}`
      ),
      303
    )
  }

  // Drafting is the paid, metered step, because it is the one that spends a Gemini
  // call. Seeing the radar is free; writing to someone is what the plan buys.
  if (business.subscriptionStatus !== 'active') {
    return Response.redirect(back('needs_plan=1'), 303)
  }
  if (!(await allowForKey('winback', businessId, LIMITS.winback))) {
    return Response.redirect(
      back(`import_error=${encodeURIComponent(`That is ${LIMITS.winback} drafts today, my daily limit. The rest will still be here tomorrow.`)}`),
      303
    )
  }
  if (!(await underGlobalCap('winback', GLOBAL_LIMITS.winback))) {
    return Response.redirect(back('import_error=Drafting%20is%20paused%20for%20today.%20Nothing%20is%20lost%2C%20try%20again%20tomorrow.'), 303)
  }

  const a = assess(client, businessCadence(business.clients))
  let draft
  try {
    draft = await draftWinBack({
      business: {
        name: business.name,
        type: business.type,
        city: business.city,
        brandVoice: business.brandVoice,
        contentLanguage: business.contentLanguage,
        promotions: business.promotions,
      },
      client: {
        name: client.name,
        lastService: client.lastService,
        visitCount: client.visitCount,
        cadenceDays: client.cadenceDays,
        daysSince: a.daysSince,
      },
      situation: a.reason,
    })
  } catch (err) {
    console.error('Win-back draft failed:', err)
    return Response.redirect(back('import_error=Could%20not%20write%20the%20message%2C%20try%20again'), 303)
  }

  const stored: StoredDraft = {
    subject: draft.subject,
    body: draft.body,
    reasoning: draft.reasoning,
    model: draft.model,
    tokensUsed: draft.tokensUsed,
  }
  await db.client.update({
    where: { id: client.id },
    data: { winBackDraft: JSON.stringify(stored), winBackDraftedAt: new Date() },
  })

  return Response.redirect(back(`review=${encodeURIComponent(client.name)}`, client.id), 303)
}
