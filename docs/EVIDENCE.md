# Evidence: Bloom running in production

This documents that Bloom is live and that its AI agent executes real decisions
and real side effects in production. Nothing here contains secrets or customer
credentials.

## Live product

- **App:** https://bloom.jonathanandrei.com
- **Public agent activity feed:** https://bloom.jonathanandrei.com/agent
  Every weekly run writes each decision and action here (generate, decide
  promotion, self-QA score, rewrite, send, errors). This is the primary live
  evidence that the AI operates the business, not just suggests text.

## The AI executes key decisions autonomously

On each weekly run the agent, with no human trigger:

1. **Decides** the week's strategic angle and which promotion to feature (logged
   as `decided_promotion` when the owner leaves it open).
2. **Generates** three social posts and a full email newsletter in the business's
   brand voice, via Gemini 2.5 Flash on Vertex AI with a forced response schema
   (`generated_content`).
3. **Reviews its own work** with a second Gemini call that scores the draft 0 to 100,
   and **rewrites** it when it falls below the quality bar, keeping the better
   attempt (`qa_review` / `qa_regenerated`). A representative logged result:
   `Rejected its own draft (65/100) and rewrote it. Accepted at 75/100.`
4. **Sends** the newsletter to the business's subscribers through a verified
   Resend domain (`sent_newsletter`), Pro tier only.

Each log line records the model, token count, and latency for the run.

## Verified real-money and real-delivery events

- **Real payment on live Stripe.** A live-mode subscription checkout completed and
  the webhook activated the account (dashboard showed the paid tier; agent feed
  logged `subscription_activated`). The test charges were then refunded.
- **Real newsletter delivered.** A newsletter was generated and emailed to a real
  inbox through the exact production send path (Resend accepted it with a message
  ID and it was received).

## Google Cloud / Gemini usage

- **Vertex AI** serves Gemini 2.5 Flash for both the generation call and the
  self-QA call on every run. Model label recorded in logs reads
  `gemini-2.5-flash (vertex)`.
- Code: [`src/lib/gemini.ts`](../src/lib/gemini.ts) (generation + self-QA gate),
  [`src/lib/agent-run.ts`](../src/lib/agent-run.ts) (weekly run + delivery),
  [`src/app/api/cron/weekly/route.ts`](../src/app/api/cron/weekly/route.ts) and
  [`src/app/api/cron/run-business/route.ts`](../src/app/api/cron/run-business/route.ts)
  (the autonomous scheduler and per-business worker).

## How to see it live

1. Open https://bloom.jonathanandrei.com/agent to see the real activity feed.
2. Create a free preview at https://bloom.jonathanandrei.com/setup to watch the
   agent decide, write, and self-QA a week of content on the spot.
