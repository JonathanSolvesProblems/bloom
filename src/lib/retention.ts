/**
 * The retention engine: works out who this business is about to lose, and what
 * that costs them.
 *
 * The thresholds come from published salon industry benchmarks (Simple Salon,
 * JeriCommerce, Zoca). They are vendor data, not peer-reviewed, so they frame the
 * problem; the dollar figure the product acts on is each client's OWN value,
 * computed from their real spend (see annualValue), not this benchmark:
 * - A first-time client who does not rebook within 30 days has only about a 20%
 *   chance of ever returning. That makes days 7 to 30 after a first visit the
 *   single highest-value moment to act, and it is the moment nobody is watching.
 * - A typical salon loses 30 to 40% of its clients every year, even a well-run one.
 * - A loyal regular is worth several hundred dollars a year (roughly $600 annualized
 *   from the loyalty-member figures), so saving even one covers the software.
 *
 * The part a prompt cannot do: risk is judged against each client's OWN rhythm.
 * A 4-week regular at 6 weeks is drifting. An 8-week regular at 6 weeks is fine.
 * That only comes from their real booking history.
 */

export type RiskLevel = 'critical' | 'at_risk' | 'watch' | 'safe' | 'lost'

/**
 * Only what the risk maths actually reads. Names, emails and services are
 * deliberately NOT here: the engine has no business knowing who someone is to
 * decide whether they are lapsing, and leaving them out means callers who only
 * need the numbers can avoid loading a business's customer list at all.
 */
export type ClientLike = {
  lastVisitAt: Date
  visitCount: number
  avgSpend: number
  cadenceDays: number | null
  winBackSentAt?: Date | null
  contactCount?: number | null
  unsubscribedAt?: Date | null
  recoveredAt?: Date | null
}

/**
 * How long to wait before a second note, and how many notes are ever allowed.
 *
 * An owner reasonably wants to follow up once on someone who did not reply. What
 * they must never be able to do, by accident or otherwise, is pester: two notes
 * three weeks apart is a considerate nudge, five notes in a week is spam and would
 * put the shared sending domain (and their own name) at risk. So the follow-up is
 * possible, deliberate, and hard capped at two contacts per lapse. Coming back
 * resets the count, because that is a new chapter, not more of the same one.
 */
export const FOLLOW_UP_AFTER_DAYS = 21
export const MAX_CONTACTS_PER_LAPSE = 2

export type ContactState =
  | { kind: 'writable'; followUp: boolean }
  | { kind: 'cooling'; daysLeft: number }
  | { kind: 'capped' }
  | { kind: 'opted_out' }

/** Whether the agent may write to this person right now, and why not if not. */
export function contactState(c: ClientLike, now: Date = new Date()): ContactState {
  if (c.unsubscribedAt) return { kind: 'opted_out' }
  const contacts = c.contactCount ?? 0
  if (!c.winBackSentAt || contacts === 0) return { kind: 'writable', followUp: false }
  if (contacts >= MAX_CONTACTS_PER_LAPSE) return { kind: 'capped' }
  const waited = daysBetween(c.winBackSentAt, now)
  if (waited < FOLLOW_UP_AFTER_DAYS) return { kind: 'cooling', daysLeft: FOLLOW_UP_AFTER_DAYS - waited }
  return { kind: 'writable', followUp: true }
}

export type Assessment = {
  level: RiskLevel
  /** Plain sentence the owner can read, and the agent can act on. */
  reason: string
  daysSince: number
  /** For a never-rebooked first-timer: days left before the 30-day cliff. */
  daysToCliff: number | null
  /** What this client is worth per year if they keep their rhythm. */
  annualValue: number
  /** Ranking weight so the agent works the most valuable saves first. */
  priority: number
}

/** The 30-day rebooking cliff for first-time clients. */
export const NEW_CLIENT_CLIFF_DAYS = 30
/** Do not pester someone who was just in. */
const NEW_CLIENT_GRACE_DAYS = 7
/** Fallback rhythm when a business has no history to infer one from (6 weeks). */
export const DEFAULT_CADENCE_DAYS = 42

const DAY_MS = 86_400_000

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS)
}

/**
 * A client's own rhythm: the MEDIAN gap between visits, not the mean. One
 * six-month gap (a holiday, an injury) would drag a mean far enough to hide a
 * real lapse; the median keeps the everyday rhythm.
 */
export function computeCadenceDays(visitDates: Date[]): number | null {
  if (visitDates.length < 2) return null
  const sorted = [...visitDates].sort((x, y) => x.getTime() - y.getTime())
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1], sorted[i])
    if (gap > 0) gaps.push(gap)
  }
  if (!gaps.length) return null
  gaps.sort((x, y) => x - y)
  const mid = Math.floor(gaps.length / 2)
  const median = gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2)
  return Math.max(1, median)
}

/**
 * Yearly value of a client if they keep their rhythm.
 *
 * Deliberately conservative: a client's own cadence is only trusted for money
 * once there are at least two gaps to take a median of. One gap is a guess, and
 * an eager one, two visits a fortnight apart would imply 26 visits a year and
 * value someone at three times what they are really worth. Risk still judges
 * them on their own cadence (a rhythm of one gap is the best read available);
 * only the dollar figure falls back, because that is the number an owner will
 * quote back at me.
 */
export function annualValue(c: ClientLike, fallbackCadence: number): number {
  const trusted = c.visitCount >= 3 && c.cadenceDays ? c.cadenceDays : fallbackCadence
  const visitsPerYear = 365 / Math.max(1, trusted)
  return Math.round(c.avgSpend * visitsPerYear)
}

/**
 * The median cadence across a business's regulars. Used to value a first-timer,
 * who has no rhythm of their own yet but would likely settle into the shop's.
 */
export function businessCadence(clients: ClientLike[]): number {
  const known = clients.map((c) => c.cadenceDays).filter((d): d is number => !!d)
  if (!known.length) return DEFAULT_CADENCE_DAYS
  known.sort((a, b) => a - b)
  const mid = Math.floor(known.length / 2)
  return known.length % 2 ? known[mid] : Math.round((known[mid - 1] + known[mid]) / 2)
}

export function assess(c: ClientLike, fallbackCadence: number, now: Date = new Date()): Assessment {
  const daysSince = daysBetween(c.lastVisitAt, now)
  const value = annualValue(c, fallbackCadence)

  // Case 1: they came once and never rebooked. This is the 30-day cliff, and the
  // most valuable thing the agent does, because after day 30 they are 80% gone.
  if (c.visitCount === 1) {
    const daysToCliff = NEW_CLIENT_CLIFF_DAYS - daysSince
    if (daysSince <= NEW_CLIENT_GRACE_DAYS) {
      return {
        level: 'watch',
        reason: `First visit ${daysSince} days ago. Still early, the window opens soon.`,
        daysSince,
        daysToCliff,
        annualValue: value,
        priority: 10 + value / 1000,
      }
    }
    if (daysSince <= NEW_CLIENT_CLIFF_DAYS) {
      return {
        level: 'critical',
        reason: `Came once, ${daysSince} days ago, and never rebooked. ${daysToCliff} days left before the 30-day cliff, after which only about 1 in 5 ever return.`,
        daysSince,
        daysToCliff,
        annualValue: value,
        // The highest priority in the whole system: a closing window on a client
        // who has not formed a habit yet.
        priority: 1000 + value / 100,
      }
    }
    return {
      level: 'lost',
      reason: `Came once, ${daysSince} days ago, and never came back. Past the 30-day window, so the odds are long, but still worth one honest attempt.`,
      daysSince,
      daysToCliff: 0,
      annualValue: value,
      priority: 100 + value / 1000,
    }
  }

  // Case 2: a regular. Judge them against their OWN rhythm, never a generic rule.
  const cadence = c.cadenceDays ?? fallbackCadence
  const ratio = daysSince / cadence

  if (ratio <= 1.15) {
    return {
      level: 'safe',
      reason: `On rhythm. Comes about every ${cadence} days, last in ${daysSince} days ago.`,
      daysSince,
      daysToCliff: null,
      annualValue: value,
      priority: 0,
    }
  }
  if (ratio <= 1.5) {
    return {
      level: 'at_risk',
      reason: `Usually comes every ${cadence} days but it has been ${daysSince}. Drifting past their own rhythm.`,
      daysSince,
      daysToCliff: null,
      annualValue: value,
      priority: 300 + value / 100,
    }
  }
  if (ratio <= 2.5) {
    return {
      level: 'critical',
      reason: `A ${cadence}-day regular who has not been in for ${daysSince} days, well past their rhythm. This is a real client slipping away.`,
      daysSince,
      daysToCliff: null,
      annualValue: value,
      priority: 800 + value / 100,
    }
  }
  return {
    level: 'lost',
    reason: `Was a ${cadence}-day regular, now ${daysSince} days out. Probably gone somewhere else, worth one honest attempt.`,
    daysSince,
    daysToCliff: null,
    annualValue: value,
    priority: 200 + value / 1000,
  }
}

export type Summary = {
  total: number
  critical: number
  atRisk: number
  safe: number
  lost: number
  /** Yearly revenue attached to everyone currently slipping (critical + at_risk). */
  revenueAtRisk: number
  /**
   * At-risk clients the agent would actually write to: not opted out, not already
   * contacted. The at-risk count itself must not exclude those people (the
   * business is still losing them, and the owner should see that), but any promise
   * to write to "all of them" has to count only the ones it can keep.
   */
  contactable: number
  /** Yearly revenue attached to clients who came back after a win-back. */
  revenueRecovered: number
  recoveredCount: number
}

/** Generic so a caller that passes full client rows gets them back intact. */
export type Assessed<T extends ClientLike = ClientLike> = T & { assessment: Assessment }

export function assessAll<T extends ClientLike>(clients: T[], now: Date = new Date()): Assessed<T>[] {
  const fallback = businessCadence(clients)
  return clients
    .map((c) => ({ ...c, assessment: assess(c, fallback, now) }))
    .sort((a, b) => b.assessment.priority - a.assessment.priority)
}

export function summarize(assessed: Assessed[]): Summary {
  const s: Summary = {
    total: assessed.length,
    critical: 0,
    atRisk: 0,
    safe: 0,
    lost: 0,
    revenueAtRisk: 0,
    contactable: 0,
    revenueRecovered: 0,
    recoveredCount: 0,
  }
  for (const c of assessed) {
    const { level, annualValue: v } = c.assessment
    if (level === 'critical' || level === 'at_risk') {
      if (!c.unsubscribedAt && !c.winBackSentAt) s.contactable++
    }
    if (level === 'critical') {
      s.critical++
      s.revenueAtRisk += v
    } else if (level === 'at_risk') {
      s.atRisk++
      s.revenueAtRisk += v
    } else if (level === 'lost') {
      s.lost++
    } else {
      s.safe++
    }
    // Recovered is measured, not claimed: they got a win-back and then booked.
    if (c.recoveredAt) {
      s.recoveredCount++
      s.revenueRecovered += v
    }
  }
  return s
}
