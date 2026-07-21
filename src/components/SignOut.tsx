'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'

/**
 * Forget this device. The account, the book and the history are untouched: this
 * only clears the cookie that remembers which dashboard belongs to this browser,
 * which matters on a shared or salon-floor computer.
 */
export default function SignOut() {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await fetch('/api/session', { method: 'DELETE' })
        } catch {
          /* nothing to do: the cookie is either gone or was never set */
        }
        window.location.href = '/'
      }}
      className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1 disabled:opacity-50"
      title="Forget this device. Your data is not touched."
    >
      <LogOut className="w-3.5 h-3.5" /> {busy ? 'Signing out' : 'Sign out'}
    </button>
  )
}
