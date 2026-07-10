import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles, Mail, Users, CalendarClock, ArrowRight,
  ExternalLink, Zap, CheckCircle2, Clock, TrendingUp, Activity
} from 'lucide-react'
import { db } from '@/lib/db'
import CopyField from '@/components/CopyField'

export const dynamic = 'force-dynamic'

function relTime(date: Date): string {
  const s = Math.round((Date.now() - date.getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const ACTION_STYLES: Record<string, { label: string; dot: string }> = {
  generated_content: { label: 'generate', dot: 'bg-brand-emerald' },
  sent_newsletter: { label: 'send', dot: 'bg-brand-cyan' },
  decided_promotion: { label: 'decide', dot: 'bg-brand-violet' },
  qa_review: { label: 'qa', dot: 'bg-brand-teal' },
  qa_regenerated: { label: 'rewrote', dot: 'bg-accent-coral' },
  paused_delivery: { label: 'pause', dot: 'bg-accent-coral' },
  agent_error: { label: 'error', dot: 'bg-red-500' },
}

type Log = { id: string; action: string; summary: string; details: string | null; createdAt: Date }

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { businessId } = await params
  const { t } = await searchParams

  const business = await db.business.findUnique({
    where: { id: businessId },
    include: {
      weeklyContent: { orderBy: { createdAt: 'desc' }, take: 10 },
      agentLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      subscribers: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!business) notFound()

  // This page renders subscriber email addresses and owner data. The businessId
  // is public (it is in every subscribe link), so it is not a credential.
  // Require the owner-only token, and 404 rather than 403 so the route never
  // confirms that a given business exists.
  if (!t || t !== business.dashboardToken) notFound()

  const latestContent = business.weeklyContent[0]
  const isActive = business.subscriptionStatus === 'active'
  const subscriberCount = business.subscribers.length

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  const shareUrl = `${base}/subscribe/${businessId}`

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-emerald-600 rounded-md flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-foreground">Bloom</span>
            <span className="text-muted">•</span>
            <span className="text-foreground font-medium text-sm truncate max-w-xs">{business.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/agent" className="text-xs text-muted hover:text-foreground transition-colors hidden sm:flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> Agent feed
            </Link>
            {isActive ? (
              <div className="flex items-center gap-1.5 bg-brand-emerald/10 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <Zap className="w-3 h-3" /> Active
              </div>
            ) : (
              <Link href={`/api/checkout?businessId=${businessId}`} className="btn-primary text-sm py-2 px-4">
                Activate for $99/mo <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {!isActive && (
          <div className="bg-brand-emerald/[0.07] border border-brand-emerald/25 rounded-xl p-5 flex items-start gap-4">
            <Clock className="w-5 h-5 text-brand-emerald mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-foreground">Auto-delivery is not active yet</p>
              <p className="text-sm text-muted mt-1">
                Upgrade to Pro and Bloom will generate and send your content every Monday, automatically.
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
            <div key={label} className="card bg-card flex items-center gap-3">
              {icon}
              <div>
                <div className="text-2xl font-bold text-foreground">{value}</div>
                <div className="text-xs text-muted">{label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {/* Latest content */}
          <div className="card bg-card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-foreground">This week&apos;s content</h2>
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
                    <p className="text-sm text-muted leading-relaxed line-clamp-3">{text}</p>
                  </div>
                ))}
                <div className="pt-3 border-t border-border">
                  <div className="text-xs font-semibold text-muted mb-1">Newsletter subject</div>
                  <p className="text-sm font-medium text-foreground">{latestContent.newsletterSubject}</p>
                  {latestContent.newsletterSent ? (
                    <div className="flex items-center gap-1 text-xs text-emerald-600 mt-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Sent to {latestContent.subscriberCount} subscribers
                    </div>
                  ) : (
                    <div className="text-xs text-muted mt-2 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Will be sent next Monday
                    </div>
                  )}
                </div>

                {/* Agent decision record */}
                {(latestContent.weeklyTheme || latestContent.reasoning || latestContent.qaScore != null) && (
                  <div className="pt-3 border-t border-border space-y-2">
                    {latestContent.weeklyTheme && (
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-teal bg-brand-teal/10 px-2.5 py-1 rounded-full">
                        <Sparkles className="w-3 h-3" /> {latestContent.weeklyTheme}
                      </div>
                    )}
                    {latestContent.reasoning && (
                      <div>
                        <div className="text-xs font-semibold text-muted mb-1">Why the agent chose this</div>
                        <p className="text-sm text-muted leading-relaxed">{latestContent.reasoning}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-mono text-muted pt-1">
                      {latestContent.model && <span>{latestContent.model}</span>}
                      {latestContent.tokensUsed ? <span>· {latestContent.tokensUsed.toLocaleString()} tokens</span> : null}
                      {latestContent.latencyMs ? <span>· {(latestContent.latencyMs / 1000).toFixed(1)}s</span> : null}
                      {latestContent.qaScore != null && <span>· self-QA {latestContent.qaScore}/100</span>}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <CalendarClock className="w-10 h-10 text-border mx-auto mb-3" />
                <p className="text-sm text-muted mb-4">No content yet. Preview your first week&apos;s content.</p>
                <Link href={`/preview/${businessId}`} className="btn-primary text-sm py-2 px-4">
                  Generate content <Sparkles className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Activity log + Subscribers */}
          <div className="space-y-6">
            {/* Activity log */}
            <div className="card bg-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  AI activity log
                </h2>
                <Link href="/agent" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
                  Full feed <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="text-[11px] text-muted mb-4 flex items-center gap-1.5 font-mono">
                <Clock className="w-3 h-3" /> next agent run · Monday 13:00 UTC
              </div>
              {business.agentLogs.length > 0 ? (
                <div className="space-y-3">
                  {(business.agentLogs as Log[]).slice(0, 8).map((log) => {
                    const style = ACTION_STYLES[log.action] ?? { label: log.action, dot: 'bg-muted' }
                    let reasoning = ''
                    try {
                      const d = log.details ? JSON.parse(log.details) : {}
                      if (typeof d.reasoning === 'string') reasoning = d.reasoning
                    } catch {
                      /* ignore */
                    }
                    return (
                      <div key={log.id} className="flex items-start gap-3 text-sm">
                        <div className={`w-2 h-2 ${style.dot} rounded-full mt-1.5 shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground leading-tight">{log.summary}</p>
                          {reasoning && log.action === 'generated_content' && (
                            <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">{reasoning}</p>
                          )}
                          <p className="text-xs text-muted mt-0.5">{relTime(new Date(log.createdAt))}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted">No activity yet. Generate your first content above.</p>
              )}
            </div>

            {/* Subscribers */}
            <div className="card bg-card">
              <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-emerald-600" />
                Newsletter subscribers
              </h2>
              {subscriberCount > 0 ? (
                <>
                  <p className="text-3xl font-bold text-foreground mb-1">{subscriberCount}</p>
                  <p className="text-sm text-muted mb-4">subscribers receiving your newsletter</p>
                  <div className="space-y-1 mb-4">
                    {business.subscribers.slice(0, 5).map((s: { id: string; email: string }) => (
                      <div key={s.id} className="text-xs text-muted flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                        {s.email}
                      </div>
                    ))}
                    {subscriberCount > 5 && <p className="text-xs text-muted">+{subscriberCount - 5} more</p>}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted mb-4">No subscribers yet. Share your signup link with customers.</p>
              )}
              <div className="text-xs font-semibold text-muted mb-1.5">Your public subscribe link</div>
              <CopyField value={shareUrl} />
            </div>
          </div>
        </div>

        {/* Promotions editor */}
        <PromotionsEditor businessId={businessId} currentPromotions={business.promotions ?? ''} token={t} />
      </div>
    </div>
  )
}

function PromotionsEditor({
  businessId,
  currentPromotions,
  token,
}: {
  businessId: string
  currentPromotions: string
  token: string
}) {
  return (
    <form action={`/api/businesses/${businessId}/promotions`} method="POST" className="card bg-card">
      <input type="hidden" name="t" value={token} />
      <h2 className="font-semibold text-foreground mb-2">Update this week&apos;s promotions</h2>
      <p className="text-sm text-muted mb-4">
        Tell Bloom what to feature this week. Leave it blank and the agent will decide the angle for you.
      </p>
      <textarea
        name="promotions"
        className="input"
        style={{ minHeight: 90, resize: 'vertical' }}
        defaultValue={currentPromotions}
        placeholder="e.g. Holiday weekend special: 15% off all services. New summer menu launches Friday."
      />
      <div className="flex justify-end mt-3">
        <button type="submit" className="btn-primary text-sm py-2 px-4">
          Save promotions
        </button>
      </div>
    </form>
  )
}
