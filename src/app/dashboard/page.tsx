import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { SESSION_COOKIE } from '@/app/api/session/route'

export const dynamic = 'force-dynamic'

/**
 * The stable way back in: /dashboard with no id.
 *
 * Resolves the remembered session to the owner's real dashboard, and sends anyone
 * without one to the recovery page to have their link emailed. This is what makes
 * a bookmark, or simply typing the site name, work on a return visit.
 */
export default async function DashboardIndex() {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value ?? ''
  const sep = raw.indexOf(':')
  if (sep > 0) {
    const businessId = raw.slice(0, sep)
    const token = raw.slice(sep + 1)
    // Re-check against the database: a deleted account or a rotated token must not
    // keep working just because a cookie says so.
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { dashboardToken: true },
    })
    if (business && business.dashboardToken === token) {
      redirect(`/dashboard/${businessId}?t=${encodeURIComponent(token)}`)
    }
  }
  redirect('/recover?expired=1')
}
