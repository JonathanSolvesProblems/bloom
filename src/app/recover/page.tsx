'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, MailCheck } from 'lucide-react'
import BloomMark from '@/components/BloomMark'

export default function RecoverPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'sent'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setState('loading')
    try {
      await fetch('/api/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      /* the response is deliberately uninformative either way */
    }
    // Always land on the same confirmation, so this is never a probe for which
    // emails have an account.
    setState('sent')
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <BloomMark className="w-8 h-8" />
          <span className="font-display font-bold text-foreground text-lg">Bloom</span>
        </Link>

        {state === 'sent' ? (
          <div className="card bg-card text-center py-10">
            <MailCheck className="w-12 h-12 text-brand-emerald mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-foreground mb-2">Check your inbox</h1>
            <p className="text-muted text-sm">
              If that email has a Bloom account, the dashboard link is on its way. It can take a minute to arrive.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card bg-card space-y-4">
            <div className="text-center mb-2">
              <h1 className="text-xl font-semibold text-foreground">Sign in</h1>
              <p className="text-muted text-sm mt-1">
                There are no passwords here. Enter the email you signed up with and I&apos;ll send your dashboard link,
                which signs you in and stays remembered on this device.
              </p>
            </div>
            <input
              type="email"
              className="input"
              placeholder="you@yourbusiness.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={state === 'loading'}
            />
            <button
              type="submit"
              disabled={state === 'loading'}
              className="btn-primary w-full justify-center disabled:opacity-60"
            >
              {state === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Sending…
                </>
              ) : (
                'Email me my link'
              )}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted mt-6">
          Don&apos;t have an account yet?{' '}
          <Link href="/setup" className="text-brand-emerald-text hover:underline">
            Get started
          </Link>
        </p>
      </div>
    </div>
  )
}
