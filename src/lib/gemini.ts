import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const MODEL = 'gemini-2.5-flash'

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
  // Self-critique
  qaScore: number | null
  qaNotes: string
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

const VOICE_GUIDE: Record<string, string> = {
  friendly: 'warm, approachable, uses "we" and "you", conversational',
  professional: 'polished, authoritative, concise, no slang',
  casual: 'relaxed, fun, can use light humour, short sentences',
  bold: 'energetic, punchy, uses exclamation, strong calls to action',
  elegant: 'refined, sophisticated, evocative language, no hard sells',
}

export async function generateWeeklyContent(business: {
  name: string
  type: string
  city: string
  description: string
  brandVoice: string
  promotions?: string | null
}): Promise<WeeklyContentResult> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  })

  const voiceDesc = VOICE_GUIDE[business.brandVoice] ?? 'friendly and approachable'
  const hasPromo = !!business.promotions && business.promotions.trim().length > 0

  const prompt = `You are an autonomous marketing agent running weekly marketing for a small local business. You do not just write text, you make decisions and explain them.

BUSINESS PROFILE:
- Name: ${business.name}
- Type: ${business.type}
- City: ${business.city}
- Description: ${business.description}
- Brand voice: ${business.brandVoice} (${voiceDesc})
- This week's promotions / news from the owner: ${hasPromo ? business.promotions : 'NONE PROVIDED, so YOU decide the smartest angle to feature this week based on the business type, the season, and the current date.'}

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

  const t0 = Date.now()
  const result = await model.generateContent(prompt)
  const latencyMs = Date.now() - t0
  const data = extractJson(result.response.text())
  const usage = result.response.usageMetadata
  const tokensUsed = usage?.totalTokenCount ?? 0

  const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
  const variants = Array.isArray(data.subjectVariants) ? (data.subjectVariants as unknown[]).map((s) => String(s)) : []
  const chosenSubject = str(data.chosenSubject) || str(data.newsletterSubject) || variants[0] || 'Your weekly update'

  const content = {
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

  // Self-critique QA pass (best-effort, never blocks shipping)
  let qaScore: number | null = null
  let qaNotes = ''
  try {
    const qaModel = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    })
    const qaPrompt = `You are a strict marketing QA reviewer. Score this week's drafts for a ${business.type} with a ${business.brandVoice} brand voice, from 0-100, on: brand-voice adherence, specificity (not generic), a clear call to action, and sounding human (no AI tells).

DRAFTS:
- Post 1: ${content.post1}
- Post 2: ${content.post2}
- Post 3: ${content.post3}
- Newsletter subject: ${content.newsletterSubject}

Return JSON exactly: {"score": <integer 0-100>, "notes": "<one short sentence, e.g. 'Strong, on-brand, clear CTA' or 'Post 2 is generic, weak CTA'>"}`
    const qaRes = await qaModel.generateContent(qaPrompt)
    const qa = extractJson(qaRes.response.text())
    if (typeof qa.score === 'number') qaScore = Math.max(0, Math.min(100, Math.round(qa.score)))
    qaNotes = str(qa.notes)
  } catch {
    /* QA is best-effort; ship content regardless */
  }

  return {
    ...content,
    qaScore,
    qaNotes,
    model: MODEL,
    tokensUsed,
    latencyMs,
  }
}
