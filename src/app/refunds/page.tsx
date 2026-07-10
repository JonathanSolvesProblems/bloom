import type { Metadata } from 'next'
import { LegalShell, LegalSection } from '@/components/LegalShell'
import { SUPPORT_EMAIL } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Refund Policy · Bloom',
  description: 'Bloom\'s refund and cancellation policy.',
}

export default function RefundsPage() {
  return (
    <LegalShell title="Refund Policy" updated="July 10, 2026">
      <LegalSection heading="First-week guarantee">
        <p>
          If you are not happy with your first week on a paid plan, email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> within 7 days of your first charge and I will refund
          that charge in full, no questions asked.
        </p>
      </LegalSection>

      <LegalSection heading="Cancelling">
        <p>
          You can cancel anytime from your dashboard. Cancellation stops the next renewal and takes effect at the end of
          the period you have already paid for, so you keep your content until then. After the first week, monthly
          charges for periods that have already started are generally non-refundable, since the content for that period
          has already been produced.
        </p>
      </LegalSection>

      <LegalSection heading="Something went wrong?">
        <p>
          If Bloom failed to deliver what your plan promised in a given period, that is on me. Email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and I will make it right, with a refund where a refund
          is fair.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
