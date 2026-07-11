/**
 * Public support address, shown in the footer and every legal page and used as
 * the contact of record for billing and privacy questions. Stripe requires a
 * working support contact to activate a live account, so this must resolve to a
 * monitored inbox before real charges are switched on. Override with
 * NEXT_PUBLIC_SUPPORT_EMAIL; the default is an address on Bloom's own domain.
 */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'jonathan@jonathanandrei.com'

/** Trading name and operator shown on legal pages. */
export const OPERATOR = 'Jonathan Andrei'
export const OPERATOR_SITE = 'https://jonathanandrei.com'

/**
 * The public base URL for building redirect targets (Stripe success/cancel,
 * dashboard links). Behind Traefik the standalone server binds 0.0.0.0:3000, so
 * `request.nextUrl.origin` resolves to http://0.0.0.0:3000 and a post-payment
 * redirect would send the customer to an unreachable address. Prefer the
 * configured public origin; only fall back to the request when none is set.
 */
export function publicBaseUrl(request: { nextUrl: { origin: string } }): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return request.nextUrl.origin
}
