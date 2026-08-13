# Evidence: Bloom running in production

This documents that Bloom is live and that its AI executes real decisions and real
side effects in production. Nothing here contains secrets or customer credentials.

Where something is not yet proven, it says so.

## Live product

- **App:** https://bloom.jonathanandrei.com
- **Client radar (the flagship):** the risk engine and win-back drafting live
  behind an owner-only token, so the fastest way to see them is the demo account
  below.
- **Public agent activity feed:** https://bloom.jonathanandrei.com/agent

  The feed deliberately shows the agent working WITHOUT naming a client. The
  underlying data is a business's real customer list, so the feed is an allowlist:
  an action type is private until it has been reviewed as safe to publish, and the
  model's per-client reasoning never appears there at all. What you will see is
  lines like `win back | a hair salon in Toronto | Wrote a personal note to a
  client slipping away. A 28-day regular who has not been in for 44 days.`

## Rules decide WHO. Gemini decides WHAT TO SAY.

This split is the architecture and it is checkable in the code.

**Deterministic, no LLM:** [`src/lib/retention.ts`](../src/lib/retention.ts)
computes the *median* gap between a client's real visits and scores them against
their own cadence. The median rather than the mean, because a single six-month gap
would drag a mean far enough to hide a real lapse. It is exact, reproducible, and
cannot hallucinate a rhythm. The engine does not even accept a client's name or
email: it has no business knowing who someone is to decide whether they are
lapsing.

**Generative:** [`draftWinBack`](../src/lib/gemini.ts) reads one person's real
history and writes the note. It is constrained hard: it may only offer what the
owner configured (left open, it invented free treatments the owner would have had
to honour), and it must never reveal that a list was consulted.

### The negative control

The clearest proof the system is not just a threshold with a chatbot bolted on:

| Client | Own rhythm | Days since last visit | Verdict |
| --- | --- | --- | --- |
| Aisha B. | every 56 days | **44** | on rhythm, agent stays silent |
| Jane W. | every 28 days | **44** | slipping away, agent acts |

Identical inputs to any date-threshold rule. Opposite correct answers. Visible on
the homepage and reproducible from the sample book below.

## The AI executes key decisions

**Autonomous, no human trigger** (the weekly content agent):

1. **Decides** the week's angle and which promotion to feature (`decided_promotion`).
2. **Generates** three social posts and a newsletter via Gemini 2.5 Flash on Vertex
   AI with a forced response schema (`generated_content`).
3. **Reviews its own work** with a second Gemini call scoring 0 to 100 and
   **rewrites** below the bar, keeping the better attempt (`qa_review` /
   `qa_regenerated`). A representative logged result:
   `Rejected its own draft (65/100) and rewrote it. Accepted at 75/100.`
4. **Sends** the newsletter through a verified Resend domain (`sent_newsletter`),
   Pro only.

These log lines record model, token count, and latency.

**Owner-triggered, one client at a time** (the win-back): the owner clicks for a
specific client; Gemini drafts the note; the owner reviews it, can edit any line,
and approves before it sends (`winback_sent`). A human sees the exact words before
they reach the client's inbox. These lines record model and token count.

**Honest limitations:**

- The win-back has **no automated self-QA gate**. The content path scores and
  rewrites itself; the win-back makes a single call and shows the draft for approval.
  The gate today is the owner reviewing and approving each note, which is exactly why
  the feature is not scheduled.
- The win-back is **not autonomous**. It sends email in a real business's name to
  a customer they care about, and that has not earned unsupervised operation yet.
- The **false-positive rate is unmeasured**. The thresholds come from published
  retention research, not a validated corpus. Aisha is a structural negative
  control, not a measured precision figure.
- **No arms-length users yet.** Every number in the app today comes from the
  sample book or from my own testing.

## Verified real-money and real-delivery events

- **Real payment on live Stripe.** A live-mode subscription checkout completed and
  the webhook activated the account (`subscription_activated`). Both test charges
  were refunded and the subscriptions cancelled, so net revenue is $0.
- **Real newsletter delivered.** Generated and emailed to a real inbox through the
  exact production path (Resend accepted it with a message ID; it was received).

## Google Cloud / Gemini usage

- **Vertex AI** serves Gemini 2.5 Flash for all three call sites (win-back draft,
  weekly generation, self-QA). The model label recorded in logs reads
  `gemini-2.5-flash (vertex)`.
- Code:
  - [`src/lib/retention.ts`](../src/lib/retention.ts) the deterministic risk engine
  - [`src/lib/import-csv.ts`](../src/lib/import-csv.ts) booking-export parsing
  - [`src/lib/gemini.ts`](../src/lib/gemini.ts) all Gemini calls, including
    `draftWinBack`
  - [`src/app/api/clients/winback/route.ts`](../src/app/api/clients/winback/route.ts)
    draft, gate, send, log
  - [`src/app/api/clients/import/route.ts`](../src/app/api/clients/import/route.ts)
    merge-on-import and measured recovery
  - [`src/lib/agent-run.ts`](../src/lib/agent-run.ts) and
    [`src/app/api/cron/weekly/route.ts`](../src/app/api/cron/weekly/route.ts) the
    autonomous weekly run

## How to see it live, in about a minute

1. Open https://bloom.jonathanandrei.com/demo and enter the demo password (shared
   with judges in the submission). It opens a real, comped Pro salon.
2. Open the client radar, click **Download a sample booking history**, and upload
   it. The sample is generated with dates relative to today, so it never goes
   stale.
3. Read the two rows that matter: **Aisha and Jane, both 44 days out, opposite
   verdicts.** That is the whole thesis, and no date-threshold tool can produce it.
4. Click **Win them back** on Nina (the first-timer with 12 days left on the
   30-day cliff). Gemini drafts the note and you will see exactly what it wrote,
   plus why.

   The send is deliberately held: the sample uses `@example.com`, an IANA-reserved
   domain that hard bounces, and bounces are scored against the sending domain
   every real business here shares. Upload a book with your own address to see it
   send for real.
5. Optional: click the **follow-up sample** link, which is the same book days later
   with that client rebooked. Uploading it proves the save from the owner's own
   data, which is the only way Bloom will count one.
