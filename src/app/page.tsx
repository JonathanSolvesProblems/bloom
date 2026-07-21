import Link from 'next/link'
import {
  Sparkles,
  CalendarClock,
  Mail,
  CheckCircle2,
  ArrowRight,
  Copy,
  ShieldCheck,
  Users,
  Palette,
  Send,
  ScrollText,
  Camera,
  ThumbsUp,
  MapPin,
  Coffee,
  Scissors,
  Dumbbell,
  Wrench,
  ShoppingBag,
  Stethoscope,
  Building2,
  PawPrint,
  Upload,
  Radar,
} from 'lucide-react'
import SiteNav from '@/components/SiteNav'
import AgentHeroCard from '@/components/AgentHeroCard'
import RhythmWall from '@/components/RhythmWall'
import CountUp from '@/components/CountUp'
import Reveal from '@/components/Reveal'
import { SUPPORT_EMAIL } from '@/lib/config'

// Industry retention figures, used to frame the problem honestly instead of
// projecting Bloom's own output as a benefit.
const painStats = [
  { to: 40, suffix: '%', label: 'of clients a typical salon loses every year, even a well-run one' },
  { to: 20, suffix: '%', label: 'chance a first-timer ever comes back once 30 days pass with no rebooking' },
  { to: 600, prefix: '$', suffix: '+', label: 'a year a loyal regular is worth, so saving even one covers the software' },
]

const industries = [
  { icon: Coffee, label: 'Cafés & Restaurants' },
  { icon: Scissors, label: 'Salons & Spas' },
  { icon: Dumbbell, label: 'Gyms & Fitness' },
  { icon: Wrench, label: 'Contractors & Trades' },
  { icon: ShoppingBag, label: 'Retail & Boutiques' },
  { icon: Stethoscope, label: 'Dental & Health' },
  { icon: Building2, label: 'Real Estate' },
  { icon: PawPrint, label: 'Pet Services' },
]

const steps = [
  {
    icon: <Upload className="w-5 h-5 text-brand-teal" />,
    step: '01',
    title: 'Upload your booking history',
    desc: 'Export a CSV from whatever you already use: Fresha, Square, Vagaro, Booksy, even Google Calendar. It needs an email and a date. Nothing to migrate, nothing to install.',
  },
  {
    icon: <Radar className="w-5 h-5 text-brand-teal" />,
    step: '02',
    title: 'Bloom finds who is slipping',
    desc: 'Every client is judged against their own rhythm, not a generic rule. A 4-week regular at 6 weeks is in trouble. An 8-week regular at 6 weeks is fine. You see who is going, and what they are worth a year.',
  },
  {
    icon: <Send className="w-5 h-5 text-brand-teal" />,
    step: '03',
    title: 'It writes each of them personally',
    desc: 'Not a blast. One note per client, in your voice, about their last visit and their own timing. It never contacts the same person twice, and it counts a save only when they actually rebook.',
  },
]

const faqs = [
  {
    q: 'How does Bloom know a client is slipping away?',
    a: 'From their own booking history, not a generic rule. Bloom works out the median gap between each person\'s visits and measures them against that. A client who normally comes every 4 weeks is in trouble at 7 weeks; one who comes every 8 weeks is not. First-timers are the exception and the priority: someone who came once and has not rebooked has roughly a 1 in 5 chance of ever returning once 30 days pass, so Bloom surfaces them while the window is still open.',
  },
  {
    q: 'Does it blast my whole list?',
    a: 'No, and it will not let you. Bloom writes one message to one client at a time, referencing their last visit and their own timing. It will not contact the same person twice, it never invents a discount you did not authorise, and anyone who unsubscribes is excluded permanently. Every message carries a one-click unsubscribe and your postal address, as anti-spam law requires.',
  },
  {
    q: 'What happens to my client list?',
    a: 'It stays in your dashboard, behind an owner-only link, and it is used for one thing: working out who is slipping. Bloom does not sell it, share it, or use it to train anything. Your booking export never needs to leave your own hands beyond that upload, and you can stop any time.',
  },
  {
    q: 'Do I have to switch booking systems?',
    a: 'No. Bloom sits alongside whatever you already use. You export a CSV and upload it; Bloom reads the columns it recognises (email and date are required, service and price make it smarter). There is nothing to install, no integration to approve, and no migration.',
  },
  {
    q: 'Does Bloom post to my social accounts automatically?',
    a: 'No. Social captions for Instagram, Facebook, and Google are written and formatted for you to copy and paste in seconds. Bloom does not publish to third-party social accounts on your behalf. On Pro, the one thing it does send on its own is your email newsletter, every Monday.',
  },
  {
    q: 'Can I review or edit anything before it goes out?',
    a: 'Yes. You see a full preview of everything the agent writes, and you can update your promotions and voice anytime from your dashboard.',
  },
  {
    q: 'How does Bloom learn my brand voice?',
    a: 'You pick a voice during setup (friendly, professional, bold, and more), and every piece of content is generated to match it.',
  },
  {
    q: 'What does the AI actually do on its own?',
    a: 'A scheduled agent runs every week with no human trigger. It picks the angle, writes the week with Google Gemini, scores its own draft and rewrites it when it falls short, and records every action to your activity log. On Pro it also emails your newsletter through Resend.',
  },
  {
    q: 'What is the difference between Starter and Pro?',
    a: 'One thing: who sends the newsletter. Starter writes your week and leaves it ready to publish. Pro emails it to your subscribers every Monday and logs each message. You can move from Starter to Pro from your dashboard, and the change is prorated.',
  },
  {
    q: 'Is there a contract?',
    a: 'No. Both plans are month to month and you can cancel in one click anytime.',
  },
  {
    q: 'Where does my subscriber list live?',
    a: 'In your Bloom dashboard. You get a public subscribe page to share with customers so your list keeps growing.',
  },
]

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <SiteNav />

      <main className="flex-1">
        {/* Hero. Deliberately asymmetric and left-hung: a centered stack under a
            gradient is the shape every generated page has, and this one is a page
            of a book, not a landing section. */}
        <section className="paper-grain relative overflow-hidden border-b border-ink">
          <div className="aurora" />
          <div className="relative z-10 max-w-6xl mx-auto px-6 pt-14 pb-16 lg:pt-20 lg:pb-20 grid lg:grid-cols-12 gap-x-10 gap-y-12 items-start">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft border border-rule px-2.5 py-1 mb-7">
                <span className="w-1 h-1 rounded-full bg-pencil" />
                Retention agent · salons and barbershops
              </div>

              <h1 className="font-display text-[2.6rem] sm:text-6xl lg:text-[4.1rem] leading-[0.94] text-ink">
                Nobody
                <br />
                cancels.
                <br />
                <span className="text-ink-soft">They just stop</span>
                <br />
                <span className="relative inline-block">
                  coming.
                  {/* Struck through by hand: the word is the thing that quietly
                      stops, so the line stops with it. */}
                  <svg
                    className="absolute left-0 -bottom-1 w-full h-3 overflow-visible"
                    viewBox="0 0 100 12"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1 8 C 22 3, 48 11, 74 5 C 84 2.6, 92 6, 99 4"
                      fill="none"
                      stroke="var(--pencil)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </span>
              </h1>

              <p className="text-[1.05rem] text-ink-soft max-w-md mt-8 leading-relaxed">
                And you find out months later, from a gap in the book. Bloom reads your booking history, works out who
                is drifting from{' '}
                <span className="text-ink font-medium">their own rhythm</span>, and writes each one a note in your
                voice. Export a CSV from whatever you already use. Nothing to migrate.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <Link href="/setup" className="btn-primary text-base py-3 px-7 whitespace-nowrap">
                  Show me who is slipping
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Link>
                <a href="#how-it-works" className="btn-outline text-base py-3 px-7 whitespace-nowrap">
                  See how it works
                </a>
              </div>
              <p className="font-mono text-[11px] text-ink-soft mt-5">
                Free to look. No card, no export needed to try it.
              </p>
            </div>

            {/* The argument, drawn. This is the first thing worth looking at, so
                it gets the width and sits high on the page. */}
            <div className="lg:col-span-7 lg:pt-6">
              <RhythmWall />
            </div>
          </div>
        </section>

        {/* The problem */}
        <section className="bg-surface border-y border-border py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <p className="text-center text-sm font-semibold text-brand-teal-text uppercase tracking-[0.14em] mb-3">
                It is not a marketing problem. It is a memory problem.
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground max-w-2xl mx-auto">
                Clients do not leave in a huff. They drift, one skipped booking at a time, and nobody is watching the
                calendar closely enough to notice.
              </h2>
            </Reveal>
            <div className="grid sm:grid-cols-3 gap-8 mt-12 text-center">
              {painStats.map((s, i) => (
                <Reveal key={s.label} delay={i * 80}>
                  <div className="font-mono text-4xl sm:text-5xl font-bold text-foreground">
                    <CountUp to={s.to} prefix={s.prefix} suffix={s.suffix} />
                  </div>
                  <div className="text-sm text-muted mt-2 max-w-[15rem] mx-auto leading-relaxed">{s.label}</div>
                </Reveal>
              ))}
            </div>
            <p className="text-center text-xs text-muted mt-10">
              Source: published salon industry retention benchmarks (Simple Salon and JeriCommerce churn data, Zoca
              lapsed-client analysis). Bloom shows each of your own clients&apos; real annual value from your own book.
            </p>
          </div>
        </section>

        {/* Industry marquee */}
        <section className="py-12 bg-surface border-y border-border overflow-hidden">
          <p className="text-center text-sm font-medium text-muted mb-6">Built for every kind of local business</p>
          <div className="marquee-wrap marquee-mask">
            <div className="marquee gap-3">
              {[...industries, ...industries].map((it, i) => (
                <span
                  key={i}
                  className="shrink-0 inline-flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 text-sm text-foreground font-medium"
                >
                  <it.icon className="w-4 h-4 text-brand-teal" />
                  {it.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-24">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground">How Bloom works</h2>
            <p className="text-center text-muted mt-3 mb-14 max-w-xl mx-auto">
              One upload, then the agent takes over.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <Reveal key={s.step} delay={i * 80}>
                <div className="card card-hover h-full flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 bg-brand-teal/10 rounded-xl flex items-center justify-center">{s.icon}</div>
                    <span className="font-mono text-sm text-muted">{s.step}</span>
                  </div>
                  <h3 className="font-semibold text-foreground text-lg">{s.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Agent command center (proof) */}
        <section id="proof" className="relative overflow-hidden bg-surface border-y border-border py-24 px-6">
          <div className="relative z-10 max-w-6xl mx-auto">
            <Reveal>
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 bg-card border border-border text-muted text-sm font-medium px-3.5 py-1.5 rounded-full mb-5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-brand-emerald opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-emerald" />
                  </span>
                  Live agent operations
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                  It does not just flag who is leaving. It writes to them.
                </h2>
                <p className="text-muted mt-4 leading-relaxed">
                  Every action is recorded: who it judged at risk and why, what it wrote, and whether they came back. A
                  scheduled agent also writes your week every Monday with no human in the loop. The trace below is an
                  illustrative example. The live feed shows the real runs.
                </p>
                <Link
                  href="/agent"
                  className="inline-flex items-center gap-1.5 text-brand-teal-text hover:text-foreground transition-colors mt-4 text-sm font-medium"
                >
                  View the live agent feed <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </Reveal>

            <div className="grid lg:grid-cols-3 gap-4 mt-10">
              <Reveal className="lg:col-span-2">
                {/* Deliberately dark: this is a code console, not a themed surface. */}
                <div className="rounded-2xl border border-white/10 bg-ink-dark shadow-lg p-5 font-mono text-[13px] leading-relaxed">
                  <div className="flex items-center gap-2 text-white/40 mb-4 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                    <span className="ml-2">bloom agent · example run</span>
                  </div>
                  {[
                    ['09:00:01', 'decide', 'chose this week angle + promotion', ''],
                    ['09:00:03', 'generate', '3 posts + 1 newsletter written', 'gemini-2.5-flash'],
                    ['09:00:05', 'self-qa', 'scored draft, rewrote below 75', 'kept the better one'],
                    ['09:00:07', 'send', 'newsletter emailed to subscribers', 'resend'],
                    ['09:00:07', 'log', 'every step recorded to the feed', ''],
                  ].map(([time, action, msg, meta], i) => (
                    <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5 border-t border-white/5 first:border-0">
                      <span className="text-brand-emerald">{time}</span>
                      <span className="text-brand-cyan w-20">{action}</span>
                      <span className="text-white/80 flex-1 min-w-[12rem]">{msg}</span>
                      {meta && <span className="text-white/40 text-xs">{meta}</span>}
                    </div>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={100}>
                <div className="card h-full flex flex-col gap-4">
                  <div className="text-muted text-sm font-medium">Every week, on its own</div>
                  {[
                    { icon: <Sparkles className="w-4 h-4" />, label: 'Decide the angle and promotion' },
                    { icon: <ScrollText className="w-4 h-4" />, label: 'Write and self-check the content' },
                    { icon: <Mail className="w-4 h-4" />, label: 'Email the newsletter (Pro)' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-3 text-foreground">
                      <span className="w-8 h-8 rounded-lg bg-brand-emerald/15 text-brand-emerald flex items-center justify-center shrink-0">
                        {row.icon}
                      </span>
                      <span className="text-sm">{row.label}</span>
                    </div>
                  ))}
                  <div className="mt-auto pt-4 border-t border-border text-xs text-muted font-mono">
                    next run · Monday 13:00 UTC
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Capabilities: two honest buckets */}
        <section className="max-w-6xl mx-auto px-6 py-24">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground">What Bloom handles for you</h2>
            <p className="text-center text-muted mt-3 mb-14 max-w-xl mx-auto">
              One thing is fully automated. The rest is written and ready to paste.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-6">
            <Reveal>
              <div className="card card-hover h-full bg-gradient-to-br from-brand-emerald/[0.06] to-brand-teal/[0.04] border-brand-teal/30">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-emerald bg-brand-emerald/10 px-2.5 py-1 rounded-full mb-4">
                  <Send className="w-3.5 h-3.5" /> Auto-sent for you
                </div>
                <h3 className="font-semibold text-foreground text-xl">Your Monday email newsletter</h3>
                <p className="text-muted text-sm mt-2 leading-relaxed">
                  Written and emailed to your subscriber list automatically every week. You do nothing. Bloom grows the
                  list for you with a public subscribe page.
                </p>
                <ul className="mt-5 space-y-2 text-sm text-foreground/80">
                  {['Sent automatically every Monday', 'Full subscriber dashboard', 'Public subscribe page to grow your list'].map(
                    (f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-brand-emerald shrink-0" /> {f}
                      </li>
                    )
                  )}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="card card-hover h-full">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-coral bg-accent-coral/10 px-2.5 py-1 rounded-full mb-4">
                  <Copy className="w-3.5 h-3.5" /> Ready to paste in seconds
                </div>
                <h3 className="font-semibold text-foreground text-xl">Your social captions</h3>
                <p className="text-muted text-sm mt-2 leading-relaxed">
                  Three posts a week, written in your voice and formatted for each platform. Copy, paste, done.
                </p>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { icon: <Camera className="w-4 h-4" />, label: 'Instagram' },
                    { icon: <ThumbsUp className="w-4 h-4" />, label: 'Facebook' },
                    { icon: <MapPin className="w-4 h-4" />, label: 'Google' },
                  ].map((p) => (
                    <div key={p.label} className="rounded-xl border border-border p-3 text-center">
                      <div className="w-8 h-8 mx-auto rounded-lg bg-surface flex items-center justify-center text-foreground">
                        {p.icon}
                      </div>
                      <div className="text-xs text-muted mt-2">{p.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          <div className="grid sm:grid-cols-4 gap-4 mt-6">
            {[
              { icon: <Palette className="w-5 h-5" />, label: 'Matches your brand voice' },
              { icon: <ScrollText className="w-5 h-5" />, label: 'Full activity log of every AI action' },
              { icon: <Users className="w-5 h-5" />, label: 'Subscriber management' },
              { icon: <CalendarClock className="w-5 h-5" />, label: 'Update promotions anytime' },
            ].map((f, i) => (
              <Reveal key={f.label} delay={i * 60}>
                <div className="card card-hover h-full flex items-center gap-3 py-4">
                  <span className="w-9 h-9 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                    {f.icon}
                  </span>
                  <span className="text-sm text-foreground">{f.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="bg-surface border-y border-border py-24 px-6">
          <div className="max-w-5xl mx-auto text-center">
            <Reveal>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Simple pricing</h2>
              <p className="text-muted mt-3 mb-4">Cancel anytime.</p>
              <p className="text-sm text-muted mb-12 max-w-lg mx-auto">
                Finding who is slipping is always free. Both paid plans write to them. The difference between Starter
                and Pro is only who sends your Monday newsletter.
              </p>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left items-stretch">
              <Reveal>
                <div className="card h-full flex flex-col">
                  <div className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Preview</div>
                  <div className="text-4xl font-bold text-foreground mb-1">Free</div>
                  <p className="text-sm text-muted mb-6">See what you are losing before you commit.</p>
                  <ul className="space-y-2.5 text-sm text-foreground/80 mb-6">
                    {[
                      'Every client scored against their own rhythm',
                      'What each one is worth a year, and who is slipping',
                      'One real week of content for your business',
                      'No credit card required',
                    ].map(
                      (f) => (
                        <li key={f} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-brand-emerald mt-0.5 shrink-0" /> {f}
                        </li>
                      )
                    )}
                  </ul>
                  <Link href="/setup" className="btn-outline w-full text-sm mt-auto">
                    Preview for free
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={80}>
                <div className="card h-full flex flex-col">
                  <div className="text-sm font-semibold text-brand-teal-text uppercase tracking-wide mb-2">Starter</div>
                  <div className="text-4xl font-bold text-foreground mb-1">
                    $49 <span className="text-lg font-normal text-muted">/month</span>
                  </div>
                  <p className="text-sm text-muted mb-6">Write to the clients you are about to lose.</p>
                  <ul className="space-y-2.5 text-sm text-foreground/80 mb-6">
                    {[
                      'A personal win-back note to every client who is slipping',
                      'Saving one client pays for the year',
                      '3 social posts written every week',
                      'A newsletter drafted and ready to paste',
                      'Full agent activity dashboard',
                      'Cancel anytime',
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-brand-emerald mt-0.5 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/setup" className="btn-outline w-full text-sm mt-auto">
                    Start with a free preview
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={160}>
                <div className="card h-full flex flex-col relative ring-2 ring-brand-emerald">
                  <div className="absolute -top-3 left-6 bg-primary text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Full autopilot
                  </div>
                  <div className="text-sm font-semibold text-brand-emerald uppercase tracking-wide mb-2">Pro</div>
                  <div className="text-4xl font-bold text-foreground mb-1">
                    $99 <span className="text-lg font-normal text-muted">/month</span>
                  </div>
                  <p className="text-sm text-muted mb-6">The full weekly agent, running on its own.</p>
                  <ul className="space-y-2.5 text-sm text-foreground/80 mb-6">
                    {[
                      'Everything in Starter',
                      'Newsletter emailed automatically every Monday',
                      'Subscriber management + subscribe page',
                      'One-click unsubscribe handled for you',
                      'Delivery logged, message by message',
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-brand-emerald mt-0.5 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/setup" className="btn-primary w-full text-sm mt-auto">
                    Start with a free preview
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <p className="flex items-center justify-center gap-1.5 text-xs text-muted mt-3">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-emerald" /> Love your first week or your money back
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-6 py-24">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-12">Questions, answered honestly</h2>
          </Reveal>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delay={i * 40}>
                <details className="group card card-hover [&_summary]:cursor-pointer">
                  <summary className="flex items-center justify-between gap-4 font-medium text-foreground list-none">
                    {f.q}
                    <ArrowRight className="w-4 h-4 text-muted shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="text-sm text-muted leading-relaxed mt-3">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="relative overflow-hidden px-6 py-24">
          <div className="aurora" />
          <div className="relative z-10 max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Find out who you are about to lose, in under a minute.
            </h2>
            <p className="text-muted mt-4 mb-8">
              No account, no credit card, and no booking export needed to try it.
            </p>
            <Link href="/setup" className="btn-primary text-base py-3 px-10">
              Show me who is slipping
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-6 text-sm text-muted">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-teal" />
              <span className="font-display font-semibold text-foreground">Bloom</span>
              <span className="text-muted">· AI retention agent for local businesses</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <Link href="/setup" className="hover:text-foreground transition-colors">
                Get started
              </Link>
              <Link href="/recover" className="hover:text-foreground transition-colors">
                Find my dashboard
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/refunds" className="hover:text-foreground transition-colors">
                Refunds
              </Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-foreground transition-colors">
                Contact
              </a>
            </div>
          </div>
          {/* A colophon, which is what the back of a book has: who set it, in what,
              and on what. It is the honest place for a byline. */}
          <div className="flex flex-col sm:flex-row items-baseline justify-between gap-3 border-t border-ink pt-6 font-mono text-[11px] text-ink-soft">
            <p>
              Built by{' '}
              <a
                href="https://jonathanandrei.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink underline decoration-pencil decoration-2 underline-offset-4 hover:decoration-ink"
              >
                JonathanSolvesProblems
              </a>
            </p>
            <p className="text-ink-soft">Set in Fraunces. Reasoning by Gemini, on Vertex AI.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
