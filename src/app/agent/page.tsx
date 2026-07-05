import Link from 'next/link'
import { db } from '@/lib/db'
import { ArrowLeft, Sparkles } from 'lucide-react'

export const dynamic = 'force-dynamic'

type LogRow = {
  id: string
  createdAt: Date
  action: string
  summary: string
  details: string | null
  business: { name: string } | null
}

const ACTION_STYLES: Record<string, { label: string; cls: string }> = {
  generated_content: { label: 'generate', cls: 'bg-brand-emerald/15 text-brand-emerald' },
  sent_newsletter: { label: 'send', cls: 'bg-brand-cyan/15 text-brand-cyan' },
  decided_promotion: { label: 'decide', cls: 'bg-brand-violet/15 text-brand-violet' },
  qa_review: { label: 'qa', cls: 'bg-brand-teal/15 text-brand-teal' },
  paused_delivery: { label: 'pause', cls: 'bg-accent-coral/15 text-accent-coral' },
  agent_error: { label: 'error', cls: 'bg-red-500/15 text-red-500' },
}

function fmt(d: Date): string {
  return new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

function nextMondayUTC(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 13, 0, 0))
  const day = d.getUTCDay()
  let add = (1 - day + 7) % 7
  if (add === 0 && now.getUTCHours() >= 13) add = 7
  d.setUTCDate(d.getUTCDate() + add)
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

export default async function AgentPage() {
  const [logs, totalActions, generatedCount, newsletterAgg, businessCount] = await Promise.all([
    db.agentLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { business: { select: { name: true } } },
    }) as Promise<LogRow[]>,
    db.agentLog.count(),
    db.agentLog.count({ where: { action: 'generated_content' } }),
    db.weeklyContent.aggregate({ _sum: { subscriberCount: true } }),
    db.business.count(),
  ])

  const subscribersReached = newsletterAgg._sum.subscriberCount ?? 0

  const stats = [
    { label: 'agent actions', value: totalActions },
    { label: 'content runs', value: generatedCount },
    { label: 'subscribers reached', value: subscribersReached },
    { label: 'businesses', value: businessCount },
  ]

  return (
    <div className="min-h-screen bg-ink-dark text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/50 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="font-display font-bold">Bloom</span>
            <span className="text-white/40 text-sm">Agent operations</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-white/70">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-brand-emerald opacity-60 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-emerald" />
            </span>
            live
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold">What the agent has done</h1>
        <p className="text-white/50 text-sm mt-1">
          A live, unedited record of every decision and action Bloom&apos;s agent has taken in production.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="font-mono text-2xl font-bold">{s.value.toLocaleString()}</div>
              <div className="text-xs text-white/50 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 mt-4 flex items-center justify-between text-sm">
          <span className="text-white/60">Next scheduled agent run</span>
          <span className="font-mono text-brand-emerald">{nextMondayUTC()}</span>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
          {logs.length === 0 && (
            <div className="p-8 text-center text-white/40 text-sm font-mono">
              No agent activity yet. The feed fills as businesses go live and the weekly agent runs.
            </div>
          )}
          {logs.map((log) => {
            const style = ACTION_STYLES[log.action] ?? { label: log.action, cls: 'bg-white/10 text-white/70' }
            let details: Record<string, unknown> = {}
            try {
              details = log.details ? JSON.parse(log.details) : {}
            } catch {
              /* ignore malformed details */
            }
            const reasoning = typeof details.reasoning === 'string' ? details.reasoning : ''
            const meta = [
              details.model ? String(details.model) : '',
              typeof details.tokensUsed === 'number' ? `${details.tokensUsed.toLocaleString()} tokens` : '',
              typeof details.latencyMs === 'number' ? `${(details.latencyMs / 1000).toFixed(1)}s` : '',
            ].filter(Boolean)

            return (
              <div key={log.id} className="p-4 font-mono text-[13px]">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-white/40 shrink-0">{fmt(log.createdAt)}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${style.cls}`}>{style.label}</span>
                  {log.business?.name && <span className="text-brand-cyan shrink-0">{log.business.name}</span>}
                  <span className="text-white/85 flex-1 min-w-[12rem]">{log.summary}</span>
                </div>
                {(reasoning || meta.length > 0) && (
                  <div className="mt-2 pl-1 border-l-2 border-white/10 ml-1 space-y-1">
                    {reasoning && <div className="text-white/50 text-xs font-sans leading-relaxed pl-3">{reasoning}</div>}
                    {meta.length > 0 && <div className="text-white/35 text-[11px] pl-3">{meta.join('  ·  ')}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-8 text-center">
          <Link href="/setup" className="inline-flex items-center gap-2 text-brand-emerald hover:text-white transition-colors text-sm">
            <Sparkles className="w-4 h-4" /> Put this agent to work for your business
          </Link>
        </div>
      </main>
    </div>
  )
}
