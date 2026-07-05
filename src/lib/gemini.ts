import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface WeeklyContentResult {
  post1: string
  post2: string
  post3: string
  newsletterSubject: string
  newsletterHtml: string
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
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  })

  const voiceGuide: Record<string, string> = {
    friendly: 'warm, approachable, uses "we" and "you", conversational',
    professional: 'polished, authoritative, concise, no slang',
    casual: 'relaxed, fun, can use light humour, short sentences',
    bold: 'energetic, punchy, uses exclamation, strong calls to action',
    elegant: 'refined, sophisticated, evocative language, no hard sells',
  }

  const voiceDesc = voiceGuide[business.brandVoice] ?? 'friendly and approachable'

  const prompt = `You are a local marketing expert generating weekly content for a small business.

BUSINESS PROFILE:
- Name: ${business.name}
- Type: ${business.type}
- City: ${business.city}
- Description: ${business.description}
- Brand voice: ${business.brandVoice} (${voiceDesc})
- This week's promotions / news: ${business.promotions || 'Nothing specific: highlight quality, service, and community'}

TASK: Create this week's marketing content. Make it sound authentically human, NOT like AI wrote it.

Return a JSON object with exactly these keys:

{
  "post1": "First social post (Google Business Profile / Facebook). 60-100 words. Engaging opener. Highlight a specific product, service, or story.",
  "post2": "Second social post. 50-80 words. Feature a promotion or seasonal angle, end with a clear call to action.",
  "post3": "Third social post. 40-70 words. Community-focused or behind-the-scenes. Builds trust and personality.",
  "newsletterSubject": "Email subject line. 6-10 words. Curiosity-driven or benefit-focused.",
  "newsletterHtml": "Full HTML email body (150-200 words of copy). Use simple inline-styled HTML: a header with the business name, a short paragraph of news/promotions, a highlight section (use a light background div), and a closing CTA button linking to '#'. Keep it mobile-friendly and readable."
}

Only return the JSON object. No markdown, no extra text.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Gemini returned no parseable JSON')

  return JSON.parse(jsonMatch[0]) as WeeklyContentResult
}
