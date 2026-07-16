import { GoogleGenAI, Type } from '@google/genai'
import { sanitizeNewsletterHtml } from './sanitize-html'

const MODEL = 'gemini-2.5-flash'

/**
 * Without a forced schema Gemini sometimes answers the QA prompt with an ARRAY
 * of per-draft scores instead of one object. JSON.parse succeeds, data.score is
 * undefined, the score silently becomes null, and the gate can never fire.
 */
const QA_SCHEMA = {
  type: Type.OBJECT,
  properties: { score: { type: Type.INTEGER }, notes: { type: Type.STRING } },
  required: ['score', 'notes'],
}

function asObject(v: unknown): Record<string, unknown> {
  if (Array.isArray(v)) {
    const first = v.find((x) => x && typeof x === 'object')
    return (first as Record<string, unknown>) ?? {}
  }
  if (v && typeof v === 'object') return v as Record<string, unknown>
  return {}
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

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
  qaFailed: boolean
  regenerated: boolean
  rejectedQaScore: number | null
  rejectedQaNotes: string
  // Run evidence
  model: string
  tokensUsed: number
  latencyMs: number
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const m = text.match(/[[{][\s\S]*[\]}]/)
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function isTransient(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err)
  return /\b429\b|RESOURCE_EXHAUSTED|quota|rate.?limit|\b503\b|UNAVAILABLE|deadline/i.test(msg)
}

async function generateJson(
  prompt: string,
  responseSchema?: unknown,
  thinkingBudget?: number
): Promise<{ data: unknown; tokens: number }> {
  const config: Record<string, unknown> = { responseMimeType: 'application/json' }
  if (responseSchema) config.responseSchema = responseSchema
  // Scoring does not need deep reasoning: budget 0 takes the QA call from ~3s to ~0.8s.
  if (thinkingBudget !== undefined) config.thinkingConfig = { thinkingBudget }

  // When the weekly cron fans out, many workers hit Vertex at once. Quota
  // rejections are transient, so back off instead of failing the customer.
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await client().models.generateContent({
        model: MODEL,
        contents: prompt,
        config,
      })
      const data = extractJson(result.text ?? '')
      const tokens = result.usageMetadata?.totalTokenCount ?? 0
      return { data, tokens }
    } catch (err) {
      lastErr = err
      if (!isTransient(err) || attempt === 2) throw err
      await sleep(1000 * 2 ** attempt + Math.floor(Math.random() * 250))
    }
  }
  throw lastErr
}

const VOICE_GUIDE: Record<string, string> = {
  friendly: 'warm, approachable, uses "we" and "you", conversational',
  professional: 'polished, authoritative, concise, no slang',
  casual: 'relaxed, fun, can use light humour, short sentences',
  bold: 'energetic, punchy, uses exclamation, strong calls to action',
  elegant: 'refined, sophisticated, evocative language, no hard sells',
}

/** LTR languages only. RTL would need a dir="rtl" email template; out of scope. */
export const LANGUAGES: Record<string, string> = {
  en: 'English',
  fr: 'French (Français)',
  es: 'Spanish (Español)',
  pt: 'Portuguese (Português)',
  it: 'Italian (Italiano)',
  de: 'German (Deutsch)',
}

type Business = {
  name: string
  type: string
  city: string
  description: string
  brandVoice: string
  promotions?: string | null
  contentLanguage?: string | null
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

function languageName(business: Business): string {
  const code = (business.contentLanguage || 'en').toLowerCase()
  return LANGUAGES[code] ?? 'English'
}

function buildPrompt(business: Business, priorWeek: PriorWeek | null, critique: string | null): string {
  const voiceDesc = VOICE_GUIDE[business.brandVoice] ?? 'friendly and approachable'
  const hasPromo = !!business.promotions && business.promotions.trim().length > 0
  const code = (business.contentLanguage || 'en').toLowerCase()
  const lang = languageName(business)

  const language =
    code === 'en'
      ? ''
      : `\nLANGUAGE: Write every field natively in ${lang}. Do NOT write in English and translate. Write as a ${lang}-speaking local marketer would, with correct accents, idiom, and punctuation conventions. This includes the posts, all subject lines, the newsletter HTML body, and also weeklyTheme, featuredPromotion and reasoning, because the owner reads those too.`

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

  // Give the model the real date. Without it, it guesses the season from its
  // training data and features holidays that have already passed.
  const today = new Date().toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Toronto',
  })

  return `You are an autonomous marketing agent running weekly marketing for a small local business. You do not just write text, you make decisions and explain them.

TODAY IS ${today}. Only reference holidays, seasons, or events that are near this date or still ahead of it. Never feature something that has already passed.

BUSINESS PROFILE:
- Name: ${business.name}
- Type: ${business.type}
- City: ${business.city}
- Description: ${business.description}
- Brand voice: ${business.brandVoice} (${voiceDesc})
- This week's promotions / news from the owner: ${hasPromo ? business.promotions : 'NONE PROVIDED, so YOU decide the smartest angle to feature this week based on the business type, the season, and the current date.'}${language}${memory}${retry}

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
  "newsletterHtml": "The newsletter BODY only, as simple inline-styled HTML (150-200 words). Do NOT include the business name as a heading, a logo, or any header block: those are added automatically around your body. Start directly with a short greeting paragraph of news/promotions tied to the weekly theme, then a highlight section (a light background div with its own small heading), then end with a clear call to action written as TEXT (for example inviting the reader to reply, call, or visit this week). Do NOT include placeholder links or buttons with href='#' or empty hrefs; only link to a real URL if the owner provided one, otherwise keep the call to action as text. Mobile-friendly and readable."
}

STYLE RULES (these decide whether the content is usable):
- NO emojis anywhere. Not in posts, subjects, the newsletter, or the headings. Zero.
- Write the way the owner would text a regular customer: plain, specific, a little understated. Not like a marketer or an ad.
- BANNED words and phrases (they read as AI or as hype): "unlock", "elevate", "transform", "empower", "buzzing", "passionate about", "dive in", "delight", "seamless", "curated", "journey", "game-changer", "take it to the next level", "we've got you covered", "in today's world", "look no further", "the perfect", "whether you're ... or ...", "we're excited to", "boasts", "nestled". Do not use exclamation marks more than once across all three posts.
- Be concrete. Use specific details from the business description (real services, real neighbourhood, a real reason to come in this week). If you cannot be specific, say something small and true rather than something big and generic. A vague post is a failed post.
- Vary the openings. Do not start every post with a rhetorical question.

Only return the JSON object. No markdown, no extra text.`
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
    // Sanitize at the single choke point before this HTML is stored, rendered
    // on the public preview, or emailed. See sanitizeNewsletterHtml.
    newsletterHtml: sanitizeNewsletterHtml(str(data.newsletterHtml)),
    weeklyTheme: str(data.weeklyTheme),
    featuredPromotion: str(data.featuredPromotion, hasPromo ? String(business.promotions) : ''),
    subjectVariants: variants,
    chosenSubject,
    reasoning: str(data.reasoning),
  }
}

/** Self-critique. `failed` is true when the reviewer could not produce a score. */
async function review(
  draft: Draft,
  business: Business
): Promise<{ score: number | null; notes: string; tokens: number; failed: boolean }> {
  try {
    const qaPrompt = `You are a strict marketing QA reviewer and a native ${languageName(business)} speaker. The drafts below are written in ${languageName(business)}; judge them in that language and never penalise them for not being English. Judge this week's drafts for a ${business.type} with a ${business.brandVoice} brand voice AS A SET, on: brand-voice adherence, specificity (not generic), a clear call to action, and sounding human (no AI tells). Be harsh: generic filler scores below 70. Score AT MOST 40 if there is any emoji, or any hype/AI-tell word ("unlock", "elevate", "transform", "buzzing", "dive in", "delight", "seamless", "the perfect", "we're excited to"), or if the posts could belong to any business rather than this specific one.

DRAFTS:
- Post 1: ${draft.post1}
- Post 2: ${draft.post2}
- Post 3: ${draft.post3}
- Newsletter subject: ${draft.newsletterSubject}

Return ONE overall score from 0-100 for the whole set, and one short sentence naming the single weakest thing.`

    const { data, tokens } = await generateJson(qaPrompt, QA_SCHEMA, 0)

    const obj = asObject(data)
    let score = typeof obj.score === 'number' ? clamp(obj.score) : null

    // Safety net: if the model still returned per-draft scores, take the harshest.
    if (score === null && Array.isArray(data)) {
      const nums = (data as unknown[])
        .map((d) => (d && typeof d === 'object' ? (d as Record<string, unknown>).score : null))
        .filter((n): n is number => typeof n === 'number')
      if (nums.length) score = clamp(Math.min(...nums))
    }

    if (score === null) {
      console.error('Self-QA returned no usable score:', JSON.stringify(data).slice(0, 200))
      return { score: null, notes: '', tokens, failed: true }
    }
    return { score, notes: str(obj.notes), tokens, failed: false }
  } catch (err) {
    console.error('Self-QA review call failed:', err)
    return { score: null, notes: '', tokens: 0, failed: true }
  }
}

/**
 * Generate this week's marketing, then critique it. If the agent's own review
 * scores the draft below QA_THRESHOLD, it REJECTS the draft and rewrites it once
 * using its own critique, then keeps whichever attempt scored higher.
 *
 * The QA score is a gate, not a label: a low score changes what ships.
 */
export async function generateWeeklyContent(
  business: Business,
  priorWeek: PriorWeek | null = null,
  opts: { allowRewrite?: boolean; critique?: string } = {}
): Promise<WeeklyContentResult> {
  const allowRewrite = opts.allowRewrite !== false
  const t0 = Date.now()
  let tokens = 0

  const first = await generateJson(buildPrompt(business, priorWeek, opts.critique ?? null))
  tokens += first.tokens
  let draft = toDraft(asObject(first.data), business)

  const firstReview = await review(draft, business)
  tokens += firstReview.tokens

  let qaScore = firstReview.score
  let qaNotes = firstReview.notes
  let qaFailed = firstReview.failed
  let regenerated = false
  let rejectedQaScore: number | null = null
  let rejectedQaNotes = ''

  // A rewrite is a second full generation (~25s). Only start one when the caller
  // allows it AND enough of the 60s function budget remains, otherwise a bad
  // draft is traded for a 504.
  const budgetLeft = Date.now() - t0 < 30_000

  if (allowRewrite && budgetLeft && qaScore !== null && qaScore < QA_THRESHOLD) {
    // The agent rejects its own work and tries again, told exactly what it got wrong.
    rejectedQaScore = qaScore
    rejectedQaNotes = qaNotes

    try {
      const second = await generateJson(buildPrompt(business, priorWeek, qaNotes || 'Too generic; not specific to this business.'))
      tokens += second.tokens
      const retryDraft = toDraft(asObject(second.data), business)

      const retryReview = await review(retryDraft, business)
      tokens += retryReview.tokens
      regenerated = true
      qaFailed = retryReview.failed

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
    qaFailed,
    regenerated,
    rejectedQaScore,
    rejectedQaNotes,
    model: usingVertex() ? `${MODEL} (vertex)` : MODEL,
    tokensUsed: tokens,
    latencyMs: Date.now() - t0,
  }
}

const WINBACK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    body: { type: Type.STRING },
    reasoning: { type: Type.STRING },
  },
  required: ['subject', 'body', 'reasoning'],
}

export interface WinBackDraft {
  subject: string
  /** Simple inline-styled HTML paragraphs, wrapped in the business branding at send. */
  body: string
  /** Why the agent wrote it this way, recorded to the activity feed. */
  reasoning: string
  model: string
  tokensUsed: number
}

/**
 * Write one personal message to one specific client the business is about to
 * lose.
 *
 * This is the part that cannot be done with a generic prompt: the agent is given
 * this person's real history (what they had done last, how often they normally
 * come, how far past their own rhythm they are) and has to sound like the owner
 * noticed them personally. A blast would not work here, and would not deserve to.
 */
export async function draftWinBack(input: {
  business: {
    name: string
    type: string
    city: string
    brandVoice: string
    contentLanguage?: string | null
    promotions?: string | null
  }
  client: { name: string; lastService: string; visitCount: number; cadenceDays: number | null; daysSince: number }
  situation: string
}): Promise<WinBackDraft> {
  const { business, client: c } = input
  const voiceDesc = VOICE_GUIDE[business.brandVoice] ?? 'friendly and approachable'
  const code = (business.contentLanguage || 'en').toLowerCase()
  const lang = LANGUAGES[code] ?? 'English'
  const language =
    code === 'en'
      ? ''
      : `\nLANGUAGE: Write the subject and body natively in ${lang}, as a ${lang}-speaking owner would. Do not write in English and translate.`

  // The agent must never invent a discount. Left to its own devices it offers
  // free treatments the owner never authorized, and the client turns up expecting
  // to be honoured. Only what the owner actually configured is on the table.
  const promo = business.promotions?.trim()
  const offer = promo
    ? `\nWHAT YOU ARE ALLOWED TO OFFER (optional, only if it fits naturally):
${promo}
Offer nothing beyond this. Do not improve it, round it up, or add anything to it.`
    : `\nYOU HAVE NOTHING TO GIVE AWAY. Do NOT offer a discount, a freebie, a complimentary treatment, an upgrade, a gift, or any other incentive. You have not been authorised to spend the owner's money and inventing an offer would commit them to honouring it. The reason to come back is that you remember them and their ${c.lastService || 'last visit'} is due, nothing more.`

  const history =
    c.visitCount === 1
      ? `This is the part that matters: ${c.name} came in ONCE, ${c.daysSince} days ago${c.lastService ? ` for ${c.lastService}` : ''}, and never booked again. They have no habit with this business yet. If they do not come back soon, they almost certainly never will.`
      : `${c.name} has been in ${c.visitCount} times${c.lastService ? `, last for ${c.lastService}` : ''}. They normally come about every ${c.cadenceDays} days, but it has now been ${c.daysSince} days. They are drifting, and they may not have noticed themselves.`

  const prompt = `You are the owner of ${business.name}, a ${business.type} in ${business.city}. Your brand voice is ${business.brandVoice} (${voiceDesc}).

You are writing ONE short email to ONE real client you are about to lose. Not a campaign. Not a blast. One message to one person you actually remember.

WHO THEY ARE:
- Name: ${c.name}
- ${history}
- The read on them: ${input.situation}
${offer}${language}

Write the email. Return JSON with exactly these keys:

{
  "subject": "A short, human subject line. It should read like it came from a person, not a marketing tool. 4 to 8 words. Do not use their full name like a mail merge.",
  "body": "The email body as simple inline-styled HTML paragraphs (<p> tags only). 60 to 100 words.",
  "reasoning": "1 to 2 sentences on why you wrote it this way for this specific person."
}

HOW TO WRITE IT (this decides whether it works):
- Sound like the owner noticed, not like software noticed. Warm, brief, a little understated.
- Reference something real and specific: what they had done last, or how long it has been. Do not invent details you were not given.
- Give them one easy reason to come back: a gentle nudge to book. Never beg, never guilt them, never imply they did something wrong.
- NO emojis. No hype words ("unlock", "elevate", "transform", "we miss you so much!!", "exclusive offer"). No exclamation-mark spam, at most one.
- Open on THEM, not on pleasantries. Never open with generic well-wishing ("Hope you're doing wonderfully", "Hope this finds you well", "Hope you've been great"). Start with the specific thing you remember about them.
- NEVER reveal how you know they are overdue. Do not write "going through our appointments", "checking our records", "our system flagged", "it's been X days since your last visit", or anything else implying a list was consulted. The owner simply thought of them. They must feel remembered, not tracked.
- Short beats clever. If a line does not sound like a real person typing, cut it.
- Sign off as ${business.name}. Do NOT add a subject line, greeting boilerplate, or an unsubscribe footer inside the body, those are added around it.

Only return the JSON object.`

  const { data, tokens } = await generateJson(prompt, WINBACK_SCHEMA)
  const d = asObject(data)

  return {
    subject: str(d.subject) || `A quick note from ${business.name}`,
    // The model authors this HTML and the client name is attacker-influenced, so
    // it goes through the same allowlist sanitizer as the newsletter.
    body: sanitizeNewsletterHtml(str(d.body)),
    reasoning: str(d.reasoning),
    model: usingVertex() ? `${MODEL} (vertex)` : MODEL,
    tokensUsed: tokens,
  }
}
