// ─── فچرهای داده: تلگرام / RSS / یاهو فایننس / بایننس / کوین‌گکو / ترس‌وطمع ───

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export async function fetchText(
  url: string,
  timeoutMs = 12000
): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: '*/*' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const txt = await fetchText(url, timeoutMs)
  return JSON.parse(txt) as T
}

export async function fetchJsonPost<T>(
  url: string,
  body: unknown,
  timeoutMs = 12000
): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: '*/*' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
  ).trim()
}

// ─── تلگرام (پیش‌نمایش عمومی t.me/s/ بدون نیاز به API Key) ───
export interface RawItem {
  title: string
  url: string | null
  publishedAt: Date
}

export async function fetchTelegram(handle: string, limit = 18): Promise<RawItem[]> {
  const html = await fetchText(`https://t.me/s/${handle}`)
  const blocks = html.split('class="tgme_widget_message ').slice(1)
  const items: RawItem[] = []
  for (const block of blocks) {
    const postId = block.match(/data-post="\/([^"]+)"/)?.[1]
    const iso = block.match(/<time datetime="([^"]+)"/)?.[1]
    const textHtml = block.match(
      /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/
    )?.[1]
    if (!textHtml) continue
    const title = stripTags(textHtml)
    if (title.length < 12) continue
    items.push({
      title,
      url: postId ? `https://t.me/${postId}` : null,
      publishedAt: iso ? new Date(iso) : new Date(),
    })
    if (items.length >= limit) break
  }
  return items
}

// ─── RSS (پشتیبانی از item و entry) ───
export async function fetchRss(url: string, limit = 15): Promise<RawItem[]> {
  const xml = await fetchText(url)
  const items: RawItem[] = []
  const blocks = [
    ...(xml.match(/<item[\s\S]*?<\/item>/g) ?? []),
    ...(xml.match(/<entry[\s\S]*?<\/entry>/g) ?? []),
  ]
  for (const block of blocks) {
    const title =
      block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? ''
    let link =
      block.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/)?.[1] ?? ''
    if (!link) {
      link = block.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? ''
    }
    const dateStr =
      block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ??
      block.match(/<updated>([\s\S]*?)<\/updated>/)?.[1] ??
      block.match(/<published>([\s\S]*?)<\/published>/)?.[1] ??
      ''
    const t = stripTags(title)
    if (t.length < 12) continue
    const parsed = dateStr ? new Date(dateStr) : new Date()
    items.push({
      title: t,
      url: link ? stripTags(link) : null,
      publishedAt: isNaN(parsed.getTime()) ? new Date() : parsed,
    })
    if (items.length >= limit) break
  }
  return items
}

// ─── یاهو فایننس (نفت، طلا، شاخص‌ها، VIX، دلار) ───
export interface QuoteResult {
  price: number
  closes: number[] // بسته‌شدن روزانه (قدیمی → جدید)
  change1d: number
  change7d: number
  change30d: number
}

export function pctFrom(closes: number[], back: number): number {
  if (closes.length < back + 1) return 0
  const last = closes[closes.length - 1]
  const prev = closes[closes.length - 1 - back]
  if (!prev) return 0
  return ((last / prev - 1) * 100)
}

export async function fetchYahoo(symbol: string): Promise<QuoteResult> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=3mo`
  const j = await fetchJson<{
    chart: {
      result?: Array<{
        meta: { regularMarketPrice?: number }
        indicators: { quote: Array<{ close: Array<number | null> }> }
      }>
    }
  }>(url)
  const r = j.chart.result?.[0]
  if (!r) throw new Error(`no data for ${symbol}`)
  const closes = (r.indicators.quote[0]?.close ?? []).filter(
    (c): c is number => typeof c === 'number' && isFinite(c)
  )
  if (!closes.length) throw new Error(`empty closes for ${symbol}`)
  const lastClose = closes[closes.length - 1]
  // قراردادهای آتی: فیلد regularMarketPrice گاهی از آخرین کندل عقب می‌ماند یا کندل واقعی ICE را نشان نمی‌دهد
  // (مثال واقعی BZ=F: متا 111.7 ولی کندل و بازار واقعی 116.72). برای آتی‌ها همیشه آخرین کندل ملاک است.
  const isFuture = symbol.endsWith('=F')
  const price = isFuture ? lastClose : (r.meta.regularMarketPrice ?? lastClose)
  return {
    price,
    closes,
    change1d: pctFrom(closes, 1),
    change7d: pctFrom(closes, 5),
    change30d: pctFrom(closes, 21),
  }
}

// ─── سری زمانی بلند با تاریخ (موتور پیش‌بینی ۳۰روزه + چارت کندل) ───
export interface SeriesPoint {
  date: string // YYYY-MM-DD (UTC)
  open: number
  high: number
  low: number
  close: number
}

export async function fetchYahooSeries(symbol: string, range = '1y'): Promise<SeriesPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=${range}`
  const j = await fetchJson<{
    chart: {
      result?: Array<{
        timestamp?: number[]
        indicators: {
          quote: Array<{
            close: Array<number | null>
            open?: Array<number | null>
            high?: Array<number | null>
            low?: Array<number | null>
          }>
        }
      }>
    }
  }>(url)
  const r = j.chart.result?.[0]
  if (!r?.timestamp?.length) throw new Error(`no series for ${symbol}`)
  const q = r.indicators.quote[0] ?? {}
  const closes = q.close ?? []
  const opens = q.open ?? []
  const highs = q.high ?? []
  const lows = q.low ?? []
  const out: SeriesPoint[] = []
  for (let i = 0; i < r.timestamp.length; i++) {
    const c = closes[i]
    if (typeof c !== 'number' || !isFinite(c)) continue
    const o = typeof opens[i] === 'number' && isFinite(opens[i]) ? opens[i] : c
    const h = typeof highs[i] === 'number' && isFinite(highs[i]) ? highs[i] : Math.max(o, c)
    const l = typeof lows[i] === 'number' && isFinite(lows[i]) ? lows[i] : Math.min(o, c)
    out.push({
      date: new Date(r.timestamp[i] * 1000).toISOString().slice(0, 10),
      open: o,
      high: h,
      low: l,
      close: c,
    })
  }
  if (out.length < 30) throw new Error(`short series for ${symbol}`)
  return out
}

export async function fetchBinanceSeries(symbol: string, limit = 365): Promise<SeriesPoint[]> {
  try {
    const klines = await fetchJson<Array<Array<number | string>>>(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=${limit}`
    )
    const out = klines.map((k) => ({
      date: new Date(Number(k[0])).toISOString().slice(0, 10),
      open: parseFloat(String(k[1])),
      high: parseFloat(String(k[2])),
      low: parseFloat(String(k[3])),
      close: parseFloat(String(k[4])),
    }))
    if (out.length < 30) throw new Error(`short binance series for ${symbol}`)
    return out
  } catch (e) {
    // بایننس موقتاً محدود کرده (HTTP 418/429) یا خطای شبکه — فالبک بی‌درنگ به کندل‌های یاهو
    // تا کاربر هرگز ارور خام نبیند و محاسبه پیش‌بینی نشکند
    try {
      return await fetchYahooSeries(binanceToYahoo(symbol), '1y')
    } catch {
      throw e
    }
  }
}

// ─── تریدینگ‌ویو (مرجع مستقل: برنت واقعی ICE، WTI نیومکس، اسپات طلا و نقره) ───
export interface TvQuote {
  price: number
  changePct: number
  expiration?: number // تاریخ انقضای قرارداد به‌صورت YYYYMMDD (برای آتی‌ها)
}

export async function fetchTradingViewQuotes(
  tickers: string[]
): Promise<Record<string, TvQuote>> {
  const j = await fetchJsonPost<{ data?: Array<{ s: string; d?: unknown[] }> }>(
    'https://scanner.tradingview.com/global/scan',
    {
      symbols: { tickers, query: { types: [] } },
      columns: ['close', 'change', 'expiration'],
    }
  )
  const out: Record<string, TvQuote> = {}
  for (const row of j.data ?? []) {
    const price = row.d?.[0]
    const chg = row.d?.[1]
    if (typeof price === 'number' && isFinite(price)) {
      out[row.s] = {
        price,
        changePct: typeof chg === 'number' && isFinite(chg) ? chg : 0,
        expiration:
          typeof row.d?.[2] === 'number' && row.d[2] > 19900000
            ? (row.d[2] as number)
            : undefined,
      }
    }
  }
  if (!Object.keys(out).length) throw new Error('tradingview: no quotes returned')
  return out
}

// ─── بایننس (کریپتو) ───
// بایننس گاهی IP را موقتاً محدود می‌کند (HTTP 418/429) — معادل یاهو برای فالبک بی‌درنگ
export function binanceToYahoo(symbol: string): string {
  return symbol.endsWith('USDT') ? `${symbol.slice(0, -4)}-USD` : symbol
}

export async function fetchBinance(symbol: string): Promise<QuoteResult> {
  try {
    const klines = await fetchJson<Array<Array<number | string>>>(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=35`
    )
    const closes = klines.map((k) => parseFloat(String(k[4])))
    const ticker = await fetchJson<{ lastPrice: string }>(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`
    )
    const price = parseFloat(ticker.lastPrice) || closes[closes.length - 1]
    return {
      price,
      closes,
      change1d: pctFrom(closes, 1),
      change7d: pctFrom(closes, 5),
      change30d: pctFrom(closes, 21),
    }
  } catch (e) {
    // فالبک: کندل‌های BTC-USD/ETH-USD یاهو همان داده را می‌دهند
    try {
      return await fetchYahoo(binanceToYahoo(symbol))
    } catch {
      throw e
    }
  }
}

// ─── کوین‌گکو (مارکت کلی کریپتو) ───
export interface GlobalCrypto {
  totalMcap: number
  mcapChange24h: number
  btcDominance: number
}

export async function fetchGlobalCrypto(): Promise<GlobalCrypto> {
  const j = await fetchJson<{
    data: {
      total_market_cap: { usd: number }
      market_cap_change_percentage_24h_usd: number
      market_cap_percentage: { btc: number }
    }
  }>('https://api.coingecko.com/api/v3/global')
  return {
    totalMcap: j.data.total_market_cap.usd,
    mcapChange24h: j.data.market_cap_change_percentage_24h_usd,
    btcDominance: j.data.market_cap_percentage.btc,
  }
}

// ─── شاخص ترس و طمع کریپتو ───
export interface FNG {
  value: number
  label: string
  history: number[] // از قدیم به جدید
}

export async function fetchFearGreed(): Promise<FNG> {
  const j = await fetchJson<{
    data: Array<{ value: string; value_classification: string; timestamp: string }>
  }>('https://api.alternative.me/fng/?limit=31')
  const history = j.data.map((d) => parseInt(d.value)).reverse()
  return {
    value: parseInt(j.data[0].value),
    label: j.data[0].value_classification,
    history,
  }
}

// ─── ایکس (توییتر): خواندن از آینه‌های عمومی Nitter ───
const NITTER_MIRRORS = ['xcancel.com', 'nitter.poast.org', 'lightbrd.com']

// اکانت‌های خبرگزاری/روزنگار: اگر آینه‌ها بسته بودند، از گوگل‌نیوز جایگزین می‌گیریم
const X_FALLBACK_SEARCH: Record<string, string> = {
  Reuters: 'Reuters',
  AP: 'Associated Press',
  FoxNews: 'Fox News',
  NBCNews: 'NBC News',
  nytimes: 'New York Times',
  i24NEWS_EN: 'i24NEWS',
  BarakRavid: 'Barak Ravid',
  idfonline: 'IDF Israel',
  CENTCOM: 'CENTCOM',
}

async function fetchXViaNews(handle: string, limit = 12): Promise<RawItem[]> {
  const query = X_FALLBACK_SEARCH[handle]
  if (!query) throw new Error(`X mirror blocked and no news fallback for @${handle}`)
  const url =
    `https://news.google.com/rss/search?q=${encodeURIComponent(
      query + ' (iran OR israel OR gaza OR hormuz OR strike OR military OR nuclear)'
    )}+when:2d&hl=en-US&gl=US&ceid=US:en`
  return fetchRss(url, limit)
}

export async function fetchX(handle: string, limit = 15): Promise<RawItem[]> {
  let lastErr: unknown = new Error('no mirror')
  for (const mirror of NITTER_MIRRORS) {
    try {
      const html = await fetchText(
        `https://${mirror}/${encodeURIComponent(handle)}`,
        11000
      )
      if (html.length < 500 || html.includes('Instance has been rate limited'))
        throw new Error('mirror blocked')
      const items: RawItem[] = []
      // هر آیتم: بلوک timeline-item با محتوا و تاریخ
      const blocks = html.split('timeline-item').slice(1)
      for (const block of blocks) {
        const textHtml = block.match(/tweet-content[^>]*>([\s\S]*?)<\/div>/)?.[1]
        if (!textHtml) continue
        const title = stripTags(textHtml)
        if (title.length < 12) continue
        const statusId = block.match(/\/status\/(\d+)/)?.[1]
        const dateTitle =
          block.match(/tweet-date[^>]*>[\s\S]*?title="([^"]+)"/)?.[1] ?? ''
        const ts = dateTitle ? new Date(dateTitle) : new Date()
        items.push({
          title,
          url: statusId
            ? `https://x.com/${handle}/status/${statusId}`
            : `https://x.com/${handle}`,
          publishedAt: isNaN(ts.getTime()) ? new Date() : ts,
        })
        if (items.length >= limit) break
      }
      if (items.length) return items
      throw new Error('no items parsed')
    } catch (e) {
      lastErr = e
    }
  }
  // آینه‌ها بسته‌اند → برای اکانت‌های خبری از گوگل‌نیوز جایگزین
  try {
    return await fetchXViaNews(handle, limit)
  } catch (fallbackErr) {
    throw lastErr instanceof Error
      ? new Error(`${lastErr.message} | fallback: ${fallbackErr instanceof Error ? fallbackErr.message : ''}`)
      : lastErr
  }
}

// ─── اینستاگرام: تلاش برای استوری‌ها (بدون کوکی معمولاً بسته است) ───
export async function fetchInstagramStories(
  handle: string,
  limit = 10
): Promise<RawItem[]> {
  // بدون کوکی لاگین، اینستاگرام به‌طور کامل بسته است؛ تلاش برای خواندن عمومی پروفایل
  const html = await fetchText(
    `https://www.instagram.com/${encodeURIComponent(handle)}/`,
    11000
  )
  const items: RawItem[] = []
  // فقط توضیحات متای عمومی + دکمه‌های جدیدترین پست‌ها (اگر رندر شده باشد)
  const blocks = html.match(/"edge_owner_to_timeline_media"[\s\S]{0,4000}/g) ?? []
  void blocks
  const captions =
    html.match(/"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"((?:[^"\\]|\\.)*)"/g) ?? []
  for (const cap of captions.slice(0, limit)) {
    const raw = cap.match(/"text":"((?:[^"\\]|\\.)*)"/)?.[1] ?? ''
    const text = raw
      .replace(/\\n/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\\u[\dA-Fa-f]{4}/g, (m) => {
        try {
          return JSON.parse(`"${m}"`) as string
        } catch {
          return ''
        }
      })
      .trim()
    if (text.length < 12) continue
    items.push({
      title: text,
      url: `https://www.instagram.com/${handle}/`,
      publishedAt: new Date(),
    })
  }
  if (!items.length) throw new Error('اینستاگرام بدون کوکی لاگین قابل خواندن نیست (استوری خصوصی است)')
  return items
}

// ─── پروازهای نظامی (ADSB عمومی) ───
export interface MilAircraft {
  callsign: string
  type: string
  category: 'tanker' | 'transport' | 'fighter' | 'recon' | 'bomber' | 'other'
  lat: number
  lon: number
  altFt: number | null
  kmToIran: number
}

export interface MilTraffic {
  aircraft: MilAircraft[]
  sourceApi: string
}

// نقاط مرجع ایران برای محاسبه نزدیک‌ترین فاصله
const IRAN_POINTS: Array<[number, number]> = [
  [35.69, 51.39], // تهران
  [38.08, 46.29], // تبریز
  [27.18, 56.28], // بندرعباس
  [25.29, 60.64], // چابهار
  [36.3, 59.6], // مشهد
  [28.92, 50.84], // بوشهر
  [34.31, 47.07], // کرمانشاه
  [29.5, 60.86], // زاهدان
  [30.29, 57.08], // کرمان
  [32.0, 52.87], // اصفهان
]

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function kmToIran(lat: number, lon: number): number {
  let min = Infinity
  for (const [la, lo] of IRAN_POINTS) {
    const km = haversineKm(lat, lon, la, lo)
    if (km < min) min = km
  }
  return Math.round(min)
}

function classifyMil(typeRaw: string, callsign: string): MilAircraft['category'] {
  const t = (typeRaw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const c = (callsign || '').toUpperCase()

  if (/^(KC|K35|K46|K10|C135|MRTT)/.test(t)) return 'tanker'
  if (/^(B(1|2|52)|B1L)/.test(t)) return 'bomber'
  if (/^(F(15|16|22|35)|FA18|EA18|F117)/.test(t)) return 'fighter'
  if (
    /^(RC135|E3|E6|E7|E11|E95|P8|P3|P9|RQ4|MQ4|MQ9|U2|EP3|CL60|GLOB)/.test(t)
  )
    return 'recon'
  if (/^C(5|17|130|146|12|208|212|40|145|38)/.test(t)) return 'transport'
  // KC-46A پگاسوس و KC-30 با کد B762/B77W پرواز می‌کنند
  if (c.startsWith('RCH') && (t === 'B762' || t === 'B77W' || t === 'B703')) return 'tanker'
  if (c.startsWith('RCH')) return 'transport' // Air Mobility Command
  return 'other'
}

interface AdsbState {
  flight?: string
  r?: string
  t?: string
  lat?: number
  lon?: number
  alt_baro?: number | string
}

async function adsbFrom(url: string, sourceApi: string): Promise<MilTraffic> {
  const j = await fetchJson<{ ac?: AdsbState[] }>(url, 14000)
  const out: MilAircraft[] = []
  for (const ac of j.ac ?? []) {
    if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number') continue
    // پنجره جغرافیایی: خلیج فارس، عراق، شرق مدیترانه، دریای عمان
    if (ac.lat < 18 || ac.lat > 44 || ac.lon < 32 || ac.lon > 68) continue
    const type = (ac.t || '').trim()
    const callsign = (ac.flight || '').trim()
    if (!type && !callsign) continue
    const altFt =
      ac.alt_baro === 'ground' || typeof ac.alt_baro !== 'number' ? null : ac.alt_baro
    out.push({
      callsign: callsign || (ac.r ?? ''),
      type: type || '?',
      category: classifyMil(type, callsign),
      lat: ac.lat,
      lon: ac.lon,
      altFt,
      kmToIran: kmToIran(ac.lat, ac.lon),
    })
  }
  return { aircraft: out, sourceApi }
}

export async function fetchMilitaryFlights(): Promise<MilTraffic> {
  try {
    return await adsbFrom('https://api.adsb.lol/v2/mil', 'adsb.lol')
  } catch {
    return await adsbFrom('https://opendata.adsb.fi/api/v2/mil', 'adsb.fi')
  }
}
