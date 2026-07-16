import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

function shell(title: string, inner: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fbfaf7;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0b1b14">
  <div style="max-width:420px;padding:32px;text-align:center">
    <div style="width:44px;height:44px;border-radius:12px;background:#059669;margin:0 auto 18px"></div>
    ${inner}
  </div>
</body></html>`
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

function message(title: string, body: string): Response {
  return shell(title, `<h1 style="font-size:1.35rem;margin:0 0 10px">${title}</h1>
    <p style="color:#5b6b62;line-height:1.6;margin:0">${body}</p>`)
}

/**
 * Confirmation page for a plain link click (GET). It does NOT unsubscribe on its
 * own: mail-security scanners (Outlook SafeLinks, Barracuda, Mimecast) fetch
 * every link with a GET before delivery, so deleting on GET would silently
 * unsubscribe readers who never clicked. The actual removal happens on the POST
 * this form submits, which is also the RFC 8058 one-click target mail clients
 * hit directly.
 */
function confirmPage(query: string, name: string, what: string): Response {
  return shell('Unsubscribe', `<h1 style="font-size:1.35rem;margin:0 0 10px">Unsubscribe from ${name}?</h1>
    <p style="color:#5b6b62;line-height:1.6;margin:0 0 20px">You will stop receiving ${what} from ${name}.</p>
    <form method="post" action="/api/unsubscribe?${query}">
      <button type="submit" style="background:#059669;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:15px;font-weight:600;cursor:pointer">Yes, unsubscribe me</button>
    </form>`)
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function GET(request: NextRequest) {
  const subId = request.nextUrl.searchParams.get('s')
  const clientId = request.nextUrl.searchParams.get('c')

  // Always show the same confirm page whether or not the id resolves, so the
  // link is never a probe for membership.
  if (clientId) {
    const client = await db.client.findUnique({
      where: { id: clientId },
      include: { business: { select: { name: true } } },
    })
    const name = esc(client?.business?.name ?? 'this business')
    return confirmPage(`c=${encodeURIComponent(clientId)}`, name, 'emails')
  }

  if (!subId) return message('Link not valid', 'This unsubscribe link is missing its identifier.')

  const sub = await db.subscriber.findUnique({
    where: { id: subId },
    include: { business: { select: { name: true } } },
  })
  const name = esc(sub?.business?.name ?? 'this business')
  return confirmPage(`s=${encodeURIComponent(subId)}`, name, 'newsletters')
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
