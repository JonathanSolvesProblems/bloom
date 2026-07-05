'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-muted font-mono break-all">
        {value}
      </div>
      <button onClick={copy} className="btn-outline text-xs py-2 px-3 shrink-0" aria-label="Copy link">
        {copied ? <Check className="w-3.5 h-3.5 text-brand-emerald" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}
