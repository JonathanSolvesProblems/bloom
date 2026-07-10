'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ArrowLeft, ArrowRight, Loader2, Check } from 'lucide-react'
import { z } from 'zod'

const BUSINESS_TYPES = [
  'Restaurant / Café',
  'Salon / Spa / Barbershop',
  'Gym / Fitness Studio',
  'Contractor / Trades',
  'Retail / Boutique',
  'Dental / Medical',
  'Real Estate',
  'Other',
]

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "pt", label: "Português" },
  { value: "it", label: "Italiano" },
  { value: "de", label: "Deutsch" },
]

const BRAND_VOICES = [
  { value: 'friendly', label: 'Friendly & warm', desc: 'Approachable and conversational' },
  { value: 'professional', label: 'Professional', desc: 'Polished and authoritative' },
  { value: 'casual', label: 'Casual & fun', desc: 'Relaxed with light humour' },
  { value: 'bold', label: 'Bold & energetic', desc: 'Punchy with strong CTAs' },
  { value: 'elegant', label: 'Elegant', desc: 'Refined and sophisticated' },
]

type FormData = {
  name: string
  type: string
  city: string
  province: string
  country: string
  description: string
  brandVoice: string
  contentLanguage: string
  promotions: string
  ownerName: string
  ownerEmail: string
}

type Errors = Partial<Record<keyof FormData, string>>

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [form, setForm] = useState<FormData>({
    name: '',
    type: '',
    city: '',
    province: '',
    country: 'CA',
    description: '',
    brandVoice: 'friendly',
    contentLanguage: 'en',
    promotions: '',
    ownerName: '',
    ownerEmail: '',
  })

  function set(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validateStep(n: number): boolean {
    const errs: Errors = {}
    if (n === 1) {
      if (!form.name.trim()) errs.name = 'Business name is required'
      if (!form.type) errs.type = 'Select a business type'
      if (!form.city.trim()) errs.city = 'City is required'
      if (!form.description.trim()) errs.description = 'Tell us about your business'
    }
    if (n === 2) {
      if (!form.brandVoice) errs.brandVoice = 'Pick a brand voice'
    }
    if (n === 3) {
      if (!form.ownerName.trim()) errs.ownerName = 'Your name is required'
      const emailResult = z.string().email().safeParse(form.ownerEmail)
      if (!emailResult.success) errs.ownerEmail = 'Enter a valid email'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function nextStep() {
    if (validateStep(step)) setStep((s) => s + 1)
  }

  async function handleSubmit() {
    if (!validateStep(3)) return
    setLoading(true)
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to create business')
      const { businessId, dashboardToken } = await res.json()
      // Keep the owner-only token in this browser. It must never ride along in
      // the preview URL, because that link gets shared with prospects.
      if (dashboardToken) {
        try {
          localStorage.setItem(`bloom_dt_${businessId}`, dashboardToken)
        } catch {
          /* private mode: owner can still reach the dashboard after checkout */
        }
      }
      router.push(`/preview/${businessId}`)
    } catch {
      setErrors({ ownerEmail: 'Something went wrong, please try again' })
      setLoading(false)
    }
  }

  const steps = ['Business info', 'Brand voice', 'Your details']

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-muted hover:text-muted">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-600 rounded-md flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-foreground">Bloom</span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto w-full px-6 py-10 flex-1">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-10">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i + 1 < step
                    ? 'bg-emerald-600 text-white'
                    : i + 1 === step
                    ? 'bg-emerald-600 text-white'
                    : 'bg-border text-muted'
                }`}
              >
                {i + 1 < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-sm ${i + 1 === step ? 'text-foreground font-medium' : 'text-muted'} hidden sm:block`}>
                {label}
              </span>
              {i < steps.length - 1 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="card bg-card">
          {/* Step 1: Business Info */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-2xl font-bold text-foreground">Tell us about your business</h2>
              <p className="text-muted text-sm">This is how Bloom learns your voice and creates content that fits your brand.</p>

              <div>
                <label className="label">Business name</label>
                <input className="input" placeholder="e.g. Chez Marie Bistro" value={form.name} onChange={(e) => set('name', e.target.value)} />
                {errors.name && <p className="error-text">{errors.name}</p>}
              </div>

              <div>
                <label className="label">Business type</label>
                <select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                  <option value="">Select a type…</option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {errors.type && <p className="error-text">{errors.type}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">City</label>
                  <input className="input" placeholder="e.g. Montreal" value={form.city} onChange={(e) => set('city', e.target.value)} />
                  {errors.city && <p className="error-text">{errors.city}</p>}
                </div>
                <div>
                  <label className="label">Province / State</label>
                  <input className="input" placeholder="e.g. QC" value={form.province} onChange={(e) => set('province', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">What do you do?</label>
                <textarea
                  className="input"
                  style={{ minHeight: 100, resize: 'vertical' }}
                  placeholder="e.g. We're a family-run Italian bistro in Old Montreal known for our handmade pasta and cozy atmosphere. Open for lunch and dinner, Tuesday through Sunday."
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                />
                {errors.description && <p className="error-text">{errors.description}</p>}
              </div>
            </div>
          )}

          {/* Step 2: Brand Voice + Promotions */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground">Your brand voice</h2>
              <p className="text-muted text-sm">Bloom writes in a voice that sounds like you, not like a robot.</p>

              <div>
                <label className="label">Content language</label>
                <select
                  className="input"
                  value={form.contentLanguage}
                  onChange={(e) => set('contentLanguage', e.target.value)}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted mt-1.5">
                  Your posts and newsletter are written natively in this language, not translated.
                </p>
              </div>

              <div>
                <label className="label">Brand voice</label>
                <div className="grid grid-cols-1 gap-3 mt-1">
                  {BRAND_VOICES.map(({ value, label, desc }) => (
                    <label
                      key={value}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        form.brandVoice === value
                          ? 'border-emerald-500 bg-brand-emerald/10'
                          : 'border-border hover:border-border'
                      }`}
                    >
                      <input
                        type="radio"
                        name="brandVoice"
                        value={value}
                        checked={form.brandVoice === value}
                        onChange={() => set('brandVoice', value)}
                        className="accent-emerald-600"
                      />
                      <div>
                        <div className="font-medium text-sm text-foreground">{label}</div>
                        <div className="text-xs text-muted">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {errors.brandVoice && <p className="error-text">{errors.brandVoice}</p>}
              </div>

              <div>
                <label className="label">This week&apos;s promotions or news <span className="text-muted font-normal">(optional)</span></label>
                <textarea
                  className="input"
                  style={{ minHeight: 100, resize: 'vertical' }}
                  placeholder="e.g. 20% off wine on Thursdays, new patio is now open, Mother's Day special menu available May 10-12."
                  value={form.promotions}
                  onChange={(e) => set('promotions', e.target.value)}
                />
                <p className="text-xs text-muted mt-1">You can update this every week from your dashboard.</p>
              </div>
            </div>
          )}

          {/* Step 3: Owner Details */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-2xl font-bold text-foreground">Almost done</h2>
              <p className="text-muted text-sm">
                We&apos;ll send your AI-generated content preview to this email, plus your dashboard link.
              </p>

              <div>
                <label className="label">Your name</label>
                <input className="input" placeholder="e.g. Marie Tremblay" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
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
                />
                {errors.ownerEmail && <p className="error-text">{errors.ownerEmail}</p>}
              </div>

              <div className="bg-brand-emerald/10 border border-brand-emerald/25 rounded-lg p-4 text-sm text-foreground">
                <strong>What happens next:</strong> Bloom will generate a preview of your week&apos;s content (3 social posts + a newsletter draft) instantly. No credit card needed to see it.
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            {step > 1 ? (
              <button onClick={() => setStep((s) => s - 1)} className="btn-outline text-sm py-2 px-4">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <div />
            )}
            {step < 3 ? (
              <button onClick={nextStep} className="btn-primary text-sm py-2 px-6">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading} className="btn-primary text-sm py-2 px-6 disabled:opacity-60">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    Generate my content preview
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
