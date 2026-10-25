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
  loadCustomMetas,
  customMetasInUse,
  warEntitiesInUse,
  getCycleWindowChart,
  WAR_ENTITIES,
  WAR_PAIRS,
  type WarAi,
  type WarCycle40,
} from '@/lib/war-astro'
import { db } from '@/lib/db'
import { WAR_12_END, WINDOW_40, todayStr } from '@/lib/cycles'
import { daysBetween, tehranDateStr, addDays } from '@/lib/tehran'

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

/** مدل گاهی شناسه چارت را کامل تکرار نمی‌کند (مثلاً «custom» به‌جای «custom:cuid») —
 *  شناسه‌ها را به شناسه واقعی نگاشت می‌کنیم تا خوانش هر چارت در UI پیدا شود */
function normalizeAiReads(ai: WarAi): WarAi {
  const ids = warEntitiesInUse()
  const customs = customMetasInUse()
  const byName = new Map<string, string>()
  for (const m of ids) {
    byName.set(m.fa, m.id)
    byName.set(m.short, m.id)
  }
  ai.reads = (ai.reads ?? []).map((r) => {
    if (ids.some((m) => m.id === r.id)) return r
    const nameHit = byName.get(r.id)
    if (nameHit) return { ...r, id: nameHit }
    if (r.id.startsWith('custom') && customs.length === 1) return { ...r, id: customs[0].id }
    return r
  })
  return ai
}

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
 "reads": [{"id": "شناسه چارت", "read": "۳ تا ۵ جمله وضعیت نجومی همین چارت و ریسک آن — برای همه چارت‌ها"}],
 "flashpoints": [{"pair": "الف↔ب", "read": "۲ تا ۴ جمله تحلیل نقطه انفجار این جفت بر اساس سینستری و پنجره‌ها"}],
 "calls": [{"when": "تاریخ جلالی دقیق (همان که در داده آمده)", "windowDays": عدد, "what": "چه انتظاری با این پنجره می‌رود — کوبنده و مشخص", "confidence": عدد ۰-۱۰۰}],
 "prediction": "پیشگویی سرفصل اصلی: ۴ تا ۷ جمله — کدام ماه‌ها خطرناک‌اند، چه نوع رویدادی (حمله مستقیم/نیابتی/تحریم/ترور/غافلگیری) در کدام پنجره محتمل‌تر است و سقف/کف اسکالاسیون چه می‌تواند باشد",
 "monthlyNote": "۲ تا ۳ جمله درباره گرفتگی‌ها و ماه‌های آینده"
}
شناسه چارت‌ها: ${warEntitiesInUse().map((e) => `${e.id}=${e.fa}`).join('، ')}.
الزام: آرایه reads باید دقیقاً برای هر شناسه بالا یک عضو داشته باشد — از جمله چارت‌های دلخواه کاربر (شناسه‌های custom:...)؛ هیچ چارتی را جا نینداز.
در calls فقط از تاریخ‌هایی که در «پنجره‌های ترانزیتی» داده شده استفاده کن؛ چیزی از خودت تاریخ نساز. مهم‌ترین ۵ تا ۸ پنجره را انتخاب کن.`

// چرخه‌های ۴۰روزه گن/هرست از آتش‌بس — همان شواهدی که در امتیاز ریسک (cycleScore) و
// انتخاب سناریوهای روز حمله استفاده می‌شوند؛ اگر جدول چرخه خالی بود محاسبه مستقیم می‌شود
async function getCycles40(): Promise<WarCycle40[]> {
  const today = todayStr()
  // گن و هرست تاریخ یکسان دارند (هر دو: آتش‌بس + k×۴۰) — بر اساس تاریخ ادغام می‌شوند
  const pick = (rows: { date: string; label: string; family: string }[]) => {
    const upcoming = rows
      .filter((r) => r.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
    const out: WarCycle40[] = []
    for (const r of upcoming) {
      const last = out[out.length - 1]
      if (last && last.date === r.date) {
        if (r.family === 'hurst' && !last.families.includes('hurst')) last.families.push('hurst')
        continue
      }
      out.push({
        date: r.date,
        k: Math.max(1, Math.round(daysBetween(WAR_12_END, r.date) / WINDOW_40)),
        families: [r.family === 'hurst' ? 'hurst' : 'gann'],
        daysLeft: daysBetween(today, r.date),
      })
      if (out.length >= 4) break
    }
    return out
  }
  try {
    const rows = await db.cycle.findMany({
      where: { label: { contains: '۴۰ روزه' } },
      orderBy: { date: 'asc' },
    })
    const picked = pick(rows)
    if (picked.length) return picked
  } catch {
    // جدول در دسترس نیست — محاسبه مستقیم
  }
  // fallback: گن k×۴۰ از آتش‌بس + هرست k×۴۰ از آتش‌بس
  const end = new Date(WAR_12_END + 'T00:00:00Z')
  const rows: { date: string; label: string; family: string }[] = []
  for (let k = 1; k <= 20; k++) {
    rows.push({
      date: tehranDateStr(addDays(end, WINDOW_40 * k)),
      label: `چرخه ۴۰ روزه (${k}×۴۰) از آتش‌بس`,
      family: 'gann',
    })
  }
  for (let k = 1; k <= 6; k++) {
    rows.push({
      date: tehranDateStr(addDays(end, WINDOW_40 * k)),
      label: `چرخه هرست ۴۰ روزه (${k}×۴۰)`,
      family: 'hurst',
    })
  }
  return pick(rows)
}

export async function GET() {
  try {
    // چارت‌های دلخواه کاربر — باید قبل از هر محاسبه‌ای در رجیستری ثبت شوند تا
    // در پنجره‌ها، سینستری، دیجست AI و چارت‌ها حضور داشته باشند
    const customs = await loadCustomMetas()
    const agg = getWarAggregate()
    // کش ساعتی AI — با تغییر چارت‌های دلخواه باطل شود
    const customHash = customs.map((m) => m.id).join(',').slice(0, 60)
    const key = `full-${new Date().toISOString().slice(0, 13)}-${customHash}`
    let ai = aiCache.get(key) ?? null
    let aiSource: 'ai' | 'engine' = ai ? 'ai' : 'engine' // کش فقط حاوی نتایج موفق AI است
    if (!ai) {
      const digest = warAiDigest()
      const result = await askAi(digest, AI_PROMPT, 3200)
      if (result) {
        ai = normalizeAiReads(result)
        aiSource = 'ai'
        aiCache.set(key, ai)
      }
    }
    if (!ai) ai = warFallbackAi()

    // سینستری چارت‌های دلخواه با سه کنشگر اصلی — تا در تحلیل استفاده شوند
    const customPairs = customMetasInUse().flatMap((m) => [
      { a: m.id, b: 'iran', label: 'چارت دلخواه کاربر ↔ ایران' },
      { a: m.id, b: 'israel', label: 'چارت دلخواه کاربر ↔ اسرائیل' },
      { a: m.id, b: 'usa', label: 'چارت دلخواه کاربر ↔ آمریکا' },
    ])

    return NextResponse.json({
      ok: true,
      generatedAtIso: new Date().toISOString(),
      warIndex: agg.index,
      entities: warEntitiesInUse().map((m) => getEntityChart(m.id)),
      pairs: [...WAR_PAIRS.map((p) => getSynastry(p.a, p.b)), ...customPairs.map((p) => getSynastry(p.a, p.b))],
      windows: agg.windows.slice(0, 60),
      eclipses: agg.eclipses,
      cycles40: await getCycles40(),
      windowChart: getCycleWindowChart(),
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
    await loadCustomMetas() // برای پذیرش شناسه چارت‌های دلخواه
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
