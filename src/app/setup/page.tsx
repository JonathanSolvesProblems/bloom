'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { z } from 'zod'
import BloomMark from '@/components/BloomMark'
import PendingOverlay from '@/components/PendingOverlay'

/**
 * One step, five fields, then the radar.
 *
 * This used to be an 11-field, 3-step content-marketing onboarding ending in
 * "Generate my content preview", which meant a retention product made you answer
 * brand-voice questions before it would show you who you were losing. The flagship
 * needs none of that: a name to sign the emails, a type and city so the notes read
 * like a local, and an email for the account. Everything else is asked later, in
 * the dashboard, only if the owner turns weekly content on.
 */

const BUSINESS_TYPES = [
  'Salon / Spa / Barbershop',
  'Gym / Fitness Studio',
  'Dental / Medical',
  'Restaurant / Café',
  'Retail / Boutique',
  'Contractor / Trades',
  'Other',
]

type Form = { name: string; type: string; city: string; ownerName: string; ownerEmail: string }
type Errors = Partial<Record<keyof Form, string>>

export default function SetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [form, setForm] = useState<Form>({
    name: '',
    type: 'Salon / Spa / Barbershop',
    city: '',
    ownerName: '',
    ownerEmail: '',
  })

  // Wake the serverless database while the owner is still filling the form, so the
  // signup that follows is fast rather than paying a cold start on submit.
  useEffect(() => {
    fetch('/api/health').catch(() => {})
  }, [])

  function set(field: keyof Form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  async function handleSubmit() {
    const errs: Errors = {}
    if (!form.name.trim()) errs.name = 'What is the business called?'
    if (!form.ownerName.trim()) errs.ownerName = 'Your name signs the notes I write'
    if (!z.string().email().safeParse(form.ownerEmail).success) errs.ownerEmail = 'Enter a valid email'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setLoading(true)
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('failed')
      const { businessId, dashboardToken, existing } = await res.json()
      if (existing) {
        router.push('/recover?exists=1')
        return
      }
      if (dashboardToken) {
        try {
          localStorage.setItem(`bloom_dt_${businessId}`, dashboardToken)
        } catch {
          /* private mode: the token is also in the URL below */
        }
        // Straight to the radar, the reason they came. Empty until they upload,
        // but one click away from the sample book.
        router.push(`/dashboard/${businessId}/clients?t=${encodeURIComponent(dashboardToken)}`)
        return
      }
      throw new Error('no token')
    } catch {
      setErrors({ ownerEmail: 'Something went wrong, please try again' })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col paper-grain">
      {loading && <PendingOverlay messages={['Setting up your account', 'Opening your radar']} />}
      <header className="border-b border-ink bg-card px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-muted hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <BloomMark />
          <span className="font-display font-bold text-foreground text-lg">Bloom</span>
        </div>
      </header>

      <div className="max-w-xl mx-auto w-full px-6 py-12 flex-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft mb-3">Free, no card</p>
        <h1 className="font-display text-3xl sm:text-4xl text-ink leading-tight">
          Let&apos;s find who you are about to lose.
        </h1>
        <p className="text-ink-soft mt-3 leading-relaxed">
          Two questions and an email. Then upload your booking history (or try it with a sample) and I will show you
          who is slipping, and what they are worth.
        </p>

        <div className="card bg-card mt-8 space-y-5">
          <div>
            <label className="label">Business name</label>
            <input
              className="input"
              placeholder="e.g. Wildflower Studio"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
            />
            {errors.name && <p className="error-text">{errors.name}</p>}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">
                City <span className="text-muted font-normal">(optional)</span>
              </label>
              <input
                className="input"
                placeholder="e.g. Toronto"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Your name</label>
              <input
                className="input"
                placeholder="e.g. Marie"
                value={form.ownerName}
                onChange={(e) => set('ownerName', e.target.value)}
              />
              {errors.ownerName && <p className="error-text">{errors.ownerName}</p>}
            </div>
            <div>
              <label className="label">Your email</label>
              <input
                className="input"
                type="email"
                placeholder="marie@example.com"
                value={form.ownerEmail}
                onChange={(e) => set('ownerEmail', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              {errors.ownerEmail && <p className="error-text">{errors.ownerEmail}</p>}
            </div>
          </div>

          <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full text-base py-3 disabled:opacity-60">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Setting up
              </>
            ) : (
              <>
                Show me who is slipping <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="font-mono text-[11px] text-ink-soft text-center">
            Your email is your login. No card, and nothing is sent to anyone without you.
          </p>
        </div>
      </div>
    </div>
  )
}
