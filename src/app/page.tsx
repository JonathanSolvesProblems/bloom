import Link from 'next/link'
import { Sparkles, CalendarClock, Mail, TrendingUp, CheckCircle2, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-lg">Bloom</span>
          </div>
          <nav className="flex items-center gap-6">
            <a href="#how-it-works" className="text-sm text-gray-500 hover:text-gray-900 hidden sm:block">How it works</a>
            <a href="#pricing" className="text-sm text-gray-500 hover:text-gray-900 hidden sm:block">Pricing</a>
            <Link href="/setup" className="btn-primary text-sm py-2 px-4">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm font-medium px-4 py-2 rounded-full mb-8">
            <Sparkles className="w-4 h-4" />
            Powered by Google Gemini AI
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Your local business,<br />
            <span className="text-emerald-600">on marketing autopilot.</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Bloom writes your weekly social posts, email newsletter, and Google updates — then sends them automatically.
            Set up once. Never think about marketing again.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/setup" className="btn-primary text-base py-3 px-8">
              Preview my AI content free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#how-it-works" className="btn-outline text-base py-3 px-8">
              See how it works
            </a>
          </div>
          <p className="text-sm text-gray-400 mt-4">No credit card to preview. $99/month to activate auto-delivery.</p>
        </section>

        {/* Social proof strip */}
        <section className="bg-emerald-600 py-6 px-6">
          <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-8 text-center">
            {[
              { stat: '3 posts', label: 'auto-generated weekly' },
              { stat: '1 newsletter', label: 'sent every Monday' },
              { stat: '5 hrs/week', label: 'saved per business' },
              { stat: '100%', label: 'AI-operated' },
            ].map(({ stat, label }) => (
              <div key={stat} className="text-white">
                <div className="text-2xl font-bold">{stat}</div>
                <div className="text-emerald-100 text-sm">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">How Bloom works</h2>
          <p className="text-center text-gray-500 mb-14 max-w-xl mx-auto">
            Three steps. Then the AI takes over — forever.
          </p>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                icon: <Sparkles className="w-6 h-6 text-emerald-600" />,
                step: '1',
                title: 'Tell Bloom about your business',
                desc: 'Share your business type, personality, and this week\'s promotions. Takes under 5 minutes.',
              },
              {
                icon: <CalendarClock className="w-6 h-6 text-emerald-600" />,
                step: '2',
                title: 'AI generates your week\'s content',
                desc: '3 social posts and a full email newsletter — written in your brand voice, ready to publish.',
              },
              {
                icon: <Mail className="w-6 h-6 text-emerald-600" />,
                step: '3',
                title: 'Bloom sends it every Monday',
                desc: 'Newsletters go out to your subscribers automatically. Posts are ready to copy and paste. You stay in the loop without doing the work.',
              },
            ].map(({ icon, step, title, desc }) => (
              <div key={step} className="card flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center font-bold text-emerald-600 text-sm">
                    {step}
                  </div>
                  {icon}
                </div>
                <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What you get */}
        <section className="bg-gray-50 py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">What Bloom handles for you</h2>
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {[
                'Weekly Google Business Profile posts',
                'Weekly email newsletter to your subscribers',
                'Facebook & Instagram caption drafts',
                'Tailored to your promotions and seasonality',
                'Written in your brand voice — sounds human',
                'Full activity log of every AI action',
                'Subscriber management dashboard',
                'Update promotions anytime from your dashboard',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <span className="text-gray-700 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-10">Built for local businesses</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { emoji: '🍽️', label: 'Restaurants & Cafés' },
              { emoji: '💆', label: 'Salons & Spas' },
              { emoji: '🏋️', label: 'Gyms & Fitness' },
              { emoji: '🔧', label: 'Contractors & Trades' },
              { emoji: '🛍️', label: 'Retail & Boutiques' },
              { emoji: '🦷', label: 'Dental & Health' },
              { emoji: '🏡', label: 'Real Estate' },
              { emoji: '📦', label: 'Any local business' },
            ].map(({ emoji, label }) => (
              <div key={label} className="card text-center py-4">
                <div className="text-3xl mb-2">{emoji}</div>
                <div className="text-sm text-gray-600 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="bg-gray-50 py-16 px-6">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple pricing</h2>
            <p className="text-gray-500 mb-12">One plan. Everything included. Cancel anytime.</p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center max-w-2xl mx-auto">
              {/* Free preview */}
              <div className="card flex-1 text-left">
                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Preview</div>
                <div className="text-3xl font-bold text-gray-900 mb-1">Free</div>
                <p className="text-sm text-gray-500 mb-6">See your AI-generated content before you commit.</p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> One-time content preview</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> 3 social posts + newsletter draft</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> No credit card required</li>
                </ul>
                <Link href="/setup" className="btn-outline w-full justify-center text-sm">
                  Preview for free
                </Link>
              </div>
              {/* Pro */}
              <div className="card flex-1 text-left border-emerald-500 border-2 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most popular
                </div>
                <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wide mb-2">Pro</div>
                <div className="text-3xl font-bold text-gray-900 mb-1">$99 <span className="text-lg font-normal text-gray-500">/month</span></div>
                <p className="text-sm text-gray-500 mb-6">Full weekly AI marketing, delivered automatically.</p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> 3 social posts every week</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Newsletter sent every Monday</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Full activity dashboard</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Subscriber management</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Update promotions anytime</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Cancel anytime</li>
                </ul>
                <Link href="/setup" className="btn-primary w-full justify-center text-sm">
                  Start with a free preview
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-5xl mx-auto px-6 py-20 text-center">
          <TrendingUp className="w-10 h-10 text-emerald-600 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to stop worrying about marketing?</h2>
          <p className="text-gray-500 mb-8 max-w-lg mx-auto">
            See your AI-generated content in under 2 minutes. No account, no credit card — just your business info.
          </p>
          <Link href="/setup" className="btn-primary text-base py-3 px-10">
            Preview my content free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-gray-100 py-8 px-6 text-center text-sm text-gray-400">
        © 2026 Bloom. AI marketing for local businesses. Powered by Google Gemini.
      </footer>
    </div>
  )
}
