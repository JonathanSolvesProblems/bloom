import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assessAll, summarize, NEW_CLIENT_CLIFF_DAYS, type RiskLevel, type Assessed, type ClientLike } from '@/lib/retention'
import CountUp from '@/components/CountUp'
import Celebrate from '@/components/Celebrate'
import RhythmStrip from '@/components/RhythmStrip'
import {
  ArrowLeft, Upload, AlertTriangle, TrendingDown, Sparkles, CheckCircle2, PartyPopper, Lock, ArrowRight,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

/**
 * The risk engine deliberately does not know who anyone is (see ClientLike), but
 * this screen has to name them, so it carries the identity fields alongside.
 */
type RadarClient = Assessed<ClientLike & { name: string; email: string; lastService: string }>

const RISK_STYLE: Record<RiskLevel, { label: string; dot: string; text: string; ring: string }> = {
  critical: { label: 'Slipping away', dot: 'bg-red-500', text: 'text-red-500', ring: 'ring-red-500/30' },
  at_risk: { label: 'Drifting', dot: 'bg-accent-coral', text: 'text-accent-coral-strong', ring: 'ring-accent-coral/30' },
  lost: { label: 'Long gone', dot: 'bg-muted', text: 'text-muted', ring: 'ring-border' },
  watch: { label: 'Too early', dot: 'bg-brand-cyan', text: 'text-brand-teal-text', ring: 'ring-border' },
  safe: { label: 'On rhythm', dot: 'bg-brand-emerald', text: 'text-brand-emerald-text', ring: 'ring-border' },
}

export default async function ClientRadarPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{
    t?: string
    imported?: string
    import_error?: string
    sent?: string
    recovered?: string
    needs_plan?: string
    drafted?: string
    subject?: string
  }>
}) {
  const { businessId } = await params
  const {
    t,
    imported,
    import_error: importError,
    sent,
    recovered,
    needs_plan: needsPlan,
    drafted,
    subject,
  } = await searchParams

  const business = await db.business.findUnique({
    where: { id: businessId },
    include: { clients: true },
  })
  if (!business) notFound()
  // This page renders the business's entire customer list. It is the most
  // sensitive screen in the product, so require the owner-only token and 404
  // rather than 403 so it never confirms a business exists.
  if (!t || t !== business.dashboardToken) notFound()

  // When a send was held back (a sample address), show the owner what the agent
  // actually wrote. It is the whole point of the feature and was otherwise
  // invisible: nothing else renders a drafted note.
  const draftedLog = drafted
    ? await db.agentLog.findFirst({
        where: { businessId, action: 'winback_drafted' },
        orderBy: { createdAt: 'desc' },
        select: { details: true },
      })
    : null
  let draftedNote: { subject?: string; body?: string; draftReasoning?: string } = {}
  try {
    if (draftedLog?.details) draftedNote = JSON.parse(draftedLog.details)
  } catch {
    /* a malformed log must not take the page down */
  }

  const assessed = assessAll(business.clients)
  const s = summarize(assessed)
  const dash = `/dashboard/${businessId}?t=${encodeURIComponent(t)}`
  const isActive = business.subscriptionStatus === 'active'

  // Everyone worth acting on, most valuable save first.
  const actionable = assessed.filter((c) => ['critical', 'at_risk'].includes(c.assessment.level))
  const rest = assessed.filter((c) => !['critical', 'at_risk'].includes(c.assessment.level))

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-card px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={dash} className="text-muted hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="font-semibold text-foreground">Client radar</span>
            <span className="text-muted">·</span>
            <span className="text-sm text-muted truncate max-w-xs">{business.name}</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {importError && (
          <div className="bg-accent-coral/[0.08] border border-accent-coral/30 rounded-xl p-4 text-sm text-foreground">
            {importError === 'nofile'
              ? 'Pick a CSV file to upload.'
              : importError === 'toobig'
                ? 'That file is larger than 5 MB. Export a shorter date range.'
                : importError === 'norows'
                  ? 'I could not find any rows with both an email and a date.'
                  : importError}
          </div>
        )}
        {imported && !recovered && (
          <div className="bg-brand-emerald/[0.07] border border-brand-emerald/25 rounded-xl p-4 text-sm text-foreground">
            Read {imported} clients from your booking history.
          </div>
        )}
        {recovered && (
          // The one moment worth celebrating: they were going, the agent wrote to
          // them, and the owner's own export proves they came back.
          <div className="relative overflow-hidden bg-brand-emerald/[0.09] border border-brand-emerald/40 rounded-xl p-5">
            <Celebrate />
            <div className="relative flex items-start gap-3">
              <PartyPopper className="w-5 h-5 text-brand-emerald shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">{recovered} came back.</p>
                <p className="text-sm text-muted mt-1">
                  They were slipping away, I wrote to them, and they booked again. That is not a projection, it is in
                  the export you just uploaded.
                </p>
              </div>
            </div>
          </div>
        )}
        {sent && (
          <div className="bg-brand-emerald/[0.07] border border-brand-emerald/25 rounded-xl p-4 text-sm text-foreground flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-brand-emerald shrink-0 mt-0.5" />
            <span>
              Sent. I wrote {sent} a personal note about their last visit and it is on its way. If they book again, your
              next upload will count them as won back.
            </span>
          </div>
        )}

        {drafted && (
          <div className="bg-card border border-border rounded-xl p-5 text-sm">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-brand-teal-text shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">Here is what I would have sent {drafted}.</p>
                <p className="text-muted mt-1 leading-relaxed">
                  I held the send because that is a sample client with a reserved test address. It would bounce, and
                  bounces count against the sending domain every business here shares. Upload your own booking history
                  and it goes out for real.
                </p>

                <div className="mt-4 rounded-lg border border-border bg-surface p-4">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">Subject</p>
                  <p className="text-foreground font-medium mt-1">{draftedNote.subject ?? subject}</p>
                  {draftedNote.body && (
                    <div
                      className="mt-3 pt-3 border-t border-border text-foreground leading-relaxed [&_p]:mb-2"
                      // The model wrote this and it went through the same allowlist
                      // sanitizer as the newsletter before it was stored.
                      dangerouslySetInnerHTML={{ __html: draftedNote.body }}
                    />
                  )}
                </div>

                {draftedNote.draftReasoning && (
                  <p className="text-xs text-muted mt-3 leading-relaxed">
                    <span className="font-semibold">Why I wrote it that way:</span> {draftedNote.draftReasoning}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {needsPlan && (
          <div className="bg-accent-coral/[0.08] border border-accent-coral/30 rounded-xl p-4 text-sm text-foreground">
            Reaching out is part of a paid plan. Finding who is slipping is always free.
          </div>
        )}

        {business.clients.length === 0 ? (
          <EmptyState businessId={businessId} token={t} />
        ) : (
          <>
            {!isActive && s.contactable > 0 && (
              // The honest pitch: the number above is what leaving is costing, and
              // it is their own data saying so, not a projection. The count is the
              // CONTACTABLE one, never the at-risk one: promising to write to
              // someone who opted out is a promise the agent refuses to keep.
              <div className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <Lock className="w-5 h-5 text-brand-teal-text shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-foreground">
                    I can write to {s.contactable === 1 ? 'them' : `all ${s.contactable} of them`}, personally.
                  </p>
                  <p className="text-sm text-muted mt-1">
                    One note per client, in your voice, about their last visit and their own timing. Saving one client
                    covers the plan for a year. You are looking at ${s.revenueAtRisk.toLocaleString()} of them.
                  </p>
                </div>
                <Link
                  href={`/api/checkout?businessId=${businessId}&plan=starter`}
                  className="btn-primary text-sm py-2 px-4 shrink-0"
                >
                  Start from $49/mo <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
            {/* The money. This is the whole point of the screen. */}
            <section className="grid sm:grid-cols-3 gap-4">
              <div className="card bg-card">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Need attention
                </div>
                <div className="text-4xl font-bold text-foreground font-mono">
                  <CountUp to={s.critical + s.atRisk} />
                </div>
                <div className="text-sm text-muted mt-1">
                  {s.critical} slipping away, {s.atRisk} drifting
                </div>
              </div>
              <div className="card bg-card ring-2 ring-red-500/20">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" /> Revenue at risk
                </div>
                <div className="text-4xl font-bold text-red-500 font-mono">
                  $<CountUp to={s.revenueAtRisk} />
                </div>
                <div className="text-sm text-muted mt-1">a year, if you do nothing</div>
              </div>
              <div
                className={`card bg-card relative overflow-hidden ${
                  recovered ? 'ring-2 ring-brand-emerald/40' : ''
                }`}
              >
                {/* Only when a save actually landed on this import. */}
                {recovered && <Celebrate />}
                <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-emerald" /> Won back
                </div>
                <div className="text-4xl font-bold text-brand-emerald-text font-mono">
                  $<CountUp to={s.revenueRecovered} />
                </div>
                <div className="text-sm text-muted mt-1">
                  {s.recoveredCount} {s.recoveredCount === 1 ? 'client' : 'clients'} came back
                </div>
              </div>
            </section>

            {actionable.length > 0 ? (
              <section>
                <h2 className="font-semibold text-foreground mb-1">Act on these first</h2>
                <p className="text-sm text-muted mb-4">
                  Sorted by what they are worth. A first-timer who does not rebook within{' '}
                  {NEW_CLIENT_CLIFF_DAYS} days has about a 1 in 5 chance of ever coming back, so those are at the top.
                </p>
                <div className="space-y-3">
                  {actionable.map((c) => (
                    <ClientRow key={c.email} client={c} businessId={businessId} token={t} isActive={isActive} />
                  ))}
                </div>
              </section>
            ) : (
              <div className="card bg-card text-center py-10">
                <CheckCircle2 className="w-10 h-10 text-brand-emerald mx-auto mb-3" />
                <p className="font-semibold text-foreground">Nobody is slipping right now</p>
                <p className="text-sm text-muted mt-1">Every client is on their own rhythm. I will keep watching.</p>
              </div>
            )}

            {rest.length > 0 && (
              <section>
                <h2 className="font-semibold text-foreground mb-3">Everyone else</h2>
                <div className="space-y-2">
                  {rest.slice(0, 30).map((c) => (
                    <div
                      key={c.email}
                      className="flex items-center gap-3 text-sm px-4 py-2.5 rounded-lg border border-border bg-card"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${RISK_STYLE[c.assessment.level].dot}`} />
                      <span className="font-medium text-foreground truncate w-40">{c.name}</span>
                      <span className={`text-xs shrink-0 ${RISK_STYLE[c.assessment.level].text}`}>
                        {RISK_STYLE[c.assessment.level].label}
                      </span>
                      <span className="text-muted text-xs flex-1 truncate hidden sm:block">{c.assessment.reason}</span>
                      <span className="text-muted font-mono text-xs shrink-0">${c.assessment.annualValue}/yr</span>
                    </div>
                  ))}
                  {rest.length > 30 && <p className="text-xs text-muted pt-1">+{rest.length - 30} more</p>}
                </div>
              </section>
            )}

            <ImportCard businessId={businessId} token={t} compact />
          </>
        )}
      </div>
    </div>
  )
}

function ClientRow({
  client,
  businessId,
  token,
  isActive,
}: {
  client: RadarClient
  businessId: string
  token: string
  isActive: boolean
}) {
  const a = client.assessment
  const style = RISK_STYLE[a.level]
  // For a first-timer the cliff is a real deadline, so show it as one.
  const cliffPct =
    a.daysToCliff !== null && a.daysToCliff > 0
      ? Math.max(4, Math.round((a.daysToCliff / NEW_CLIENT_CLIFF_DAYS) * 100))
      : null

  return (
    <div className={`card bg-card ring-1 ${style.ring}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`relative flex h-2 w-2 shrink-0`}>
              {a.level === 'critical' && (
                <span className={`absolute inline-flex h-full w-full rounded-full ${style.dot} opacity-60 animate-ping`} />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${style.dot}`} />
            </span>
            <span className="font-semibold text-foreground truncate">{client.name}</span>
            <span className={`text-xs font-semibold ${style.text}`}>{style.label}</span>
            {client.lastService && (
              <span className="text-xs text-muted truncate hidden sm:inline">· last in for {client.lastService}</span>
            )}
          </div>
          <p className="text-sm text-muted leading-relaxed">{a.reason}</p>

          {/* Their rhythm, and the gap in it. Same drawing as the homepage, on
              their real numbers: this is the evidence behind the verdict, so it
              belongs next to the verdict. */}
          <RhythmStrip
            cadenceDays={client.cadenceDays}
            daysSince={a.daysSince}
            visitCount={client.visitCount}
            alarm={a.level === 'critical' || a.level === 'at_risk'}
          />

          {cliffPct !== null && (
            <div className="mt-3 max-w-md">
              <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                <span className="text-pencil font-semibold">{a.daysToCliff} days left</span>
                <span className="text-muted">before the {NEW_CLIENT_CLIFF_DAYS}-day cliff</span>
              </div>
              {/* A countdown, not a progress bar: it drains left as the window
                  shuts, and it is drawn in pencil because it is an alarm. */}
              <div className="h-1 bg-border overflow-hidden">
                <div className="h-full bg-pencil transition-all" style={{ width: `${cliffPct}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="font-mono font-bold text-foreground">${a.annualValue.toLocaleString()}</div>
            <div className="text-[11px] text-muted">a year</div>
          </div>
          {client.unsubscribedAt ? (
            // They asked not to be contacted. That decision outranks the revenue.
            <span className="text-xs text-muted whitespace-nowrap px-3">Opted out</span>
          ) : client.recoveredAt ? (
            <span className="text-xs font-semibold text-brand-emerald-text whitespace-nowrap px-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Came back
            </span>
          ) : client.winBackSentAt ? (
            <span className="text-xs text-muted whitespace-nowrap px-3">Reached out, waiting</span>
          ) : !isActive ? (
            // Do not render a button that is going to bounce. Say what it costs.
            <Link href={`/api/checkout?businessId=${businessId}&plan=starter`} className="btn-outline text-sm py-2 px-4 whitespace-nowrap">
              <Lock className="w-3.5 h-3.5" /> Write to them, from $49
            </Link>
          ) : (
            <form action={`/api/clients/winback?businessId=${businessId}&t=${encodeURIComponent(token)}`} method="post">
              <input type="hidden" name="email" value={client.email} />
              <button type="submit" className="btn-primary text-sm py-2 px-4 whitespace-nowrap">
                <Sparkles className="w-3.5 h-3.5" /> Win them back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ businessId, token }: { businessId: string; token: string }) {
  return (
    <div className="text-center py-6">
      <h1 className="text-3xl sm:text-4xl font-bold text-foreground max-w-2xl mx-auto leading-tight">
        Find the clients you are about to lose.
      </h1>
      <p className="text-muted mt-4 max-w-xl mx-auto leading-relaxed">
        Most salons lose about 40% of new clients within a year, and a first-timer who does not rebook within 30 days
        has roughly a 1 in 5 chance of ever coming back. Upload your booking history and I will show you exactly who is
        slipping, and what they are worth.
      </p>
      <div className="mt-8 max-w-xl mx-auto text-left">
        <ImportCard businessId={businessId} token={token} />
      </div>
    </div>
  )
}

function ImportCard({ businessId, token, compact }: { businessId: string; token: string; compact?: boolean }) {
  return (
    <form
      action="/api/clients/import"
      method="post"
      encType="multipart/form-data"
      className="card bg-card"
    >
      <input type="hidden" name="t" value={token} />
      <input type="hidden" name="businessId" value={businessId} />
      <h2 className="font-semibold text-foreground mb-2 flex items-center gap-2">
        <Upload className="w-4 h-4 text-brand-teal-text" />
        {compact ? 'Refresh from a new export' : 'Upload your booking history'}
      </h2>
      <p className="text-sm text-muted mb-4">
        {compact
          ? 'Upload a fresh export any time. Anyone who booked again after a win-back gets counted as won back.'
          : 'Export your appointments from whatever you already use (Fresha, Square, Vagaro, Booksy, even Google Calendar) and drop the CSV here. It needs a client email and a date; service and price make it smarter. Nothing to migrate.'}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="input flex-1 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-brand-teal/10 file:text-brand-teal-text"
        />
        <button type="submit" className="btn-primary text-sm py-2 px-5 shrink-0">
          Analyze my clients
        </button>
      </div>
      <p className="text-xs text-muted mt-3">
        {compact ? (
          <>
            Trying it out? This{' '}
            <a
              href="/api/sample-csv?returned=1"
              className="text-brand-teal-text underline underline-offset-2 hover:no-underline"
            >
              follow-up sample
            </a>{' '}
            is the same book a few days later, with one client rebooked after a win-back.
          </>
        ) : (
          <>
            No export handy?{' '}
            <a href="/api/sample-csv" className="text-brand-teal-text underline underline-offset-2 hover:no-underline">
              Download a sample booking history
            </a>{' '}
            and upload it to see how this works.
          </>
        )}
      </p>
    </form>
  )
}
