import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

function shell(title: string, inner: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#151516;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#f1eee4">
  <div style="max-width:420px;padding:32px;text-align:center">
    <svg width="40" height="40" viewBox="0 0 32 32" style="margin:0 auto 18px;display:block">
      <rect width="32" height="32" rx="7" fill="#202023"/>
      <g transform="translate(13 13)"><g fill="none" stroke="#f1eee4" stroke-width="1.9" stroke-linejoin="round">
        <ellipse cx="0" cy="-6" rx="3.2" ry="5"/><ellipse cx="0" cy="-6" rx="3.2" ry="5" transform="rotate(72)"/>
        <ellipse cx="0" cy="-6" rx="3.2" ry="5" transform="rotate(144)"/><ellipse cx="0" cy="-6" rx="3.2" ry="5" transform="rotate(288)"/>
      </g><circle r="2.4" fill="#f1eee4"/></g>
      <ellipse cx="24.5" cy="24.5" rx="2.9" ry="4.6" fill="#ff4d6d" transform="rotate(34 24.5 24.5)"/>
    </svg>
    ${inner}
  </div>
</body></html>`
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

function message(title: string, body: string): Response {
  return shell(title, `<h1 style="font-size:1.35rem;margin:0 0 10px">${title}</h1>
    <p style="color:#9a968c;line-height:1.6;margin:0">${body}</p>`)
}

/**
 * Confirmation page for a plain link click (GET). It does NOT unsubscribe on its
 * own: mail-security scanners (Outlook SafeLinks, Barracuda, Mimecast) fetch
 * every link with a GET before delivery, so deleting on GET would silently
 * unsubscribe readers who never clicked. The actual removal happens on the POST
 * this form submits, which is also the RFC 8058 one-click target mail clients
 * hit directly.
 */
function confirmPage(query: string, what: string): Response {
  return shell('Unsubscribe', `<h1 style="font-size:1.35rem;margin:0 0 10px">Unsubscribe?</h1>
    <p style="color:#9a968c;line-height:1.6;margin:0 0 20px">You will stop receiving ${what} from this business.</p>
    <form method="post" action="/api/unsubscribe?${query}">
      <button type="submit" style="background:#f1eee4;color:#151516;border:0;border-radius:4px;padding:12px 22px;font-size:15px;font-weight:600;cursor:pointer">Yes, unsubscribe me</button>
    </form>`)
}

export async function GET(request: NextRequest) {
  const subId = request.nextUrl.searchParams.get('s')
  const clientId = request.nextUrl.searchParams.get('c')

  // The page renders identically whether or not the id resolves, so it cannot be
  // used to test whether an address is on a list. Naming the business would leak
  // exactly that, and it is not needed: whoever clicked this arrived from the
  // email itself and already knows who sent it.
  if (clientId) return confirmPage(`c=${encodeURIComponent(clientId)}`, 'emails')
  if (subId) return confirmPage(`s=${encodeURIComponent(subId)}`, 'newsletters')
  return message('Link not valid', 'This unsubscribe link is missing its identifier.')
}

// One-click unsubscribe (RFC 8058) and the confirm-page submit both land here.
// Only a POST removes the subscriber.
export async function POST(request: NextRequest) {
  const subId = request.nextUrl.searchParams.get('s')
  const clientId = request.nextUrl.searchParams.get('c')

  // A client is the business's own booking history, not a mailing-list row, so
  // opting out flags them instead of deleting them. The retention agent skips
  // anyone carrying this flag, permanently.
  if (clientId) {
    await db.client.updateMany({
      where: { id: clientId, unsubscribedAt: null },
      data: { unsubscribedAt: new Date() },
    })
    return message('You are unsubscribed', 'You will not receive any more emails from this business.')
  }

  if (!subId) return message('Link not valid', 'This unsubscribe link is missing its identifier.')

  try {
    await db.subscriber.delete({ where: { id: subId } })
  } catch {
    /* already gone, or never existed: report success either way */
  }
  return message('You are unsubscribed', 'You will not receive any more newsletters from this business.')
}
