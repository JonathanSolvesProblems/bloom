'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Lock, Search, Sparkles, CheckCircle2 } from 'lucide-react'
import PendingForm from './PendingForm'

/**
 * The rest of the book: everyone the agent is NOT flagging today.
 *
 * These rows used to be dead text, which meant an owner could not write to a
 * client unless the algorithm had already picked them. That is backwards. The
 * owner knows things the booking history does not (she mentioned moving, he
 * always books late), so every client here is reachable, with a search to find
 * one by name in a book of any size.
 */

export type BookRow = {
  id: string
  name: string
  email: string
  level: 'critical' | 'at_risk' | 'watch' | 'safe' | 'lost'
  reason: string
  annualValue: number
  /** Days until a follow-up is allowed, when cooling off. */
  daysLeft?: number
  status: 'writable' | 'follow_up' | 'cooling' | 'capped' | 'locked' | 'opted_out' | 'recovered'
}

const STYLE: Record<BookRow['level'], { label: string; dot: string; text: string }> = {
  critical: { label: 'Slipping away', dot: 'bg-pencil', text: 'text-pencil' },
  at_risk: { label: 'Drifting', dot: 'bg-accent-coral', text: 'text-accent-coral-strong' },
  lost: { label: 'Long gone', dot: 'bg-muted', text: 'text-muted' },
  watch: { label: 'Too early', dot: 'bg-brand-cyan', text: 'text-brand-teal-text' },
  safe: { label: 'On rhythm', dot: 'bg-brand-emerald', text: 'text-brand-emerald-text' },
}

export default function ClientBook({
  rows,
  businessId,
  token,
}: {
  rows: BookRow[]
  businessId: string
  token: string
}) {
  const [q, setQ] = useState('')
  const winbackAction = `/api/clients/winback?businessId=${businessId}&t=${encodeURIComponent(token)}`

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s))
  }, [q, rows])

  // Long books stay usable without paging the whole thing into the page.
  const shown = filtered.slice(0, 50)

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold text-foreground">
          Everyone else <span className="text-muted font-normal">({rows.length})</span>
        </h2>
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input py-1.5 text-sm"
            // Inline, because the .input component class sets its own padding and
            // would otherwise win over a utility and put the text under the icon.
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Find a client by name or email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-muted mb-3">
        Nobody here needs chasing today. You can still write to any of them: you know things the booking history does
        not.
      </p>

      <div className="space-y-2">
        {shown.map((c) => {
          const s = STYLE[c.level]
          return (
            <div
              key={c.email}
              id={`c-${c.id}`}
              className="flex items-center gap-4 text-sm px-4 py-2.5 rounded-lg border border-border bg-card scroll-mt-24"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
              <span className="font-medium text-foreground truncate w-32 sm:w-40">{c.name}</span>
              <span className={`text-xs shrink-0 ${s.text}`}>{s.label}</span>
              <span className="text-muted text-xs flex-1 truncate hidden md:block">{c.reason}</span>
              <span className="text-muted font-mono text-xs shrink-0 hidden sm:inline">${c.annualValue.toLocaleString()}/yr</span>

              {c.status === 'opted_out' ? (
                <span className="text-xs text-muted shrink-0 w-36 text-right">Opted out</span>
              ) : c.status === 'recovered' ? (
                <span className="text-xs text-brand-emerald-text shrink-0 w-36 text-right flex items-center justify-end gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Came back
                </span>
              ) : c.status === 'capped' ? (
                <span className="text-xs text-muted shrink-0 w-36 text-right" title="Two notes is my limit for one lapse">
                  Reached out twice
                </span>
              ) : c.status === 'cooling' ? (
                <span
                  className="text-xs text-muted shrink-0 w-36 text-right"
                  title={`Giving them room to reply. You can follow up in ${c.daysLeft} days.`}
                >
                  Reached out, waiting
                </span>
              ) : c.status === 'locked' ? (
                <Link
                  href={`/api/checkout?businessId=${businessId}&plan=starter`}
                  className="text-xs text-brand-teal-text shrink-0 w-36 text-right hover:underline flex items-center justify-end gap-1"
                >
                  <Lock className="w-3 h-3" /> from $49
                </Link>
              ) : (
                <div className="shrink-0 w-36 flex justify-end">
                  <PendingForm
                    action={winbackAction}
                    messages={['Reading their history', c.status === 'follow_up' ? 'Writing a follow-up' : 'Writing the note']}
                  >
                    <input type="hidden" name="email" value={c.email} />
                    <button
                      type="submit"
                      className="btn-outline text-xs py-1.5 px-2.5 whitespace-nowrap"
                      title={`Write a note to ${c.name}`}
                    >
                      <Sparkles className="w-3 h-3" /> {c.status === 'follow_up' ? 'Follow up' : 'Write a note'}
                    </button>
                  </PendingForm>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p className="text-sm text-muted py-4 text-center">No client matches &ldquo;{q}&rdquo;.</p>
        )}
        {filtered.length > shown.length && (
          <p className="text-xs text-muted pt-1">
            Showing {shown.length} of {filtered.length}. Search above to find anyone else.
          </p>
        )}
      </div>
    </section>
  )
}
