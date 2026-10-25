// ─── پنج بات خودکار سامانه روزنامه فردا ───
// 1) خبرگیر (تلگرام + ایکس + اینستاگرام + RSS آمریکایی)
// 2) بازارگیر (بیت‌کوین، نفت، طلا، سهام آمریکا)
// 3) پروازگیر (هواپیماهای نظامی آمریکا نزدیک ایران)
// 4) تحلیل‌گر کلان‌روند (چرخه‌های گن/هرست/صدساله + ریسک + یادگیری)
// 5) گزارش‌ساز هوش مصنوعی (گزارش نهایی + پیش‌بینی روز حمله)
import { db } from '@/lib/db'
import { aiChatCompletion } from '@/lib/ai-gateway'
import { scoreTension, levelFromScore } from '@/lib/tension'
import { syncCycles, todayStr } from '@/lib/cycles'
import { computeAndStoreRisk } from '@/lib/risk'
import {
  fetchTelegram,
  fetchRss,
  fetchX,
  fetchInstagramStories,
  fetchYahoo,
  fetchTradingViewQuotes,
  fetchBinance,
  fetchGlobalCrypto,
  fetchFearGreed,
  fetchMilitaryFlights,
  type RawItem,
  type TvQuote,
} from '@/lib/fetchers'
import { tehranDateStr, addDays, daysBetween } from '@/lib/tehran'
import { isRelevantNews } from '@/lib/relevance'
import { detectLang, needsFa } from '@/lib/lang'

// ─── منابع کاربر (فقط همین‌ها مجازند — منابع داخلی ایران ممنوع) ───
const USER_SOURCES: Array<{
  type: 'telegram' | 'x' | 'instagram' | 'rss'
  handle: string
  label: string
  lang: string
  weight: number
  storiesOnly?: boolean
}> = [
  // ── تلگرام (لیست کاربر — ۸ کانال) ──
  { type: 'telegram', handle: 'persian_trend_official', label: 'Persian Trend', lang: 'fa', weight: 1.0 },
  { type: 'telegram', handle: 'BLUEGUARD_NEWSS', label: 'BlueGuard News', lang: 'fa', weight: 1.1 },
  { type: 'telegram', handle: 'daneshagahi_CoJ', label: 'دانش‌آگاهی', lang: 'fa', weight: 1.0 },
  { type: 'telegram', handle: 'MLStrategy', label: 'ML Strategy', lang: 'en', weight: 1.1 },
  { type: 'telegram', handle: 'VahidOnline', label: 'وحید آنلاین', lang: 'fa', weight: 1.2 },
  { type: 'telegram', handle: 'overlordechokilo', label: 'Overlord', lang: 'en', weight: 1.0 },
  { type: 'telegram', handle: 'sorahachi', label: 'Sorahachi', lang: 'fa', weight: 1.0 },
  { type: 'telegram', handle: 'Alibk3', label: 'Alibk3', lang: 'fa', weight: 1.0 },
  // ── ایکس (لیست کاربر — ۱۵ حساب) ──
  { type: 'x', handle: 'c14english', label: 'C14 English', lang: 'en', weight: 1.1 },
  { type: 'x', handle: 'i24NEWS_EN', label: 'i24NEWS', lang: 'en', weight: 1.2 },
  { type: 'x', handle: 'IsraelWarRoom', label: 'Israel War Room', lang: 'en', weight: 1.1 },
  { type: 'x', handle: 'BarakRavid', label: 'Barak Ravid', lang: 'en', weight: 1.3 },
  { type: 'x', handle: 'FoxNews', label: 'Fox News', lang: 'en', weight: 1.3 },
  { type: 'x', handle: 'NBCNews', label: 'NBC News', lang: 'en', weight: 1.3 },
  { type: 'x', handle: 'nytimes', label: 'NY Times', lang: 'en', weight: 1.3 },
  { type: 'x', handle: 'idfonline', label: 'IDF (رسمی)', lang: 'en', weight: 1.4 },
  { type: 'x', handle: 'CENTCOM', label: 'CENTCOM (رسمی)', lang: 'en', weight: 1.4 },
  { type: 'x', handle: 'Osint613', label: 'OSINT 613', lang: 'en', weight: 1.1 },
  { type: 'x', handle: 'sentdefender', label: 'Sent Defender', lang: 'en', weight: 1.1 },
  { type: 'x', handle: 'WarMonitors', label: 'War Monitors', lang: 'en', weight: 1.2 },
  { type: 'x', handle: 'MenchOsint', label: 'Mench OSINT', lang: 'en', weight: 1.1 },
  { type: 'x', handle: 'Reuters', label: 'Reuters', lang: 'en', weight: 1.4 },
  { type: 'x', handle: 'AP', label: 'AP News', lang: 'en', weight: 1.4 },
  // ── اینستاگرام (لیست کاربر — فقط استوری) ──
  { type: 'instagram', handle: 'mrpakdel_', label: 'mrpakdel_ (استوری)', lang: 'fa', weight: 0.9, storiesOnly: true },
  { type: 'instagram', handle: 'yashar', label: 'Yashar (استوری)', lang: 'fa', weight: 0.9, storiesOnly: true },
  // ── وب‌سایت‌های معتبر آمریکایی (RSS) ──
  {
    type: 'rss',
    handle: 'https://moxie.foxnews.com/google-publisher/latest.xml',
    label: 'Fox News RSS', lang: 'en', weight: 1.3,
  },
  {
    type: 'rss',
    handle: 'https://news.google.com/rss/search?q=when:2d+site:nbcnews.com+(iran+OR+israel+OR+hormuz+OR+strike)&hl=en-US&gl=US&ceid=US:en',
    label: 'NBC News (فیلتر ایران)', lang: 'en', weight: 1.3,
  },
  {
    type: 'rss',
    handle: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    label: 'NYT World RSS', lang: 'en', weight: 1.3,
  },
  {
    type: 'rss',
    handle: 'https://news.google.com/rss/search?q=when:2d+site:reuters.com+(iran+OR+israel+OR+hormuz+OR+oil+OR+strike)&hl=en-US&gl=US&ceid=US:en',
    label: 'Reuters (فیلتر ایران)', lang: 'en', weight: 1.4,
  },
  {
    type: 'rss',
    handle: 'https://news.google.com/rss/search?q=when:2d+site:apnews.com+(iran+OR+israel+OR+hormuz+OR+oil+OR+strike)&hl=en-US&gl=US&ceid=US:en',
    label: 'AP News (فیلتر ایران)', lang: 'en', weight: 1.4,
  },
]

// منابع پیش‌فرض قدیمی (رسانه‌های داخلی ایران و منابع غیرمجاز) — حذف همیشگی
const REMOVED_HANDLES = [
  'bbcpersian',
  'presstv',
  'IRIBnews',
  'intelslava',
  'Middle_East_Spectator',
  'ClashReport',
  'rybar',
  'SputnikInt',
  'almayadeenenglish',
  'Timesofisrael',
  'Tasnimnews_EN',
  'iranintl_en',
  'Nexta_live',
  'Alarabiya_Breaking',
  'https://feeds.bbci.co.uk/persian/rss.xml',
  'https://rss.dw.com/rdf/rss-per-all',
  'https://feeds.nbcnews.com/nbcnews/public/news.xml',
  'https://www.iranintl.com/rss',
  'https://www.isna.ir/rss',
  'https://irna.ir/rss',
  'https://www.mehrnews.com/rss',
  'https://www.presstv.ir/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://www.jpost.com/rss/rssfeedsfrontpage.aspx',
  'https://news.google.com/rss/search?q=iran+israel+OR+hormuz+OR+strike&hl=en-US&gl=US&ceid=US:en',
]

const DEFAULT_EVENTS = [
  {
    name: 'جنگ ۱۲ روزه ایران و اسرائیل',
    startDate: '2025-06-13',
    endDate: '2025-06-24',
    note: 'حمله هوایی اسرائیل و آمریکا به ایران، پاسخ موشکی ایران، آتش‌بس در ۳ تیر ۱۴۰۴',
  },
  {
    name: 'پنجره ۴۰ روزه (الگوی دوره دوم)',
    startDate: '2025-06-24',
    endDate: '2025-08-03',
    note: 'بازه ۴۰ روزه پس از آتش‌بس که در تحلیل‌های چرخه‌ای به‌عنوان پنجره خطر مرجع استفاده می‌شود',
  },
]

export async function seedIfEmpty(): Promise<void> {
  // افزودن/به‌روزرسانی منابع کاربر
  for (const s of USER_SOURCES) {
    await db.source.upsert({
      where: { handle: s.handle },
      create: {
        type: s.type,
        handle: s.handle,
        label: s.label,
        lang: s.lang,
        weight: s.weight,
        storiesOnly: s.storiesOnly ?? false,
      },
      update: {
        type: s.type,
        label: s.label,
        weight: s.weight,
        storiesOnly: s.storiesOnly ?? false,
      },
    })
  }
  // حذف منابع قدیمی غیرمجاز (از جمله رسانه‌های داخلی ایران — دروغگو)
  // منابعی که کاربر خودش بعداً اضافه کند حفظ می‌شوند
  await db.source.deleteMany({
    where: { handle: { in: REMOVED_HANDLES } },
  })
  // حذف اخبار یتیم (متعلق به منابع حذف‌شده قدیمی)
  await db.newsItem.deleteMany({ where: { sourceId: null } })
  if ((await db.refEvent.count()) === 0) {
    await db.refEvent.createMany({ data: DEFAULT_EVENTS })
  }
}

// ─── لاگ اجرای بات‌ها ───
async function logBot(bot: string, fn: () => Promise<{ items: number; message?: string }>) {
  const started = Date.now()
  try {
    const r = await fn()
    await db.botRun.create({
      data: {
        bot,
        status: 'ok',
        items: r.items,
        message: r.message ?? null,
        durationMs: Date.now() - started,
      },
    })
    return r
  } catch (e) {
    await db.botRun.create({
      data: {
        bot,
        status: 'error',
        items: 0,
        message: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - started,
      },
    })
    throw e
  }
}

// ─── بات ۱: خبرگیر ───
async function fetchSourceItems(type: string, handle: string): Promise<RawItem[]> {
  switch (type) {
    case 'telegram':
      return fetchTelegram(handle)
    case 'x':
      return fetchX(handle)
    case 'instagram':
      return fetchInstagramStories(handle, 6)
    default:
      return fetchRss(handle)
  }
}

// ─── ورودی مشترک یک منبع خبری: دریافت + فیلتر موضوعی + ذخیره (بدون تکرار) ───
async function ingestFromSource(
  s: { id: string; type: string; handle: string; label: string; lang: string; weight: number },
  cutoff: Date
): Promise<number> {
  const raw = await fetchSourceItems(s.type, s.handle)
  const fresh = raw.filter((r) => r.publishedAt >= cutoff)
  if (!fresh.length) return 0
  // ── فیلتر موضوعی سخت: فقط جنگ/تنش ایران-آمریکا-اسرائیل-هرمز (الزام کاربر) ──
  const relevant = fresh.filter((r) => isRelevantNews(r.title).ok)
  if (!relevant.length) return 0
  const ids = relevant.map((r) => {
    if (s.type === 'telegram') {
      return `${s.type}:${s.handle}:${r.url?.split('/').pop() ?? r.title.slice(0, 120)}`
    }
    if (s.type === 'x') {
      const statusId = r.url?.match(/\/status\/(\d+)/)?.[1]
      return `${s.type}:${s.handle}:${statusId ?? r.title.slice(0, 120)}`
    }
    return `${s.type}:${s.handle}:${r.title.slice(0, 120)}`
  })
  const existing = await db.newsItem.findMany({
    where: { externalId: { in: ids } },
    select: { externalId: true },
  })
  const have = new Set(existing.map((e) => e.externalId))
  const seen = new Set<string>()
  const toCreate = relevant
    .map((r, i) => ({ r, id: ids[i] }))
    .filter(({ id }) => {
      if (seen.has(id) || have.has(id)) return false
      seen.add(id)
      return true
    })
    .map(({ r, id }) => {
      const t = scoreTension(r.title, s.weight)
      return {
        sourceId: s.id,
        sourceType: s.type,
        sourceLabel: s.label,
        title: r.title.slice(0, 900),
        content: r.title.slice(0, 2000),
        url: r.url,
        externalId: id,
        // زبان واقعی از روی متن خبر تشخیص داده می‌شود نه از برچسب منبع —
        // یک کانال فارسی ممکن است عربی/چینی/انگلیسی پست کند و باید ترجمه شود
        lang: detectLang(r.title),
        publishedAt: r.publishedAt,
        tensionScore: t.score,
        level: t.level,
        keywords: JSON.stringify(t.keywords),
      }
    })
  let added = 0
  for (const row of toCreate) {
    try {
      await db.newsItem.create({ data: row })
      added++
    } catch {
      // تکراری — رد شود
    }
  }
  return added
}

export async function runNewsBot(): Promise<{ items: number }> {
  return logBot('news', async () => {
    const sources = await db.source.findMany({ where: { active: true } })
    const cutoff = addDays(new Date(), -10)
    let added = 0
    let fetched = 0
    const failed: string[] = []

    await Promise.allSettled(
      sources.map(async (s) => {
        try {
          const raw = await fetchSourceItems(s.type, s.handle)
          fetched += raw.length
          added += await ingestFromSource(s, cutoff)
        } catch (e) {
          failed.push(`${s.label}: ${e instanceof Error ? e.message.slice(0, 60) : 'خطا'}`)
        }
      })
    )
    // پاکسازی: اخبار قدیمی‌تر از ۳۰ روز
    await db.newsItem.deleteMany({ where: { publishedAt: { lt: addDays(new Date(), -30) } } })
    // پاکسازی اخبار نامرتبط موجود (خبرهای قبلی که موضوعشان جنگ ایران/اسرائیل/آمریکا/هرمز نیست)
    const recent = await db.newsItem.findMany({
      where: { publishedAt: { gte: addDays(new Date(), -30) } },
      select: { id: true, title: true },
    })
    const irrelevantIds = recent.filter((n) => !isRelevantNews(n.title).ok).map((n) => n.id)
    if (irrelevantIds.length) {
      await db.newsItem.deleteMany({ where: { id: { in: irrelevantIds } } })
    }
    const msg = `${fetched} آیتم خوانده شد، ${added} جدید ذخیره شد، ${irrelevantIds.length} نامرتبط رد شد${
      failed.length ? ` | منابع ناموفق: ${failed.slice(0, 3).join('، ')}` : ''
    }`
    return { items: added, message: msg }
  })
}

// ─── تیک خبری (هر ۳۰ ثانیه): چرخش بین منابع تا همه هر چند دقیقه یک‌بار پوشش داده شوند ───
const newsTickState = { idx: 0 }

export async function runNewsTick(): Promise<{ items: number; sources: string[] }> {
  const sources = await db.source.findMany({
    where: { active: true },
    orderBy: { id: 'asc' },
  })
  if (!sources.length) return { items: 0, sources: [] }
  const BATCH = 6
  const start = newsTickState.idx % sources.length
  const batch = Array.from(
    { length: Math.min(BATCH, sources.length) },
    (_, i) => sources[(start + i) % sources.length]
  )
  newsTickState.idx = (start + batch.length) % sources.length

  const cutoff = addDays(new Date(), -10)
  let added = 0
  await Promise.allSettled(
    batch.map(async (s) => {
      try {
        added += await ingestFromSource(s, cutoff)
      } catch {
        // منبع در این دور در دسترس نبود — دور بعد دوباره تلاش می‌شود
      }
    })
  )
  return { items: added, sources: batch.map((b) => b.label) }
}

// ─── غنی‌سازی هوش مصنوعی اخبار: ترجمه فارسی + تشخیص تبلیغ/نظر + حکم نهایی ───
interface AiNewsVerdict {
  i: number
  ir?: boolean
  ad: boolean
  op: boolean
  v: 'war_signal' | 'tension' | 'diplomacy' | 'routine'
  t: number
  fa: string | null
}

function parseJsonLoose<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/```json/gi, '```')
    .split('```')
    .map((s) => s.trim())
    .filter(Boolean)
  // مدل‌ها گاهی escape نامعتبر می‌سازند (مثل \ب) — بک‌اسلش‌های یتیم را دوباره escape می‌کنیم
  const repair = (s: string) => s.replace(/\\(?![\\/"bfnrtu])/g, '\\\\')
  for (const chunk of [raw, ...cleaned]) {
    for (const candidate of [chunk, repair(chunk)]) {
      try {
        const start = candidate.search(/[[{]/)
        if (start === -1) continue
        const end = Math.max(candidate.lastIndexOf(']'), candidate.lastIndexOf('}'))
        if (end <= start) continue
        return JSON.parse(candidate.slice(start, end + 1)) as T
      } catch {
        continue
      }
    }
  }
  return null
}

export async function enrichNewsWithAi(): Promise<{ items: number }> {
  const pending = await db.newsItem.findMany({
    where: {
      aiVerdict: 'unknown',
      publishedAt: { gte: addDays(new Date(), -2) },
      title: { not: '' },
    },
    orderBy: { publishedAt: 'desc' },
    take: 36,
    select: { id: true, title: true, lang: true, sourceType: true },
  })
  if (!pending.length) return { items: 0 }

  const list = pending.map((p, i) => ({
    i,
    lang: p.lang,
    src: p.sourceType,
    text: p.title.slice(0, 260),
  }))

  const raw = await aiChatCompletion({
    messages: [
      {
        role: 'assistant',
        content:
          'تو تحلیلگر خبری جنگ و ژئوپلیتیک هستی. برای هر خبر ورودی یک آبجکت JSON برگردان. قوانین: (0) ir=true فقط اگر خبر به جنگ، تنش نظامی، تحریم‌ها یا درگیری بین ایران و آمریکا و اسرائیل یا تنگه هرمز مربوط باشد؛ هر موضوع دیگری (ورزش، سلبریتی، سیاست داخلی آمریکا، جنگ اوکراین، اقتصاد بدون ارتباط جنگی و…) ir=false است. (1) ad=true اگر خبر نیست و تبلیغ/کسب‌درآمد/دعوت به کانال است. (2) op=true اگر نظر شخصی/تحلیل سلیقه‌ای نویسنده است نه خبر واقعی. (3) v یکی از: war_signal (نشانه مستقیم شروع/تشدید حمله نظامی), tension (تنش و تحرکات نظامی), diplomacy (مذاکره/دیپلماسی/کاهش تنش), routine (خبر عادی). (4) t امتیاز تنش 0..100 (برای routine حداکثر 20، diplomacy حداکثر 35). (5) fa ترجمه فارسی کوتاه و دقیق متن (حداکثر ۳۵ کلمه) — برای هر زبانی اجباری است: انگلیسی، عربی، فرانسوی، عبری، ترکی، روسی و هر زبان دیگر باید حتماً به فارسی ترجمه شود؛ فقط اگر متن از قبل فارسی است null بگذار. فقط و فقط آرایه JSON خروجی بده، بدون توضیح اضافه.',
      },
      {
        role: 'user',
        content: `خبرها:\n${JSON.stringify(list, null, 0)}\n\nخروجی: آرایه JSON با فیلدهای {i, ir, ad, op, v, t, fa} به همان ترتیب i.`,
      },
    ],
  })
  const parsed = parseJsonLoose<AiNewsVerdict[]>(raw)
  if (!Array.isArray(parsed)) throw new Error('پاسخ JSON نامعتبر از مدل')

  let updated = 0
  for (const v of parsed) {
    if (typeof v.i !== 'number' || !pending[v.i]) continue
    const row = pending[v.i]
    const irrelevant = v.ir === false
    const data: {
      isAd?: boolean
      isOpinion?: boolean
      aiVerdict?: string
      tensionScore?: number
      level?: string
      textFa?: string | null
    } = {
      isAd: Boolean(v.ad),
      isOpinion: Boolean(v.op),
      // خبر نامرتبط با جنگ ایران/اسرائیل/آمریکا/هرمز → حکم نامرتبط (از فید و امتیاز حذف می‌شود)
      aiVerdict: irrelevant
        ? 'irrelevant'
        : ['war_signal', 'tension', 'diplomacy', 'routine'].includes(v.v)
          ? v.v
          : 'unknown',
      textFa: v.fa && typeof v.fa === 'string' && v.fa.length > 3 ? v.fa.slice(0, 500) : null,
    }
    if (irrelevant) {
      // تنش نامرتبط‌ها صفر شود تا در هیچ محاسبه‌ای اثر نگذارند
      data.tensionScore = 0
      data.level = 'calm'
    } else if (typeof v.t === 'number' && isFinite(v.t) && v.t >= 0 && v.t <= 100) {
      const tension = Math.round(v.t)
      data.tensionScore = tension
      data.level = levelFromScore(tension)
    }
    try {
      await db.newsItem.update({ where: { id: row.id }, data })
      updated++
    } catch {
      // رد شود
    }
  }
  return { items: updated }
}

// ─── تضمین ترجمه: هر خبر غیرفارسی بدون ترجمه باید فارسی شود (انگلیسی/عربی/فرانسوی/...) ───
export async function translatePendingNews(): Promise<{ items: number }> {
  const candidates = await db.newsItem.findMany({
    where: {
      textFa: null,
      isAd: false,
      // ۱۲ روز: هم‌پوشان با پنجره ingest (۱۰ روز) — خبر خارجی نباید از صف ترجمه بیفتد بیرون
      publishedAt: { gte: addDays(new Date(), -12) },
      title: { not: '' },
      aiVerdict: { not: 'irrelevant' },
    },
    orderBy: { publishedAt: 'desc' },
    take: 90,
    select: { id: true, title: true },
  })
  // زبان ذخیره‌شده ممکن است اشتباه باشد (منبع «فارسی» با متن عربی) —
  // ملاک فقط متن واقعی است، نه فیلد lang
  const pending = candidates.filter((p) => needsFa(p.title)).slice(0, 30)
  if (!pending.length) return { items: 0 }

  const raw = await aiChatCompletion({
    messages: [
      {
        role: 'assistant',
        content:
          'تو مترجم حرفه‌ای خبری هستی. هر متن ورودی را به فارسی روان و دقیق ترجمه کن (حداکثر ۳۵ کلمه). متن ممکن است انگلیسی، عربی، فرانسوی، عبری، ترکی یا هر زبان دیگری باشد — همه باید فارسی شوند. فقط آرایه JSON برگردان: [{"i": شماره, "fa": "ترجمه"}] به همان ترتیب.',
      },
      {
        role: 'user',
        content: `متن‌ها:\n${JSON.stringify(
          pending.map((p, i) => ({ i, text: p.title.slice(0, 260) })),
          null,
          0
        )}`,
      },
    ],
  })
  const parsed = parseJsonLoose<Array<{ i: number; fa: string }>>(raw)
  if (!Array.isArray(parsed)) return { items: 0 }

  let updated = 0
  for (const v of parsed) {
    if (typeof v.i !== 'number' || !pending[v.i]) continue
    if (!(v.fa && typeof v.fa === 'string' && v.fa.length > 3)) continue
    try {
      await db.newsItem.update({
        where: { id: pending[v.i].id },
        data: {
          textFa: v.fa.slice(0, 500),
          // اصلاح زبان ذخیره‌شده بر اساس متن واقعی
          lang: detectLang(pending[v.i].title),
        },
      })
      updated++
    } catch {
      // رد شود
    }
  }
  return { items: updated }
}

// ─── بات ۲: بازارگیر ───
const YAHOO_ASSETS: Array<{ symbol: string; name: string; category: string; unit: string }> = [
  { symbol: 'CL=F', name: 'نفت WTI', category: 'energy', unit: '$' },
  { symbol: 'BZ=F', name: 'نفت برنت', category: 'energy', unit: '$' },
  { symbol: 'GC=F', name: 'طلا', category: 'metals', unit: '$' },
  { symbol: 'SI=F', name: 'نقره', category: 'metals', unit: '$' },
  { symbol: '^GSPC', name: 'S&P 500', category: 'indices', unit: '' },
  { symbol: '^IXIC', name: 'نزدک', category: 'indices', unit: '' },
  { symbol: '^DJI', name: 'داوجونز', category: 'indices', unit: '' },
  { symbol: '^VIX', name: 'شاخص ترس VIX', category: 'risk', unit: '' },
  { symbol: 'DX-Y.NYB', name: 'شاخص دلار DXY', category: 'indices', unit: '' },
  { symbol: 'NVDA', name: 'انویدیا', category: 'indices', unit: '$' },
]

const CRYPTO_ASSETS: Array<{ symbol: string; name: string; category: string }> = [
  { symbol: 'BTCUSDT', name: 'بیت‌کوین', category: 'crypto' },
  { symbol: 'ETHUSDT', name: 'اتریوم', category: 'crypto' },
]

// اصلاح‌گر منبع قیمت: برنت واقعی از ICE اروپا، WTI از نیومکس، طلا/نقره اسپات و
// کریپتو/شاخص‌ها از تریدینگ‌ویو (همان مرجع اپ‌های چارت کاربر)
const TV_ASSET_OVERRIDES: Record<string, string> = {
  'BZ=F': 'ICEEUR:BRN1!',
  'CL=F': 'NYMEX:CL1!',
  'GC=F': 'OANDA:XAUUSD',
  'SI=F': 'TVC:SILVER',
  // کریپتو — قیمت بایننس با مرجع کاربر فاصله دارد؛ تریدینگ‌ویو مرجع نمایشی است
  BTCUSDT: 'BINANCE:BTCUSDT',
  ETHUSDT: 'BINANCE:ETHUSDT',
  // شاخص‌ها — برای تیک سریع ۳۰ ثانیه‌ای (یک درخواست دسته‌ای)
  '^GSPC': 'SP:SPX',
  '^IXIC': 'NASDAQ:IXIC',
  '^DJI': 'DJ:DJI',
  'DX-Y.NYB': 'TVC:DXY',
  '^VIX': 'TVC:VIX',
  // سهام — انویدیا
  NVDA: 'NASDAQ:NVDA',
}

export async function runMarketBot(): Promise<{ items: number }> {
  return logBot('market', async () => {
    let saved = 0

    const saveQuote = (
      a: { symbol: string; name: string; category: string; unit?: string },
      q: { price: number; change1d: number; change7d: number; change30d: number; closes: number[] }
    ) =>
      db.assetSnapshot.upsert({
        where: { symbol: a.symbol },
        create: {
          symbol: a.symbol,
          name: a.name,
          category: a.category,
          unit: a.unit ?? '$',
          price: q.price,
          change1d: q.change1d,
          change7d: q.change7d,
          change30d: q.change30d,
          spark: JSON.stringify(q.closes.slice(-30).map((c) => Math.round(c * 100) / 100)),
        },
        update: {
          price: q.price,
          change1d: q.change1d,
          change7d: q.change7d,
          change30d: q.change30d,
          spark: JSON.stringify(q.closes.slice(-30).map((c) => Math.round(c * 100) / 100)),
        },
      })

    // یک درخواست برای همه نمادهای تریدینگ‌ویو؛ اگر قطع بود یاهو (کندل‌ها) تنها می‌ماند
    const tvQuotes = await fetchTradingViewQuotes(Object.values(TV_ASSET_OVERRIDES)).catch(
      () => ({}) as Record<string, TvQuote>
    )

    const yahooJobs = YAHOO_ASSETS.map(async (a) => {
      try {
        const q = await fetchYahoo(a.symbol)
        const tvSym = TV_ASSET_OVERRIDES[a.symbol]
        const tv = tvSym ? tvQuotes[tvSym] : undefined
        if (tv) {
          q.price = tv.price
          q.change1d = tv.changePct
        }
        // آخرین نقطه اسپارک‌لاین باید دقیقاً برابر قیمت نمایش‌داده‌شده باشد
        const closes = [...q.closes]
        if (closes.length) closes[closes.length - 1] = q.price
        await saveQuote(a, { ...q, closes })
        saved++
      } catch {
        // رد شدن یک دارایی مشکلی ایجاد نمی‌کند
      }
    })

    const cryptoJobs = CRYPTO_ASSETS.map(async (a) => {
      try {
        const q = await fetchBinance(a.symbol)
        const tvSym = TV_ASSET_OVERRIDES[a.symbol]
        const tv = tvSym ? tvQuotes[tvSym] : undefined
        if (tv) {
          q.price = tv.price
          q.change1d = tv.changePct
        }
        await saveQuote(a, q)
        saved++
      } catch {
        // ignore
      }
    })

    const globalJob = (async () => {
      try {
        const g = await fetchGlobalCrypto()
        await db.macroMetric.upsert({
          where: { key: 'total_mcap' },
          create: { key: 'total_mcap', value: g.totalMcap, label: 'مارکت‌کپ کل کریپتو' },
          update: { value: g.totalMcap, label: 'مارکت‌کپ کل کریپتو' },
        })
        await db.macroMetric.upsert({
          where: { key: 'btc_dominance' },
          create: { key: 'btc_dominance', value: g.btcDominance, label: 'دامیننس بیت‌کوین' },
          update: { value: g.btcDominance, label: 'دامیننس بیت‌کوین' },
        })
        saved++
      } catch {
        // ignore
      }
    })()

    const fngJob = (async () => {
      try {
        const f = await fetchFearGreed()
        await db.macroMetric.upsert({
          where: { key: 'fear_greed' },
          create: {
            key: 'fear_greed',
            value: f.value,
            label: `ترس و طمع: ${f.label}`,
            extra: JSON.stringify({ label: f.label, history: f.history }),
          },
          update: {
            value: f.value,
            label: `ترس و طمع: ${f.label}`,
            extra: JSON.stringify({ label: f.label, history: f.history }),
          },
        })
        saved++
      } catch {
        // ignore
      }
    })()

    await Promise.allSettled([...yahooJobs, ...cryptoJobs, globalJob, fngJob])
    return { items: saved }
  })
}

// ─── تیک سریع بازار (هر ۳۰ ثانیه): فقط قیمت لحظه‌ای از یک درخواست دسته‌ای تریدینگ‌ویو ───
// اسپارک‌لاین و تغییرات هفته/ماه در اجرای کامل بات بروز می‌شوند
export async function runMarketFastQuotes(): Promise<{ items: number }> {
  const tv = await fetchTradingViewQuotes(Object.values(TV_ASSET_OVERRIDES)).catch(
    () => ({}) as Record<string, TvQuote>
  )
  const all: Array<{ symbol: string; name: string; category: string; unit?: string }> = [
    ...YAHOO_ASSETS,
    ...CRYPTO_ASSETS.map((c) => ({ ...c, unit: '$' })),
  ]
  let saved = 0
  for (const a of all) {
    const tvSym = TV_ASSET_OVERRIDES[a.symbol]
    const q = tvSym ? tv[tvSym] : undefined
    if (!q) continue
    try {
      await db.assetSnapshot.upsert({
        where: { symbol: a.symbol },
        create: {
          symbol: a.symbol,
          name: a.name,
          category: a.category,
          unit: a.unit ?? '$',
          price: q.price,
          change1d: q.changePct,
          change7d: q.changePct,
          change30d: q.changePct,
          spark: JSON.stringify([Math.round(q.price * 100) / 100]),
        },
        update: {
          price: q.price,
          change1d: q.changePct,
        },
      })
      saved++
    } catch {
      // رد شود
    }
  }
  return { items: saved }
}

// ─── بات ۳: پروازگیر — هواپیماهای نظامی آمریکا در منطقه ───
export async function runFlightBot(): Promise<{ items: number }> {
  return logBot('flight', async () => {
    const { aircraft, sourceApi } = await fetchMilitaryFlights()
    const counts = { tankers: 0, transport: 0, fighters: 0, recon: 0, bombers: 0, other: 0 }
    let nearIran = 0
    let nearestKm: number | null = null
    for (const a of aircraft) {
      if (a.category === 'tanker') counts.tankers++
      else if (a.category === 'transport') counts.transport++
      else if (a.category === 'fighter') counts.fighters++
      else if (a.category === 'recon') counts.recon++
      else if (a.category === 'bomber') counts.bombers++
      else counts.other++
      if (a.kmToIran <= 900) nearIran++
      if (nearestKm === null || a.kmToIran < nearestKm) nearestKm = a.kmToIran
    }
    // اهمیت برای ریسک جنگ: سوخت‌رسان و شناسایی قوی‌ترین سیگنال‌های آماده‌سازی هستند
    let base =
      counts.tankers * 12 + counts.transport * 7 + counts.fighters * 5 +
      counts.recon * 10 + counts.bombers * 22
    const prox =
      nearestKm === null ? 0.8 : nearestKm <= 500 ? 1.35 : nearestKm <= 900 ? 1.15 : nearestKm <= 1500 ? 0.95 : 0.8
    let significance = Math.round(base * prox + (nearIran > 0 ? 8 : 0))
    significance = Math.max(0, Math.min(100, significance))

    const top = aircraft
      .sort((a, b) => a.kmToIran - b.kmToIran)
      .slice(0, 40)
      .map((a) => ({
        callsign: a.callsign,
        type: a.type,
        category: a.category,
        lat: Math.round(a.lat * 1000) / 1000,
        lon: Math.round(a.lon * 1000) / 1000,
        altFt: a.altFt,
        kmToIran: a.kmToIran,
      }))

    await db.flightSnapshot.create({
      data: {
        total: aircraft.length,
        ...counts,
        nearIran,
        nearestKm,
        significance,
        details: JSON.stringify(top),
        sourceApi,
      },
    })
    // نگهداری ۲۰۰ لحظه‌نگاشت آخر
    const old = await db.flightSnapshot.findMany({
      orderBy: { createdAt: 'desc' },
      skip: 200,
      take: 500,
      select: { id: true },
    })
    if (old.length) {
      await db.flightSnapshot.deleteMany({ where: { id: { in: old.map((o) => o.id) } } })
    }
    return {
      items: aircraft.length,
      message: `${aircraft.length} هواپیمای نظامی در منطقه، ${nearIran} نزدیک ایران (نزدیک‌ترین: ${nearestKm ?? '-'} کیلومتر)`,
    }
  })
}

// ─── یادگیری از اشتباهات: ارزیابی پیش‌بینی‌های گذشته ───
// تشخیص «روز تشدید»: تنش خبری بالا یا سیگنال جنگی زیاد یا تحرک پروازی مهم
async function escalationOnDate(date: string): Promise<boolean> {
  const dayStart = new Date(`${date}T00:00:00Z`)
  const dayEnd = addDays(dayStart, 1)
  const [highNews, warSignals, bigFlight] = await Promise.all([
    db.newsItem.count({
      where: {
        publishedAt: { gte: dayStart, lt: dayEnd },
        tensionScore: { gte: 65 },
        isAd: false,
        isOpinion: false,
      },
    }),
    db.newsItem.count({
      where: {
        publishedAt: { gte: dayStart, lt: dayEnd },
        aiVerdict: 'war_signal',
        isAd: false,
        isOpinion: false,
      },
    }),
    db.flightSnapshot.findFirst({
      where: { createdAt: { gte: dayStart, lt: dayEnd }, significance: { gte: 70 } },
      select: { id: true },
    }),
  ])
  return highNews >= 8 || warSignals >= 4 || Boolean(bigFlight)
}

function mistakeNoteFa(row: {
  score: number
  newsScore: number
  marketScore: number
  cycleScore: number
  flightScore: number
}): string {
  const parts: Array<[string, number]> = [
    ['خبری', row.newsScore],
    ['بازار', row.marketScore],
    ['چرخه', row.cycleScore],
    ['پرواز', row.flightScore],
  ]
  parts.sort((a, b) => b[1] - a[1])
  const top = parts[0]
  const lessons: Record<string, string> = {
    خبری: 'تنش خبری بالا (احتمالاً از تبلیغ/نظر/اغراق کانال‌ها) — وزن منابع کم‌اعتبار را پایین بیاور',
    بازار: 'حرکت بازار (نفت/طلا/سهام) گمراه‌کننده بود — بازار گاهی بدون جنگ هم Risk-Off می‌شود',
    چرخه: 'چرخه‌های گن/هرست هم‌زمانی تصادفی دارند — به‌تنهایی کافی نیست، هم‌پوشانی با خبر/پرواز لازم است',
    پرواز: 'تحرک پروازی معمولی (تدریجی/لجستیکی) با آماده‌سازی حمله اشتباه گرفته شد — به الگوی ناگهانی سوخت‌رسان‌ها دقت کن',
  }
  return `❌ هشدار سطح ${row.score} اثبات نشد | عامل غالب: ${top[0]} (${top[1]}) | درس: ${lessons[top[0]] ?? '-'}`
}

export async function runCalibration(): Promise<{ checked: number }> {
  const today = todayStr()
  const pending = await db.riskDaily.findMany({
    where: { date: { lt: today }, outcome: 'pending' },
  })
  let checked = 0
  for (const row of pending) {
    const ageDays = daysBetween(row.date, today)
    if (ageDays < 1) continue

    // ۱) پیش‌بینی مشخص روز حمله
    if (row.predictedAttackDate) {
      const diff = Math.abs(daysBetween(row.predictedAttackDate, today))
      if (diff <= 14) {
        let hit = false
        for (let off = -1; off <= 1 && !hit; off++) {
          const d = tehranDateStr(addDays(new Date(`${row.predictedAttackDate}T00:00:00Z`), off))
          hit = await escalationOnDate(d)
        }
        await db.riskDaily.update({
          where: { id: row.id },
          data: {
            outcome: hit ? 'hit' : 'miss',
            outcomeNote: hit
              ? `✅ پیش‌بینی روز ${row.predictedAttackDate} تأیید شد — تشدید واقعی رخ داد`
              : `❌ حمله در ${row.predictedAttackDate} رخ نداد | ${mistakeNoteFa(row)}`,
          },
        })
        checked++
        continue
      }
    }
    // ۲) روزهای هشدار بالا بدون پیش‌بینی مشخص
    if (row.score >= 72 && ageDays >= 2) {
      const hit =
        (await escalationOnDate(row.date)) ||
        (await escalationOnDate(tehranDateStr(addDays(new Date(`${row.date}T00:00:00Z`), 1)))) ||
        (await escalationOnDate(tehranDateStr(addDays(new Date(`${row.date}T00:00:00Z`), 2))))
      await db.riskDaily.update({
        where: { id: row.id },
        data: {
          outcome: hit ? 'hit' : 'miss',
          outcomeNote: hit
            ? `✅ هشدار بالا درست بود — در ۴۸ ساعت بعد تشدید رخ داد`
            : mistakeNoteFa(row),
        },
      })
      checked++
    }
  }
  return { checked }
}

// ─── بات ۴: تحلیل‌گر کلان‌روند (چرخه‌ها + ریسک + یادگیری) ───
export async function runMacroBot(): Promise<{ items: number }> {
  return logBot('macro', async () => {
    const cycles = await syncCycles()
    await runCalibration()
    const risk = await computeAndStoreRisk()
    return { items: cycles, message: `ریسک امروز: ${risk.score} (${risk.level})` }
  })
}

// ─── بات ۵: گزارش‌ساز هوش مصنوعی + پیش‌بینی روز حمله ───
export async function runReportBot(force = false): Promise<{ items: number; skipped?: boolean }> {
  return logBot('report', async () => {
    const today = todayStr()
    const latest = await db.report.findFirst({ orderBy: { createdAt: 'desc' } })
    const ageMin = latest ? (Date.now() - latest.createdAt.getTime()) / 60000 : Infinity
    // اگر ریسک جهش کرده (مثلاً ریزش ناگهانی بازار + خبر حرکت جنگنده) گزارش باید فوراً بروز شود
    const currentRiskRow = await db.riskDaily.findUnique({ where: { date: today } })
    const currentScore = currentRiskRow?.score ?? 0
    const riskJumped = latest ? Math.abs(currentScore - latest.riskScore) >= 8 : false
    if (!force && latest && ageMin < 20 && !riskJumped) {
      return { items: 0, skipped: true, message: `گزارش ${Math.round(ageMin)} دقیقه پیش تولید شده` }
    }

    const [history, hotNews, assets, metrics, cycles, lastFlight, mistakes, warSignalCount, macroPatterns] =
      await Promise.all([
        db.riskDaily.findMany({ orderBy: { date: 'desc' }, take: 7 }),
        db.newsItem.findMany({
          where: {
            publishedAt: { gte: addDays(new Date(), -2) },
            isAd: false,
            isOpinion: false,
            aiVerdict: { not: 'irrelevant' },
          },
          orderBy: { tensionScore: 'desc' },
          take: 12,
          select: {
            title: true,
            textFa: true,
            sourceLabel: true,
            sourceType: true,
            tensionScore: true,
            aiVerdict: true,
            publishedAt: true,
          },
        }),
        db.assetSnapshot.findMany(),
        db.macroMetric.findMany(),
        db.cycle.findMany({ where: { date: { gte: today } }, orderBy: { date: 'asc' }, take: 10 }),
        db.flightSnapshot.findFirst({ orderBy: { createdAt: 'desc' } }),
        db.riskDaily.findMany({
          where: { outcome: { in: ['hit', 'miss'] } },
          orderBy: { date: 'desc' },
          take: 8,
          select: { date: true, outcome: true, outcomeNote: true, score: true },
        }),
        db.newsItem.count({
          where: {
            aiVerdict: 'war_signal',
            isAd: false,
            isOpinion: false,
            publishedAt: { gte: addDays(new Date(), -2) },
          },
        }),
        db.macroPattern.findMany({ orderBy: { similarity: 'desc' }, take: 5 }),
      ])
    // ردیف ریسک امروز از قبل خوانده شد (برای تشخیص جهش)
    const riskToday = currentRiskRow

    const flightFresh =
      lastFlight && Date.now() - lastFlight.createdAt.getTime() < 90 * 60000 ? lastFlight : null

    const data = {
      تاریخ: tehranDateStr(new Date()),
      ریسک_امروز: riskToday
        ? {
            امتیاز: riskToday.score,
            سطح: riskToday.level,
            روند: riskToday.trend,
            امتیاز_خبری: riskToday.newsScore,
            امتیاز_بازار: riskToday.marketScore,
            امتیاز_چرخه: riskToday.cycleScore,
            امتیاز_پرواز: riskToday.flightScore,
            پیش‌بینی_قبلی_روز_حمله: riskToday.predictedAttackDate,
          }
        : 'محاسبه نشده',
      روند_۷روز: history.map((h) => ({ تاریخ: h.date, امتیاز: h.score, نتیجه: h.outcome })),
      سیگنال‌های_جنگی_۴۸ساعت: warSignalCount,
      اخبار_داغ: hotNews.map((n) => ({
        متن: (n.textFa ?? n.title).slice(0, 150),
        منبع: `${n.sourceLabel} (${n.sourceType})`,
        حکم: n.aiVerdict,
        تنش: n.tensionScore,
      })),
      بازار: assets.map((a) => ({
        دارایی: a.name,
        قیمت: a.price,
        تغییر_روز: Math.round((a.change1d ?? 0) * 100) / 100,
        تغییر_هفته: Math.round((a.change7d ?? 0) * 100) / 100,
      })),
      سنجه‌ها: metrics.map((m) => ({ کلید: m.key, مقدار: Math.round(m.value * 100) / 100 })),
      پروازهای_نظامی: flightFresh
        ? {
            کل_منطقه: flightFresh.total,
            سوخت‌رسان: flightFresh.tankers,
            ترابری: flightFresh.transport,
            جنگنده: flightFresh.fighters,
            شناسایی: flightFresh.recon,
            بمب‌افکن: flightFresh.bombers,
            نزدیک_ایران: flightFresh.nearIran,
            نزدیک‌ترین_کیلومتر: flightFresh.nearestKm,
            اهمیت: flightFresh.significance,
          }
        : 'داده تازه موجود نیست',
      چرخه‌های_پیش_رو: cycles.map((c) => ({
        تاریخ: c.date,
        روز_باقی‌مانده: daysBetween(today, c.date),
        عنوان: c.label,
        خانواده: c.family,
        شدت: c.weight,
      })),
      // الگوهای کلان: تطبیق رفتار امروز بازار با امضای پیش از بحران‌های تاریخی — الزام کاربر
      الگوهای_کلان_تاریخی: {
        امتیاز_الگو: riskToday?.patternScore ?? 0,
        تطبیق‌ها: macroPatterns.map((p) => ({
          رویداد: p.eventName,
          سال: p.eventName.match(/\d{4}/)?.[0] ?? '',
          شباهت_درصد: Math.round(p.similarity),
          پیشنهاد_ریسک: Math.round(p.score),
          پنجره_رویداد_روز: `${p.windowLo} تا ${p.windowHi}`,
          توضیح: p.note,
        })),
        امضای_امروز: (riskToday?.detail
          ? (JSON.parse(riskToday.detail) as { pattern?: { current?: unknown; regimeNotesFa?: string[] } }).pattern
          : null) ?? null,
      },
      // یادگیری از اشتباهات گذشته — الزام کاربر
      درس‌های_پیش‌بینی‌های_قبلی: mistakes.map((m) => ({
        تاریخ: m.date,
        نتیجه: m.outcome,
        امتیاز_آن_روز: m.score,
        درس: m.outcomeNote?.slice(0, 220) ?? '',
      })),
    }

    const raw = await aiChatCompletion({
      messages: [
        {
          role: 'assistant',
          content:
            'تو تحلیلگر ارشد ژئوپلیتیک و بازارهای مالی سامانه پایش ریسک جنگ ایران/اسرائیل/آمریکا هستی. داده‌های چند منبعی (خبر، بازار، پروازهای نظامی آمریکا، چرخه‌های زمانی، الگوهای کلان تاریخی) به تو داده می‌شود. وظایف: (1) گزارش فارسی مختصر و مبتنی بر داده بنویس (بدون حدس خارج از داده، با ساختار مارک‌داون ##). (2) بر اساس هم‌زمانی سه سیگنال — Risk-Off بازار (نفت/طلا بالا، سهام/بیت‌کوین پایین)، اخبار منفی حمله، و تحرک سوخت‌رسان/جنگنده آمریکا نزدیک ایران + پنجره‌های چرخه‌ای — چهار سناریوی زمانی حمله در ۱۴ روز آینده بده: «nearestAttackDate» نزدیک‌ترین روز ممکن (اگر تشدید ناگهانی رخ دهد)، «medianAttackDate» میانه پنجره محتمل، «farthestAttackDate» دورترین روز محتمل، و «predictedAttackDate» محتمل‌ترین روز طبق قضاوت تو. همه با قالب YYYY-MM-DD؛ اگر شواهد کافی نیست null بده و اطمینان پایین. (3) «الگوهای کلان تاریخی» را جدی بگیر: رفتار امروز بازار (نفت/طلا/سهام/VIX/بیت‌کوین) را با امضای پیش از بحران‌های تاریخی (مثل جنگ خلیج فارس ۱۹۹۰، اوکراین ۲۰۲۲، جنگ ۱۲روزه ۲۰۲۵) مقایسه کن؛ اگر شباهت بالاست، هم در گزارش بخش «روند کلان و پیش‌بینی الگویی» بنویس و هم پنجره زمانی (X تا Y روز) را در انتخاب سناریوهای زمانی لحاظ کن — پنجره تاریخی باید تقریباً با فاصله نزدیک تا دورتر منطبق شود. (4) از درس‌های پیش‌بینی‌های قبلی (اشتباهات) پند بگیر و الگوی اشتباه را تکرار نکن؛ نمونه منفی (مثل دریای سرخ ۲۰۲۴ که به جنگ بزرگ نرسید) را برای تردید منطقی به‌کار ببر. (5) اگر خبر خارجی مهمی هست معنی دقیقش را در تحلیل بیاور. در پایان گزارش بنویس که تحلیل «احتمالاتی» است نه قطعی. خروجی فقط و فقط JSON این ساختار باشد: {"reportFa": "متن مارک‌داون گزارش", "nearestAttackDate": "YYYY-MM-DD یا null", "medianAttackDate": "YYYY-MM-DD یا null", "farthestAttackDate": "YYYY-MM-DD یا null", "predictedAttackDate": "YYYY-MM-DD یا null", "attackConfidence": 0..100, "rationaleFa": "توضیح کوتاه پیش‌بینی و چهار سناریو"}',
        },
        {
          role: 'user',
          content: `داده‌های امروز:\n${JSON.stringify(data, null, 1)}\n\nگزارش با بخش‌های: خلاصه وضعیت / تحلیل خبری / بازار و Risk-Off / روند کلان و پیش‌بینی الگویی / پروازهای نظامی / چرخه‌های زمانی / پیش‌بینی روز محتمل حمله / توصیه‌های پایش. حداکثر ۵۰۰ کلمه. فقط JSON بده.`,
        },
      ],
    })

    const parsed = parseJsonLoose<{
      reportFa?: string
      nearestAttackDate?: string | null
      medianAttackDate?: string | null
      farthestAttackDate?: string | null
      predictedAttackDate?: string | null
      attackConfidence?: number
      rationaleFa?: string
    }>(raw)
    const content = parsed?.reportFa?.trim() || raw.trim()
    if (!content) throw new Error('پاسخ خالی از مدل')

    // اعتبارسنجی تاریخ‌ها: همه باید در ۱۴ روز آینده باشند
    const validDate = (v: string | null | undefined): string | null => {
      if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
      const diff = daysBetween(today, v)
      return diff >= 0 && diff <= 14 ? v : null
    }
    const predicted = validDate(parsed?.predictedAttackDate)
    const nearDate = validDate(parsed?.nearestAttackDate)
    const midDate = validDate(parsed?.medianAttackDate)
    const farDate = validDate(parsed?.farthestAttackDate)
    const confidence = Math.max(0, Math.min(100, Math.round(parsed?.attackConfidence ?? 0)))
    const rationale = (parsed?.rationaleFa ?? '').slice(0, 600)

    const usedModel = 'glm-4.6'
    await db.report.create({
      data: { content, riskScore: riskToday?.score ?? 0, model: usedModel },
    })
    await db.riskDaily.updateMany({
      where: { date: today },
      data: {
        predictedAttackDate: predicted,
        attackDateNear: nearDate,
        attackDateMid: midDate,
        attackDateFar: farDate,
        attackConfidence: confidence,
        rationaleFa: rationale,
      },
    })
    // نگهداری ۲۰ گزارش آخر
    const old = await db.report.findMany({
      orderBy: { createdAt: 'desc' },
      skip: 20,
      take: 100,
      select: { id: true },
    })
    if (old.length) {
      await db.report.deleteMany({ where: { id: { in: old.map((o) => o.id) } } })
    }
    return {
      items: 1,
      message: `گزارش با ${usedModel}${predicted ? ` | محتمل‌ترین: ${predicted} (${confidence}%)` : ''}${nearDate ? ` | نزدیک: ${nearDate}` : ''}${farDate ? ` | دور: ${farDate}` : ''}`,
    }
  })
}

// ─── اجرای همه بات‌ها به ترتیب درست ───
export interface RunSummary {
  bot: string
  ok: boolean
  items?: number
  message?: string
  error?: string
  ms: number
}

export async function runAllBots(force = false): Promise<RunSummary[]> {
  await seedIfEmpty()
  const out: RunSummary[] = []

  // مرحله ۱: خبرگیر + بازارگیر + پروازگیر موازی
  const t1 = Date.now()
  const [newsRes, marketRes, flightRes] = await Promise.allSettled([
    (async () => {
      const r = await runNewsBot()
      try {
        await enrichNewsWithAi() // ترجمه فارسی + حکم هوش مصنوعی + فیلتر تبلیغ/نامرتبط
        // تضمین ترجمه: باقی‌مانده اخبار غیرفارسی بدون ترجمه — انگلیسی/عربی/چینی/فرانسوی و...
        await translatePendingNews()
      } catch {
        // تحلیل هوش مصنوعی اختیاری است — خطا مسیر اصلی را نمی‌شکند
      }
      return r
    })(),
    runMarketBot(),
    runFlightBot(),
  ])
  out.push(
    newsRes.status === 'fulfilled'
      ? { bot: 'news', ok: true, ...newsRes.value, ms: Date.now() - t1 }
      : { bot: 'news', ok: false, error: String(newsRes.reason), ms: Date.now() - t1 }
  )
  out.push(
    marketRes.status === 'fulfilled'
      ? { bot: 'market', ok: true, ...marketRes.value, ms: Date.now() - t1 }
      : { bot: 'market', ok: false, error: String(marketRes.reason), ms: Date.now() - t1 }
  )
  out.push(
    flightRes.status === 'fulfilled'
      ? { bot: 'flight', ok: true, ...flightRes.value, ms: Date.now() - t1 }
      : { bot: 'flight', ok: false, error: String(flightRes.reason), ms: Date.now() - t1 }
  )

  // مرحله ۲: تحلیل کلان‌روند (به داده مراحل ۱ نیاز دارد)
  try {
    const r = await runMacroBot()
    out.push({ bot: 'macro', ok: true, ...r, ms: 0 })
  } catch (e) {
    out.push({ bot: 'macro', ok: false, error: String(e), ms: 0 })
  }

  // مرحله ۳: گزارش‌ساز هوش مصنوعی
  try {
    const r = await runReportBot(force)
    out.push({ bot: 'report', ok: true, ...r, ms: 0 })
  } catch (e) {
    out.push({ bot: 'report', ok: false, error: String(e), ms: 0 })
  }

  return out
}
