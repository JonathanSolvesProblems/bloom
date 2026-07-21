'use client'

import { useState } from 'react'
import PendingOverlay from './PendingOverlay'

/**
 * A native form that shows the working overlay while it submits.
 *
 * These are real form POSTs that navigate, so the browser just sits there for the
 * few seconds a Gemini call or a file parse takes, with no sign anything is
 * happening. That is the "loggy click" from the test video. Wrapping the form here
 * puts the overlay up on submit; it clears itself when the new page paints.
 */
export default function PendingForm({
  action,
  encType,
  messages,
  className,
  children,
}: {
  action: string
  encType?: string
  messages: string | string[]
  className?: string
  children: React.ReactNode
}) {
  const [busy, setBusy] = useState(false)
  return (
    <>
      <form action={action} method="post" encType={encType} className={className} onSubmit={() => setBusy(true)}>
        {children}
      </form>
      {busy && <PendingOverlay messages={messages} />}
    </>
  )
}
