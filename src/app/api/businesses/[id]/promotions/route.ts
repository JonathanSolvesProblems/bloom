import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getMondayOf } from '@/lib/agent-run'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.formData()
  const token = body.get('t')?.toString() ?? ''

  // The businessId is public (it appears in every subscribe link), so it cannot
  // authorize a mutation. Require the owner-only dashboard token.
  const business = await db.business.findUnique({ where: { id }, select: { dashboardToken: true } })
  if (!business || !token || token !== business.dashboardToken) {
    return new Response('Not found', { status: 404 })
  }

  // Only overwrite the fields the submitted form actually carried, so the
  // promotions, settings, and branding forms can share this route without one
  // wiping another's value.
  const data: { promotions?: string; mailingAddress?: string; brandColor?: string; logoUrl?: string } = {}
  if (body.has('promotions')) data.promotions = body.get('promotions')?.toString() ?? ''
  if (body.has('mailingAddress')) data.mailingAddress = (body.get('mailingAddress')?.toString() ?? '').slice(0, 200)
  if (body.has('brandColor')) {
    // Store only a valid #rrggbb; anything else clears back to the default.
    const c = (body.get('brandColor')?.toString() ?? '').trim()
    data.brandColor = /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : ''
  }
  if (body.has('logoUrl')) {
    // Store only a real http(s) URL; anything else clears the logo.
    const u = (body.get('logoUrl')?.toString() ?? '').trim().slice(0, 500)
    let ok = ''
    try {
      const parsed = new URL(u)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') ok = parsed.toString()
    } catch {
      /* not a URL */
    }
    data.logoUrl = ok
  }

  if (Object.keys(data).length > 0) {
    await db.business.update({ where: { id }, data })

    // If the owner changed what to feature, drop this week's not-yet-sent draft
    // so the next preview or run regenerates against the new promotions instead
    // of returning the stale one. Never touch a newsletter already emailed.
    if ('promotions' in data) {
      const weekOf = getMondayOf(new Date())
      await db.weeklyContent.deleteMany({ where: { businessId: id, weekOf, newsletterSent: false } })
    }
  }

  const { redirect } = await import('next/navigation')
  redirect(`/dashboard/${id}?t=${encodeURIComponent(token)}`)
}
