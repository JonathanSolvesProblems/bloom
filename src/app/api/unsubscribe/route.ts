import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

function page(title: string, message: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fbfaf7;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0b1b14">
  <div style="max-width:420px;padding:32px;text-align:center">
    <div style="width:44px;height:44px;border-radius:12px;background:#059669;margin:0 auto 18px"></div>
    <h1 style="font-size:1.35rem;margin:0 0 10px">${title}</h1>
    <p style="color:#5b6b62;line-height:1.6;margin:0">${message}</p>
  </div>
</body></html>`
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

async function unsubscribe(request: NextRequest): Promise<Response> {
  const id = request.nextUrl.searchParams.get('s')
  if (!id) return page('Link not valid', 'This unsubscribe link is missing its identifier.')

  const sub = await db.subscriber.findUnique({
    where: { id },
    include: { business: { select: { name: true } } },
  })

  // Already gone, or never existed: report success either way so the link is
  // never a probe for whether an address is on a list.
  if (!sub) return page('You are unsubscribed', 'You will not receive any more newsletters from this business.')

  const name = sub.business?.name ?? 'this business'
  try {
    await db.subscriber.delete({ where: { id } })
  } catch {
    /* already removed */
  }

  return page('You are unsubscribed', `You will not receive any more newsletters from ${name}.`)
}

export async function GET(request: NextRequest) {
  return unsubscribe(request)
}

// Supports one-click unsubscribe (RFC 8058) when a mail client POSTs the header URL.
export async function POST(request: NextRequest) {
  return unsubscribe(request)
}
