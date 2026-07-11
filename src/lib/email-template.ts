/**
 * Wrap the AI-written newsletter body in the business's own branding: a header
 * with their logo and brand color. The body is generated header-less (see the
 * prompt) so this is the single place the header is added. Rendered at read time
 * (preview and send), so changing the brand takes effect immediately without
 * regenerating content.
 */

const HEX = /^#[0-9a-fA-F]{6}$/
const DEFAULT_COLOR = '#047857'

function safeColor(c?: string | null): string {
  return c && HEX.test(c) ? c : DEFAULT_COLOR
}

/** Only allow a real http(s) image URL; anything else renders no logo. */
function safeLogo(u?: string | null): string {
  if (!u) return ''
  try {
    const url = new URL(u)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
  } catch {
    /* not a URL */
  }
  return ''
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Readable text color (black or white) for text sitting on the brand color. */
function textOn(hex: string): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  // Perceived luminance; dark backgrounds get white text.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#111827' : '#ffffff'
}

export type Branding = { name: string; brandColor?: string | null; logoUrl?: string | null }

export function brandEmail(bodyHtml: string, brand: Branding): string {
  const color = safeColor(brand.brandColor)
  const logo = safeLogo(brand.logoUrl)
  const onColor = textOn(color)
  const name = esc(brand.name)

  // Show the logo if there is one (it is the brand mark, and usually already
  // contains the name); otherwise fall back to the business name as text. The
  // logo keeps the name as alt text for when a client blocks remote images.
  const brandMark = logo
    ? `<img src="${esc(logo)}" alt="${name}" height="44" style="display:inline-block;max-height:44px;border:0" />`
    : `<span style="color:${onColor};font-size:20px;font-weight:700;font-family:Helvetica,Arial,sans-serif">${name}</span>`
  const header = `<tr><td style="background:${color};padding:24px;text-align:center">${brandMark}</td></tr>`

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-collapse:collapse">
  ${header}
  <tr><td style="padding:28px 24px;color:#111827;font-family:Helvetica,Arial,sans-serif">${bodyHtml}</td></tr>
</table>`
}
