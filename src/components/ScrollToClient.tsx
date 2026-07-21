'use client'

import { useEffect } from 'react'

/**
 * Put the owner back on the client they just acted on.
 *
 * A plain #fragment in the redirect is not enough: the page streams, so the anchor
 * frequently does not exist yet at the moment the browser tries to jump to it, and
 * the jump is silently dropped. That is why "rewrite" kept landing at the top.
 * Scrolling here, after mount, is deterministic.
 */
export default function ScrollToClient({ id }: { id?: string }) {
  useEffect(() => {
    if (!id) return
    const el = document.getElementById(`c-${id}`)
    if (!el) return
    // rAF so it runs after the first paint, and 'center' so the row is obviously
    // the thing being looked at rather than hidden under the sticky header.
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [id])

  return null
}
