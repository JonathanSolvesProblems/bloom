# Bloom

Bloom is an AI marketing agent for local businesses. Every Monday it writes a full week of marketing content (three social posts and an email newsletter) in the business's own brand voice, then sends the newsletter to their subscribers. The owner sets it up once and the agent runs on its own.

I built Bloom because most local businesses (salons, cafes, gyms, clinics) know they should post and email their customers regularly but never find the time. Bloom does the writing and the sending so they can get back to running the business.

## How it works

1. **Set up once.** The owner enters their business details, picks a brand voice, and adds their contact info. Three short steps, no credit card.
2. **See a free preview.** Bloom generates three real social posts and a newsletter draft on the spot, so the owner sees the quality before paying anything.
3. **The agent takes over.** On Pro ($99/month), a scheduled job runs every Monday at 13:00 UTC. It generates that week's content with Gemini, saves it, emails the newsletter to the business's subscriber list through Resend, and logs every action to an activity log.
4. **Grow the list.** Each business gets a public subscribe page to share with customers so their audience keeps growing.

The weekly run is fully autonomous. No person triggers it: the Vercel Cron defined in [vercel.json](vercel.json) calls `/api/cron/weekly`, which is the agent's entry point.

## Stack

- **Next.js 16** (App Router) and React 19
- **Google Gemini 2.5 Flash** for content generation, in [src/lib/gemini.ts](src/lib/gemini.ts)
- **Prisma 7** on **Neon** Postgres, schema in [prisma/schema.prisma](prisma/schema.prisma)
- **Stripe** for the $99/month subscription and webhooks
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
| `GEMINI_API_KEY` | Google Generative AI (Gemini) API key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the Stripe webhook |
| `RESEND_API_KEY` | Resend API key for sending email |
| `RESEND_FROM_DOMAIN` | Verified sending domain (defaults to `bloom.ai`) |
| `CRON_SECRET` | Shared secret the weekly cron sends as a Bearer token |

### Deploying

Deploy on Vercel. Add every variable above in the project settings, then point a Stripe webhook at `/api/webhooks/stripe` for the `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed` events. The weekly cron in `vercel.json` runs automatically once deployed.

## License

MIT. See [LICENSE](LICENSE).
