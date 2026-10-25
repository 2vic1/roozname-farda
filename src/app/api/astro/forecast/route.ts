// API پیش‌بینی ماهانه استرولوژی — سبک Xanastrology
// (تاریخ دقیق تعاملات با پنجره فعال ±۷ روز، قیاس‌های تاریخی سیارات بیرونی،
//  ستارگان ثابت، گرفتگی‌ها، اطوار ماه + لایه شخصی روی چارت تولد)
import { NextResponse } from 'next/server'
import { aiChatCompletion } from '@/lib/ai-gateway'
import { resolveBirth } from '@/lib/jalali'
import { computeNatalFull, computeMonthForecast, type NatalContext } from '@/lib/natal'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ─── کش‌ها ───
const ctxCache = new Map<string, NatalContext>()
const fcCache = new Map<string, ReturnType<typeof computeMonthForecast>>()
const aiCache = new Map<string, Record<string, unknown>>()

function extractJson(text: string): Record<string, unknown> | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fence ? fence[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

async function loadContext(
  birth?: { jy: number; jm: number; jd: number; hour: number; minute: number; city: string },
): Promise<NatalContext | null> {
  // حریم خصوصی: فقط داده‌ی تولد inline که کلاینت همین حالا فرستاده — هیچ chartId/جدولی در کار نیست
  if (birth) {
    const key = `x-${birth.jy}-${birth.jm}-${birth.jd}-${birth.hour}-${birth.minute}-${birth.city}`
    const cached = ctxCache.get(key)
    if (cached) return cached
    const resolved = resolveBirth(birth)
    const full = computeNatalFull(resolved.utc, resolved.lat, resolved.lon)
    const ctx: NatalContext = {
      birth: resolved.utc, lat: resolved.lat, lon: resolved.lon,
      western: full.western, vedic: full.vedic, stars: full.stars, numerology: full.numerology,
    }
    ctxCache.set(key, ctx)
    return ctx
  }
  return null
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      birth?: { jy: number; jm: number; jd: number; hour: number; minute: number; city: string }
      jy: number
      jm: number
    }
    const jy = Number(body.jy), jm = Number(body.jm)
    if (!Number.isFinite(jy) || !Number.isFinite(jm) || jm < 1 || jm > 12 || jy < 1178 || jy > 1500) {
      return NextResponse.json({ ok: false, error: 'ماه یا سال نامعتبر است' }, { status: 400 })
    }

    const hasChart = Boolean(body.birth)
    const natal = hasChart ? await loadContext(body.birth) : null

    const fcKey = `${body.birth ? `${body.birth.jy}-${body.birth.jm}-${body.birth.jd}-${body.birth.hour}-${body.birth.minute}-${body.birth.city}` : 'sky'}:${jy}:${jm}`
    let fc = fcCache.get(fcKey)
    if (!fc) {
      fc = computeMonthForecast(jy, jm, natal)
      if (fcCache.size > 200) fcCache.clear()
      fcCache.set(fcKey, fc)
    }

    // ─── روایت هوش مصنوعی به سبک اخترشناسی مالی ───
    const personal = Boolean(natal)
    let ai: Record<string, unknown> | null = aiCache.get(fcKey) ?? null
    if (!ai) {
      const events = fc.skyEvents
        .slice(0, 10)
        .map((e) => `${e.note}${e.passes > 1 ? ' — چندگذره' : ''}`)
        .join('\n')
      const hits = fc.natalHits
        .slice(0, 8)
        .map((h) => `${h.bodyFa} ${h.aspectFa} ${h.targetFa} تولد → محور ${h.dim === 'career' ? 'شغل' : h.dim === 'love' ? 'عشق' : h.dim === 'money' ? 'مال' : 'احساس'} — ${h.jalali}`)
        .join('\n')
      const analogs = fc.analogs
        .filter((a) => a.windows.length)
        .map((a) => `${a.planetFa} در ${a.signFa}: آخرین دوره‌ها ${a.windows.map((w) => `${w.from}–${w.to}`).join('، ')}${w_note(a.windows)}`)
        .join('\n')
      function w_note(wins: { note: string }[]): string {
        const n = wins.find((x) => x.note)?.note
        return n ? ` — ${n}` : ''
      }
      const phases = fc.moonPhases
        .map((p) => `${p.kind === 'full' ? 'ماه کامل' : 'ماه نو'} ${p.jalali} در ${p.degree}${p.starContact ? ` در جوار ${p.starContact}` : ''}`)
        .join('؛ ')
      const stars = fc.starsInMonth
        .slice(0, 6)
        .map((s) => `${s.bodyFa} مقارن ${s.star} (${s.meaning})`)
        .join('؛ ')
      const retros = fc.retroInMonth
        .map((r) => `${r.bodyFa} ${r.kind === 'start' ? 'راجع شد' : 'مستقیم شد'} — ${r.jalali}`)
        .join('؛ ')

      const prompt = `پیش‌بینی ماه ${fc.label} (${fc.days} روز) محاسبه شد — سبک اخترشناسی مالی جهانی.${personal && natal ? `\nچارت شخص: خورشید ${natal.western.planets.find((p) => p.body === 'Sun')?.degText}، ماه ${natal.western.planets.find((p) => p.body === 'Moon')?.degText}، طالع ${natal.western.ascText}. ${fc.dashaContext ? fc.dashaContext + '.' : ''}${fc.personalYear ? ` سال شخصی ${fc.personalYear}.` : ''}` : '\n(پیش‌بینی عمومی آسمان)'}

تعاملات دقیق ماه:
${events || 'تعامل آسمان-به-آسمان مهمی نیست'}
اطوار: ${phases || '—'}
برگشتی‌ها: ${retros || 'هیچ'}
ستارگان ثابت: ${stars || '—'}
گرفتگی‌ها: ${fc.eclipses.map((e) => `${e.kind === 'solar' ? 'خورشیدی' : 'ماهی'} ${e.jalali}${e.hits.length ? ` (برخورد با ${e.hits.join('، ')})` : ''}`).join('؛ ') || 'هیچ'}
قیاس تاریخی:
${analogs || '—'}
${personal && hits ? `ترانزیت روی چارت تولد:\n${hits}` : ''}
امتیازهای محاسبه‌شده: شغل ${fc.scores.career}، عشق ${fc.scores.love}، مال ${fc.scores.money}، احساس ${fc.scores.feelings}

فقط JSON معتبر بده:
{
 "summary": "پاراگراف آغازین درباره هوای کلی ماه — به سبک پست‌های اخترشناسی مالی (گردابه انرژی‌ها)، ۳-۴ جمله",
 "career": "تحلیل شغل/نهادها در این ماه — ۲-۴ جمله",
 "love": "تحلیل عاطفی — ۲-۳ جمله",
 "money": "تحلیل مالی/بازار — ۲-۴ جمله",
 "feelings": "تحلیل انرژی روانی/احساسی — ۲-۳ جمله",
 "luckyDays": [{"day": روز-عددی, "why": "کوتاه"}],
 "cautionDays": [{"day": روز-عددی, "why": "کوتاه"}],
 "xanNote": "یک جمله کوبنده پایانی به سبک Xanastrology که به چرخه تاریخی/قیاس تاریخی اشاره دارد"
}
روز lucky/caution حتماً از دل تعاملات واقعی بالا انتخاب شود (عدد روز ماه).`

      try {
        const text = await aiChatCompletion({
          messages: [
            {
              role: 'system',
              content:
                'تو استرولوژیست ممتاز ایرانی به سبک اخترشناسی مالی جهانی (Xanastrology) هستی: ترکیب چرخه‌های تکرار تاریخی سیارات بیرونی، تعاملات دقیق با پنجره فعال، ستارگان ثابت و اطوار ماه. لحن: شاعرانه، کوبنده، رمزآلود اما مبتنی بر داده‌های داده‌شده. فقط فارسی. خروجی فقط JSON معتبر، بدون markdown.',
            },
            { role: 'user', content: prompt },
          ],
          maxTokens: 2000,
          temperature: 0.6,
          timeoutMs: 150_000,
        })
        ai = extractJson(text)
        if (!ai || !('summary' in ai)) ai = null
        if (ai) aiCache.set(fcKey, ai)
      } catch {
        ai = null
      }
    }
    if (!ai) {
      const top = fc.skyEvents[0]
      ai = {
        summary: `ماه ${fc.label} با ${fc.skyEvents.length} تعامل آسمانی مهم و ${fc.eclipses.filter((e) => e.inMonth).length} گرفتگی در پنجره — شاخص ترکیبی ${fc.scores.overall} از ۱۰۰.`,
        career: `محور شغل: ${fc.scores.career}/۱۰۰ — ${fc.ingresses.map((i) => `${i.bodyFa} وارد ${i.toSign === 0 ? 'حمل' : ''}`).filter(Boolean).join('') || ''}${top ? ` مهم‌ترین تعامل: ${top.note}.` : ''}`,
        love: `محور عشق: ${fc.scores.love}/۱۰۰.`,
        money: `محور مال: ${fc.scores.money}/۱۰۰.`,
        feelings: `محور احساس: ${fc.scores.feelings}/۱۰۰ — ${fc.moonPhases.map((p) => `${p.kind === 'full' ? 'ماه کامل' : 'ماه نو'} ${p.jalali}`).join('، ')}.`,
        luckyDays: [],
        cautionDays: [],
        xanNote: fc.analogs.find((a) => a.windows.length)
          ? `${fc.analogs.find((a) => a.windows.length)?.planetFa} دوباره در ${fc.analogs.find((a) => a.windows.length)?.signFa} است — همان آسمان ${fc.analogs.find((a) => a.windows.length)?.windows[0]?.from}؛ تاریخ تکرار می‌شود، فقط لباس عوض می‌کند.`
          : 'آسمان این ماه چرخه‌ای بی‌سابقه دارد — تاریخ هنوز این صحنه را ندیده است.',
      }
    }

    return NextResponse.json({ ok: true, forecast: fc, ai, personal })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'خطای محاسبه پیش‌بینی' },
      { status: 500 },
    )
  }
}
