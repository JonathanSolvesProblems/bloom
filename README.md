# Bloom

Bloom is an AI marketing agent for local businesses. Every Monday it writes a full week of marketing content (three social posts and an email newsletter) in the business's own brand voice, then sends the newsletter to their subscribers. The owner sets it up once and the agent runs on its own.

I built Bloom because most local businesses (salons, cafes, gyms, clinics) know they should post and email their customers regularly but never find the time. Bloom does the writing and the sending so they can get back to running the business.

## Demo

Live app: **https://bloom.jonathanandrei.com**. Enter a business in three steps and Bloom generates a real content preview on the spot, no signup or credit card required.

## How it works

1. **Set up once.** The owner enters their business details, picks a brand voice, and adds their contact info. Three short steps, no credit card.
2. **See a free preview.** Bloom generates three real social posts and a newsletter draft on the spot, so the owner sees the quality before paying anything.
3. **The agent takes over.** A scheduled job runs at 13:00 UTC. It generates that week's content with Gemini, saves it, and logs every action to an activity log. On Starter ($49/month) the owner publishes it themselves. On Pro ($99/month) the agent also emails the newsletter to the business's subscriber list through Resend.
4. **Grow the list.** Each business gets a public subscribe page to share with customers so their audience keeps growing.

The weekly run is fully autonomous. No person triggers it: on the primary self-hosted deployment a cron sidecar (see [docker-compose.yml](docker-compose.yml)) calls `/api/cron/weekly` daily, which is the agent's entry point. It ticks daily so a missed run self-heals, but the content is keyed per week, so each business gets one week of content per week. On a Vercel-only deployment you would add a Vercel Cron back to `vercel.json` instead.

## Stack

- **Next.js 16** (App Router) and React 19
- **Google Gemini 2.5 Flash** for content generation, in [src/lib/gemini.ts](src/lib/gemini.ts)
- **Prisma 7** on **Neon** Postgres, schema in [prisma/schema.prisma](prisma/schema.prisma)
- **Stripe** for the Starter and Pro subscriptions and webhooks
- **Resend** for newsletter delivery
- **Vercel Cron** for the weekly agent run

## Getting started

```bash
npm install
cp .env.example .env      # then fill in your own keys
npx prisma migrate dev --name init
npm run dev
```

Then open http://localhost:3000.

### Environment variables

Every value lives in [.env.example](.env.example):

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `VERTEX_API_KEY` | Gemini through Vertex AI, used in production |
| `GEMINI_API_KEY` | AI Studio key, the local fallback |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the Stripe webhook |
| `RESEND_API_KEY` | Resend API key for sending email |
| `RESEND_FROM_DOMAIN` | Verified sending domain; the agent refuses to send without it |
| `CRON_SECRET` | Shared secret the weekly cron sends as a Bearer token |
| `NEXT_PUBLIC_APP_URL` | Public origin, baked into the client bundle |
| `INTERNAL_APP_URL` | Self-hosted only: where the dispatcher reaches its workers |

Whichever host it runs on, point a Stripe webhook at `/api/webhooks/stripe` for the `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed` events.

### Deploying on Vercel

Add every variable above except `INTERNAL_APP_URL` in the project settings.

`vercel.json` intentionally defines no cron. The weekly agent is driven by the sidecar on the self-hosted box, and running a Vercel cron as well would fire a second dispatcher against the same database every Monday. The atomic send-claim in `agent-run.ts` is the backstop; removing the schedule is the primary fix. If you run Bloom on Vercel only, add the cron back:

```json
{ "crons": [{ "path": "/api/cron/weekly", "schedule": "0 13 * * 1" }] }
```

### Deploying on a plain Docker host

[docker-compose.yml](docker-compose.yml) runs the standalone Next.js server behind an existing Traefik, plus a sidecar that replaces Vercel Cron. The repo is checked out into `./app` beside the compose file, with `.env` (mode 600) next to it.

```bash
docker compose up -d --build
docker compose logs -f app
```

Two things differ from Vercel and are easy to get wrong:

- Background work uses `after()` from `next/server`, not `waitUntil` from `@vercel/functions`. That helper is a silent no-op off-platform, which would mean paid subscriptions never activate and the weekly agent never runs.
- `INTERNAL_APP_URL` must use the **container name**, not the compose service name. The Traefik network is shared with other stacks, and a generic alias like `app` resolves to one of them.

## License

MIT. See [LICENSE](LICENSE).
