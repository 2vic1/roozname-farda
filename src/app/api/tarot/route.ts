// ─── API فال تاروت — قرعه + تفسیر هوش مصنوعی (سرگرمی) ───
import { NextResponse } from 'next/server'
import { drawCards, buildPrompt, isSpreadKey, SPREADS, TAROT_DISCLAIMER, type SpreadKey } from '@/lib/tarot'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      question?: unknown
      spread?: unknown
    }
    const spread: SpreadKey = isSpreadKey(body.spread) ? body.spread : 'three'
    const question = typeof body.question === 'string' ? body.question.slice(0, 500) : ''

    const cards = drawCards(spread)
    const { system, user } = buildPrompt(cards, question, SPREADS[spread].fa)

    const { aiChatCompletion } = await import('@/lib/ai-gateway')
    const reading = (
      await aiChatCompletion({
        messages: [
          { role: 'assistant', content: system },
          { role: 'user', content: user },
        ],
        maxTokens: 3000,
      })
    ).trim()
    if (reading.length < 80) throw new Error('تفسیر ناقص از مدل برگشت')

    return NextResponse.json({
      ok: true,
      spread,
      spreadFa: SPREADS[spread].fa,
      question,
      cards,
      reading,
      disclaimer: TAROT_DISCLAIMER,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
