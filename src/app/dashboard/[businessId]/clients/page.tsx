import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import {
  assessAll, summarize, contactState, NEW_CLIENT_CLIFF_DAYS,
  type RiskLevel, type Assessed, type ClientLike,
} from '@/lib/retention'
import CountUp from '@/components/CountUp'
import Celebrate from '@/components/Celebrate'
import RhythmStrip from '@/components/RhythmStrip'
import PendingForm from '@/components/PendingForm'
import ClientBook, { type BookRow } from '@/components/ClientBook'
import {
  ArrowLeft, Upload, AlertTriangle, TrendingDown, Sparkles, CheckCircle2, PartyPopper, Lock, ArrowRight,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

/**
 * The risk engine deliberately does not know who anyone is (see ClientLike), but
 * this screen has to name them, so it carries the identity fields alongside.
 */
type RadarClient = Assessed<
  ClientLike & { id: string; name: string; email: string; lastService: string; winBackDraft: string | null }
>

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
    review?: string
    drafted?: string
    discarded?: string
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
    review,
    drafted,
    discarded,
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

  const assessed = assessAll(business.clients)
  const s = summarize(assessed)
  const dash = `/dashboard/${businessId}?t=${encodeURIComponent(t)}`
  const isActive = business.subscriptionStatus === 'active'

  // Everyone worth acting on, most valuable save first. Anyone carrying a drafted
  // note is promoted here too, whatever their risk, so the owner can always find
  // and read what the agent wrote rather than losing it in the long list.
  const isActionable = (c: (typeof assessed)[number]) =>
    ['critical', 'at_risk'].includes(c.assessment.level) || (!!c.winBackDraft && !c.winBackSentAt)
  const actionable = assessed.filter(isActionable)
  const rest = assessed.filter((c) => !isActionable(c))

  // The rest of the book stays reachable: the owner knows things the booking
  // history does not, so every client can be written to, not just the flagged ones.
  const bookRows: BookRow[] = rest.map((c) => {
    const state = contactState(c)
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      level: c.assessment.level,
      reason: c.assessment.reason,
      annualValue: c.assessment.annualValue,
      daysLeft: state.kind === 'cooling' ? state.daysLeft : undefined,
      status:
        state.kind === 'opted_out'
          ? 'opted_out'
          : c.recoveredAt && state.kind === 'writable' && !state.followUp
            ? 'recovered'
            : state.kind === 'capped'
              ? 'capped'
              : state.kind === 'cooling'
                ? 'cooling'
                : !isActive
                  ? 'locked'
                  : state.followUp
                    ? 'follow_up'
                    : 'writable',
    }
  })

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
        {review && (
          <div className="bg-brand-teal/[0.07] border border-brand-teal/25 rounded-xl p-4 text-sm text-foreground flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-brand-teal-text shrink-0 mt-0.5" />
            <span>
              I wrote a note to {review}. Read it below, and it goes out only when you press send. Nothing has been sent.
            </span>
          </div>
        )}
        {sent && (
          <div className="bg-brand-emerald/[0.07] border border-brand-emerald/25 rounded-xl p-4 text-sm text-foreground flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-brand-emerald shrink-0 mt-0.5" />
            <span>
              Sent to {sent}. If they book again, your next upload will count them as won back.
            </span>
          </div>
        )}
        {drafted && (
          <div className="bg-card border border-border rounded-xl p-4 text-sm text-foreground flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-brand-teal-text shrink-0 mt-0.5" />
            <span>
              {drafted} is a sample client with a reserved test address, so I held the send rather than bounce a real
              email off the shared sending domain. Upload your own booking history and it goes out for real.
            </span>
          </div>
        )}
        {discarded && (
          <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted">
            Discarded the draft for {discarded}. Nothing was sent.
          </div>
        )}

        {needsPlan && (
          <div className="bg-accent-coral/[0.08] border border-accent-coral/30 rounded-xl p-4 text-sm text-foreground">
            Writing to a client is part of a paid plan. Finding who is slipping is always free.
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
                <p className="text-sm text-muted mt-1">
                  All {business.clients.length} {business.clients.length === 1 ? 'client' : 'clients'} in your book are
                  on their own rhythm, and your book is saved. I will keep watching, and you can still write to anyone
                  below.
                </p>
              </div>
            )}

            {bookRows.length > 0 && <ClientBook rows={bookRows} businessId={businessId} token={t} />}

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

  const winbackAction = `/api/clients/winback?businessId=${businessId}&t=${encodeURIComponent(token)}`
  const state = contactState(client)
  // A note the agent has written but the owner has not sent yet.
  let draft: { subject?: string; body?: string; reasoning?: string } | null = null
  if (client.winBackDraft) {
    try {
      draft = JSON.parse(client.winBackDraft)
    } catch {
      /* a corrupt draft simply shows no preview; Rewrite fixes it */
    }
  }

  return (
    // Anchored so a redirect after drafting or sending lands on this row, rather
    // than at the top of a long book.
    <div id={`c-${client.id}`} className={`card bg-card ring-1 ${style.ring} scroll-mt-24`}>
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
          {state.kind === 'opted_out' ? (
            // They asked not to be contacted. That decision outranks the revenue.
            <span className="text-xs text-muted whitespace-nowrap px-3">Opted out</span>
          ) : client.recoveredAt && state.kind === 'writable' && !state.followUp ? (
            <span className="text-xs font-semibold text-brand-emerald-text whitespace-nowrap px-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Came back
            </span>
          ) : client.winBackDraft ? (
            <span className="text-xs font-semibold text-brand-teal-text whitespace-nowrap px-3">Draft ready ↓</span>
          ) : state.kind === 'capped' ? (
            <span className="text-xs text-muted whitespace-nowrap px-3" title="Two notes is my limit for one lapse">
              Reached out twice
            </span>
          ) : state.kind === 'cooling' ? (
            <span
              className="text-xs text-muted whitespace-nowrap px-3"
              title={`Giving them room to reply. You can follow up in ${state.daysLeft} days.`}
            >
              Reached out, waiting
            </span>
          ) : state.followUp ? (
            <PendingForm action={winbackAction} messages={['Reading their history', 'Writing a follow-up']}>
              <input type="hidden" name="email" value={client.email} />
              <button type="submit" className="btn-outline text-sm py-2 px-4 whitespace-nowrap">
                <Sparkles className="w-3.5 h-3.5" /> Follow up
              </button>
            </PendingForm>
          ) : !isActive ? (
            // Do not render a button that is going to bounce. Say what it costs.
            <Link href={`/api/checkout?businessId=${businessId}&plan=starter`} className="btn-outline text-sm py-2 px-4 whitespace-nowrap">
              <Lock className="w-3.5 h-3.5" /> Write to them, from $49
            </Link>
          ) : (
            <PendingForm action={winbackAction} messages={['Reading their history', 'Writing the note']}>
              <input type="hidden" name="email" value={client.email} />
              <button type="submit" className="btn-primary text-sm py-2 px-4 whitespace-nowrap">
                <Sparkles className="w-3.5 h-3.5" /> Write the note
              </button>
            </PendingForm>
          )}
        </div>
      </div>

      {/* The draft, held for the owner to read before it goes anywhere. This is
          the trust story: nothing reaches a client without them seeing it first. */}
      {draft && !client.winBackSentAt && !client.unsubscribedAt && (
        <div className="mt-4 pt-4 border-t border-rule">
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">To {client.name} · subject</p>
            <p className="text-foreground font-medium mt-1">{draft.subject}</p>
            {draft.body && (
              <div
                className="mt-3 pt-3 border-t border-border text-sm text-foreground leading-relaxed [&_p]:mb-2"
                dangerouslySetInnerHTML={{ __html: draft.body }}
              />
            )}
          </div>
          {draft.reasoning && (
            <p className="text-xs text-muted mt-2 leading-relaxed">
              <span className="font-semibold">Why I wrote it that way:</span> {draft.reasoning}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <PendingForm action={winbackAction} messages={[`Sending to ${client.name}`]}>
              <input type="hidden" name="email" value={client.email} />
              <input type="hidden" name="action" value="send" />
              <button type="submit" className="btn-primary text-sm py-2 px-4">
                <ArrowRight className="w-3.5 h-3.5" /> Send it to {client.name}
              </button>
            </PendingForm>
            <PendingForm action={winbackAction} messages={['Writing a new note']}>
              <input type="hidden" name="email" value={client.email} />
              <button type="submit" className="btn-outline text-sm py-2 px-3">
                Rewrite
              </button>
            </PendingForm>
            {/* Discard is instant (no model call), so it needs no overlay. */}
            <form action={winbackAction} method="post">
              <input type="hidden" name="email" value={client.email} />
              <input type="hidden" name="action" value="discard" />
              <button type="submit" className="text-sm py-2 px-3 text-muted hover:text-accent-coral-strong transition-colors">
                Discard
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/** One click, no file: seed the sample book server-side. This is the fastest way
 *  for a new owner (who may not have a CSV handy) to see the radar populated. */
function SampleButton({
  businessId,
  token,
  sample,
  children,
  primary,
}: {
  businessId: string
  token: string
  sample: '1' | '2'
  children: React.ReactNode
  primary?: boolean
}) {
  return (
    <PendingForm action="/api/clients/import" messages={['Reading the sample book', 'Working out who is slipping']}>
      <input type="hidden" name="t" value={token} />
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="sample" value={sample} />
      <button type="submit" className={primary ? 'btn-primary text-base py-3 px-7' : 'btn-outline text-sm py-2 px-4'}>
        {children}
      </button>
    </PendingForm>
  )
}

function EmptyState({ businessId, token }: { businessId: string; token: string }) {
  return (
    <div className="py-4">
      <div className="text-center">
        <h1 className="font-display text-3xl sm:text-4xl text-foreground max-w-2xl mx-auto leading-tight">
          Find the clients you are about to lose.
        </h1>
        <p className="text-muted mt-4 max-w-xl mx-auto leading-relaxed">
          A typical salon loses about 40% of its clients every year, and a first-timer who does not rebook within 30
          days has roughly a 1 in 5 chance of ever coming back. Upload your booking history and I will show you exactly
          who is slipping, and what they are worth.
        </p>

        {/* The lowest-friction path first: no file needed. */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <SampleButton businessId={businessId} token={token} sample="1" primary>
            See it with sample data <ArrowRight className="w-4 h-4" />
          </SampleButton>
          <span className="font-mono text-[11px] text-ink-soft">A made-up salon book, so you can look before uploading yours.</span>
        </div>
      </div>

      <div className="mt-10 max-w-xl mx-auto text-left">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-rule" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">or use your own book</span>
          <div className="h-px flex-1 bg-rule" />
        </div>
        <ImportCard businessId={businessId} token={token} />
      </div>
    </div>
  )
}

function ImportCard({ businessId, token, compact }: { businessId: string; token: string; compact?: boolean }) {
  return (
    <div className="card bg-card">
      <PendingForm
        action="/api/clients/import"
        encType="multipart/form-data"
        messages={['Reading your book', 'Working out who is slipping']}
      >
        <input type="hidden" name="t" value={token} />
        <input type="hidden" name="businessId" value={businessId} />
        <h2 className="font-semibold text-foreground mb-2 flex items-center gap-2">
          <Upload className="w-4 h-4 text-brand-teal-text" />
          {compact ? 'Refresh from a new export' : 'Upload your booking history'}
        </h2>
        <p className="text-sm text-muted mb-4">
          {compact
            ? 'Upload a fresh export any time (CSV or Excel). Anyone who booked again after a win-back gets counted as won back.'
            : 'Export your appointments from whatever you already use (Fresha, Square, Vagaro, Booksy, even Google Calendar) and drop the file here. CSV or Excel both work. It needs a client email and a date; service and price make it smarter. Nothing to migrate, and it stays private to you.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="file"
            name="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            required
            className="input flex-1 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-brand-teal/10 file:text-brand-teal-text"
          />
          <button type="submit" className="btn-primary text-sm py-2 px-5 shrink-0">
            Analyze my clients
          </button>
        </div>
      </PendingForm>

      {compact && (
        <div className="text-xs text-muted mt-3 flex flex-wrap items-center gap-1.5">
          <span>Trying it out?</span>
          <SampleButton businessId={businessId} token={token} sample="2">
            Load the follow-up sample
          </SampleButton>
          <span>the same book days later, with one client rebooked.</span>
        </div>
      )}
    </div>
  )
}
