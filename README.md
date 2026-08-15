# Bloom

**Bloom finds the clients a local business is about to lose, and writes to each one personally.**

Nobody cancels. They just quietly stop coming, and the owner finds out months later, if ever. A typical salon loses about 40% of its clients every year, a first-timer who does not rebook within 30 days has about a one-in-five chance of ever returning, and a loyal regular is worth several hundred dollars a year (about $600). The signal is invisible because it is an *absence*, spread across hundreds of people who each have their own rhythm.

An owner uploads a booking-history CSV from whatever they already use. Bloom works out each client's own visit rhythm, flags the ones drifting from it, and drafts a personal note to each. It is your appointment book, but it reads itself.

## The idea, in one architectural line

**Rules decide WHO. Gemini decides WHAT TO SAY.**

- The risk engine ([src/lib/retention.ts](src/lib/retention.ts)) is deterministic: it takes the *median* gap between a client's real visits and measures them against themselves. Exact, auditable, reproducible, and incapable of hallucinating a rhythm. The output is "she is worth $1,295 a year and she is leaving," and that call has to be right every time it is asked.
- Gemini ([`draftWinBack`](src/lib/gemini.ts)) does what a rule cannot: read one messy human history and write something a real person would actually send.

The demo of the whole thesis is two clients: **Aisha and Jane are both 44 days since their last visit.** Aisha comes every 8 weeks, so she is fine and Bloom stays silent. Jane comes every 4 weeks, so she is going. Any tool that flags "no visit in 60 days" treats them identically and is wrong about one of them.

## Demo

Demo video: **https://www.youtube.com/watch?v=4XNtqJFUIms**

Writeup: **https://jonathanandrei.com/blog/bloom-client-retention-gemini-xprize-hackerfund/**

Live app: **https://bloom.jonathanandrei.com**. No signup or card needed, and you do not even need a booking export: the radar links a generated sample book ([/api/sample-csv](src/app/api/sample-csv/route.ts)) whose dates are relative to today, so it never goes stale.

## How it works

1. **Upload the book.** Any CSV with a client email and a date. [src/lib/import-csv.ts](src/lib/import-csv.ts) finds the columns by keyword, so Fresha, Square, Vagaro, Booksy and Google Calendar exports all work. Same-day rows are merged into one visit, because those platforms export a row per service line item.
2. **See who is slipping, free.** The client radar scores every client against their own cadence and shows what each is worth a year. This costs nothing to show, so it costs nothing to see.
3. **The agent writes to them.** Owner-triggered, one client at a time: Gemini drafts a note referencing that person's last visit and timing; the owner reviews and approves it, and Bloom sends it from the business's verified domain. Never a blast, never twice, never to someone who opted out.
4. **The save is measured.** Re-upload a fresh export; if they booked again *after* the note went out, Bloom counts it. Recovery is proven by the owner's own data, not claimed.

Separately, a weekly content agent runs fully autonomously on a cron sidecar (see [docker-compose.yml](docker-compose.yml)), generating that week's posts and newsletter and, on Pro, sending it. It is the original product and it still ships; it is no longer the headline.

## Stack

- **Next.js 16** (App Router) and React 19
- **Google Gemini 2.5 Flash** via **Vertex AI**, in [src/lib/gemini.ts](src/lib/gemini.ts): win-back drafting, weekly content, and a self-QA gate on the content path
- **Prisma 7** on **Neon** Postgres, schema in [prisma/schema.prisma](prisma/schema.prisma)
- **Papa Parse** for booking-export parsing
- **Stripe** for the Starter and Pro subscriptions and webhooks
- **Resend** for delivery from a verified domain
- **Docker + Traefik** on a self-hosted box, with a cron sidecar for the weekly run

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
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Support address shown in the footer and on legal pages |
| `FREE_PREVIEW_DAILY_CAP` | Global ceiling on free content previews per day (default 500) |
| `WINBACK_DAILY_CAP` | Win-backs per business per day (default 50) |
| `WINBACK_GLOBAL_DAILY_CAP` | Win-backs across all businesses per day (default 500) |
| `DEMO_BUSINESS_ID` / `DEMO_PASSWORD` | The password-gated demo account at `/demo` |
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

[docker-compose.yml](docker-compose.yml) runs the standalone Next.js server behind an existing Traefik, plus a sidecar that replaces Vercel Cron. The build context is `./app` beside the compose file, with `.env` (mode 600) next to it.

The source in `./app` is shipped from a local checkout rather than pulled on the box, because the repo is private and a shared host is the wrong place to keep a credential that can read it:

```bash
# from the local repo, on the committed tree (never the working directory)
git archive --format=tar.gz -o /tmp/bloom.tgz HEAD
scp /tmp/bloom.tgz <user>@<host>:~/bloom/bloom.tgz

# on the box
cd ~/bloom && rm -rf app-new && mkdir app-new && tar xzf bloom.tgz -C app-new
rm -rf app.prev && mv app app.prev && mv app-new app && rm -f bloom.tgz
docker compose up -d --build
docker compose logs -f app
```

`app.prev` is the rollback. Shipping `git archive HEAD` rather than copying the directory is deliberate: it carries exactly what is committed, so untracked local files and gitignored media can never reach production.

Two things differ from Vercel and are easy to get wrong:

- Background work uses `after()` from `next/server`, not `waitUntil` from `@vercel/functions`. That helper is a silent no-op off-platform, which would mean paid subscriptions never activate and the weekly agent never runs.
- `INTERNAL_APP_URL` must use the **container name**, not the compose service name. The Traefik network is shared with other stacks, and a generic alias like `app` resolves to one of them.

## License

MIT. See [LICENSE](LICENSE).
