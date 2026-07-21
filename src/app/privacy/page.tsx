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
          From business owners: your name, email, business details, and mailing address. If you use the client radar,
          you also upload a booking export: your clients&apos; names, email addresses, and visit history. That client
          list is yours. You control it, I only process it on your behalf, and it is used for nothing but the purpose
          below. Payment details are handled entirely by Stripe; I never see or store your card number.
        </p>
      </LegalSection>

      <LegalSection heading="How I use it">
        <p>
          Your uploaded booking history is used to work out which of your clients are drifting from their own visit
          rhythm, and, only when you choose to reach one, to draft a personal note through Google&apos;s Gemini model
          (via Vertex AI) and send it from your verified domain through Resend. I never send anything to your clients
          without you starting it. I do not sell your data or your clients&apos; data, do not use it to advertise to you,
          and do not use it to train any model.
        </p>
      </LegalSection>

      <LegalSection heading="Who processes your data">
        <p>
          Bloom relies on a small set of service providers: Neon (database), Google Cloud / Vertex AI (drafting),
          Resend (email delivery), and Stripe (payments). Each processes data only to provide its part of the service.
          For your uploaded client list you are the data controller and Bloom is your processor.
        </p>
      </LegalSection>

      <LegalSection heading="Your clients' and subscribers' rights">
        <p>
          Every email Bloom sends on your behalf, a win-back note or a newsletter, carries a working one-click
          unsubscribe link and your postal address, as anti-spam law requires. A client who unsubscribes is flagged and
          never contacted again. Anti-spam law (including CASL in Canada) applies to these emails, and you are
          responsible for having a lawful basis to contact your own clients.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights and deletion">
        <p>
          You can delete your account and everything in it, your client list included, in one step from your dashboard,
          under &ldquo;Delete my account and all data&rdquo;. It cancels any subscription and removes every record
          immediately, and I keep no copy. You can also email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and I will do it for you. Otherwise I keep your data
          only while your account is active.
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
