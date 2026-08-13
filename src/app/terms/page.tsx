import type { Metadata } from 'next'
import { LegalShell, LegalSection } from '@/components/LegalShell'
import { SUPPORT_EMAIL, OPERATOR } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Terms of Service · Bloom',
  description: 'The terms that govern your use of Bloom.',
}

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="July 10, 2026">
      <p>
        Bloom is an AI client-retention and marketing service operated by {OPERATOR}. By creating a business,
        generating content, or subscribing to a paid plan, you agree to these terms. If you do not agree, please do not
        use the service.
      </p>

      <LegalSection heading="What Bloom does">
        <p>
          Bloom generates weekly marketing content for your business using AI: three social posts and an email
          newsletter. On the Starter plan the content is written for you to publish yourself. On the Pro plan Bloom also
          emails the newsletter to the subscribers on your list. Bloom does not post to third-party social accounts on
          your behalf.
        </p>
      </LegalSection>

      <LegalSection heading="Your content and your responsibility">
        <p>
          You are responsible for the business details, promotions, and subscriber list you provide, and for reviewing
          generated content before you publish or send it. You confirm that everyone on your subscriber list agreed to
          hear from your business. Do not use Bloom to send unsolicited email or content that is unlawful, deceptive, or
          infringing.
        </p>
        <p>
          AI-generated content can contain mistakes. Bloom is a drafting tool, not a substitute for your own judgment.
          You own the content you publish and are responsible for its accuracy and compliance with the law.
        </p>
      </LegalSection>

      <LegalSection heading="Plans, billing, and cancellation">
        <p>
          Paid plans are billed monthly in advance through Stripe and renew automatically until cancelled. You can
          cancel anytime from your dashboard; cancellation takes effect at the end of the current paid period, and you
          keep access until then. Prices may change with notice; a change never applies to a period you have already
          paid for. Refunds are covered by the <a href="/refunds">Refund Policy</a>.
        </p>
      </LegalSection>

      <LegalSection heading="Availability and liability">
        <p>
          Bloom is provided on an &quot;as is&quot; basis without warranties of any kind. I work to keep it running but do not
          guarantee uninterrupted or error-free service. To the maximum extent permitted by law, my total liability for
          any claim relating to the service is limited to the amount you paid in the three months before the claim.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about these terms? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
