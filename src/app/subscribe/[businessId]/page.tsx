'use client'

import { useState, use } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import BloomMark from '@/components/BloomMark'

export default function SubscribePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setState('loading')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, email }),
      })
      if (res.ok) {
        setState('success')
      } else {
        const d = await res.json()
        setMessage(d.error ?? 'Something went wrong')
        setState('error')
      }
    } catch {
      setMessage('Could not connect, please try again')
      setState('error')
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <BloomMark className="w-11 h-11 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Stay in the loop</h1>
          <p className="text-muted">
            Subscribe to get the latest news and offers delivered straight to your inbox.
          </p>
        </div>

        {state === 'success' ? (
          <div className="card bg-card text-center py-10">
            <CheckCircle2 className="w-12 h-12 text-brand-emerald mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">You&apos;re subscribed!</h2>
            <p className="text-muted text-sm">
              You&apos;re on the list. Look out for the next newsletter in your inbox.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card bg-card space-y-4">
            <div>
              <label className="label">Your email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={state === 'loading'}
              />
            </div>
            {state === 'error' && (
              <p className="error-text">{message}</p>
            )}
            <button
              type="submit"
              disabled={state === 'loading'}
              className="btn-primary w-full justify-center disabled:opacity-60"
            >
              {state === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Subscribing…
                </>
              ) : (
                'Subscribe to newsletter'
              )}
            </button>
            <p className="text-xs text-muted text-center">
              Unsubscribe anytime. Your email is never shared.
            </p>
          </form>
        )}

        <p className="text-center text-xs text-muted mt-6">
          Powered by <span className="text-emerald-600 font-medium">Bloom</span>, AI marketing for local businesses
        </p>
      </div>
    </div>
  )
}
