'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'

/**
 * The delete control, behind two gates: a disclosure, and typing the word.
 *
 * This is deliberately the least convenient thing in the product. It is also the
 * thing that makes uploading a client list safe to do, so it has to be visibly
 * present, not buried. A plain button would be a misclick away from wiping an
 * account, so the owner has to type "DELETE" before the button arms.
 */
export default function DeleteAccount({ businessId, token }: { businessId: string; token: string }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const armed = typed.trim().toUpperCase() === 'DELETE'

  return (
    <div className="mt-8 border border-accent-coral/30 rounded-lg p-5 bg-accent-coral/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-semibold text-accent-coral-strong"
      >
        <Trash2 className="w-4 h-4" /> Delete my account and all data
      </button>

      {open && (
        <div className="mt-4">
          <p className="text-sm text-muted leading-relaxed">
            This deletes your client list, your history, and your account, and cancels any subscription. It cannot be
            undone, and I keep no copy. Type <span className="font-mono font-semibold text-foreground">DELETE</span> to
            confirm.
          </p>
          <form
            action={`/api/businesses/${businessId}/delete?t=${encodeURIComponent(token)}`}
            method="post"
            className="flex flex-col sm:flex-row gap-3 mt-3"
            onSubmit={(e) => {
              if (!armed) e.preventDefault()
            }}
          >
            <input
              className="input flex-1"
              placeholder="Type DELETE"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label="Type DELETE to confirm"
            />
            <button
              type="submit"
              disabled={!armed}
              className="btn-primary text-sm py-2 px-5 shrink-0 disabled:opacity-40"
              style={armed ? { background: 'var(--pencil-strong)', boxShadow: '3px 3px 0 var(--ink)' } : undefined}
            >
              Delete everything
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
