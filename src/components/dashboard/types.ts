// ─── تایپ‌های مشترک داشبورد روزنامه فردا ───

export type Level = 'calm' | 'watch' | 'elevated' | 'high' | 'critical'
export type Verdict = 'war_signal' | 'tension' | 'diplomacy' | 'routine' | 'irrelevant' | 'unknown'
export type Outcome = 'pending' | 'hit' | 'miss' | 'neutral'
export type SourceType = 'telegram' | 'x' | 'instagram' | 'rss'

export interface ForecastPoint {
  date: string
  score: number
  level: string
}

export interface RiskData {
  id: string
  date: string
  score: number
  level: string
  trend: string
  newsScore: number
  marketScore: number
  cycleScore: number
  flightScore: number
  patternScore: number
  predictedAttackDate: string | null
  attackDateNear: string | null
  attackDateMid: string | null
  attackDateFar: string | null
  attackConfidence: number
  rationaleFa: string
  outcome: Outcome
  outcomeNote: string | null
  forecast: ForecastPoint[]
  detail: {
    newsCount48h?: number
    marketParts?: Record<string, number>
    cycleToday?: { score: number; hits: string[] }
    pattern?: {
      score: number
      bestSimilarity: number
      window: [number, number] | null
      current?: {
        oil7d: number
        oil30d: number
        gold30d: number
        spx30d: number
        vix: number
        btc30d: number
      }
      regimeNotesFa?: string[]
      top?: Array<{ eventKey: string; eventName: string; similarity: number; windowLo: number; windowHi: number }>
    }
    nearestCycles?: Array<{ date: string; label: string; weight: number }>
  }
  updatedAt: string
}

export interface HistoryPoint {
  id: string
  date: string
  score: number
  level: string
  trend: string
}

export interface NewsData {
  id: string
  sourceType: SourceType
  sourceLabel: string
  title: string
  textFa: string | null
  aiVerdict: Verdict
  isAd: boolean
  isOpinion: boolean
  url: string | null
  lang: string
  publishedAt: string
  tensionScore: number
  level: string
  keywords: string
}

export interface AssetData {
  id: string
  symbol: string
  name: string
  category: string
  price: number
  change1d: number | null
  change7d: number | null
  change30d: number | null
  unit: string | null
  spark: string
  updatedAt: string
}

export interface MetricData {
  key: string
  value: number
  label: string
  extra: { label?: string; history?: number[] }
  updatedAt: string
}

export interface CycleData {
  id: string
  date: string
  label: string
  family: string
  weight: number
  note: string | null
  daysLeft: number
}

export interface FlightDetail {
  callsign: string
  type: string
  category: string
  lat: number
  lon: number
  altFt: number | null
  kmToIran: number
}

export interface FlightData {
  id: string
  createdAt: string
  total: number
  tankers: number
  transport: number
  fighters: number
  recon: number
  bombers: number
  other: number
  nearIran: number
  nearestKm: number | null
  significance: number
  details: FlightDetail[]
}

export interface AccuracyData {
  total: number
  hit: number
  miss: number
  pending: number
  hitRate: number
  lastMistakes: Array<{ date: string; note: string; outcome: string }>
}

export interface ReportData {
  id: string
  content: string
  riskScore: number
  model: string
  createdAt: string
}

export interface BotRunData {
  id: string
  bot: string
  status: string
  message: string | null
  items: number
  durationMs: number
  createdAt: string
}

export interface SourceData {
  id: string
  type: string
  handle: string
  label: string
  lang: string
  weight: number
  storiesOnly: boolean
  active: boolean
}

export interface RefEventData {
  id: string
  name: string
  startDate: string
  endDate: string
  note: string | null
}

// ─── الگوهای کلان: تطبیق با امضای پیش از بحران‌های تاریخی ───
export interface PatternData {
  eventKey: string
  eventName: string
  similarity: number
  score: number
  windowLo: number
  windowHi: number
  note: string
  updatedAt: string
}

export interface DashboardData {
  ok: boolean
  today: string
  serverTime: string
  risk: RiskData | null
  history: HistoryPoint[]
  news: NewsData[]
  hotNews: NewsData[]
  assets: AssetData[]
  metrics: MetricData[]
  cycles: CycleData[]
  flights: FlightData | null
  aiAccuracy: AccuracyData
  report: ReportData | null
  botRuns: BotRunData[]
  sources: SourceData[]
  refEvents: RefEventData[]
  patterns: PatternData[]
  warAstro?: {
    index: number
    note: string
    parts?: { label: string; value: number; share: number }[]
  } | null
}

// ─── متادیتای سطوح هشدار ───
export const LEVEL_META: Record<
  Level,
  { fa: string; color: string; chip: string; bar: string }
> = {
  calm: {
    fa: 'آرام',
    color: '#10b981',
    chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
    bar: 'bg-emerald-500',
  },
  watch: {
    fa: 'پایش',
    color: '#eab308',
    chip: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
    bar: 'bg-yellow-500',
  },
  elevated: {
    fa: 'هشدار',
    color: '#f97316',
    chip: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
    bar: 'bg-orange-500',
  },
  high: {
    fa: 'بحرانی',
    color: '#ef4444',
    chip: 'bg-red-500/15 text-red-400 border-red-500/40',
    bar: 'bg-red-500',
  },
  critical: {
    fa: 'فوری',
    color: '#dc2626',
    chip: 'bg-red-600/20 text-red-300 border-red-600/50',
    bar: 'bg-red-600',
  },
}

export function levelMeta(level: string) {
  return LEVEL_META[(level as Level) in LEVEL_META ? (level as Level) : 'watch']
}

// ─── متادیتای حکم هوش مصنوعی درباره هر خبر ───
export const VERDICT_META: Record<
  Verdict,
  { fa: string; chip: string; color: string }
> = {
  war_signal: {
    fa: 'سیگنال جنگی',
    chip: 'bg-red-500/15 text-red-400 border-red-500/40',
    color: '#ef4444',
  },
  tension: {
    fa: 'تنش',
    chip: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
    color: '#f97316',
  },
  diplomacy: {
    fa: 'دیپلماتیک',
    chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
    color: '#10b981',
  },
  routine: {
    fa: 'عادی',
    chip: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40',
    color: '#a1a1aa',
  },
  irrelevant: {
    fa: 'نامرتبط',
    chip: 'bg-red-950/40 text-red-400/70 border-red-900/40',
    color: '#7f1d1d',
  },
  unknown: {
    fa: 'در صف تحلیل',
    chip: 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60',
    color: '#71717a',
  },
}

export function verdictMeta(v: string) {
  return VERDICT_META[(v as Verdict) in VERDICT_META ? (v as Verdict) : 'unknown']
}

// ─── نام فارسی زبان خبر (برای نشان زبان در فید) ───
export const LANG_FA: Record<string, string> = {
  fa: 'فارسی',
  en: 'انگلیسی',
  ar: 'عربی',
  fr: 'فرانسوی',
  he: 'عبری',
  tr: 'ترکی',
  ru: 'روسی',
  es: 'اسپانیایی',
  de: 'آلمانی',
  zh: 'چینی',
  ja: 'ژاپنی',
  ko: 'کره‌ای',
}

export function langFa(lang: string): string {
  return LANG_FA[lang] ?? lang.toUpperCase()
}

// ─── متادیتای بات‌ها ───
export const BOT_META: Record<string, { fa: string; desc: string }> = {
  news: { fa: 'بات خبرگیر', desc: 'تلگرام، ایکس، اینستاگرام و RSS — گردآوری و امتیازدهی تنش' },
  market: { fa: 'بات بازارگیر', desc: 'نفت، طلا، سهام، کریپتو و سنجه‌ها' },
  macro: { fa: 'بات کلان‌روند', desc: 'چرخه‌های زمانی + الگوهای کلان تاریخی + ریسک روزانه' },
  flight: { fa: 'بات پروازگیر', desc: 'رصد هواپیماهای نظامی آمریکا نزدیک ایران' },
  report: { fa: 'بات گزارش‌ساز', desc: 'تحلیل نهایی با هوش مصنوعی' },
}

export function botFa(bot: string) {
  return BOT_META[bot]?.fa ?? bot
}

// ─── متادیتای انواع منبع ───
export const SOURCE_TYPE_FA: Record<string, string> = {
  telegram: 'تلگرام',
  x: 'ایکس',
  instagram: 'اینستاگرام',
  rss: 'وب‌سایت',
}

// ─── متادیتای خانواده چرخه‌ها ───
export const CYCLE_FAMILY_FA: Record<string, string> = {
  gann: 'گن',
  fibonacci: 'فیبوناچی',
  solar: 'فصلی/نجومی',
  event: 'رویداد سیاسی',
  hurst: 'هرست',
  century: 'چرخه صدساله',
}

export const CYCLE_FAMILY_ORDER = ['gann', 'fibonacci', 'solar', 'event', 'hurst', 'century']

// ─── دسته‌بندی بازارها ───
export const CATEGORY_FA: Record<string, string> = {
  energy: 'انرژی',
  metals: 'فلزات گران‌بها',
  crypto: 'کریپتو',
  indices: 'شاخص‌ها و سهام',
  risk: 'سنجه ریسک',
}

// ─── متادیتای نتیجه ارزیابی پیش‌بینی ───
export const OUTCOME_META: Record<Outcome, { fa: string; chip: string }> = {
  pending: { fa: 'در انتظار ارزیابی', chip: 'border-zinc-700 text-zinc-400' },
  hit: { fa: 'پیش‌بینی درست', chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
  miss: { fa: 'پیش‌بینی نادرست', chip: 'border-red-500/40 bg-red-500/10 text-red-400' },
  neutral: { fa: 'خنثی', chip: 'border-zinc-700 text-zinc-500' },
}

export function outcomeMeta(o: string) {
  return OUTCOME_META[(o as Outcome) in OUTCOME_META ? (o as Outcome) : 'pending']
}

// ─── دستیارهای عدد و تاریخ فارسی (سمت کلاینت) ───
export function faNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toLocaleString('fa-IR')
}

const YMD_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}

/** تبدیل YYYY-MM-DD به تاریخ شمسی «۱۴۰۴/۰۵/۱۲» */
export function faDateYMD(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', YMD_OPTS).format(new Date(dateStr + 'T00:00:00Z'))
  } catch {
    return dateStr
  }
}

/** تبدیل YYYY-MM-DD به «۱۲ مرداد» */
export function faDateShort(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'UTC',
      month: 'long',
      day: 'numeric',
    }).format(new Date(dateStr + 'T00:00:00Z'))
  } catch {
    return dateStr
  }
}

/** «۵/۱۲» برای نوارهای پیش‌بینی */
export function faDateMini(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'UTC',
      month: 'numeric',
      day: 'numeric',
    }).format(new Date(dateStr + 'T00:00:00Z'))
  } catch {
    return dateStr
  }
}

/** فاصله روز تا یک تاریخ YYYY-MM-DD */
export function daysUntil(dateStr: string): number {
  try {
    const target = new Date(dateStr + 'T00:00:00Z').getTime()
    const today = new Date()
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    return Math.round((target - todayUtc) / 86400000)
  } catch {
    return 0
  }
}

/** زمان نسبی فارسی */
export function relTimeFa(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  const mins = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000))
  if (mins < 1) return 'همین حالا'
  if (mins < 60) return `${mins.toLocaleString('fa-IR')} دقیقه پیش`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours.toLocaleString('fa-IR')} ساعت پیش`
  const days = Math.floor(hours / 24)
  return `${days.toLocaleString('fa-IR')} روز پیش`
}
