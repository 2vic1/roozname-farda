// API چارت تولد — استرولوژی شخصی (غربی + ودیک + ستارگان ثابت + چرخه زندگی)
// حریم خصوصی: هیچ چارتی ذخیره نمی‌شود — فقط محاسبه‌ی زنده در حافظه‌ی همین فرایند
import { NextResponse } from 'next/server'
import { aiChatCompletion } from '@/lib/ai-gateway'
import { resolveBirth } from '@/lib/jalali'
import {
  computeNatalFull,
  natalFallbackText,
  SIGNS_FA,
  PLANET_FA,
  type NatalAspect,
  type StarContact,
  type WesternChart,
  type VedicChart,
  type NumerologyInfo,
  type LifeCycle,
} from '@/lib/natal'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ─── کش چارت محاسبه‌شده (کلید = اثر انگشت ورودی) ───
interface CachedNatal {
  western: WesternChart
  vedic: VedicChart
  stars: StarContact[]
  numerology: NumerologyInfo
  lifeCycle: LifeCycle
  index: number
  birthIso: string
  lat: number
  lon: number
  city: string
}
const natalCache = new Map<string, CachedNatal>()
const aiCache = new Map<string, Record<string, unknown>>()

function inputKey(jy: number, jm: number, jd: number, h: number, m: number, city: string): string {
  return `${jy}-${jm}-${jd}-${h}-${m}-${city}`
}

// ─── استخراج JSON از پاسخ هوش مصنوعی ───
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

function aspectsText(aspects: NatalAspect[]): string {
  return aspects
    .slice(0, 10)
    .map((a) => `${a.aFa} ${a.aspectFa} ${a.bFa} (مدار ${a.orb.toFixed(1)}°)`)
    .join('، ')
}

function starsText(stars: StarContact[]): string {
  if (!stars.length) return 'هیچ'
  return stars.map((s) => `${s.bodyFa} مقارن ${s.star} (${s.meaning})`).join('؛ ')
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      jy: number
      jm: number
      jd: number
      hour: number
      minute: number
      city: string
      name?: string
    }

    const jy = Number(body.jy), jm = Number(body.jm), jd = Number(body.jd)
    const hour = Number(body.hour), minute = Number(body.minute)
    if (
      !Number.isFinite(jy) || !Number.isFinite(jm) || !Number.isFinite(jd) ||
      jm < 1 || jm > 12 || jd < 1 || jd > 31 ||
      jy < 1178 || jy > 1500 ||
      !Number.isFinite(hour) || !Number.isFinite(minute) ||
      hour < 0 || hour > 23 || minute < 0 || minute > 59
    ) {
      return NextResponse.json({ ok: false, error: 'تاریخ یا ساعت تولد نامعتبر است' }, { status: 400 })
    }

    const key = inputKey(jy, jm, jd, hour, minute, body.city)
    let natal = natalCache.get(key)
    if (!natal) {
      const resolved = resolveBirth({ jy, jm, jd, hour, minute, city: body.city })
      const full = computeNatalFull(resolved.utc, resolved.lat, resolved.lon, {
        gy: resolved.utc.getUTCFullYear(),
        gm: resolved.utc.getUTCMonth() + 1,
        gd: resolved.utc.getUTCDate(),
      })
      natal = {
        western: full.western,
        vedic: full.vedic,
        stars: full.stars,
        numerology: full.numerology,
        lifeCycle: full.lifeCycle,
        index: full.index,
        birthIso: resolved.utc.toISOString(),
        lat: resolved.lat,
        lon: resolved.lon,
        city: resolved.city,
      }
      natalCache.set(key, natal)
    }

    // ─── تحلیل هوش مصنوعی (با کش) ─── // هیچ ذخیره‌ای انجام نمی‌شود (حریم خصوصی)
    let ai: Record<string, unknown> | null = (aiCache.get(key) as Record<string, unknown>) ?? null
    if (!ai) {
      const w = natal.western
      const sun = w.planets.find((p) => p.body === 'Sun')
      const moon = w.planets.find((p) => p.body === 'Moon')
      const prompt = `یک چارت تولد با روش‌های غربی و ودیک محاسبه شده است. تحلیل عمیق فارسی بده.

مشخصات: تولد ${jy}/${jm}/${jd} جلالی، ساعت ${hour}:${minute}، ${natal.city}
غربی: خورشید ${sun?.degText} (خانه ${sun?.house})، ماه ${moon?.degText} (خانه ${moon?.house})، طالع ${w.ascText}، میانه آسمان ${w.mcText}
سیارات: ${w.planets.map((p) => `${p.fa} ${p.degText} خانه${p.house}${p.retro ? ' ℞' : ''}${p.dignity ? ` [${p.dignity}]` : ''}`).join('، ')}
جنبه‌های مهم: ${aspectsText(w.aspects)}
تراز: عنصر مسلط ${w.dominantElement}، کیفیت مسلط ${w.dominantModality}
ودیک: ماه در ناکشترای ${natal.vedic.moonNakshatraFa} پادا ${natal.vedic.moonPada} (ویژگی: ${natal.vedic.moonNakTrait}) — دشای جاری: ${natal.vedic.currentMaha} / آنتاردشا: ${natal.vedic.currentAntar}
مرز دشاها: ${natal.vedic.dasha.map((d) => `${d.lordFa}:${d.fromAge.toFixed(0)}-${d.toAge.toFixed(0)}سالگی`).join('، ')}
ستارگان ثابت: ${starsText(natal.stars)}
اعدادشناسی: مسیر زندگی ${natal.numerology.lifePath} (${natal.numerology.lifePathFa})
شاخص کلی چارت: ${natal.index}/100

فقط JSON معتبر بده (بدون هیچ متن اضافه):
{
 "summary": "۳ جمله معرفی روحِ چارت به مخاطب (تو بخوان)، شاعرانه و قاطع",
 "personality": ["۴ تا ۶ جمله کوتاه شخصیتی"],
 "strengths": ["۳ تا ۵ نقطه قوت"],
 "weaknesses": ["۳ تا ۵ نقطه سایه/ضعف"],
 "lifePath": "تحلیل مسیر زندگی بر اساس دشاها و ناکشترا — ۴-۶ جمله با ذکر سن‌های کلیدی",
 "career": "تحلیل شغلی ۳-۴ جمله",
 "love": "تحلیل عاطفی ۳-۴ جمله",
 "money": "تحلیل مالی ۳-۴ جمله",
 "feelings": "تحلیل درون/احساس ۳-۴ جمله",
 "dashaNote": "معنی دوره فعلی دشا برای این شخص — ۲-۳ جمله",
 "starNote": "معنی اتصال ستاره ثابت یا «بدون اتصال برجسته» — ۱-۲ جمله"
}`

      try {
        const text = await aiChatCompletion({
          messages: [
            {
              role: 'system',
              content:
                'تو استرولوژیست ممتاز ایرانی هستی؛ هم نجوم غربی (استوایی، خانه، جنبه) و هم نجوم ودیک شرقی (ناکشترا، ویمشوتاری دشا) را عمیق می‌دانی. سبک تو شاعرانه، کوبنده و پر از تصویر آسمانی است، مثل اخترشناسان مالی ایرانی (Xanastrology). همیشه فقط فارسی پاسخ بده. خروجی فقط JSON معتبر باشد، بدون markdown و بدون توضیح اضافه.',
            },
            { role: 'user', content: prompt },
          ],
          maxTokens: 2400,
          temperature: 0.55,
          timeoutMs: 150_000,
        })
        ai = extractJson(text)
        if (!ai || typeof ai !== 'object' || !('summary' in ai)) ai = null
        if (ai) aiCache.set(key, ai)
      } catch {
        ai = null
      }
    }
    if (!ai) {
      ai = {
        summary: natalFallbackText(natal.western, natal.vedic, natal.index),
        personality: [
          `هسته اراده تو از ${SIGNS_FA[natal.western.sunSign]} می‌آید و نقاب اجتماعی‌ات طالع ${SIGNS_FA[natal.western.ascSign]} است.`,
          `نیازهای عاطفی‌ات را ماه در ${SIGNS_FA[natal.western.moonSign]} تعریف می‌کند.`,
          `عنصر مسلط چارت تو ${natal.western.dominantElement} است — این رنگ کل زندگی‌ات را می‌سازد.`,
        ],
        strengths: ['از جنبه‌های هماهنگ چارت محاسبه شد — تحلیل دقیق‌تر با تنظیم کلید هوش مصنوعی فعال می‌شود.'],
        weaknesses: ['برای تحلیل عمیق‌تر، کلید هوش مصنوعی را در تنظیمات ست کنید.'],
        lifePath: `دوره جاری دشا: ${natal.vedic.currentMaha} — آنتاردشا: ${natal.vedic.currentAntar}.`,
        career: `میانه آسمان ${natal.western.mcText} مسیر حرفه‌ای تو را نشان می‌دهد.`,
        love: `زهره و ماه تولد تو نقشه عشق تو را ترسیم می‌کند.`,
        money: `خانه‌های دوم و هشتم چارت تو معیار ثروت است.`,
        feelings: `ماه در ناکشترای ${natal.vedic.moonNakshatraFa} — ${natal.vedic.moonNakTrait}.`,
        dashaNote: `اکنون در دشای ${natal.vedic.currentMaha} با آنتاردشای ${natal.vedic.currentAntar} هستی.`,
        starNote: natal.stars.length
          ? `${natal.stars[0].bodyFa} مقارن ${natal.stars[0].star}: ${natal.stars[0].meaning}`
          : 'بدون اتصال برجسته به ستارگان ثابت.',
      }
    }

    return NextResponse.json({
      ok: true,
      input: { jy, jm, jd, hour, minute, city: natal.city, name: body.name ?? '' },
      birthIso: natal.birthIso,
      western: natal.western,
      vedic: {
        ayanamsa: natal.vedic.ayanamsa,
        planets: natal.vedic.planets,
        moonNakshatra: natal.vedic.moonNakshatra,
        moonNakshatraFa: natal.vedic.moonNakshatraFa,
        moonPada: natal.vedic.moonPada,
        moonNakTrait: natal.vedic.moonNakTrait,
        dasha: natal.vedic.dasha,
        currentMaha: natal.vedic.currentMaha,
        currentAntar: natal.vedic.currentAntar,
      },
      stars: natal.stars,
      numerology: natal.numerology,
      lifeCycle: natal.lifeCycle,
      index: natal.index,
      ai,
      planetsFa: PLANET_FA,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'خطای محاسبه چارت' },
      { status: 500 },
    )
  }
}
