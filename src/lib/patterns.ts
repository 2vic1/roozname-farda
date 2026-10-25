// ─── موتور الگوهای کلان: تطبیق رفتار فعلی بازار با امضای پیش از بحران‌های تاریخی ───
// منطق درخواست کاربر: مثلا وقتی بازار سهام به‌شدت می‌ریزد و نفت به‌شدت بالا می‌رود،
// بر اساس رفتار گذشته، احتمال اتفاق بزرگ (مثل جنگ) بالاست. این موتور همان را الگوریتمی می‌کند:
// امضای چندروزه/چندماهه امروز (نفت، طلا، سهام، VIX، دلار، بیت‌کوین) با امضای بازار
// در هفته‌ها قبل از بحران‌های تاریخی مقایسه می‌شود و امتیاز + پنجره زمانی برمی‌گرداند.

import { db } from '@/lib/db'

export interface AnalogEvent {
  key: string
  name: string // نام فارسی
  year: number
  /** امضای بازار در هفته/ماه منتهی به رویداد (درصد تغییر) */
  sig: {
    oil7d: number
    oil30d: number
    gold30d: number
    spx30d: number
    vix: number
    btc30d: number | null // قبل از ۲۰۱۰ بیت‌کوین نبود → null یعنی مقایسه نشود
  }
  /** بازه فاصله روز از این امضا تا رویداد در آن مقطع تاریخی */
  daysToEvent: [number, number]
  /** شدت نهایی بحران 0-100 */
  severity: number
  /** توضیح فارسی الگو */
  note: string
}

// امضاهای تاریخی مرجع (تغییرات تقریبی و مستند بازار پیش از رویداد)
export const ANALOGS: AnalogEvent[] = [
  {
    key: 'gulf1990',
    name: 'تهاجم عراق به کویت → جنگ خلیج فارس',
    year: 1990,
    sig: { oil7d: 8, oil30d: 35, gold30d: 5, spx30d: -8, vix: 20, btc30d: null },
    daysToEvent: [10, 35],
    severity: 90,
    note: 'در دو ماه پیش از تهاجم، نفت حدود ۳۵٪ بالا رفت، سهام آمریکا ریخت و طلا ملایم صعودی بود.',
  },
  {
    key: 'iran1979',
    name: 'انقلاب ایران و بحران نفت',
    year: 1979,
    sig: { oil7d: 6, oil30d: 25, gold30d: 30, spx30d: -6, vix: 18, btc30d: null },
    daysToEvent: [14, 45],
    severity: 85,
    note: 'همزمانی جهش نفت و طلا با افت سهام — کلاسیک‌ترین امضای بحران ژئوپلیتیک.',
  },
  {
    key: 'iraq2003',
    name: 'حمله آمریکا به عراق',
    year: 2003,
    sig: { oil7d: 5, oil30d: 20, gold30d: 10, spx30d: -9, vix: 22, btc30d: null },
    daysToEvent: [20, 60],
    severity: 75,
    note: 'قیمت‌گذاری تدریجی احتمال جنگ؛ بعد از شروع حمله، نفت و طلا سقوط کردند (sell the fact).',
  },
  {
    key: 'ukraine2022',
    name: 'حمله روسیه به اوکراین',
    year: 2022,
    sig: { oil7d: 9, oil30d: 30, gold30d: 8, spx30d: -10, vix: 25, btc30d: -20 },
    daysToEvent: [15, 40],
    severity: 80,
    note: 'نفت و انرژی جهش، سهام ریزش، بیت‌کوین هم‌گام با ریسک‌آفرینی سقوط کرد.',
  },
  {
    key: 'israelIran2025',
    name: 'جنگ ۱۲روزه ایران و اسرائیل',
    year: 2025,
    sig: { oil7d: 7, oil30d: 18, gold30d: 6, spx30d: -3, vix: 20, btc30d: -5 },
    daysToEvent: [3, 15],
    severity: 85,
    note: 'امضای نزدیک: جهش نفت در هفته‌های پایانی، افت ملایم سهام؛ بازار همان اول صبح حمله واقعیت را قیمت‌گذاری کرد.',
  },
  {
    key: 'redSea2024',
    name: 'بحران دریای سرخ (بدون جنگ بزرگ)',
    year: 2024,
    sig: { oil7d: 3, oil30d: 12, gold30d: 3, spx30d: 2, vix: 15, btc30d: 5 },
    daysToEvent: [10, 30],
    severity: 35,
    note: 'نمونه منفی/کنترل: تنش منطقه‌ای نفت را بالا برد ولی سهام محکم ماند و جنگ بزرگ رخ نداد — هشدار مثبت کاذب.',
  },
  {
    key: 'abqaiq2019',
    name: 'حمله به ابقایق (شوک تک‌روزه)',
    year: 2019,
    sig: { oil7d: 10, oil30d: 5, gold30d: 2, spx30d: -2, vix: 17, btc30d: 0 },
    daysToEvent: [1, 7],
    severity: 50,
    note: 'جهش ناگهانی نفت در چند روز — یا شوک حمله است یا در آستانه آن؛ پنجره بسیار کوتاه.',
  },
]

export interface PatternMatch {
  eventKey: string
  eventName: string
  year: number
  similarity: number // 0-100
  score: number // پیشنهاد ریسک بر اساس شدت آن رویداد
  windowLo: number
  windowHi: number
  note: string
}

export interface PatternResult {
  score: number // امتیاز کلان 0-100
  bestSimilarity: number
  window: [number, number] | null
  matches: PatternMatch[]
  current: {
    oil7d: number
    oil30d: number
    gold30d: number
    spx30d: number
    vix: number
    btc30d: number
  }
  regimeNotesFa: string[]
}

interface AssetLite {
  symbol: string
  price: number
  change1d: number
  change7d: number
  change30d: number
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

/** استخراج امضای فعلی بازار از اسنپ‌شات‌ها */
export function currentSignature(
  assets: AssetLite[],
  vixFallback = 15
): PatternResult['current'] {
  const by = new Map(assets.map((a) => [a.symbol, a]))
  const oil = ['CL=F', 'BZ=F'].map((s) => by.get(s)).filter(Boolean) as AssetLite[]
  const oil7 = oil.length ? Math.max(...oil.map((a) => a.change7d ?? 0)) : 0
  const oil30 = oil.length ? Math.max(...oil.map((a) => a.change30d ?? 0)) : 0
  const gold30 = by.get('GC=F')?.change30d ?? 0
  const equities = ['^GSPC', '^IXIC'].map((s) => by.get(s)).filter(Boolean) as AssetLite[]
  const spx30 = equities.length
    ? Math.min(...equities.map((a) => a.change30d ?? 0))
    : 0
  const vix = by.get('^VIX')?.price ?? vixFallback
  const btc30 = by.get('BTCUSDT')?.change30d ?? 0
  return { oil7d: oil7, oil30d: oil30, gold30d: gold30, spx30d: spx30, vix, btc30d: btc30 }
}

// وزن و مقیاس نرمال‌سازی هر ویژگی در مقایسه امضاها
const FEATS: Array<{
  k: keyof PatternResult['current']
  w: number
  scale: number
}> = [
  { k: 'oil30d', w: 0.28, scale: 25 },
  { k: 'oil7d', w: 0.17, scale: 10 },
  { k: 'spx30d', w: 0.2, scale: 12 },
  { k: 'gold30d', w: 0.15, scale: 15 },
  { k: 'vix', w: 0.12, scale: 15 },
  { k: 'btc30d', w: 0.08, scale: 25 },
]

function similarity(cur: PatternResult['current'], a: AnalogEvent): number {
  let wsum = 0
  let dist = 0
  for (const f of FEATS) {
    const av = a.sig[f.k]
    if (av === null || av === undefined) continue // مثلا بیت‌کوین در ۱۹۹۰ وجود نداشت
    const cv = cur[f.k]
    dist += f.w * Math.abs(cv - av) / f.scale
    wsum += f.w
  }
  if (!wsum) return 0
  return clamp(Math.round(100 * Math.exp(-dist / wsum)))
}

/** محاسبه کامل الگوی کلان از روی داده‌های بازار */
export function computeMacroPattern(
  assets: AssetLite[],
  vixFallback = 15
): PatternResult {
  const cur = currentSignature(assets, vixFallback)
  const matches: PatternMatch[] = ANALOGS.map((a) => {
    const sim = similarity(cur, a)
    return {
      eventKey: a.key,
      eventName: a.name,
      year: a.year,
      similarity: sim,
      score: Math.round((sim / 100) ** 1.5 * a.severity),
      windowLo: a.daysToEvent[0],
      windowHi: a.daysToEvent[1],
      note: a.note,
    }
  }).sort((x, y) => y.similarity - x.similarity)

  const strong = matches.filter((m) => m.similarity >= 30)

  // میانگین وزنی شدت بحران‌های مشابه (وزن = شباهت)
  let score = 0
  if (strong.length) {
    const wsum = strong.reduce((s, m) => s + m.similarity, 0)
    score = strong.reduce((s, m) => s + m.score * m.similarity, 0) / wsum
    // ضرر ضعیف‌سازی اگر بهترین تطبیق هم متوسط باشد
    score *= Math.sqrt(matches[0].similarity / 100)
  }

  // قانون‌های مستقیم رژیم «پیش از جنگ» — همان منطق گفتاری کاربر
  const notes: string[] = []
  let regimeBonus = 0
  if (cur.oil30d > 15 && cur.spx30d < -7) {
    regimeBonus += 12
    notes.push('ترکیب جهش نفت یک‌ماهه + ریزش یک‌ماهه سهام — الگوی کلاسیک قبل از بحران بزرگ')
  }
  if (cur.oil7d > 6 && cur.vix >= 20) {
    regimeBonus += 8
    notes.push('جهش شتاب‌دار نفت در یک هفته اخیر همراه با VIX بالای ۲۰ — بازار در حال قیمت‌گذاری خطر است')
  }
  if (cur.gold30d > 12 && cur.oil30d > 10 && cur.spx30d < 0) {
    regimeBonus += 8
    notes.push('صعود هم‌زمان طلا و نفت با سهام منفی — پناه‌گیری کلاسیک از ریسک جنگ')
  }
  if (cur.spx30d < -10 && cur.oil30d < 0 && cur.gold30d < 3) {
    notes.push('ریزش سهام بدون حمایت نفت/طلا — شباهت بیشتر به رکود اقتصادی تا جنگ؛ الگوی جنگی ضعیف است')
  }

  score = clamp(Math.round(score + regimeBonus))

  // پنجره زمانی: میانگین وزنی بازه رویدادهای مشابه (شباهت ≥ ۴۰)
  let window: [number, number] | null = null
  const winMatches = matches.filter((m) => m.similarity >= 40)
  if (winMatches.length) {
    const wsum = winMatches.reduce((s, m) => s + m.similarity, 0)
    const lo = Math.round(winMatches.reduce((s, m) => s + m.windowLo * m.similarity, 0) / wsum)
    const hi = Math.round(winMatches.reduce((s, m) => s + m.windowHi * m.similarity, 0) / wsum)
    window = [Math.max(1, lo), Math.max(hi, lo + 2)]
  }

  return {
    score,
    bestSimilarity: matches[0]?.similarity ?? 0,
    window,
    matches: matches.slice(0, 5),
    current: cur,
    regimeNotesFa: notes,
  }
}

/** ذخیره الگوهای امروزشده در DB (برای داشبورد و گزارش AI) */
export async function storeMacroPatterns(assets: AssetLite[], vixFallback = 15): Promise<PatternResult> {
  const res = computeMacroPattern(assets, vixFallback)
  for (const m of res.matches) {
    await db.macroPattern.upsert({
      where: { eventKey: m.eventKey },
      create: {
        eventKey: m.eventKey,
        eventName: m.eventName,
        similarity: m.similarity,
        score: m.score,
        windowLo: m.windowLo,
        windowHi: m.windowHi,
        note: m.note,
      },
      update: {
        eventName: m.eventName,
        similarity: m.similarity,
        score: m.score,
        windowLo: m.windowLo,
        windowHi: m.windowHi,
        note: m.note,
      },
    })
  }
  return res
}
