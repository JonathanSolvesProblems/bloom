import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.formData()
  const token = body.get('t')?.toString() ?? ''
  const promotions = body.get('promotions')?.toString() ?? ''

  // The businessId is public (it appears in every subscribe link), so it cannot
  // authorize a mutation. Require the owner-only dashboard token.
  const business = await db.business.findUnique({ where: { id }, select: { dashboardToken: true } })
  if (!business || !token || token !== business.dashboardToken) {
    return new Response('Not found', { status: 404 })
  }

  await db.business.update({ where: { id }, data: { promotions } })

  const { redirect } = await import('next/navigation')
  redirect(`/dashboard/${id}?t=${encodeURIComponent(token)}`)
}
