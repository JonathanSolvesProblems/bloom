'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import PendingOverlay from './PendingOverlay'

/**
 * The drafted note, editable before it goes.
 *
 * Showing the owner the words was half the trust story; letting them change the
 * words is the other half. The agent does not know that this client just had a
 * baby, or that the salon is shut next week. So the subject and the body are plain
 * editable fields, and what is sent is exactly what is on screen when they press
 * send.
 *
 * The body is edited as plain text (paragraphs separated by blank lines) rather
 * than as HTML: an owner should never have to see a tag, and the server rebuilds
 * and sanitises the markup on the way out.
 */
export default function DraftEditor({
  action,
  email,
  clientName,
  subject,
  bodyHtml,
  reasoning,
}: {
  action: string
  email: string
  clientName: string
  subject: string
  bodyHtml: string
  reasoning?: string
}) {
  const [subj, setSubj] = useState(subject)
  const [body, setBody] = useState(() => htmlToText(bodyHtml))
  const [busy, setBusy] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const edited = subj !== subject || body !== htmlToText(bodyHtml)
  // Stable per client, so the three forms and their buttons pair up correctly
  // even with several drafts open on the page.
  const formId = `draft-${email.replace(/[^a-z0-9]/gi, '')}`

  return (
    <div className="mt-4 pt-4 border-t border-rule">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">To {clientName}</p>
        <p className="text-[11px] font-mono text-muted">{edited ? 'Edited by you' : 'Written by Bloom, edit anything'}</p>
      </div>

      <form id={formId} action={action} method="post" onSubmit={() => setBusy(true)}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="action" value="send" />

        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-muted">Subject</label>
            <input
              name="subject"
              className="input mt-1 font-medium"
              value={subj}
              onChange={(e) => setSubj(e.target.value)}
              maxLength={200}
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-muted">Message</label>
            <textarea
              name="body"
              className="input mt-1 leading-relaxed"
              style={{ minHeight: 170, resize: 'vertical' }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              required
            />
          </div>
        </div>

      </form>

      {/* Rewrite and discard are their own forms, so neither carries the edited
          text. The buttons still sit in one row via the form attribute, which is
          what it is for: no nested forms, no layout hacks. */}
      <form id={`${formId}-rewrite`} action={action} method="post" onSubmit={() => setRewriting(true)}>
        <input type="hidden" name="email" value={email} />
      </form>
      <form id={`${formId}-discard`} action={action} method="post">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="action" value="discard" />
      </form>

      {reasoning && (
        <p className="text-xs text-muted mt-2 leading-relaxed">
          <span className="font-semibold">Why I wrote it that way:</span> {reasoning}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button type="submit" form={formId} className="btn-primary text-sm py-2 px-4">
          <ArrowRight className="w-3.5 h-3.5" /> Send it to {clientName}
        </button>
        <button
          type="submit"
          form={`${formId}-rewrite`}
          className="btn-outline text-sm py-2 px-3"
          title="Have Bloom write a different note. Your edits will be replaced."
        >
          Rewrite
        </button>
        <button
          type="submit"
          form={`${formId}-discard`}
          className="text-sm py-2 px-3 text-muted hover:text-accent-coral-strong transition-colors"
        >
          Discard
        </button>
      </div>

      {busy && <PendingOverlay messages={[`Sending to ${clientName}`]} />}
      {rewriting && <PendingOverlay messages={['Reading their history', 'Writing a new note']} />}
    </div>
  )
}

/** The stored body is simple <p> markup, so this is a faithful round trip. */
function htmlToText(html: string): string {
  return html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}
