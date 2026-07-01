import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles, Mail, Users, CalendarClock, ArrowRight,
  ExternalLink, Zap, CheckCircle2, Clock, TrendingUp
} from 'lucide-react'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function relTime(date: Date): string {
  const s = Math.round((Date.now() - date.getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ businessId: string }>
}) {
  const { businessId } = await params
  const business = await db.business.findUnique({
    where: { id: businessId },
    include: {
      weeklyContent: { orderBy: { createdAt: 'desc' }, take: 10 },
      agentLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      subscribers: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!business) notFound()

  const latestContent = business.weeklyContent[0]
  const isActive = business.subscriptionStatus === 'active'
  const subscriberCount = business.subscribers.length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-emerald-600 rounded-md flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-900">Bloom</span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-700 font-medium text-sm truncate max-w-xs">{business.name}</span>
          </div>
          <div className="flex items-center gap-3">
            {isActive ? (
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <Zap className="w-3 h-3" /> Active
              </div>
            ) : (
              <Link
                href={`/api/checkout?businessId=${businessId}`}
                className="btn-primary text-sm py-2 px-4"
              >
                Activate — $99/mo <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Status banner for inactive */}
        {!isActive && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-4">
            <Clock className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900">Auto-delivery is not active yet</p>
              <p className="text-sm text-amber-700 mt-1">
                Upgrade to Pro and Bloom will generate and send your content every Monday — automatically.
              </p>
            </div>
            <Link href={`/api/checkout?businessId=${businessId}`} className="btn-primary text-sm py-2 px-4 shrink-0">
              Activate <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Newsletters sent', value: business.weeklyContent.filter((c: { newsletterSent: boolean }) => c.newsletterSent).length, icon: <Mail className="w-5 h-5 text-emerald-600" /> },
            { label: 'Subscribers', value: subscriberCount, icon: <Users className="w-5 h-5 text-emerald-600" /> },
            { label: 'Weeks of content', value: business.weeklyContent.length, icon: <CalendarClock className="w-5 h-5 text-emerald-600" /> },
            { label: 'AI actions logged', value: business.agentLogs.length, icon: <TrendingUp className="w-5 h-5 text-emerald-600" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="card bg-white flex items-center gap-3">
              {icon}
              <div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {/* Latest content */}
          <div className="card bg-white">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">This week&apos;s content</h2>
              {latestContent && (
                <Link href={`/preview/${businessId}`} className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
                  View all <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>

            {latestContent ? (
              <div className="space-y-4">
                {[
                  { label: 'Post 1', text: latestContent.post1 },
                  { label: 'Post 2', text: latestContent.post2 },
                  { label: 'Post 3', text: latestContent.post3 },
                ].map(({ label, text }) => (
                  <div key={label}>
                    <div className="text-xs font-semibold text-emerald-600 mb-1">{label}</div>
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{text}</p>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-100">
                  <div className="text-xs font-semibold text-gray-400 mb-1">Newsletter subject</div>
                  <p className="text-sm font-medium text-gray-700">{latestContent.newsletterSubject}</p>
                  {latestContent.newsletterSent ? (
                    <div className="flex items-center gap-1 text-xs text-emerald-600 mt-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Sent to {latestContent.subscriberCount} subscribers
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Will be sent next Monday
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CalendarClock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-4">No content yet. Preview your first week&apos;s content.</p>
                <Link href={`/preview/${businessId}`} className="btn-primary text-sm py-2 px-4">
                  Generate content <Sparkles className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Activity log + Subscribers */}
          <div className="space-y-6">
            {/* Activity log */}
            <div className="card bg-white">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600" />
                AI activity log
              </h2>
              {business.agentLogs.length > 0 ? (
                <div className="space-y-3">
                  {business.agentLogs.slice(0, 8).map((log: { id: string; summary: string; createdAt: Date }) => (
                    <div key={log.id} className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-700 leading-tight">{log.summary}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{relTime(new Date(log.createdAt))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No activity yet. Generate your first content above.</p>
              )}
            </div>

            {/* Subscribers */}
            <div className="card bg-white">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Newsletter subscribers
                </h2>
                <Link
                  href={`/subscribe/${businessId}`}
                  target="_blank"
                  className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                >
                  Share link <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              {subscriberCount > 0 ? (
                <>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{subscriberCount}</p>
                  <p className="text-sm text-gray-500 mb-4">subscribers receiving your newsletter</p>
                  <div className="space-y-1">
                    {business.subscribers.slice(0, 5).map((s: { id: string; email: string }) => (
                      <div key={s.id} className="text-xs text-gray-500 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                        {s.email}
                      </div>
                    ))}
                    {subscriberCount > 5 && (
                      <p className="text-xs text-gray-400">+{subscriberCount - 5} more</p>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-3">No subscribers yet. Share your signup link with customers.</p>
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-400 font-mono break-all">
                    {typeof window !== 'undefined' ? `${window.location.origin}/subscribe/${businessId}` : `/subscribe/${businessId}`}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Promotions editor */}
        <PromotionsEditor businessId={businessId} currentPromotions={business.promotions ?? ''} />
      </div>
    </div>
  )
}

function PromotionsEditor({
  businessId,
  currentPromotions,
}: {
  businessId: string
  currentPromotions: string
}) {
  return (
    <form
      action={`/api/businesses/${businessId}/promotions`}
      method="POST"
      className="card bg-white"
    >
      <h2 className="font-semibold text-gray-900 mb-2">Update this week&apos;s promotions</h2>
      <p className="text-sm text-gray-500 mb-4">
        Tell Bloom what to feature this week. The AI will use this to write your next batch of posts and newsletter.
      </p>
      <textarea
        name="promotions"
        className="input"
        style={{ minHeight: 90, resize: 'vertical' }}
        defaultValue={currentPromotions}
        placeholder="e.g. Holiday weekend special: 15% off all services. New summer menu launches Friday. Free dessert with any dinner reservation."
      />
      <div className="flex justify-end mt-3">
        <button type="submit" className="btn-primary text-sm py-2 px-4">
          Save promotions
        </button>
      </div>
    </form>
  )
}
