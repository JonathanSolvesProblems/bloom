# Bloom: Hackathon Submission

Draft answers for the XPRIZE / Hacker.fund "Build with Gemini" submission form,
written in the first person. The revenue, expense, and user figures are all zero
as of submission and are stated as final values; if a real sale lands before you
submit, update the matching figure and its explanation.

- **Live product:** https://bloom.jonathanandrei.com
- **Repository:** https://github.com/JonathanSolvesProblems/bloom
- **Category:** Small Business Services
- **Closes:** August 17, 2026, 1:00 PM PT (judging Aug 18 to Sep 15, winners Sep 25)

### What the official rules actually require (read this before anything else)

Straight from https://www.geminixprize.com/rules, because two of these are harder
than they look:

1. **Business Viability is a third of the score, and it is defined as: "launch a
   real business during the Hackathon, acquire real users, and generate real
   revenue."** Revenue must be from THIRD-PARTY customers; related-party revenue
   (my own test purchases) is disclosed separately and does not count. As of today
   that number is zero, so a third of the score is currently near zero. No amount
   of engineering or design fixes this. Only real salons do.
2. **AI-Native Operations is another third: "AI executes key business decisions,
   and how broadly AI governs the operation."** The win-back is owner-triggered, so
   the autonomous weekly agent and the public `/agent` feed are what carry this
   criterion. That is why the demo video keeps a beat on the feed.
3. **Category Impact is the last third:** meaningful movement within the category
   through "fundamental redefinition or credible scale."
4. **Video pitch: under 3 minutes**, publicly visible, showing the product actually
   running. Three minutes is a ceiling, not a target.
5. **Evidence required:** "agent execution logs, API usage records, and screenshots
   of dashboards" showing the system runs continuously in production. See
   `docs/EVIDENCE.md`, and attach a Vertex AI usage screenshot before submitting.

---

## Project overview

### Project name (max 60 characters)

```
Bloom: the AI that catches the clients you're about to lose
```
(58 characters.)

### Elevator pitch (max 200 characters)

```
Nobody cancels, they just stop coming. Bloom finds who's drifting from their own visit rhythm and writes each a personal note. A regular is worth hundreds a year, so saving one covers the software.
```
(197 characters, within the 200 limit.)

### Thumbnail

Use a 3:2 crop of the client radar (`/dashboard/<id>/clients`) or the homepage
book, showing Aisha and Jane side by side: both last seen 44 days ago, one green
and one flagged. That single image is the entire argument, and it is the one
thing in the project a judge cannot get anywhere else.

---

## Project story (Markdown)

## Inspiration

I started out building an AI that writes marketing content, and I was wrong.
Content is a commodity: any owner can get captions out of a chatbot in thirty
seconds, so I was selling something free. What none of them could get was an
answer to a harder question, and it was a question I only found by reading the
retention research for salons and barbershops.

Nobody cancels. They just quietly stop coming, and the owner finds out months
later, if ever. A typical salon loses about 40% of its clients every year. A first-timer
who does not rebook within 30 days has roughly a one-in-five chance of ever
returning, which makes days 7 to 30 after a first visit the highest-value moment
in the entire business and the one nobody is watching. And a loyal regular is
worth several hundred dollars a year (about $600 annualized), so this is not a
rounding error, it is the largest
single profit leak most shops have.

The reason nobody watches it is not laziness. It is that the answer is invisible:
it is not in any report, it is the ABSENCE of a booking, spread across hundreds
of clients who each have their own rhythm.

## What it does

Bloom finds the clients a business is about to lose, and writes to each one
personally.

The owner exports a CSV from whatever they already use (Fresha, Square, Vagaro,
Booksy, even Google Calendar) and uploads it. Nothing to migrate, nothing to
install. Bloom works out each client's own visit rhythm, the median gap between
their real appointments, and measures them against themselves rather than against
a generic rule. It then shows who is slipping and what each of them is worth a
year. That part is free, because it costs nothing to show someone their own
losses.

Then the agent acts. For one specific client, it reads that person's real history
(what they last had done, how often they normally come, how far past their own
rhythm they are) and writes them a short note in the owner's brand voice. The
owner reviews it, edits any line if they want, and approves before Bloom sends it
from the business's verified domain. Never a blast: one message, one person, once. If they book again, the owner's next export proves it, and Bloom
counts the save.

**The single sentence:** it is your appointment book, but it reads itself.

## How I built it

The architecture is the idea, so it is worth being precise about the split.

**Rules decide WHO. Gemini decides WHAT TO SAY.**

The risk engine is deterministic, and deliberately so. It computes the median gap
between a client's visits (the median, not the mean, because one six-month gap
for an injury would drag a mean far enough to hide a real lapse), then scores
them against their own cadence. It is exact, auditable, reproducible, and it
never hallucinates: the same book always produces the same verdict, which matters
when the output is "this person is worth $1,295 a year and she is leaving."

Gemini does the part rules cannot: reason over one messy human history and write
something a real person would send. That is a judgement call over unstructured
context, which is exactly what an LLM is for and exactly what a threshold is not.

The rest: Next.js 16, React 19, TypeScript, Tailwind. Gemini 2.5 Flash through
Vertex AI with forced response schemas. Neon Postgres via Prisma. Stripe for
subscriptions. Resend for delivery from a verified domain. Dockerized standalone
server behind Traefik, with a sidecar cron for the weekly content run.

## Challenges I ran into

The dangerous bugs were the ones that looked fine.

**The agent tried to give away the owner's money.** Testing the win-back drafts,
Gemini offered a client "a complimentary deep conditioning treatment, just
mention this note when you book." Nothing authorised that. On a real salon that
is a real obligation to honour, created by software, in the owner's name. Offers
are now bound to the promotions the owner actually configured, and with none set
the agent is told explicitly that it has nothing to give away.

**An import could have made the agent insult a loyal client.** My own UI tells
owners to export a shorter date range if a file is too big. Doing that rewrote a
20-visit regular as a first-timer, put her at the top of the list, and would have
emailed a two-year client to say she came once and never rebooked. Imports now
merge; the window only ever widens.

**One appointment was counted as two visits.** Square, Fresha and Vagaro export a
row per line item, so a cut-and-colour arrived as two visits. That silently
deleted the flagship case: a first-timer with a two-service appointment read as a
returning regular instead of someone with 12 days left on the cliff. The one
client the agent most needed to catch was the one it hid.

**The public feed would have published a salon's client list.** My activity feed
was built when every log line described the business's own content. The retention
agent broke that assumption by writing the business's CUSTOMERS into logs. An
anonymous visitor would have read a real client's name, service history and visit
rhythm. It is now an allowlist, so a new action type is private until someone
decides otherwise.

Each of these passed a demo. Each would have cost a real owner a real client.

## Accomplishments that I'm proud of

**The negative control.** The homepage shows Aisha and Jane, both last seen 44
days ago. Aisha comes every 8 weeks, so she is fine and Bloom stays silent. Jane
comes every 4 weeks, so the identical gap means she is going. Any tool that flags
"no visit in 60 days" treats those two identically and is wrong about one of
them. Proving the system stays quiet when it should is harder, and worth more,
than proving it can fire.

**Recovery is measured, not claimed.** Bloom only counts a save when the owner's
own fresh export shows a visit that is newer than both the last one it knew about
and the note it sent. I found and fixed the version that compared visit counts,
which would have invented saves that never happened and written them to the feed
as fact.

**It refuses to do the profitable wrong thing.** It will not contact anyone twice.
It will not contact anyone who opted out, ever. It holds sends to reserved test
addresses rather than earn a bounce on a domain other businesses share.

## What I learned

That the moat is not the model, it is the data only the customer has. My first
version sold content, and I could not answer "why not just use a chatbot?"
because there was no answer. The retention version cannot be prompted into
existence: it needs THIS owner's booking history, and the interesting decisions
(who to write to, and when) are ones a rule should make and an LLM should not.

I also learned that the honest split is the pitch. The temptation is to say "AI
does everything." What is actually true is narrower and stronger: a rule decides
who, because that must be exact; the model decides what to say, because that must
be human.

## What's next for Bloom

Real salons, which is the honest gap and the thing I am working on now. Then
storing individual visit dates rather than a per-client aggregate, so the rhythm
strip plots real appointments instead of a median; measuring a true false-positive
rate against owners telling me "no, she is fine"; and a direct Square/Fresha OAuth
sync so the book refreshes itself instead of waiting for an upload.

---

## Written narrative (500 to 1000 words)

> The submission form asks for a standalone narrative on how the business was
> built and how it runs day to day, explicitly covering what the AI does versus
> what a human does, and the jobs and economic opportunity the business creates or
> enables beyond the founding team, both actual and potential. This is that piece,
> ready to paste. It is about 720 words.

I set out to build an AI that writes marketing for local businesses, and I was
wrong about the problem. Content is free now: any salon owner can get a week of
captions out of a chatbot in the time it takes to make a coffee. I was selling
something the market already gives away.

The real problem was hiding in the retention research. In a salon or barbershop,
nobody cancels. They just quietly stop coming, and the owner finds out months
later, from a gap in the appointment book that nobody had time to notice. About
40% of a salon's clients are gone within a year. A first-timer who does not
rebook within 30 days has roughly a one-in-five chance of ever returning. A loyal
regular is worth several hundred dollars a year. That is the largest single profit leak most shops
have, and it stays invisible because it is an absence, spread across hundreds of
people who each keep their own rhythm.

Bloom reads that rhythm. An owner exports a booking-history CSV from whatever they
already use (Fresha, Square, Vagaro, Booksy, even Google Calendar) and uploads it.
Nothing to migrate. Bloom takes each client's own median gap between visits and
measures them against themselves, not against a generic rule. The homepage makes
the whole case with two clients: Aisha and Jane were both last in 44 days ago.
Aisha comes every eight weeks, so she is fine and Bloom stays silent. Jane comes
every four, so the identical gap means she is leaving. Any tool that flags "no
visit in 60 days" gets one of those two wrong, every time.

**What the AI does, and what a human does.** This is the part I am most deliberate
about. A rule decides WHO is at risk, because that call has to be exact,
reproducible, and auditable: the output is "she is worth $1,295 a year and she is
leaving," and a model that hallucinated a rhythm would cost a real owner a real
client. Gemini decides WHAT TO SAY, because writing a note that sounds like the
owner remembered someone is a judgement over messy human context, which is exactly
what a rule cannot do and an LLM can. Gemini 2.5 Flash runs on Google Cloud's
Vertex AI for every draft. A separate weekly content agent runs fully
autonomously: it picks the angle, writes, scores its own draft, rewrites when it
falls short, and sends. The win-back is deliberately owner-triggered, one client
at a time, because it sends email in a real business's name to a customer they
care about, and I will not ship unsupervised sending at scale to a stranger's
salon before it has earned it. Every action is logged to a public feed that shows
the agent working without ever naming a client.

**How it runs day to day.** The owner sets up once. The radar is free, because
showing someone their own losses should not cost anything. When they act, Bloom
drafts a note the owner reviews and approves, then sends from their verified
domain, never twice, never to anyone who opted out. When a client books again, the owner's next export proves it, and Bloom
counts the save from their own data rather than claiming it.

**Jobs and economic opportunity beyond me.** Today the honest answer is that Bloom
has no employees but me. What it creates is not headcount, it is protected
livelihood. A neighbourhood salon runs on thin margins and a handful of chairs,
and every regular who drifts away unnoticed is revenue that would otherwise pay a
stylist. When Bloom keeps 20 clients a year who would quietly have left, worth on
the order of $12,000, that can be the difference between a shop cutting a chair and
keeping one, or hiring the next. The economic opportunity Bloom enables is the
retained revenue base that local service jobs actually depend on, for people well
beyond any founding team: the stylists, barbers, and front-desk staff whose hours
exist only if the shop stays full. As Bloom grows, its own hiring follows the same
logic, salon-partnership and customer-success roles whose whole purpose is keeping
more of those chairs occupied. I would rather state that plainly, actual versus
potential, than inflate a number I do not have.

**Where it honestly stands.** The product is live in production. The gap is
arms-length paying customers, which I am closing now by getting it into real
salons. That is the one thing engineering cannot do for me, and it is what I am
spending the last month of the hackathon on.

## The uniqueness claim

The one sentence to gate every scope decision against, and the one to lead with in
the room:

> **No other entry pairs a deterministic per-client rhythm engine (which decides
> WHO is lapsing, exactly and reproducibly) with a generative agent that writes to
> that ONE person about their ONE last visit, and then proves the save from the
> owner's own next export.**

Why each half is load-bearing:

- **Per-client rhythm, not a threshold.** Everyone else's retention tool asks "no
  visit in 60 days?" Bloom asks "is this person late *for them*?" Aisha and Jane
  are both 44 days out; one is fine. A threshold gets one of them wrong, always.
- **It needs data only the customer has.** You cannot prompt this into existence.
  A chatbot can write a win-back email; it cannot know that Jane is a 28-day
  regular who is 16 days late and worth $1,295.
- **The save is measured, not claimed.** Recovery requires a visit newer than both
  the last one known and the note sent. Most tools report "emails sent."

**What a competent team could already do without this:** compute a median in a
spreadsheet. **What was not possible before:** fifty individually-written notes
that each reference a real person's actual last visit and rhythm, which no owner
has ever had the hours to write. That is the honest version of the claim, and it
is the one that survives a judge pushing on it.

## Honest limitations

What is not solved, stated plainly rather than discovered by a judge:

1. **No arms-length users yet.** Zero real salons as of submission. This is the
   real gap and I am not going to dress it up.
2. **The false-positive rate is unmeasured.** The thresholds come from published
   retention research, not from a validated corpus. I have a structural negative
   control (Aisha) but no measured precision, because measuring it requires real
   owners saying "no, she is fine." That is the first thing real users buy me.
3. **Visit-level dates are not stored.** Bloom keeps a per-client aggregate, so the
   rhythm strip spaces blooms at the median cadence rather than plotting real
   appointments. It is labelled as such in the UI rather than implying more than
   it knows.
4. **The win-back has no self-QA gate** (unlike the content path), which is why it
   is owner-triggered rather than autonomous.
5. **Two visits is a weak rhythm.** With one gap, cadence is a guess, so money
   falls back to the shop's median rather than annualising a coincidence.
6. **CSV, not OAuth.** No live sync yet; the book is as fresh as the last upload.

## Production path

What a real deployment would need beyond this: direct Square/Fresha OAuth so the
book stays current without uploads; visit-level storage; a prospective study of
precision and recall against owners' own judgement; and a critique pass on the
win-back before it is allowed to run unsupervised.

---

## Built with

(Comma-separated, up to 25 tags.)

```
Next.js, React, TypeScript, Tailwind CSS, Google Gemini, Vertex AI, Google Cloud, Prisma, Neon, PostgreSQL, Stripe, Resend, Docker, Traefik, Node.js, Papa Parse
```

---

## Project details

### What date did you start this project? (MM-DD-YY)

```
07-01-26
```

### Which category are you submitting into?

```
Small Business Services
```

### Judge access (put this in the Devpost form, NOT in the public repo)

The client radar and win-back sit behind an owner-only token, so a judge needs the
demo account to see the flagship. Provide these in the submission form, which is
private to judges, rather than here:

```
Demo: https://bloom.jonathanandrei.com/demo
Password: <the DEMO_PASSWORD value>   (do not commit this to the public repo)
Then: open the client radar, download the sample book, upload it, read Aisha vs Jane.
```

The password is deliberately left out of this tracked file because the repo is
being made public. Paste it into the Devpost submission's private notes-to-judges
field instead.

### Explain how your project uses AI to impact the world, specifically in the category you have chosen.

The biggest profit leak in a local service business is invisible. Roughly 40% of
a salon's clients are gone within a year, and a first-timer who does not rebook within
30 days has about a one-in-five chance of ever coming back. Owners do not ignore
this because they do not care. They ignore it because the signal is an ABSENCE
spread across hundreds of people who each have a different rhythm, and because
acting on it means writing a personal note to each one, which nobody has time for.

Bloom removes both barriers. A deterministic engine finds the drift by measuring
every client against their own median cadence, and Gemini writes each of them a
note that reads like the owner remembered them, because it is given that person's
real history. A shop with 400 clients might have 20 slipping in a given month,
worth over $10,000 a year between them. Saving three of them pays for the software
for years.

This is squarely Small Business Services: the AI does not advise the owner, it
performs a service the business would otherwise pay a person for, and the outcome
is measured in whether a specific named client walked back through the door.

### Explain the underlying business model of your submission.

A subscription SaaS, and the free/paid line is the product's whole sales pitch:
**seeing what you are losing is free, acting on it is what you pay for.**

An owner uploads their book and Bloom shows them, at no cost and with no card,
exactly who is slipping and what each is worth a year. That number is computed
from their own data, so it is not a marketing claim they can argue with. Writing
to those clients requires a plan: Starter $49/month or Pro $99/month, billed
through Stripe. Between the two tiers the only difference is who sends the weekly
newsletter; both include the win-back, because that is the reason to pay at all.

The pricing argument writes itself: a lapsed regular is worth several hundred
dollars a year, so recovering ONE client pays for a year of Starter. I am
not asking an owner to believe a projection, I am showing them their own losses
and charging less than one of them.

Gross margin is near 99%: the marginal cost to serve a business is a few cents of
Gemini tokens and a fraction of a cent of email.

### How will you sustain business operations in the future?

The economics sustain it: near-99% gross margin means the business is
self-funding at low scale, and infrastructure is cheap and usage-based (Neon,
Vertex AI, Resend all scale with paying customers). Revenue-linked cost, only
active paying subscribers trigger the weekly agent, keeps spend tied to income.
Growth is founder-led and organic to start (direct outreach, communities,
referrals), which keeps customer acquisition cost near zero while the product
proves retention.

### Which AI tools have you leveraged while working on this project?

The product itself runs on Google Gemini 2.5 Flash through Vertex AI for both
content generation and a self-QA review pass. During development I used AI coding
assistants for pair-programming, refactoring, and adversarial code review
alongside standard tooling.
> Jonathan: adjust this line to whatever level of detail you want to disclose.

### Explain how your business model shared above is sustainable and viable.

**Five-year goal.** The market is large: there are tens of millions of small
businesses in North America, and local service businesses that live or die on
repeat clients (salons, barbershops, spas, clinics) are a multi-million-business
segment, a total addressable market in the
billions of dollars a year at a $49 to $99 price point. A realistic five-year
target is on the order of 10,000 paying businesses at roughly $75 average, about
$9M in annual recurring revenue, which is a small fraction of a percent of the
addressable market, so growth is not gated by market size.

**Path to profitability.** Gross margin is around 99% because the cost to serve a
business is a few cents of Gemini tokens a month. Fixed costs are minimal (usage-
based infrastructure, no team to start), so the business is profitable at low
scale once customer acquisition cost is covered, and with founder-led organic
acquisition that cost starts near zero. Break-even is a few hundred paying
businesses, not tens of thousands.

**Why it's achievable.** The hypothesis, that the expensive pain is silent client
churn the owner never sees, is backed by salon industry benchmarks: a typical salon
loses 30 to 40% of its clients each year, and a first-timer who does not rebook
within 30 days has only about a 20% chance of ever returning, while a single
recovered regular is worth several hundred dollars a year. The product is live and
proven end to end: a real payment processed on live Stripe, and the agent runs
against real records in production. Real arms-length
paying customers so far: zero, with founder-led outreach just starting. The
honest gap is adoption, which is exactly what I am now closing.

### Please explain how your business operates with AI.

AI performs the service, and I want to be precise rather than flattering about
which parts it runs, because the division of labour is the design.

**A rule decides who, and it runs with no human in the loop.** Every client is
scored against their own median cadence. This is deliberately NOT an LLM: the
output is "she is worth $1,295 a year and she is leaving," and that call has to
be exact, auditable, and identical every time it is asked. A model that
hallucinates a rhythm would cost a real owner a real client.

**Gemini decides what to say, and does the part no rule can.** Given one person's
real history, it writes a note that sounds like the owner noticed, not like
software noticed. It is told what it may offer (only what the owner configured)
and what it must never reveal (that a list was consulted).

**What is scheduled and what is triggered.** The weekly content agent is fully
autonomous: it fires on a cron with no human trigger, picks the angle, writes,
scores its own draft, rewrites when it falls short, and on Pro sends the
newsletter. The win-back is deliberately owner-triggered, one client at a time. I
could make it autonomous and I have chosen not to yet: this feature sends email
in a real business's name to a real customer they care about, and an agent that
does that unsupervised, at scale, on my judgement, is not something I would ship
to a stranger's salon before it has earned it.

### Please explain the extent to which AI is live in production and executes key decisions.

Fully live at https://bloom.jonathanandrei.com, running against a real database
and real records.

Autonomous today: the weekly content agent, on a real schedule, choosing the
angle and promotion, gating its own draft on a self-QA score and rewriting below
the bar, and delivering the newsletter through a verified domain. A real
newsletter has been generated and delivered to a real inbox through this exact
path.

Owner-triggered today: the win-back. The owner clicks for one client; Gemini
drafts the note; the owner then reviews it, can edit any line, and approves before
it sends. So the AI does the writing, but a human sees and approves the exact words
before they reach a real customer's inbox, and chooses each moment one goes out.

**Honest limitation, stated plainly:** the win-back draft has no automated self-QA
gate. The weekly content path scores and rewrites itself; the win-back makes a
single call and shows the draft for approval. The gate today is the owner reviewing
and approving each note, which is exactly why the feature is owner-triggered rather
than scheduled. Adding a critique pass is the next thing I would build before
letting it run on its own.

Every action is written to an activity feed. The public one at `/agent` shows the
agent working without ever naming a client, because that feed is world-readable
and the underlying data is someone else's customer list.

### Please explain which product from Google Cloud you used during the hackathon and how.

Google Cloud Vertex AI. All content generation and the self-QA review run on
Gemini 2.5 Flash served through Vertex AI (using the `@google/genai` SDK with
`vertexai: true`). Vertex AI is the production inference layer for every weekly
run: the agent calls it to generate the posts and newsletter with a forced
response schema, then calls it again as a strict QA reviewer that gates and
triggers rewrites.

### If your project uses an LLM, it must use Gemini API for at least one LLM call. Please explain which LLMs are used and how the Gemini API is used.

The only LLM in the project is Google Gemini 2.5 Flash, through the Gemini API on
Vertex AI. There are three call sites, all with forced response schemas:

1. **Win-back draft** (the flagship). One call per client the owner chooses to
   reach. It receives that person's real situation (what they last had done, their
   own cadence, how far past it they are) and returns `{subject, body, reasoning}`.
   The prompt constrains it hard: it may only offer what the owner configured, it
   must never reveal that a list was consulted, and the reasoning it returns is
   recorded so the owner can see why it wrote what it wrote.
2. **Weekly content generation.** Returns the week's theme, chosen promotion,
   reasoning, three social posts, and the newsletter subject and HTML.
3. **Self-QA review** of the weekly content. Scores the draft 0 to 100 and names
   its single weakest point; below the threshold the agent rewrites once and keeps
   the better attempt. This gate applies to the content path only, not to the
   win-back (see the limitation noted above).

Notably, the LLM is NOT used to decide who is at risk. That is a deterministic
median-cadence calculation, on purpose.

### URL to your video pitch (public, under 3 minutes)

```
https://www.youtube.com/watch?v=4XNtqJFUIms
```
> This is the current retention demo. Earlier marketing-agent and prior retention
> cuts also exist on YouTube; link ONLY this URL in the form and keep the older
> ones out of the judging path.

### URL to your GitHub repo (shared with testing@devpost.com and judging@hacker.fund)

```
https://github.com/JonathanSolvesProblems/bloom
```
> The repo is public (github.com/JonathanSolvesProblems/bloom, MIT LICENSE), so
> testing@devpost.com and judging@hacker.fund can access it directly. No
> collaborator invites needed.

### Provide a URL to a file in your repository that shows evidence of your product running.

```
https://github.com/JonathanSolvesProblems/bloom/blob/main/docs/EVIDENCE.md
```
(See `docs/EVIDENCE.md` in this repo: live agent runs, Vertex AI usage, a real
payment, and a real newsletter delivery.)

### Are you using any pre-existing business resources (anything before May 19, 2026)?

Yes, two, both infrastructure I already owned personally, neither a business
asset:
1. A subdomain of my personal domain jonathanandrei.com hosts the product, so I
   did not need to buy a new domain.
2. My own OVH sandbox server hosts the Dockerized app.

I am NOT using any pre-existing customers, audience, followers, email lists,
employees, or partnerships. There were no customer relationships before this
project.

---

## Financials (Hackathon period: May to August 2026)

> Honest reporting. The only transactions to date were my own end-to-end payment
> tests, which I refunded, so net revenue is $0. Every figure below is stated as a
> final value; if a real sale lands before you submit, update the matching one.

### Total Revenue (USD, even if $0)

```
0
```
Net of refunds. See the explanation below.

### Revenue by Month (May, June, July, August 2026)

```
May: $0, June: $0, July: $0, August: $0
```

### Explain the revenue shared above.

Net revenue during the hackathon is $0. There were two transactions, both on
live Stripe: $49 USD each, both on July 11, 2026 (UTC). Both were my own founder
self-test purchases to verify the payment path end to end, and I refunded both
within 24 hours. They were related-party (me), not arms-length sales. No
third-party customer has paid yet; founder-led outreach is just beginning.

### Related-Party Revenue (USD, even if $0)

```
0
```
Net of refunds. Gross was $98 from two founder self-test purchases (both on
July 11, 2026 UTC), both fully refunded, so net related-party revenue is $0.

### Total Expenses (USD, even if $0)

```
~6
```
Approximately US$6 (the account's net balance is -C$8.50): the Stripe processing
fees retained on the two refunds (C$3.70 each) plus currency and settlement costs,
and a few cents of Gemini/Vertex AI usage for test generations. Hosting (OVH
sandbox), domain, Neon, Resend, and Vercel incurred no new cost during the period.

### Total Cost of Goods Sold (USD, even if $0)

```
<1
```
Direct cost to produce the content sold is Gemini/Vertex AI inference, about
$0.01 to $0.04 per business per month; during the hackathon only test generations
ran, so COGS is under $1.

### Total marketing and customer acquisition expense (USD, even if $0)

```
0
```
No paid advertising or promotion. Acquisition is founder-led and organic.

### Please explain the marketing expenses you incurred during the hackathon period, if any.

None. I have not spent on advertising or paid promotion. Distribution so far is
direct outreach and communities at no cost.

### Additional Expenses

```
0
```
No other material costs. Infrastructure used was already owned or on free usage
tiers.

### Number of users acquired during the hackathon (even if 0)

```
0
```
No real external users yet; founder-led sharing is just starting.

### Number of those users paying for your services or product during the hackathon (even if 0)

```
0
```
The only two payments were my own self-tests, both refunded.

### Testimonial (verifiable, public post online)

None yet, so leave this field blank. I will not fabricate one, and will add a
real, publicly verifiable customer testimonial once a real business is using it.

### Level of learning derived from the project

```
Significant
```

### Profit evidence (P&L)

Upload a simple P&L (template: https://bit.ly/4w3DvwL) reflecting the figures
above: revenue $0 net, expenses ~$6, so a small net loss of about $6 for the
period. Formats allowed: pdf, xls, xlsx, csv, png, jpg.

### Revenue proof to attach (from the official email)

The form wants documentary proof, not just the figures above:

- **Stripe export or bank statement.** Export the Payments list from the Stripe
  dashboard (Payments to CSV) covering the period. It will show the two July test
  charges and their refunds, which matches the $0-net story exactly. That honesty
  is an asset, not a liability: it proves the payment path is real and live.
- **P&L** using the template (https://bit.ly/4w3DvwL): $0 net revenue, ~$6
  expenses, ~$6 net loss.
- **Corporate ID:** none. Bloom is not incorporated; it is a solo project. State
  that plainly rather than leaving the field blank.

### Customer evidence to attach (from the official email)

The form asks for real customer contact info (name, email, phone) and any
testimonials. As of now there are none, and I will not fabricate any.

None yet, and I will not fabricate any. As real salons come in, this is where
their name, email, phone, and any written feedback go. Even one real owner saying
"yes, she is exactly the client I would have lost" is worth more than any amount
of the engineering already done.

### Confirmations

- [x] GitHub repo public (github.com/JonathanSolvesProblems/bloom), MIT licensed
- [x] 3-minute (or shorter) video, public on YouTube, showing the agent live: https://www.youtube.com/watch?v=4XNtqJFUIms
- [ ] Written narrative pasted (see the 720-word section above)
- [ ] Revenue proof attached (Stripe export/bank statement + P&L)
- [ ] Product evidence attached (see docs/EVIDENCE.md + a Vertex AI usage screenshot)
- [ ] Demo URL and password put in the private notes-to-judges field
- [x] (Form question removed by organizers 2026-07-25) No single customer >40% of revenue, moot regardless since revenue is $0
- [ ] Related-party revenue disclosed (two refunded founder test charges, $0 net)
