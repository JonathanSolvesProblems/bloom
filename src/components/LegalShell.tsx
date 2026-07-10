import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'

/** Shared frame for the Terms, Privacy, and Refund pages. */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-600 rounded-md flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-foreground">Bloom</span>
          </Link>
          <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted mt-2 mb-10">Last updated {updated}</p>
        <div className="prose-legal space-y-5 text-[15px] leading-relaxed text-foreground/85">{children}</div>
      </main>
    </div>
  )
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground pt-4">{heading}</h2>
      {children}
    </section>
  )
}
