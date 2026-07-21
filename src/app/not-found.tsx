import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import BloomMark from '@/components/BloomMark'

export const metadata = {
  title: 'Not found · Bloom',
  robots: { index: false, follow: false },
}

/**
 * The 404, in the product's own language: a page that stopped showing up.
 *
 * The dashboard and radar deliberately 404 rather than 403 when a token is wrong,
 * so this page is also what an owner sees with a stale or mistyped link. That is
 * why it offers a way back to their dashboard rather than only the home page.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface paper-grain flex flex-col items-center justify-center px-6 py-16 text-center">
      <BloomMark className="w-12 h-12 mb-6" />

      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">Error 404</p>
      <h1 className="font-display text-3xl sm:text-4xl text-ink leading-tight mt-3 max-w-lg">
        This page stopped coming.
      </h1>
      <p className="text-ink-soft mt-4 max-w-md leading-relaxed">
        The link is wrong, expired, or the page never existed. If you were opening your dashboard, the link is the one
        emailed to you, and it can be sent again.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <Link href="/" className="btn-primary text-base py-3 px-7">
          Back to home <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href="/recover" className="btn-outline text-base py-3 px-7">
          Find my dashboard
        </Link>
      </div>
    </div>
  )
}
