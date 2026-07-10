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
