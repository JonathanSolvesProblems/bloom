import { GoogleGenAI } from '@google/genai'

const MODEL = 'gemini-2.5-flash'

/** Below this self-critique score the agent rejects its own draft and rewrites it once. */
export const QA_THRESHOLD = 75

let _client: GoogleGenAI | null = null
function client(): GoogleGenAI {
  if (_client) return _client
  const vertexKey = process.env.VERTEX_API_KEY
  _client = vertexKey
    ? new GoogleGenAI({ vertexai: true, apiKey: vertexKey })
    : new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  return _client
}

function usingVertex(): boolean {
  return !!process.env.VERTEX_API_KEY
}

export interface PriorWeek {
  weeklyTheme: string | null
  chosenSubject: string | null
}

export interface WeeklyContentResult {
  post1: string
  post2: string
  post3: string
  newsletterSubject: string
  newsletterHtml: string
  // Agent decision record
  weeklyTheme: string
  featuredPromotion: string
  subjectVariants: string[]
  chosenSubject: string
  reasoning: string
  // Self-critique, which actually gates
  qaScore: number | null
  qaNotes: string
  regenerated: boolean
  rejectedQaScore: number | null
  rejectedQaNotes: string
  // Run evidence
  model: string
  tokensUsed: number
  latencyMs: number
}

function extractJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        return JSON.parse(m[0])
      } catch {
        /* fall through */
      }
    }
    throw new Error('Gemini returned no parseable JSON')
  }
}

async function generateJson(prompt: string): Promise<{ data: Record<string, unknown>; tokens: number }> {
  const result = await client().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  })
  const data = extractJson(result.text ?? '')
  const tokens = result.usageMetadata?.totalTokenCount ?? 0
  return { data, tokens }
}

const VOICE_GUIDE: Record<string, string> = {
  friendly: 'warm, approachable, uses "we" and "you", conversational',
  professional: 'polished, authoritative, concise, no slang',
  casual: 'relaxed, fun, can use light humour, short sentences',
  bold: 'energetic, punchy, uses exclamation, strong calls to action',
  elegant: 'refined, sophisticated, evocative language, no hard sells',
}

type Business = {
  name: string
  type: string
  city: string
  description: string
  brandVoice: string
  promotions?: string | null
}

type Draft = {
  post1: string
  post2: string
  post3: string
  newsletterSubject: string
  newsletterHtml: string
  weeklyTheme: string
  featuredPromotion: string
  subjectVariants: string[]
  chosenSubject: string
  reasoning: string
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)

function buildPrompt(business: Business, priorWeek: PriorWeek | null, critique: string | null): string {
  const voiceDesc = VOICE_GUIDE[business.brandVoice] ?? 'friendly and approachable'
  const hasPromo = !!business.promotions && business.promotions.trim().length > 0

  const memory =
    priorWeek && (priorWeek.weeklyTheme || priorWeek.chosenSubject)
      ? `\nLAST WEEK YOU RAN:
- Theme: ${priorWeek.weeklyTheme || 'unknown'}
- Subject line: ${priorWeek.chosenSubject || 'unknown'}
Do NOT repeat last week's theme or subject line. Pick a fresh angle that builds on it rather than restating it, and say in your reasoning how this week differs from last week.`
      : ''

  const retry = critique
    ? `\nYOUR PREVIOUS DRAFT WAS REJECTED BY YOUR OWN QA REVIEW. Reason: "${critique}"
Rewrite it properly. Fix exactly what the critique names: be more specific to this business, sharpen the call to action, and make it sound like a human wrote it.`
    : ''

  return `You are an autonomous marketing agent running weekly marketing for a small local business. You do not just write text, you make decisions and explain them.

BUSINESS PROFILE:
- Name: ${business.name}
- Type: ${business.type}
- City: ${business.city}
- Description: ${business.description}
- Brand voice: ${business.brandVoice} (${voiceDesc})
- This week's promotions / news from the owner: ${hasPromo ? business.promotions : 'NONE PROVIDED, so YOU decide the smartest angle to feature this week based on the business type, the season, and the current date.'}${memory}${retry}

DECIDE AND CREATE this week's marketing. Return a JSON object with exactly these keys:

{
  "weeklyTheme": "The single strategic angle you chose for this week, in 3-6 words.",
  "featuredPromotion": "The specific promotion or message you are featuring this week. If the owner gave one, use it. If not, propose a concrete one you decided on.",
  "reasoning": "2-3 sentences on WHY you chose this angle, this promotion, and this subject line for this business this week. Written like an operator explaining a decision.",
  "subjectVariants": ["Three candidate email subject lines, 6-10 words each, curiosity or benefit driven"],
  "chosenSubject": "The one subject line from subjectVariants you picked as best.",
  "post1": "First social post (Google Business Profile / Facebook). 60-100 words. Engaging opener. Highlight a specific product, service, or story tied to the weekly theme.",
  "post2": "Second social post. 50-80 words. Feature the promotion, end with a clear call to action.",
  "post3": "Third social post. 40-70 words. Community-focused or behind-the-scenes. Builds trust and personality.",
  "newsletterSubject": "Use exactly the same value as chosenSubject.",
  "newsletterHtml": "Full HTML email body (150-200 words). Simple inline-styled HTML: a header with the business name, a short paragraph of news/promotions tied to the weekly theme, a highlight section (light background div), and a closing CTA button linking to '#'. Mobile-friendly and readable."
}

Make everything sound authentically human, NOT like AI wrote it. Only return the JSON object. No markdown, no extra text.`
}

function toDraft(data: Record<string, unknown>, business: Business): Draft {
  const hasPromo = !!business.promotions && business.promotions.trim().length > 0
  const variants = Array.isArray(data.subjectVariants) ? (data.subjectVariants as unknown[]).map((s) => String(s)) : []
  const chosenSubject = str(data.chosenSubject) || str(data.newsletterSubject) || variants[0] || 'Your weekly update'
  return {
    post1: str(data.post1),
    post2: str(data.post2),
    post3: str(data.post3),
    newsletterSubject: chosenSubject,
    newsletterHtml: str(data.newsletterHtml),
    weeklyTheme: str(data.weeklyTheme),
    featuredPromotion: str(data.featuredPromotion, hasPromo ? String(business.promotions) : ''),
    subjectVariants: variants,
    chosenSubject,
    reasoning: str(data.reasoning),
  }
}

/** Self-critique. Returns null score if the reviewer call fails. */
async function review(draft: Draft, business: Business): Promise<{ score: number | null; notes: string; tokens: number }> {
  try {
    const qaPrompt = `You are a strict marketing QA reviewer. Score this week's drafts for a ${business.type} with a ${business.brandVoice} brand voice, from 0-100, on: brand-voice adherence, specificity (not generic), a clear call to action, and sounding human (no AI tells). Be harsh: generic filler scores below 70.

DRAFTS:
- Post 1: ${draft.post1}
- Post 2: ${draft.post2}
- Post 3: ${draft.post3}
- Newsletter subject: ${draft.newsletterSubject}

Return JSON exactly: {"score": <integer 0-100>, "notes": "<one short sentence naming the single weakest thing>"}`
    const { data, tokens } = await generateJson(qaPrompt)
    const score = typeof data.score === 'number' ? Math.max(0, Math.min(100, Math.round(data.score))) : null
    return { score, notes: str(data.notes), tokens }
  } catch {
    return { score: null, notes: '', tokens: 0 }
  }
}

/**
 * Generate this week's marketing, then critique it. If the agent's own review
 * scores the draft below QA_THRESHOLD, it REJECTS the draft and rewrites it once
 * using its own critique, then keeps whichever attempt scored higher.
 *
 * The QA score is a gate, not a label: a low score changes what ships.
 */
export async function generateWeeklyContent(business: Business, priorWeek: PriorWeek | null = null): Promise<WeeklyContentResult> {
  const t0 = Date.now()
  let tokens = 0

  const first = await generateJson(buildPrompt(business, priorWeek, null))
  tokens += first.tokens
  let draft = toDraft(first.data, business)

  const firstReview = await review(draft, business)
  tokens += firstReview.tokens

  let qaScore = firstReview.score
  let qaNotes = firstReview.notes
  let regenerated = false
  let rejectedQaScore: number | null = null
  let rejectedQaNotes = ''

  if (qaScore !== null && qaScore < QA_THRESHOLD) {
    // The agent rejects its own work and tries again, told exactly what it got wrong.
    rejectedQaScore = qaScore
    rejectedQaNotes = qaNotes

    try {
      const second = await generateJson(buildPrompt(business, priorWeek, qaNotes || 'Too generic; not specific to this business.'))
      tokens += second.tokens
      const retryDraft = toDraft(second.data, business)

      const retryReview = await review(retryDraft, business)
      tokens += retryReview.tokens
      regenerated = true

      // Keep whichever attempt actually scored better.
      if ((retryReview.score ?? -1) >= (rejectedQaScore ?? -1)) {
        draft = retryDraft
        qaScore = retryReview.score
        qaNotes = retryReview.notes
      } else {
        qaScore = rejectedQaScore
        qaNotes = rejectedQaNotes
        rejectedQaScore = retryReview.score
        rejectedQaNotes = retryReview.notes
      }
    } catch {
      // Rewrite failed: ship the original rather than nothing.
      regenerated = false
      rejectedQaScore = null
      rejectedQaNotes = ''
    }
  }

  return {
    ...draft,
    qaScore,
    qaNotes,
    regenerated,
    rejectedQaScore,
    rejectedQaNotes,
    model: usingVertex() ? `${MODEL} (vertex)` : MODEL,
    tokensUsed: tokens,
    latencyMs: Date.now() - t0,
  }
}
