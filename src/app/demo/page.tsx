import Link from 'next/link'
import { Sparkles, Lock } from 'lucide-react'

export const metadata = {
  title: 'Demo access · Bloom',
  robots: { index: false, follow: false },
}

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-display font-bold text-foreground text-lg">Bloom</span>
        </Link>

        <form action="/api/demo" method="post" className="card bg-card space-y-4">
          <div className="text-center mb-2">
            <div className="w-11 h-11 rounded-xl bg-brand-teal/10 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-5 h-5 text-brand-teal-text" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Demo access</h1>
            <p className="text-muted text-sm mt-1">
              Enter the demo password to explore the paid features on a live Pro account. No payment involved.
            </p>
          </div>
          <input
            type="password"
            name="password"
            className="input"
            placeholder="Demo password"
            autoComplete="off"
            required
          />
          {error && <p className="error-text">That password is not right. Try again.</p>}
          <button type="submit" className="btn-primary w-full justify-center">
            Open the demo
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Want your own?{' '}
          <Link href="/setup" className="text-brand-emerald-text hover:underline">
            Start free
          </Link>
        </p>
      </div>
    </div>
  )
}
