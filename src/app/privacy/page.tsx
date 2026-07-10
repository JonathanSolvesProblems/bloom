import type { Metadata } from 'next'
import { LegalShell, LegalSection } from '@/components/LegalShell'
import { SUPPORT_EMAIL, OPERATOR } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Privacy Policy · Bloom',
  description: 'How Bloom collects, uses, and protects your data.',
}

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="July 10, 2026">
      <p>
        This policy explains what Bloom, operated by {OPERATOR}, collects and why. I keep it short and specific on
        purpose.
      </p>

      <LegalSection heading="What I collect">
        <p>
          From business owners: your name, email, business details, promotions, and mailing address. From your
          newsletter subscribers: their email address, which you provide or collect through your Bloom subscribe page.
          Payment details are handled entirely by Stripe; I never see or store your card number.
        </p>
      </LegalSection>

      <LegalSection heading="How I use it">
        <p>
          Business details and promotions are sent to Google&apos;s Gemini model (through Vertex AI) to generate your
          content. Subscriber email addresses are used only to deliver the newsletters you send through Bloom, via
          Resend. I do not sell your data or your subscribers&apos; data, and I do not use it to advertise to you.
        </p>
      </LegalSection>

      <LegalSection heading="Who processes your data">
        <p>
          Bloom relies on a small set of service providers: Neon (database), Google Cloud / Vertex AI (content
          generation), Resend (email delivery), and Stripe (payments). Each processes data only to provide its part of
          the service.
        </p>
      </LegalSection>

      <LegalSection heading="Your subscribers' rights">
        <p>
          Every newsletter includes a working one-click unsubscribe link and the sender&apos;s postal address, as
          required by anti-spam law. Unsubscribing removes the address from your list immediately.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights and retention">
        <p>
          You can access, correct, or delete your business data at any time. To delete your account and its data, email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. I keep data for as long as your account is active and
          remove it on request, except where I must retain records for tax or legal reasons.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Privacy questions? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
