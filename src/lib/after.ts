import { after as nextAfter } from 'next/server'

/**
 * Run work after the response has been sent.
 *
 * Deliberately NOT `waitUntil` from `@vercel/functions`. That helper resolves to
 * `getContext().waitUntil?.(promise)`, and off Vercel there is no context, so the
 * optional call returns undefined and drops the promise on the floor: no error,
 * no execution. Bloom also runs as a plain Node server behind Traefik, where that
 * would silently mean paid subscriptions never activate and the weekly agent
 * never runs. `after` ships with Next and works on both.
 *
 * The catch is attached synchronously, not inside the callback. A long-lived Node
 * server exits on an unhandled rejection, and the promise is already in flight by
 * the time it gets here, so it could reject before `after` ever calls back.
 */
export function after(promise: Promise<unknown>): void {
  const guarded = promise.catch((err: unknown) => {
    console.error('Background task failed:', err)
  })
  nextAfter(() => guarded)
}
