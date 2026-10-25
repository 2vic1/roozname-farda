// ─── موتور پیش‌بینی ۳۰روزه بازار — سه روش + تلفیق ───
// روش ۱: تکنیکال (رگرسیون + مومنتوم + RSI + باند نوسان)
// روش ۲: چرخه‌های بلندمدت (اتوکورلیشن واقعی روی تاریخچه + لنگرهای سیکلی شناخته‌شده)
// روش ۳: استرولوژی مالی (چارت تولد دارایی + ترانزیت‌های روزانه + اطوار ماه + ایستگاه‌ها)
// روش ۴: تلفیق وزنی هر سه — با سنجش هم‌راستایی
// همه مسیرها: قیمت روزانه مشخص + تاریخ مشخص (قابل دقت‌سنجی بعدی)
import * as A from 'astronomy-engine'
import { eclLon, PLANET_FA, ASPECT_FA } from './natal'
import { tehranDateStr } from './tehran'
import {
  fetchYahooSeries,
  fetchBinanceSeries,
  type SeriesPoint,
} from './fetchers'

const DAY_MS = 86400000
const norm360 = (x: number) => ((x % 360) + 360) % 360
function norm180(x: number): number {
  let d = x % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

// ═══ ۱) دارایی‌های قابل پیش‌بینی + چارت تولد (مبنای استرولوژی مالی) ═══

export interface ForecastAsset {
  symbol: string
  name: string
  unit: string
  source: 'yahoo' | 'binance'
  /** تاریخ تولد دارایی — لحظه مرجع چارت مالی */
  natalIso: string
  natalNote: string
  /** لنگر چرخه بلندمدت مستند (فقط در صورت واقعی بودن) */
  anchor?: { label: string; note: string }
}

export const FORECAST_ASSETS: ForecastAsset[] = [
  {
    symbol: 'BTCUSDT',
    name: 'بیت‌کوین',
    unit: '$',
    source: 'binance',
    natalIso: '2009-01-03T18:15:05Z',
    natalNote: 'تولد: بلاک جنزیس ۳ ژانویه ۲۰۰۹ — ۱۸:۱۵:۰۵ UTC',
    anchor: {
      label: 'چرخه هالوینگ (~۴ سال)',
      note: 'آخرین هالوینگ اردیبهشت ۱۴۰۳ (۲۰۲۴-۰۴-۲۰) — هالوینگ بعدی ~۲۰۲۸؛ فاز کناریِ پس‌هالوینگ، تاریخی‌ما صعودی‌ترین بخش چرخه است',
    },
  },
  {
    symbol: 'ETHUSDT',
    name: 'اتریوم',
    unit: '$',
    source: 'binance',
    natalIso: '2015-07-30T15:26:13Z',
    natalNote: 'تولد: بلاک جنزیس ۳۰ ژوئیه ۲۰۱۵ — ۱۵:۲۶:۱۳ UTC',
  },
  {
    symbol: 'NVDA',
    name: 'انویدیا',
    unit: '$',
    source: 'yahoo',
    natalIso: '1999-01-22T14:30:00Z',
    natalNote: 'تولد: عرضه اولیه در نزدک ۲۲ ژانویه ۱۹۹۹ — ساعت ۹:۳۰ صبح نیویورک',
    anchor: {
      label: 'چرخه سه‌ماهه گزارش درآمد',
      note: 'انویدیا هر ~۶۳ روز کاری گزارش می‌دهد — نوسان پیش و پس از گزارش در الگوی چرخه‌ای لحاظ شده',
    },
  },
  {
    symbol: '^GSPC',
    name: 'S&P 500',
    unit: '',
    source: 'yahoo',
    natalIso: '1792-05-17T17:00:00Z',
    natalNote: 'تولد: توافق‌نامه باتن‌وود — تأسیس وال‌استریت ۱۷ مه ۱۷۹۲',
  },
  {
    symbol: 'CL=F',
    name: 'نفت WTI',
    unit: '$',
    source: 'yahoo',
    natalIso: '1983-03-30T15:00:00Z',
    natalNote: 'تولد: نخستین قرارداد آتی نفت WTI در نیومکس ۳۰ مارس ۱۹۸۳ — ۱۰ صبح نیویورک',
    anchor: {
      label: 'چرخه فصلی تقاضا',
      note: 'فصل رانندگی و سرمایش تابستانی آمریکا (تیر-شهریور) بیشینه تقاضا و زمستان کمینه — ریتم فصلی مستند EIA',
    },
  },
  {
    symbol: 'BZ=F',
    name: 'نفت برنت',
    unit: '$',
    source: 'yahoo',
    natalIso: '1988-06-23T09:00:00Z',
    natalNote: 'تولد: نخستین قرارداد آتی برنت در بورس نفت لندن IPE (امروز ICE Futures Europe) — ۲۳ ژوئن ۱۹۸۸',
    anchor: {
      label: 'چرخه اوپک‌پلاس',
      note: 'جلسات سهمیه‌بندی تولید اوپک‌پلاس هر ~۶ ماه — تصمیم‌های تولید، منبع اصلی شوک‌های قیمتی برنت و مرجع ۷۰٪ نفت دریایی جهان',
    },
  },
  {
    symbol: 'GC=F',
    name: 'طلا',
    unit: '$',
    source: 'yahoo',
    natalIso: '1971-08-16T01:00:00Z',
    natalNote: 'تولد: شوک نیکسون ۱۵ اوت ۱۹۷۱ — پایان تبدیل دلار به طلا و آغاز قیمت آزاد جهانی',
    anchor: {
      label: 'چرخه دلار / نرخ بهره',
      note: 'طلای بدون سودِ سپرده با ریزش دلار و افت نرخ‌های واقعی می‌جشد — ریتم مستند چهار دهه اخیر',
    },
  },
  {
    symbol: 'SI=F',
    name: 'نقره',
    unit: '$',
    source: 'yahoo',
    natalIso: '1965-07-23T16:00:00Z',
    natalNote: 'تولد: لایحه ضرب سکه ۱۹۶۵ — خروج نقره از سکه‌های رایج و آغاز بازار آزاد نقره',
  },
]

export function forecastAssetMeta(symbol: string): ForecastAsset | null {
  return FORECAST_ASSETS.find((a) => a.symbol === symbol) ?? null
}

// ═══ ۲) دریافت تاریخچه ═══

export async function fetchForecastHistory(asset: ForecastAsset): Promise<SeriesPoint[]> {
  if (asset.source === 'binance') return fetchBinanceSeries(asset.symbol, 365)
  return fetchYahooSeries(asset.symbol, '1y')
}

// ═══ ۳) ابزارهای آماری مشترک ═══

/** کندل — واقعی یا پیش‌بینی‌شده (برای چارت کندل‌استیک قشنگ) */
export interface CandlePoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  forecast: boolean
}

/**
 * ساخت کندل‌های پیش‌بینی از مسیر ۳۰روزه — دترمینیستیک.
 * open هر کندل = close کندل قبلی؛ سایه‌ها مثل کندل واقعی بر پایهٔ دامنهٔ نوسان روزانه (ATR)
 * ساخته می‌شوند ولی هرگز از باند اطمینان مسیر بیرون نمی‌زنند — نتیجه: کندلی که عین
 * کندل واقعی بدنه و سایه دارد و مشخص است «فردا تا کجا رفت، تا کجا ریخت».
 */
export function forecastCandles(path: PathPoint[], lastClose: number, atr = 0): CandlePoint[] {
  const candles: CandlePoint[] = []
  let prevClose = lastClose
  for (let t = 0; t < path.length; t++) {
    const pt = path[t]!
    const open = prevClose
    const trueClose = pt.price
    const bodyHi = Math.max(open, trueClose)
    const bodyLo = Math.min(open, trueClose)
    // سایهٔ طبیعی: ~ATR روزانه با ریتم دترمینیستیک (نه یکنواخت، نه تصادفی)
    const wick = atr > 0 ? atr * (0.34 + 0.26 * Math.abs(Math.sin(t * 1.7 + 0.6))) : 0
    const upRoom = pt.hi - bodyHi
    const loRoom = bodyLo - pt.lo
    const upWick = upRoom > 0 ? Math.min(upRoom, Math.max(wick, upRoom * 0.3)) : 0
    const loWick = loRoom > 0 ? Math.min(loRoom, Math.max(wick, loRoom * 0.3)) : 0
    const hi = Math.max(bodyHi + upWick, trueClose, open)
    const lo = Math.min(bodyLo - loWick, trueClose, open)
    // بدنهٔ خوانا: اگر جابه‌جایی روزانهٔ مسیر خیلی کوچک‌تر از دامنهٔ همان روز باشد،
    // بدنه تا ~۳۵٪ دامنهٔ روز در جهت پیش‌بینی گسترش می‌یابد تا «رفته تا کجا / ریخته تا کجا»
    // مثل کندل واقعی دیده شود — مسیر عددیِ واقعی پیش‌بینی دست‌نخورده می‌ماند
    let close = trueClose
    const minBody = (hi - lo) * 0.35
    if (Math.abs(close - open) < minBody) {
      const s = close >= open ? 1 : -1
      close = Math.max(lo, Math.min(hi, open + s * minBody))
    }
    candles.push({
      date: pt.date,
      open: Math.round(open * 100) / 100,
      high: Math.round(hi * 100) / 100,
      low: Math.round(lo * 100) / 100,
      close: Math.round(close * 100) / 100,
      forecast: true,
    })
    prevClose = trueClose
  }
  return candles
}

function ohlcHistory(series: SeriesPoint[], days: number): CandlePoint[] {
  return series.slice(-days).map((s) => ({
    date: s.date,
    open: Math.round(s.open * 100) / 100,
    high: Math.round(s.high * 100) / 100,
    low: Math.round(s.low * 100) / 100,
    close: Math.round(s.close * 100) / 100,
    forecast: false,
  }))
}

/** دامنهٔ واقعی روزانه — میانگین True Range کندل‌های اخیر (پایهٔ سایهٔ کندل پیش‌بینی) */
export function atrOf(candles: CandlePoint[], n = 14): number {
  const arr = candles.slice(-n - 1)
  if (arr.length < 2) return 0
  let sum = 0
  for (let i = 1; i < arr.length; i++) {
    const prev = arr[i - 1]!
    const c = arr[i]!
    sum += Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
  }
  return sum / (arr.length - 1)
}

function linFit(ys: number[]): { slope: number; intercept: number } {
  const n = ys.length
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 }
  let sx = 0, sy = 0, sxy = 0, sxx = 0
  for (let i = 0; i < n; i++) {
    sx += i
    sy += ys[i]
    sxy += i * ys[i]
    sxx += i * i
  }
  const denom = n * sxx - sx * sx
  const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0
  return { slope, intercept: (sy - slope * sx) / n }
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gain = 0, loss = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    if (d >= 0) gain += d
    else loss -= d
  }
  if (loss === 0) return 100
  const rs = gain / period / (loss / period)
  return 100 - 100 / (1 + rs)
}

function ema(vals: number[], period: number): number {
  const k = 2 / (period + 1)
  let e = vals[0]
  for (let i = 1; i < vals.length; i++) e = vals[i] * k + e * (1 - k)
  return e
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = xs.reduce((s, x) => s + x, 0) / xs.length
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}

function dateAdd(date: string, days: number): string {
  return new Date(new Date(date + 'T00:00:00Z').getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

// ═══ ۴) روش تکنیکال ═══

export interface PathPoint {
  date: string
  price: number
  lo: number
  hi: number
}

export interface KeyCall {
  kind: 'end' | 'peak' | 'trough' | 'turn'
  kindFa: string
  date: string
  price: number
  note: string
}

export interface TechResult {
  path: PathPoint[]
  calls: KeyCall[]
  indicators: {
    rsi: number
    emaTrendFa: string
    vol30dPct: number
    support: number
    resistance: number
    slopePctDay: number
  }
  summaryFa: string
}

export function computeTechnical(series: SeriesPoint[]): TechResult {
  const closes = series.map((s) => s.close)
  const last = closes[closes.length - 1]
  const lastDate = series[series.length - 1].date
  const logs = closes.slice(-120).map((c) => Math.log(c))
  const { slope: logSlope } = linFit(logs.slice(-60)) // درفت روزانه لگاریتمی
  const e20 = ema(closes.slice(-60), 20)
  const e50 = ema(closes.slice(-60), 50)
  const trendSpread = (e20 - e50) / last // مثبت = صعودی
  const r = rsi(closes)
  const rets: number[] = []
  for (let i = 1; i < Math.min(closes.length, 31); i++) {
    rets.push(Math.log(closes[closes.length - i] / closes[closes.length - i - 1]))
  }
  const vol = stdev(rets) // نوسان روزانه لگاریتمی

  const emaTrendFa =
    trendSpread > 0.01 ? 'صعودی (میانگین‌های طلایی)' : trendSpread < -0.01 ? 'نزولی (میانگین‌های مرگ)' : 'خنثی'

  // مسیر: درفت رگرسیونی با افت مومنتوم + کشش میانگین‌برگشتی
  const path: PathPoint[] = []
  let ln = Math.log(last)
  const lambda = 0.965 // افت مومنتوم روزانه
  for (let t = 1; t <= 30; t++) {
    const drift = logSlope * Math.pow(lambda, t) + trendSpread * 0.02 * Math.pow(lambda, t * 0.5)
    ln += drift
    const price = Math.exp(ln)
    const band = Math.exp(vol * Math.sqrt(t) * 0.85)
    path.push({ date: dateAdd(lastDate, t), price, lo: price / band, hi: price * band })
  }

  const endP = path[path.length - 1].price
  let peak = path[0], trough = path[0]
  for (const p of path) {
    if (p.price > peak.price) peak = p
    if (p.price < trough.price) trough = p
  }
  const win20 = closes.slice(-20)
  const win60 = closes.slice(-60)
  const calls: KeyCall[] = [
    {
      kind: 'end', kindFa: 'پایان ماه',
      date: path[path.length - 1].date, price: endP,
      note: `هدف خط روند: ${(((endP / last) - 1) * 100).toFixed(1)}٪ نسبت به الان — باند: ${path[path.length - 1].lo.toFixed(endP < 10 ? 4 : 0)} تا ${path[path.length - 1].hi.toFixed(endP < 10 ? 4 : 0)}`,
    },
    {
      kind: 'peak', kindFa: 'سقف ماه',
      date: peak.date, price: peak.price,
      note: `بالاترین نقطه مسیر تکنیکال — ${(((peak.price / last) - 1) * 100).toFixed(1)}٪`,
    },
    {
      kind: 'trough', kindFa: 'کف ماه',
      date: trough.date, price: trough.price,
      note: `پایین‌ترین نقطه مسیر — ${(((trough.price / last) - 1) * 100).toFixed(1)}٪`,
    },
  ]

  const dirFa = endP > last * 1.01 ? 'صعودی' : endP < last * 0.99 ? 'نزولی' : 'خنثی'
  const summaryFa = `روند میانگین‌ها ${emaTrendFa} — RSI ${Math.round(r)} — نوسان روزانه ${(vol * 100).toFixed(1)}٪ — مسیر ۳۰روزه ${dirFa}`

  return {
    path,
    calls,
    indicators: {
      rsi: Math.round(r),
      emaTrendFa,
      vol30dPct: Math.round(vol * 100 * Math.sqrt(30) * 10) / 10,
      support: Math.min(...win20),
      resistance: Math.max(...win60),
      slopePctDay: Math.round((Math.exp(logSlope) - 1) * 10000) / 100,
    },
    summaryFa,
  }
}

// ═══ ۵) روش چرخه‌ها (اتوکورلیشن + لنگر) ═══

export interface CycleResult {
  path: PathPoint[]
  calls: KeyCall[]
  info: {
    periods: Array<{ days: number; strength: number; fa: string }>
    anchorFa: string | null
    anchorNoteFa: string | null
  }
  summaryFa: string
}

export function computeCycles(series: SeriesPoint[], asset: ForecastAsset): CycleResult {
  const closes = series.map((s) => s.close)
  const last = closes[closes.length - 1]
  const lastDate = series[series.length - 1].date
  const logs = closes.map((c) => Math.log(c))
  const fit = linFit(logs)
  const resid = logs.map((l, i) => l - (fit.intercept + fit.slope * i))
  const n = resid.length

  // اتوکورلیشن روی باقیمانده‌ها — جفت‌های دوره ۷ تا ۱۲۰ روز
  const candidates: Array<{ lag: number; ac: number }> = []
  const maxLag = Math.min(120, Math.floor(n / 2))
  for (let lag = 7; lag <= maxLag; lag++) {
    let num = 0, denA = 0, denB = 0
    const m = n - lag
    for (let i = 0; i < m; i++) {
      num += resid[i] * resid[i + lag]
      denA += resid[i] ** 2
      denB += resid[i + lag] ** 2
    }
    const ac = denA > 0 && denB > 0 ? num / Math.sqrt(denA * denB) : 0
    candidates.push({ lag, ac })
  }
  // اوج‌های محلی — دو چرخه غالب با بیشینه قدرت
  const peaks: Array<{ lag: number; ac: number }> = []
  for (let i = 2; i < candidates.length - 2; i++) {
    const c = candidates[i]
    if (c.ac > candidates[i - 1].ac && c.ac >= candidates[i + 1].ac && c.ac > 0.12) {
      peaks.push(c)
    }
  }
  peaks.sort((a, b) => b.ac - a.ac)
  const top: Array<{ lag: number; ac: number; phase: number; amp: number }> = []
  for (const p of peaks) {
    if (top.some((t) => Math.abs(t.lag - p.lag) < p.lag * 0.4)) continue // دورهای نزدیک = همان چرخه
    // فاز و دامنه: برازش sin/cos روی باقیمانده با این دوره
    let cs = 0, sn = 0
    for (let i = 0; i < n; i++) {
      cs += resid[i] * Math.cos((2 * Math.PI * i) / p.lag)
      sn += resid[i] * Math.sin((2 * Math.PI * i) / p.lag)
    }
    const amp = Math.sqrt(cs * cs + sn * sn) * (2 / n)
    const phase = Math.atan2(sn, cs)
    top.push({ lag: p.lag, ac: p.ac, phase, amp })
    if (top.length >= 2) break
  }

  // مسیر: از قیمت فعلی شروع، روند خطی با میرایی (فرض گشت تصادفی) + جمع چرخه‌های میرا
  const path: PathPoint[] = []
  const residSigma = stdev(resid.slice(-60))
  const trendLambda = 0.92 // میرایی روند — ادامه تند رگرسیون ۱ساله تعدیل می‌شود
  let trendAcc = 0
  const cycAt = (idx: number) => {
    let v = 0
    for (const c of top) {
      const dampT = idx - n
      const damp = dampT > 0 ? Math.exp(-dampT / (c.lag * 2.5)) : 1
      v += c.amp * damp * Math.cos((2 * Math.PI * idx) / c.lag + c.phase)
    }
    return v
  }
  const cyc0 = cycAt(n)
  for (let t = 1; t <= 30; t++) {
    trendAcc += fit.slope * Math.pow(trendLambda, t)
    const idx = n + t
    const ln = Math.log(last) + trendAcc + (cycAt(idx) - cyc0)
    const price = Math.exp(ln)
    const band = Math.exp(residSigma * Math.sqrt(t / n) * 2.2)
    path.push({ date: dateAdd(lastDate, t), price, lo: price / band, hi: price * band })
  }

  // پیوند فاز به زمان حال: چرخه غالب الان کجای موج است؟ + تماس‌های نقطه عطف
  const turnCalls: KeyCall[] = []
  if (top.length) {
    const c = top[0]
    const idxNow = n
    const phaseNow = norm360(((2 * Math.PI * idxNow) / c.lag + c.phase) * 180 / Math.PI)
    const daysToPeak = Math.round((((450 - phaseNow) % 360) / 360) * c.lag) || c.lag
    const daysToTrough = Math.round((((630 - phaseNow) % 360) / 360) * c.lag) || c.lag
    if (daysToPeak > 0 && daysToPeak <= 30) {
      turnCalls.push({
        kind: 'turn', kindFa: 'نقطه عطف چرخه',
        date: dateAdd(lastDate, daysToPeak), price: path[Math.min(29, daysToPeak - 1)].price,
        note: `فاز اوج چرخه ${c.lag}روزه — تاریخچة تکرار الگو اینجا سقف محلی می‌سازد`,
      })
    }
    if (daysToTrough > 0 && daysToTrough <= 30) {
      turnCalls.push({
        kind: 'turn', kindFa: 'نقطه عطف چرخه',
        date: dateAdd(lastDate, daysToTrough), price: path[Math.min(29, daysToTrough - 1)].price,
        note: `فاز کف چرخه ${c.lag}روزه — تاریخچه تکرار الگو اینجا کف محلی می‌سازد`,
      })
    }
  }

  const endP = path[path.length - 1].price
  let peak = path[0], trough = path[0]
  for (const p of path) {
    if (p.price > peak.price) peak = p
    if (p.price < trough.price) trough = p
  }
  const calls: KeyCall[] = [
    {
      kind: 'end', kindFa: 'پایان ماه',
      date: path[path.length - 1].date, price: endP,
      note: `هدف چرخه‌ای: ${(((endP / last) - 1) * 100).toFixed(1)}٪ نسبت به الان`,
    },
    { kind: 'peak', kindFa: 'سقف ماه', date: peak.date, price: peak.price, note: 'اوج موج چرخه غالب در این ماه' },
    { kind: 'trough', kindFa: 'کف ماه', date: trough.date, price: trough.price, note: 'کف موج چرخه غالب در این ماه' },
    ...turnCalls,
  ]

  const dirFa = endP > last * 1.01 ? 'صعودی' : endP < last * 0.99 ? 'نزولی' : 'خنثی'
  const summaryFa = `${top.length ? `چرخه‌های غالب: ${top.map((c) => `${c.lag}روزه (قدرت ${(c.ac * 100).toFixed(0)}٪)`).join(' + ')}` : 'چرخه کوتاه‌مدت معنادار یافت نشد'} — مسیر ۳۰روزه ${dirFa}`

  const periodsFa = top.map((c) => ({
    days: c.lag,
    strength: Math.round(c.ac * 100) / 100,
    fa: `چرخه ${c.lag}روزه — قدرت ${(c.ac * 100).toFixed(0)}٪`,
  }))

  return {
    path,
    calls,
    info: {
      periods: periodsFa,
      anchorFa: asset.anchor?.label ?? null,
      anchorNoteFa: asset.anchor?.note ?? null,
    },
    summaryFa,
  }
}

// ═══ ۶) روش استرولوژی مالی ═══

export interface AstroEvent {
  date: string
  titleFa: string
  bias: 'bull' | 'bear' | 'vol'
  weight: number // شدت تقریبی از -3 تا +3
}

export interface AstroResult {
  path: PathPoint[]
  calls: KeyCall[]
  natalFa: string[]
  events: AstroEvent[]
  summaryFa: string
}

const ASPECT_ANGLE: Record<string, number> = {
  conj: 0, sextile: 60, square: 90, trine: 120, opp: 180,
}

/** نرخ حرکت روزانه (درجه/روز) — برای تشخیص راجعه */
function dailyRate(body: A.Body, date: Date): number {
  const l1 = eclLon(body, new Date(date.getTime() - DAY_MS / 4))
  const l2 = eclLon(body, new Date(date.getTime() + DAY_MS / 4))
  return norm180(l2 - l1) * 4
}

export function computeAstro(series: SeriesPoint[], asset: ForecastAsset): AstroResult {
  const closes = series.map((s) => s.close)
  const last = closes[closes.length - 1]
  const lastDate = series[series.length - 1].date
  const natal = new Date(asset.natalIso)

  // چارت تولد دارایی
  const natalBodies: Array<{ body: A.Body; lon: number }> = (
    [A.Body.Sun, A.Body.Moon, A.Body.Mercury, A.Body.Venus, A.Body.Mars, A.Body.Jupiter, A.Body.Saturn, A.Body.Uranus] as A.Body[]
  ).map((b) => ({ body: b, lon: eclLon(b, natal) }))
  const natalJup = natalBodies.find((p) => p.body === A.Body.Jupiter)!.lon
  const natalSun = natalBodies.find((p) => p.body === A.Body.Sun)!.lon
  const natalSat = natalBodies.find((p) => p.body === A.Body.Saturn)!.lon
  const natalFa = natalBodies
    .filter((p) => p.body !== A.Body.Moon) // ماه تولد برای لحظه‌های تاریخی قابل اتکا نیست
    .map((p) => {
      const signIdx = Math.floor(p.lon / 30)
      const degIn = p.lon - signIdx * 30
      return `${PLANET_FA[p.body as string]}: ${degIn.toFixed(1)}° ${['حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله', 'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت'][signIdx]}`
    })

  const events: AstroEvent[] = []

  const transitBodies = [
    { body: A.Body.Venus, w: 0.8 },
    { body: A.Body.Mars, w: 1.0 },
    { body: A.Body.Jupiter, w: 1.3 },
    { body: A.Body.Saturn, w: 1.4 },
    { body: A.Body.Uranus, w: 0.9 },
  ]
  const luckyTargets = [
    { lon: natalJup, fa: 'مشتری تولد' },
    { lon: natalSun, fa: 'خورشید تولد' },
  ]
  const hardTargets = [
    { lon: natalSun, fa: 'خورشید تولد' },
    { lon: natalSat, fa: 'زحل تولد' },
  ]

  // ── ترانزیت‌ها با تاریخ دقیق برخورد (سبک اخترشناسان: روز دقیق زاویه) ──
  // امتیاز روزانه از پیش‌محاسبه — هر رویداد روی پنجره ±۲ روزه با میرایی اثر می‌گذارد
  const scoreAdj = new Array<number>(30).fill(0)
  const startMs = new Date(lastDate + 'T12:00:00Z').getTime()
  const scanFrom = startMs - 4 * DAY_MS
  const scanDays = 36
  const dayStrAt = (i: number) => new Date(scanFrom + i * DAY_MS).toISOString().slice(0, 10)

  const pushEvent = (
    dateStr: string, titleFa: string, bias: 'bull' | 'bear' | 'vol', weight: number,
    tIdx: number, windowDays = 2,
  ) => {
    events.push({ date: dateStr, titleFa, bias, weight })
    for (let k = Math.max(0, tIdx - windowDays); k <= Math.min(29, tIdx + windowDays); k++) {
      const decay = k === tIdx ? 1 : 0.4
      const contribution = bias === 'vol' ? weight * 0.5 * decay : weight * decay
      scoreAdj[k] += contribution
    }
  }

  // طول روزانه سیاره‌های ترانزیتی — یک‌بار محاسبه
  const lonByBody = new Map<A.Body, number[]>()
  for (const tb of transitBodies) {
    const arr: number[] = []
    for (let i = 0; i < scanDays; i++) arr.push(eclLon(tb.body, new Date(scanFrom + i * DAY_MS)))
    lonByBody.set(tb.body, arr)
  }

  const scanAspects = (
    tb: (typeof transitBodies)[number], lons: number[],
    tg: { lon: number; fa: string }, keys: string[],
    filter: (key: string) => boolean, mkW: (key: string) => number,
    bias: 'bull' | 'bear', label: string,
  ) => {
    for (const key of keys) {
      const ang = ASPECT_ANGLE[key]
      if (ang === undefined) continue
      let prev = norm180(lons[0] - tg.lon - ang)
      for (let i = 1; i < lons.length; i++) {
        const cur = norm180(lons[i] - tg.lon - ang)
        if ((prev < 0 && cur >= 0) || (prev > 0 && cur <= 0)) {
          const frac = Math.abs(prev) / (Math.abs(prev) + Math.abs(cur) || 1)
          const tIdx = i - 4 + Math.round(frac) // i-1 از scanFrom → نسبت به startMs
          if (tIdx >= 0 && tIdx <= 29 && filter(key)) {
            pushEvent(
              dayStrAt(i),
              `${PLANET_FA[tb.body as string]} ${ASPECT_FA[key]} ${tg.fa} — ${label}`,
              bias, mkW(key), tIdx,
            )
          }
        }
        prev = cur
      }
    }
  }

  for (const tb of transitBodies) {
    const lons = lonByBody.get(tb.body)!
    for (const tg of luckyTargets) {
      scanAspects(
        tb, lons, tg, ['conj', 'trine'],
        (key) => key === 'trine' || tb.body === A.Body.Venus || tb.body === A.Body.Jupiter,
        (key) => Math.round(tb.w * (key === 'conj' ? 1 : 0.8) * 10) / 10,
        'bull', 'پنجره صعودی کلاسیک',
      )
    }
    for (const tg of hardTargets) {
      scanAspects(
        tb, lons, tg, ['conj', 'square', 'opp'],
        (key) => !(key === 'conj' && (tb.body === A.Body.Venus || tb.body === A.Body.Jupiter || tb.body === A.Body.Uranus)),
        (key) => -Math.round(tb.w * (key === 'conj' ? 0.7 : 1) * 10) / 10,
        'bear', 'فشار و اصلاح کلاسیک',
      )
    }
  }

  // ── اطوار ماه دقیق — ماه نو و کامل (SearchMoonPhase) ──
  for (const [targetLon, titleFa, w] of [
    [0, 'ماه نو — چرخش ماهانه؛ نوسان بالا و آغاز موج تازه', 0.5],
    [180, 'ماه کامل — اوج احساسات بازار؛ احتمال برگشت کوتاه‌مدت', -0.5],
  ] as Array<[number, string, number]>) {
    let cursor = new Date(scanFrom)
    for (;;) {
      const hit = A.SearchMoonPhase(targetLon, cursor, 40)
      if (!hit) break
      const tIdx = Math.round((hit.date.getTime() - startMs) / DAY_MS)
      if (tIdx > 29) break
      if (tIdx >= 0) {
        pushEvent(hit.date.toISOString().slice(0, 10), titleFa, 'vol', w, tIdx)
      }
      cursor = new Date(hit.date.getTime() + DAY_MS)
    }
  }

  const dailyScore = scoreAdj.map((s) => Math.max(-3, Math.min(3, s)))

  // ── ایستگاه‌های راجعه عطارد (مهم‌ترین رویداد استرولوژی مالی) ──
  for (const body of [A.Body.Mercury, A.Body.Venus] as A.Body[]) {
    let prevRate = dailyRate(body, new Date(startMs - 3 * DAY_MS))
    for (let t = -2; t <= 30; t++) {
      const d = new Date(startMs + t * DAY_MS)
      const cur = dailyRate(body, d)
      const dateStr = d.toISOString().slice(0, 10)
      if (prevRate > 0 && cur < 0) {
        const w = body === A.Body.Mercury ? -2 : -1.2
        events.push({
          date: dateStr,
          titleFa: `ایستگاه راجعه ${PLANET_FA[body as string]} ℞ — ${body === A.Body.Mercury ? 'سنت کلاسیک: اشتباهات معاملاتی و اصلاح تا پایان راجعه' : 'کاهش اشتها به ریسک تا پایان راجعه'}`,
          bias: 'bear',
          weight: w,
        })
        for (let k = Math.max(0, t); k < 30; k++) dailyScore[k] += (body === A.Body.Mercury ? -0.55 : -0.3) * (k === t ? 1.6 : 1)
      } else if (prevRate < 0 && cur > 0) {
        const w = body === A.Body.Mercury ? 1.8 : 1
        events.push({
          date: dateStr,
          titleFa: `مستقیم‌شدن ${PLANET_FA[body as string]} ↻ — پایان فشار راجعه؛ بازگشت اعتماد`,
          bias: 'bull',
          weight: w,
        })
        for (let k = Math.max(0, t); k < 30; k++) dailyScore[k] += (body === A.Body.Mercury ? 0.45 : 0.25) * (k === t ? 1.6 : 1)
      }
      prevRate = cur
    }
  }

  // ── مسیر قیمت: درفت صفر + انباشت امتیاز روزانه ──
  // هر امتیاز ≈ 0.18٪ انحراف روزانه — جمع امتیازها لگاریتمی انباشته می‌شود
  const path: PathPoint[] = []
  let ln = Math.log(last)
  const sigma = 0.012
  for (let t = 0; t < 30; t++) {
    ln += dailyScore[t] * 0.0018
    const price = Math.exp(ln)
    const band = Math.exp(sigma * Math.sqrt(t + 1))
    path.push({
      date: dateAdd(lastDate, t + 1),
      price,
      lo: price / band,
      hi: price * band,
    })
  }

  const endP = path[path.length - 1].price
  let peak = path[0], trough = path[0]
  for (const p of path) {
    if (p.price > peak.price) peak = p
    if (p.price < trough.price) trough = p
  }
  const calls: KeyCall[] = [
    {
      kind: 'end', kindFa: 'پایان ماه',
      date: path[path.length - 1].date, price: endP,
      note: `هدف سماوی: ${(((endP / last) - 1) * 100).toFixed(1)}٪ نسبت به الان`,
    },
    { kind: 'peak', kindFa: 'سقف ماه', date: peak.date, price: peak.price, note: 'روز پنجره‌های سماوی مثبت' },
    { kind: 'trough', kindFa: 'کف ماه', date: trough.date, price: trough.price, note: 'روز تجمع فشارهای سماوی' },
  ]

  // رویدادها مرتب + حذف تکراری + متن خلاصه
  events.sort((a, b) => a.date.localeCompare(b.date))
  const seen = new Set<string>()
  const uniqEvents = events.filter((e) => {
    const k = e.date + e.titleFa
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).slice(0, 14)

  const bull = dailyScore.reduce((s, x) => s + (x > 0.3 ? 1 : 0), 0)
  const bear = dailyScore.reduce((s, x) => s + (x < -0.3 ? 1 : 0), 0)
  const dirFa = endP > last * 1.01 ? 'صعودی' : endP < last * 0.99 ? 'نزولی' : 'خنثی'
  const summaryFa = `چارت تولد: ${asset.natalNote} — روزهای سبز سماوی: ${bull}، روزهای قرمز: ${bear} — مسیر ۳۰روزه ${dirFa}`

  return { path, calls, natalFa, events: uniqEvents, summaryFa }
}

// ═══ ۷) تلفیق ═══

export interface FusionResult {
  path: PathPoint[]
  calls: KeyCall[]
  weights: { technical: number; cycles: number; astro: number }
  agreementFa: string
  agreementLevel: 'aligned' | 'majority' | 'split'
  summaryFa: string
}

export function computeFusion(
  tech: TechResult,
  cyc: CycleResult,
  ast: AstroResult,
): FusionResult {
  const weights = { technical: 0.4, cycles: 0.3, astro: 0.3 }
  const path: PathPoint[] = []
  for (let t = 0; t < 30; t++) {
    const ln =
      weights.technical * Math.log(tech.path[t].price) +
      weights.cycles * Math.log(cyc.path[t].price) +
      weights.astro * Math.log(ast.path[t].price)
    const price = Math.exp(ln)
    const lo =
      weights.technical * tech.path[t].lo + weights.cycles * cyc.path[t].lo + weights.astro * ast.path[t].lo
    const hi =
      weights.technical * tech.path[t].hi + weights.cycles * cyc.path[t].hi + weights.astro * ast.path[t].hi
    path.push({ date: tech.path[t].date, price, lo, hi })
  }

  const lastPrice = tech.path[0] ? null : null // قیمت فعلی از بیرون تزریق می‌شود
  void lastPrice

  const dirs = [
    tech.path[29].price / tech.path[0].price,
    cyc.path[29].price / cyc.path[0].price,
    ast.path[29].price / ast.path[0].price,
  ]
  const ups = dirs.filter((d) => d > 1.005).length
  const downs = dirs.filter((d) => d < 0.995).length
  let agreementFa: string
  let agreementLevel: FusionResult['agreementLevel']
  if (ups === 3 || downs === 3) {
    agreementFa = 'هر سه روش هم‌جهت‌اند — قوی‌ترین نوع سیگنال'
    agreementLevel = 'aligned'
  } else if (ups >= 2 || downs >= 2) {
    agreementFa = `اکثریت روش‌ها ${ups >= 2 ? 'صعودی' : 'نزولی'}اند — یک روش مخالف است`
    agreementLevel = 'majority'
  } else {
    agreementFa = 'روش‌ها در جهت اختلاف دارند — بازار بلاتکلیف سماوی-فنی'
    agreementLevel = 'split'
  }

  let peak = path[0], trough = path[0]
  for (const p of path) {
    if (p.price > peak.price) peak = p
    if (p.price < trough.price) trough = p
  }
  const calls: KeyCall[] = [
    { kind: 'end', kindFa: 'پایان ماه', date: path[29].date, price: path[29].price, note: 'تلفیق وزنی هر سه روش — هدف نهایی' },
    { kind: 'peak', kindFa: 'سقف ماه', date: peak.date, price: peak.price, note: 'بیشینه مسیر تلفیقی' },
    { kind: 'trough', kindFa: 'کف ماه', date: trough.date, price: trough.price, note: 'کمینه مسیر تلفیقی' },
  ]

  return { path, calls, weights, agreementFa, agreementLevel, summaryFa: agreementFa }
}

// ═══ ۸) خروجی کلان ═══

export type MethodKey4 = 'technical' | 'cycles' | 'astro' | 'fusion'

export const METHOD_KEYS_4: MethodKey4[] = ['technical', 'cycles', 'astro', 'fusion']

export interface ForecastPayload {
  ok: true
  symbol: string
  name: string
  unit: string
  price: number
  priceDate: string
  runDate: string
  history: CandlePoint[] // آخرین ۹۰ روز OHLC واقعی
  candles: Record<MethodKey4, CandlePoint[]> // کندل‌های پیش‌بینی هر روش — ادامه قشنگ چارت
  natalNote: string
  natalFa: string[]
  technical: TechResult
  cycles: CycleResult
  astro: AstroResult
  fusion: FusionResult
  methodsComparison: Array<{
    key: MethodKey4
    nameFa: string
    endPrice: number
    changePct: number
    color: string
  }>
  disclaimerFa: string
}

export async function computeForecast(asset: ForecastAsset): Promise<ForecastPayload> {
  const series = await fetchForecastHistory(asset)
  const last = series[series.length - 1]

  const tech = computeTechnical(series)
  const cyc = computeCycles(series, asset)
  const ast = computeAstro(series, asset)
  const fusion = computeFusion(tech, cyc, ast)

  const cmp = (p: PathPoint[]) => p[29].price
  const methodsComparison = [
    {
      key: 'technical' as const, nameFa: 'تکنیکال', color: '#f59e0b',
      endPrice: cmp(tech.path), changePct: ((cmp(tech.path) / last.close - 1) * 100),
    },
    {
      key: 'cycles' as const, nameFa: 'چرخه‌ها', color: '#a78bfa',
      endPrice: cmp(cyc.path), changePct: ((cmp(cyc.path) / last.close - 1) * 100),
    },
    {
      key: 'astro' as const, nameFa: 'استرولوژی مالی', color: '#e879f9',
      endPrice: cmp(ast.path), changePct: ((cmp(ast.path) / last.close - 1) * 100),
    },
    {
      key: 'fusion' as const, nameFa: 'ترکیب همه', color: '#34d399',
      endPrice: cmp(fusion.path), changePct: ((cmp(fusion.path) / last.close - 1) * 100),
    },
  ]

  return {
    ok: true,
    symbol: asset.symbol,
    name: asset.name,
    unit: asset.unit,
    price: last.close,
    priceDate: last.date,
    runDate: tehranDateStr(),
    history: ohlcHistory(series, 90),
    candles: (() => {
      // سایهٔ کندل پیش‌بینی = دامنهٔ واقعی روزانه (ATR کندل‌های اخیر) — عین کندل واقعی
      const atr = atrOf(ohlcHistory(series, 15))
      return {
        technical: forecastCandles(tech.path, last.close, atr),
        cycles: forecastCandles(cyc.path, last.close, atr),
        astro: forecastCandles(ast.path, last.close, atr),
        fusion: forecastCandles(fusion.path, last.close, atr),
      }
    })(),
    natalNote: asset.natalNote,
    natalFa: ast.natalFa,
    technical: tech,
    cycles: cyc,
    astro: ast,
    fusion,
    methodsComparison: methodsComparison.map((m) => ({
      ...m,
      endPrice: Math.round(m.endPrice * 100) / 100,
      changePct: Math.round(m.changePct * 10) / 10,
    })),
    disclaimerFa:
      'پیش‌بینی احتمالاتی است نه قطعی — هر سه مسیر از مدل‌های متفاوتی می‌آیند و اختلافشان خودش اطلاعات است. برای دقت‌سنجی، مسیر روزانه + تماس‌های کلیدی (قیمت + تاریخ) در پایگاه‌داده ثبت می‌شود و هر روز کندل واقعی کنار کندل پیش‌بینی همان روز قرار می‌گیرد.',
  }
}

// ═══ ۹) دقت‌سنجی — بک‌تست ۳۰روزه + مقایسه روزبه‌روز ═══
// «هر روز کندل واقعی جلو می‌رود و کنار کندل پیش‌بینی همان روز می‌نشیند»

export interface TrackDay {
  date: string
  predicted: number
  actual: number
  devPct: number
  inBand: boolean
}

export interface MethodTrack {
  path: PathPoint[]
  candles: CandlePoint[]
  days: TrackDay[]
  mape: number // میانگین قدرمطلق خطا ٪
  inBand: number // روزهایی که قیمت واقعی داخل باند اطمینان ماند
  total: number // روزهای مقایسه‌شده
  endDevPct: number // خطای قیمت پایان پنجره
}

export interface BacktestResult {
  fromDate: string // روز اجرای پیش‌بینی شبیه‌سازی‌شده
  firstTargetDate: string
  methods: Record<MethodKey4, MethodTrack>
  realCandles: CandlePoint[] // کندل واقعی پنجره آزمون
}

/** مقایسه یک مسیر پیش‌بینی با روزهای واقعی رسیده — هسته دقت‌سنجی زنده */
export function buildTrackDays(path: PathPoint[], real: SeriesPoint[]): TrackDay[] {
  const realByDate = new Map(real.map((r) => [r.date, r]))
  const days: TrackDay[] = []
  for (const pt of path) {
    const r = realByDate.get(pt.date)
    if (!r) continue
    const devPct = ((r.close - pt.price) / pt.price) * 100
    days.push({
      date: pt.date,
      predicted: Math.round(pt.price * 100) / 100,
      actual: Math.round(r.close * 100) / 100,
      devPct: Math.round(devPct * 10) / 10,
      inBand: r.close >= pt.lo && r.close <= pt.hi,
    })
  }
  return days
}

export function summarizeTrack(path: PathPoint[], candles: CandlePoint[], days: TrackDay[]): MethodTrack {
  const sumAbs = days.reduce((s, d) => s + Math.abs(d.devPct), 0)
  const inBand = days.reduce((s, d) => s + (d.inBand ? 1 : 0), 0)
  const endDev = days.length
    ? ((days[days.length - 1].actual - days[days.length - 1].predicted) / days[days.length - 1].predicted) * 100
    : 0
  return {
    path,
    candles,
    days,
    mape: days.length ? Math.round((sumAbs / days.length) * 10) / 10 : 0,
    inBand,
    total: days.length,
    endDevPct: Math.round(endDev * 10) / 10,
  }
}

/**
 * بک‌تست خودکار: اگر امروز-منهای-۳۰روزِ-معاملاتی پیش‌بینی را اجرا می‌کردیم،
 * با واقعیت این ۳۰ روز چقدر روی هم می‌افتاد؟ — همان موتور، همان سه روش.
 */
export async function computeBacktest(asset: ForecastAsset, testDays = 30): Promise<BacktestResult | null> {
  const full = await fetchForecastHistory(asset)
  if (full.length < testDays + 60) return null
  const cut = full.slice(0, full.length - testDays) // داده تا روز اجرا
  const real = full.slice(full.length - testDays) // پنجره واقعی آزمون
  const fromClose = cut[cut.length - 1].close

  const tech = computeTechnical(cut)
  const cyc = computeCycles(cut, asset)
  const ast = computeAstro(cut, asset)
  const fusion = computeFusion(tech, cyc, ast)

  const btAtr = atrOf(ohlcHistory(cut, 15))
  const mk = (path: PathPoint[]): MethodTrack =>
    summarizeTrack(path, forecastCandles(path, fromClose, btAtr), buildTrackDays(path, real))

  return {
    fromDate: cut[cut.length - 1].date,
    firstTargetDate: real[0].date,
    methods: {
      technical: mk(tech.path),
      cycles: mk(cyc.path),
      astro: mk(ast.path),
      fusion: mk(fusion.path),
    },
    realCandles: ohlcHistory(full, testDays),
  }
}
