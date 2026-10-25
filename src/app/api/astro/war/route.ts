// API استرولوزی جنگ — چارت دولت‌ها/رهبران + سینستری + پنجره‌های ترانزیتی + پیشگویی AI
import { NextResponse } from 'next/server'
import { aiChatCompletion } from '@/lib/ai-gateway'
import {
  getEntityChart,
  getSynastry,
  getWarAggregate,
  warAiDigest,
  warFallbackAi,
  entityMeta,
  WAR_ENTITIES,
  WAR_PAIRS,
  type WarAi,
} from '@/lib/war-astro'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

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

const aiCache = new Map<string, WarAi>()

async function askAi(digest: string, prompt: string, maxTokens: number): Promise<WarAi | null> {
  try {
    const text = await aiChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'تو استرولوژیست ممتاز ایرانی متخصص اختر-سیاست (استرولوژی جنگی/ملتی) هستی؛ مثل اخترشناسان مالی ایرانی که چارت دولت‌ها را با دقت تقویمی پیشگویی می‌کنند. هم روش غربی (ترانزیت، سینستری، جنبه سخت) و هم روش شرقی (دشا، ناکشترا) را می‌دانی. لحن تو کوبنده، پیشگویانه اما متکی فقط بر داده‌های داده‌شده است؛ عدد و تاریخ دقیق جلالی می‌دهی و از عبارات مبهم پرهیز می‌کنی. همیشه فقط فارسی. خروجی فقط JSON معتبر، بدون markdown و بدون توضیح اضافه.',
        },
        { role: 'user', content: `${digest}\n\n${prompt}` },
      ],
      maxTokens,
      temperature: 0.5,
      timeoutMs: 150_000,
    })
    const j = extractJson(text)
    if (!j || typeof j !== 'object' || !('executive' in j)) return null
    return j as unknown as WarAi
  } catch {
    return null
  }
}

const AI_PROMPT = `بر اساس داده‌های زیر، پیشگویی استرولوژی جنگی بنویس.

فقط JSON معتبر بده:
{
 "executive": "۲ تا ۴ جمله جمع‌بندی وضعیت آسمان جنگی همین امروز — با ذکر عدد شاخص و جدی‌ترین خط",
 "reads": [{"id": "شناسه چارت", "read": "۳ تا ۵ جمله وضعیت نجومی همین چارت و ریسک آن — برای هر ۶ چارت"}],
 "flashpoints": [{"pair": "الف↔ب", "read": "۲ تا ۴ جمله تحلیل نقطه انفجار این جفت بر اساس سینستری و پنجره‌ها"}],
 "calls": [{"when": "تاریخ جلالی دقیق (همان که در داده آمده)", "windowDays": عدد, "what": "چه انتظاری با این پنجره می‌رود — کوبنده و مشخص", "confidence": عدد ۰-۱۰۰}],
 "prediction": "پیشگویی سرفصل اصلی: ۴ تا ۷ جمله — کدام ماه‌ها خطرناک‌اند، چه نوع رویدادی (حمله مستقیم/نیابتی/تحریم/ترور/غافلگیری) در کدام پنجره محتمل‌تر است و سقف/کف اسکالاسیون چه می‌تواند باشد",
 "monthlyNote": "۲ تا ۳ جمله درباره گرفتگی‌ها و ماه‌های آینده"
}
شناسه چارت‌ها: ${WAR_ENTITIES.map((e) => `${e.id}=${e.fa}`).join('، ')}.
در calls فقط از تاریخ‌هایی که در «پنجره‌های ترانزیتی» داده شده استفاده کن؛ چیزی از خودت تاریخ نساز. مهم‌ترین ۵ تا ۸ پنجره را انتخاب کن.`

export async function GET() {
  try {
    const agg = getWarAggregate()
    const key = `full-${new Date().toISOString().slice(0, 13)}` // کش ساعتی برای AI
    let ai = aiCache.get(key) ?? null
    let aiSource: 'ai' | 'engine' = ai ? 'ai' : 'engine' // کش فقط حاوی نتایج موفق AI است
    if (!ai) {
      const digest = warAiDigest()
      const result = await askAi(digest, AI_PROMPT, 3200)
      if (result) {
        ai = result
        aiSource = 'ai'
        aiCache.set(key, ai)
      }
    }
    if (!ai) ai = warFallbackAi()

    return NextResponse.json({
      ok: true,
      generatedAtIso: new Date().toISOString(),
      warIndex: agg.index,
      entities: WAR_ENTITIES.map((m) => getEntityChart(m.id)),
      pairs: WAR_PAIRS.map((p) => getSynastry(p.a, p.b)),
      windows: agg.windows.slice(0, 60),
      eclipses: agg.eclipses,
      ai,
      aiSource,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'خطای موتور استرولوزی جنگ' },
      { status: 500 },
    )
  }
}

// تحلیل عمیق جفتی — سینستری + پنجره‌های متمرکز دو چارت
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { a?: string; b?: string }
    const a = body.a ?? 'iran'
    const b = body.b ?? 'israel'
    const ma = entityMeta(a)
    const mb = entityMeta(b)

    const agg = getWarAggregate()
    const syn = getSynastry(a, b)
    const focused = agg.windows.filter((w) => w.entityId === a || w.entityId === b).slice(0, 18)
    const focusedEcl = agg.eclipses.filter((e) => e.hits.some((h) => h.entityId === a || h.entityId === b))

    const ca = getEntityChart(a), cb = getEntityChart(b)
    const digest = `تحلیل جفتی درخواستی: ${ma.fa} ↔ ${mb.fa} (${syn.label})
تنش جفتی: ${syn.tension}/100 — اصطکاک ${syn.friction} / جریان هماهنگ ${syn.flow}
جنبه‌های سینستری (مرتب از قوی‌ترین):
${syn.aspects.map((x) => `- ${x.aFa}(${ma.short}) ${x.aspectFa} ${x.bFa}(${mb.short}) مدار ${x.orb.toFixed(1)}° ${x.hard ? 'سخت' : 'نرم'}`).join('\n')}
پنجره‌های ترانزیتی متمرکز این دو چارت (۱۲۰ روز):
${focused.map((w) => `- ${w.jalali} (±${w.windowDays}روز، ${w.level === 'critical' ? 'بحرانی' : w.level === 'high' ? 'بالا' : 'متوسط'}): ${w.transitFa} ${w.aspectFa} ${w.targetFa} «${w.entityFa}» — ${w.note}`).join('\n') || '- پنجره سخت نزدیک نیست'}
گرفتگی‌های مرتبط:
${focusedEcl.map((e) => `- ${e.kind === 'solar' ? 'خورشیدگرفتگی' : 'ماهگرفتگی'} ${e.jalali} — ${e.hits.map((h) => `ضربه به ${h.targetFa} ${h.entityFa} (${h.orb}°)`).join('، ')}`).join('\n') || '- گرفتگی هیت‌شده در افق نیست'}`

    const pairPrompt = `بر اساس داده‌ها تحلیل جفتی عمیق بده. فقط JSON معتبر بده:
{
 "executive": "۲ تا ۴ جمله جمع‌بندی این جفت — رابطه آسمانی‌شان الان چیست",
 "reads": [{"id": "${a}", "read": "..."}, {"id": "${b}", "read": "..."}],
 "flashpoints": [{"pair": "الف↔ب", "read": "۳ تا ۵ جمله نقطه انفجار این جفت"}],
 "calls": [{"when": "تاریخ جلالی از داده", "windowDays": عدد, "what": "...", "confidence": عدد}],
 "prediction": "۴ تا ۷ جمله پیشگویی مسیر این جفت در ۱۲۰ روز پیش‌رو — نوع رویداد، سطح اسکالاسیون، نقطه چرخش",
 "monthlyNote": "۱ تا ۲ جمله"
}`

    const key = `pair-${a}-${b}-${new Date().toISOString().slice(0, 13)}`
    let ai = aiCache.get(key) ?? null
    let aiSource: 'ai' | 'engine' = ai ? 'ai' : 'engine'
    if (!ai) {
      const result = await askAi(digest, pairPrompt, 2000)
      if (result) {
        ai = result
        aiSource = 'ai'
        aiCache.set(key, ai)
      }
    }
    if (!ai) {
      const fb = warFallbackAi()
      ai = {
        ...fb,
        executive: `${ma.short} ↔ ${mb.short} — تنش ${syn.tension}/۱۰۰. ${syn.verdict}`,
        flashpoints: [{ pair: `${ma.short}↔${mb.short}`, read: `قوی‌ترین جنبه: ${syn.aspects[0] ? `${syn.aspects[0].aFa} ${syn.aspects[0].aspectFa} ${syn.aspects[0].bFa} (مدار ${syn.aspects[0].orb}°)` : '—'}. ${syn.label}.` }],
      }
    }

    return NextResponse.json({
      ok: true,
      synastry: syn,
      windows: focused,
      eclipses: focusedEcl,
      entityA: ca,
      entityB: cb,
      ai,
      aiSource,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'خطای تحلیل جفتی' },
      { status: 500 },
    )
  }
}
