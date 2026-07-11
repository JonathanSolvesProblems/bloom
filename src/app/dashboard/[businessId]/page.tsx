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
  qa_failed: { label: 'qa n/a', dot: 'bg-muted' },
  subscription_activated: { label: 'activate', dot: 'bg-brand-emerald' },
  delivery_skipped: { label: 'hold', dot: 'bg-muted' },
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
  const isPro = isActive && business.tier === 'pro'
  const subscriberCount = business.subscribers.length
  const tokenQuery = encodeURIComponent(t)
  const hasMailingAddress = !!business.mailingAddress?.trim()

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
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-brand-emerald/10 text-brand-emerald-text text-xs font-semibold px-3 py-1.5 rounded-full">
                  <Zap className="w-3 h-3" /> {isPro ? 'Pro' : 'Starter'}
                </div>
                {!isPro && (
                  // Upgrading swaps the price on the existing subscription. A
                  // second checkout would bill the same card twice, so this is a
                  // POST to a route that updates the live subscription in place.
                  <form action={`/api/upgrade?businessId=${businessId}&t=${tokenQuery}`} method="post">
                    <button type="submit" className="btn-primary text-sm py-2 px-4">
                      Upgrade to Pro <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <Link href={`/api/checkout?businessId=${businessId}&plan=starter`} className="btn-primary text-sm py-2 px-4">
                Activate from $49/mo <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {!isActive && (
          <div className="bg-brand-emerald/[0.07] border border-brand-emerald/25 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <Clock className="w-5 h-5 text-brand-emerald shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-foreground">Your agent is not running yet</p>
              <p className="text-sm text-muted mt-1">
                Starter writes your posts and newsletter every Monday. Pro also emails it to your subscribers.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href={`/api/checkout?businessId=${businessId}&plan=starter`} className="btn-outline text-sm py-2 px-4">
                Starter, $49
              </Link>
              <Link href={`/api/checkout?businessId=${businessId}&plan=pro`} className="btn-primary text-sm py-2 px-4">
                Pro, $99 <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {isActive && !isPro && (
          <div className="bg-brand-emerald/[0.07] border border-brand-emerald/25 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <Mail className="w-5 h-5 text-brand-emerald shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-foreground">You are sending the newsletter yourself</p>
              <p className="text-sm text-muted mt-1">
                On Pro, Bloom emails each Monday&apos;s newsletter to your {subscriberCount}{' '}
                {subscriberCount === 1 ? 'subscriber' : 'subscribers'} and logs every message.
              </p>
            </div>
            <form action={`/api/upgrade?businessId=${businessId}&t=${tokenQuery}`} method="post" className="shrink-0">
              <button type="submit" className="btn-primary text-sm py-2 px-4">
                Upgrade to Pro <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {isPro && !hasMailingAddress && (
          <div className="bg-accent-coral/[0.08] border border-accent-coral/30 rounded-xl p-5 flex items-start gap-4">
            <Mail className="w-5 h-5 text-accent-coral-strong shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-foreground">Add a mailing address to start sending</p>
              <p className="text-sm text-muted mt-1">
                Anti-spam law requires a real postal address in every newsletter. Until you add one below, Bloom writes
                your content but holds the Monday send.
              </p>
            </div>
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
                    <div className="flex items-center gap-1 text-xs text-brand-emerald-text mt-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Sent to {latestContent.subscriberCount} subscribers
                    </div>
                  ) : isPro ? (
                    <div className="text-xs text-muted mt-2 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Sends automatically on Monday
                    </div>
                  ) : isActive ? (
                    <div className="text-xs text-muted mt-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready for you to publish
                    </div>
                  ) : (
                    <div className="text-xs text-muted mt-2 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Activate to schedule sending
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

        {/* Newsletter branding (paid) */}
        <BrandingCard
          businessId={businessId}
          token={t}
          isActive={isActive}
          brandColor={business.brandColor || ''}
          logoUrl={business.logoUrl || ''}
        />

        {/* Business details + subscription */}
        <SettingsCard
          businessId={businessId}
          token={t}
          mailingAddress={business.mailingAddress ?? ''}
          isActive={isActive}
          cancelling={isActive && business.cancelAtPeriodEnd}
          planLabel={isPro ? 'Pro' : isActive ? 'Starter' : 'Free'}
        />
      </div>
    </div>
  )
}

function BrandingCard({
  businessId,
  token,
  isActive,
  brandColor,
  logoUrl,
}: {
  businessId: string
  token: string
  isActive: boolean
  brandColor: string
  logoUrl: string
}) {
  const color = /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : '#047857'

  return (
    <div className="card bg-card">
      <h2 className="font-semibold text-foreground mb-2">Newsletter branding</h2>
      <p className="text-sm text-muted mb-4">
        Put your logo and color in the header of every newsletter, so it looks like yours, not ours. This applies to
        your emailed newsletter and the preview.
      </p>

      {isActive ? (
        <form action={`/api/businesses/${businessId}/promotions`} method="POST" className="space-y-4">
          <input type="hidden" name="t" value={token} />
          <div className="flex items-center gap-3">
            <input
              type="color"
              name="brandColor"
              defaultValue={color}
              aria-label="Brand color"
              className="h-10 w-14 rounded-lg border border-border bg-transparent cursor-pointer p-1"
            />
            <div className="text-sm text-muted">
              Brand color for the newsletter header. Leave the default green if you like it.
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted">Logo URL</label>
            <input
              name="logoUrl"
              className="input mt-1"
              defaultValue={logoUrl}
              placeholder="https://yoursite.com/logo.png"
              maxLength={500}
            />
            <p className="text-xs text-muted mt-1">
              A direct link to a hosted image (PNG or JPG). It shows at the top of your newsletter. Leave blank for no
              logo.
            </p>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary text-sm py-2 px-4">
              Save branding
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted">
          Branding is a paid feature. Activate a plan to add your logo and color to your newsletter.
        </p>
      )}
    </div>
  )
}

function SettingsCard({
  businessId,
  token,
  mailingAddress,
  isActive,
  cancelling,
  planLabel,
}: {
  businessId: string
  token: string
  mailingAddress: string
  isActive: boolean
  cancelling: boolean
  planLabel: string
}) {
  return (
    <div className="card bg-card">
      <h2 className="font-semibold text-foreground mb-2">Business postal address</h2>
      <p className="text-sm text-muted mb-4">
        A street address or PO box, not an email. It appears in the footer of every newsletter, which anti-spam law
        requires, so Pro sending stays on hold until it is set.
      </p>
      <form action={`/api/businesses/${businessId}/promotions`} method="POST">
        <input type="hidden" name="t" value={token} />
        <input
          name="mailingAddress"
          className="input"
          defaultValue={mailingAddress}
          placeholder="123 Queen St W, Toronto, ON M5H 2M9, Canada"
          maxLength={200}
        />
        <div className="flex justify-end mt-3">
          <button type="submit" className="btn-primary text-sm py-2 px-4">
            Save address
          </button>
        </div>
      </form>

      <div className="border-t border-border mt-5 pt-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-foreground">Current plan: {planLabel}</div>
          {isActive && cancelling ? (
            <div className="text-xs text-accent-coral-strong mt-0.5">
              Set to cancel at the end of your billing period. You keep access until then.
            </div>
          ) : isActive ? (
            <div className="text-xs text-muted mt-0.5">Cancel anytime. Your content stays until the period ends.</div>
          ) : null}
        </div>
        {isActive && cancelling ? (
          <form action={`/api/cancel?businessId=${businessId}&t=${encodeURIComponent(token)}&resume=1`} method="post">
            <button type="submit" className="btn-primary text-sm py-2 px-4">
              Keep my subscription
            </button>
          </form>
        ) : isActive ? (
          <form action={`/api/cancel?businessId=${businessId}&t=${encodeURIComponent(token)}`} method="post">
            <button
              type="submit"
              className="text-sm py-2 px-4 rounded-lg border border-border text-muted hover:text-foreground hover:border-accent-coral/40 transition-colors"
            >
              Cancel subscription
            </button>
          </form>
        ) : null}
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
