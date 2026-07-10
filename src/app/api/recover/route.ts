import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { appBaseUrl } from '@/lib/agent-run'
import { allowRequest } from '@/lib/ratelimit'

const schema = z.object({ email: z.string().email() })

/**
 * Email an owner their dashboard link.
 *
 * The dashboard token lives only in the owner's browser localStorage, so a
 * cleared cache or a new device would otherwise lock a paying customer out with
 * no way back in. This is the recovery path.
 *
 * Always answers the same "if that email has an account, it is on its way",
 * whether or not the address exists, so the endpoint is never an oracle for
 * which emails have a Bloom account. Rate limited so it cannot be used to spray
 * mail at an address.
 */
export async function POST(request: NextRequest) {
  let email: string
  try {
    ;({ email } = schema.parse(await request.json()))
  } catch {
    return Response.json({ error: 'Enter a valid email' }, { status: 400 })
  }

  if (!(await allowRequest(request, 'recover', 5))) {
    return Response.json({ ok: true })
  }

  const business = await db.business.findUnique({ where: { ownerEmail: email } })
  const apiKey = process.env.RESEND_API_KEY
  const fromDomain = process.env.RESEND_FROM_DOMAIN
  const base = appBaseUrl()

  if (business && apiKey && fromDomain && base) {
    const link = `${base}/dashboard/${business.id}?t=${encodeURIComponent(business.dashboardToken)}`
    const resend = new Resend(apiKey)
    // Transactional, so no marketing footer or unsubscribe is required.
    await resend.emails
      .send({
        from: `Bloom <hello@${fromDomain}>`,
        to: email,
        subject: 'Your Bloom dashboard link',
        html: `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0b1b14;line-height:1.6">
  <p>Here is the link to your Bloom dashboard for <strong>${escapeHtml(business.name)}</strong>:</p>
  <p><a href="${link}" style="color:#047857">Open my dashboard</a></p>
  <p style="color:#6b7280;font-size:13px">This link is private to you. If you did not request it, you can ignore this email.</p>
</div>`,
      })
      .catch((err) => {
        // Never leak the failure to the caller (would become an account oracle).
        console.error('Recovery email failed:', err)
      })
  }

  return Response.json({ ok: true })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
