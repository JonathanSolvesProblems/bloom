import { NextRequest } from 'next/server'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { draftWinBack } from '@/lib/gemini'
import { assess, businessCadence } from '@/lib/retention'
import { brandEmail } from '@/lib/email-template'
import { publicBaseUrl } from '@/lib/config'
import { appBaseUrl } from '@/lib/agent-run'

export const maxDuration = 60

/**
 * Win one specific client back: the agent reads their real history, writes them a
 * personal note, and sends it. Owner-token gated.
 *
 * This never blasts. One client, one message, once (winBackSentAt guards it).
 */
export async function POST(request: NextRequest) {
  const form = await request.formData()
  const businessId = request.nextUrl.searchParams.get('businessId') ?? ''
  const token = request.nextUrl.searchParams.get('t') ?? ''
  const email = (form.get('email')?.toString() ?? '').trim().toLowerCase()

  const business = await db.business.findUnique({ where: { id: businessId }, include: { clients: true } })
  if (!business || !token || token !== business.dashboardToken) {
    return new Response('Not found', { status: 404 })
  }

  const origin = publicBaseUrl(request)
  const back = (p: string) => `${origin}/dashboard/${businessId}/clients?t=${encodeURIComponent(token)}&${p}`

  const client = business.clients.find((c) => c.email === email)
  if (!client) return Response.redirect(back('import_error=Client%20not%20found'), 303)
  if (client.unsubscribedAt) {
    return Response.redirect(back('import_error=That%20client%20unsubscribed%2C%20so%20I%20will%20not%20contact%20them'), 303)
  }
  if (client.winBackSentAt) {
    return Response.redirect(back('import_error=Already%20reached%20out%20to%20them%2C%20I%20will%20not%20nag%20twice'), 303)
  }

  // The same guards the newsletter has: a verified domain and a real postal
  // address, because anti-spam law applies to this email too.
  const apiKey = process.env.RESEND_API_KEY
  const fromDomain = process.env.RESEND_FROM_DOMAIN
  if (!apiKey || !fromDomain) {
    return Response.redirect(back('import_error=Sending%20is%20not%20configured%20yet'), 303)
  }
  if (!business.mailingAddress?.trim()) {
    return Response.redirect(back('import_error=Add%20your%20business%20postal%20address%20first%2C%20anti-spam%20law%20requires%20it'), 303)
  }
  const base = appBaseUrl()
  if (!base) return Response.redirect(back('import_error=No%20app%20URL%20configured'), 303)

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
        // Only what the owner configured. With nothing here the agent is told it
        // has nothing to give away, so it cannot invent a discount.
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

  // Claim the send BEFORE emailing, so a double-submit cannot send twice.
  const claim = await db.client.updateMany({
    where: { id: client.id, winBackSentAt: null },
    data: { winBackSentAt: new Date() },
  })
  if (claim.count === 0) return Response.redirect(back('import_error=Already%20sent'), 303)

  const unsubUrl = `${base}/api/unsubscribe?c=${client.id}`
  const html = `${brandEmail(draft.body, {
    name: business.name,
    brandColor: business.brandColor,
    logoUrl: business.logoUrl,
  })}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
<p style="font-size:12px;line-height:1.5;color:#6b7280;text-align:center;font-family:sans-serif">
  ${business.mailingAddress}<br />
  <a href="${unsubUrl}" style="color:#6b7280">Unsubscribe</a>
</p>`

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: `${business.name.replace(/[\r\n"<>]/g, ' ').trim() || 'Bloom'} <hello@${fromDomain}>`,
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
    // Release the claim so the owner can retry.
    await db.client.updateMany({ where: { id: client.id }, data: { winBackSentAt: null } })
    console.error('Win-back send failed:', err)
    return Response.redirect(back('import_error=Send%20failed%2C%20try%20again'), 303)
  }

  await db.agentLog.create({
    data: {
      businessId,
      action: 'winback_sent',
      summary: `Reached out to a ${a.level === 'critical' ? 'client slipping away' : 'drifting client'} worth about $${a.annualValue.toLocaleString()} a year. ${a.reason}`.slice(0, 200),
      details: JSON.stringify({
        risk: a.level,
        daysSince: a.daysSince,
        daysToCliff: a.daysToCliff,
        annualValue: a.annualValue,
        subject: draft.subject,
        reasoning: draft.reasoning,
        model: draft.model,
        tokensUsed: draft.tokensUsed,
      }),
    },
  })

  return Response.redirect(back(`sent=${encodeURIComponent(client.name)}`), 303)
}
