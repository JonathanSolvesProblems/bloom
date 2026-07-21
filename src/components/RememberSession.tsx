'use client'

import { useEffect } from 'react'

/**
 * Quietly remember this dashboard on this device.
 *
 * Runs once whenever an authenticated page is opened, whichever way the owner got
 * there: straight after signup, from the emailed link, or from a bookmark. After
 * that, coming back to the site takes them to their dashboard instead of the
 * marketing page.
 */
export default function RememberSession({ businessId, token }: { businessId: string; token: string }) {
  useEffect(() => {
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, token }),
    }).catch(() => {
      /* a browser refusing cookies still has the link in the address bar */
    })
  }, [businessId, token])

  return null
}
