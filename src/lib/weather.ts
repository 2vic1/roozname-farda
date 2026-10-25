// ─── موتور هواشناسی مراکز استان‌ها — کاملاً جدا از موتور ریسک جنگ ───
// زنجیرهٔ منابع: Open-Meteo (مدل‌های ترکیبی) → yr.no نروژ (ECMWF) → wttr.in (مشاهده‌شده)
// کش ۱۵ دقیقه‌ای در حافظه + بازگشت به آخرین دادهٔ سالم (stale) اگر همهٔ منابع قطع شوند

export interface WeatherCity {
  key: string
  fa: string
  province: string
  lat: number
  lon: number
}

// ۳۱ مرکز استان ایران
export const CITY_LIST: WeatherCity[] = [
  { key: 'tehran', fa: 'تهران', province: 'تهران', lat: 35.6892, lon: 51.389 },
  { key: 'karaj', fa: 'کرج', province: 'البرز', lat: 35.8355, lon: 50.9915 },
  { key: 'mashhad', fa: 'مشهد', province: 'خراسان رضوی', lat: 36.2605, lon: 59.6168 },
  { key: 'isfahan', fa: 'اصفهان', province: 'اصفهان', lat: 32.6546, lon: 51.668 },
  { key: 'tabriz', fa: 'تبریز', province: 'آذربایجان شرقی', lat: 38.08, lon: 46.2919 },
  { key: 'shiraz', fa: 'شیراز', province: 'فارس', lat: 29.5918, lon: 52.5837 },
  { key: 'ahvaz', fa: 'اهواز', province: 'خوزستان', lat: 31.3183, lon: 48.6706 },
  { key: 'qom', fa: 'قم', province: 'قم', lat: 34.6416, lon: 50.8746 },
  { key: 'kermanshah', fa: 'کرمانشاه', province: 'کرمانشاه', lat: 34.3277, lon: 47.0778 },
  { key: 'urmia', fa: 'ارومیه', province: 'آذربایجان غربی', lat: 37.5527, lon: 45.0761 },
  { key: 'rasht', fa: 'رشت', province: 'گیلان', lat: 37.2808, lon: 49.5832 },
  { key: 'zahedan', fa: 'زاهدان', province: 'سیستان‌وبلوچستان', lat: 29.4963, lon: 60.8629 },
  { key: 'hamadan', fa: 'همدان', province: 'همدان', lat: 34.7992, lon: 48.5146 },
  { key: 'kerman', fa: 'کرمان', province: 'کرمان', lat: 30.2839, lon: 57.0834 },
  { key: 'yazd', fa: 'یزد', province: 'یزد', lat: 31.8974, lon: 54.3569 },
  { key: 'ardabil', fa: 'اردبیل', province: 'اردبیل', lat: 38.2498, lon: 48.2933 },
  { key: 'bandarabbas', fa: 'بندرعباس', province: 'هرمزگان', lat: 27.1832, lon: 56.2666 },
  { key: 'arak', fa: 'اراک', province: 'مرکزی', lat: 34.0917, lon: 48.473 },
  { key: 'zanjan', fa: 'زنجان', province: 'زنجان', lat: 36.6736, lon: 48.4787 },
  { key: 'sanandaj', fa: 'سنندج', province: 'کردستان', lat: 35.3213, lon: 46.9862 },
  { key: 'qazvin', fa: 'قزوین', province: 'قزوین', lat: 36.2797, lon: 50.0049 },
  { key: 'khorramabad', fa: 'خرم‌آباد', province: 'لرستان', lat: 33.4878, lon: 48.3558 },
  { key: 'gorgan', fa: 'گرگان', province: 'گلستان', lat: 36.8427, lon: 54.4441 },
  { key: 'sari', fa: 'ساری', province: 'مازندران', lat: 36.5633, lon: 53.0601 },
  { key: 'bojnord', fa: 'بجنورد', province: 'خراسان شمالی', lat: 37.4747, lon: 57.329 },
  { key: 'birjand', fa: 'بیرجند', province: 'خراسان جنوبی', lat: 32.8663, lon: 59.2211 },
  { key: 'shahrekord', fa: 'شهرکرد', province: 'چهارمحال و بختیاری', lat: 32.3256, lon: 50.8644 },
  { key: 'yasuj', fa: 'یاسوج', province: 'کهگیلویه و بویراحمد', lat: 30.6684, lon: 51.588 },
  { key: 'ilam', fa: 'ایلام', province: 'ایلام', lat: 33.6374, lon: 46.4227 },
  { key: 'semnan', fa: 'سمنان', province: 'سمنان', lat: 35.5769, lon: 53.3921 },
  { key: 'bushehr', fa: 'بوشهر', province: 'بوشهر', lat: 28.9234, lon: 50.8203 },
]

export type WxCode =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavyrain'
  | 'snow'
  | 'sleet'
  | 'thunder'
  | 'hail'

export const WX_FA: Record<WxCode, string> = {
  clear: 'صاف',
  partly: 'نیمه‌ابری',
  cloudy: 'ابری',
  fog: 'مه',
  drizzle: 'نم‌نم باران',
  rain: 'باران',
  heavyrain: 'باران شدید',
  snow: 'برف',
  sleet: 'برف‌وباران',
  thunder: 'رعدوبرق',
  hail: 'تگرگ',
}

export interface WeatherNow {
  temp: number
  feelsLike: number | null
  humidity: number | null
  windKmh: number | null
  windDirFa: string | null
  uv: number | null
  isDay: boolean
  code: WxCode
}

export interface WeatherDay {
  date: string // YYYY-MM-DD به وقت تهران
  weekdayFa: string
  labelFa: string // امروز / امشب / فردا / نام روز
  partial?: boolean // دادهٔ امروز فقط از این لحظه به بعد است (yr.no)
  code: WxCode
  min: number
  max: number
  precipProb: number | null
  precipMM: number | null
  sunriseFa: string | null // «06:12»
  sunsetFa: string | null
}

export interface WeatherHour {
  tFa: string // «22:00»
  temp: number
  precipProb: number | null
}

export interface WeatherPayload {
  city: string
  cityFa: string
  provinceFa: string
  provider: 'open-meteo' | 'yrno' | 'wttr'
  providerFa: string
  elevation: number | null
  fetchedAt: string // ISO
  stale?: boolean
  now: WeatherNow
  days: WeatherDay[]
  hours: WeatherHour[]
}

// ─── ابزارهای زمان (تثبیت آسیا/تهران — ایران از ۱۴۰۱ بدون DST) ───

const TZ = 'Asia/Tehran'
const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }) // YYYY-MM-DD
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
const weekdayFmt = new Intl.DateTimeFormat('fa-IR', { timeZone: TZ, weekday: 'long' })

function tehranDateKey(d: Date): string {
  return dateFmt.format(d)
}

function tehranHHMM(iso: string): string {
  return hourFmt.format(new Date(iso))
}

function faWeekday(dateKey: string): string {
  try {
    return weekdayFmt.format(new Date(dateKey + 'T12:00:00Z'))
  } catch {
    return ''
  }
}

const DIR8 = ['شمال', 'شمال‌شرق', 'شرق', 'جنوب‌شرق', 'جنوب', 'جنوب‌غربی', 'غرب', 'شمال‌غربی']
function windDirFa(deg: number | null): string | null {
  if (deg === null || deg === undefined || Number.isNaN(deg)) return null
  return DIR8[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
}

const DIR16: Record<string, string> = {
  N: 'شمال', NNE: 'شمال‌شرق', NE: 'شمال‌شرق', ENE: 'شمال‌شرق',
  E: 'شرق', ESE: 'جنوب‌شرق', SE: 'جنوب‌شرق', SSE: 'جنوب‌شرق',
  S: 'جنوب', SSW: 'جنوب‌غربی', SW: 'جنوب‌غربی', WSW: 'جنوب‌غربی',
  W: 'غرب', WNW: 'شمال‌غربی', NW: 'شمال‌غربی', NNW: 'شمال‌غربی',
}

// ─── fetch با تایم‌اوت ───

async function jfetch<T>(url: string, init?: RequestInit, ms = 13000): Promise<T> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, cache: 'no-store' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return (await r.json()) as T
  } finally {
    clearTimeout(t)
  }
}

// ─── نگاشت کدها ───

function wmoMap(code: number): WxCode {
  if (code === 0 || code === 1) return 'clear'
  if (code === 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code === 61 || code === 80 || code === 81) return 'rain'
  if (code === 63 || code === 66) return 'rain'
  if (code === 65 || code === 67 || code === 82) return 'heavyrain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code === 95 || code === 96 || code === 99) return 'thunder'
  return 'cloudy'
}

function yrSymbolMap(sym: string): WxCode {
  const s = sym.replace(/_(day|night|polartwilight)$/, '')
  if (s.includes('thunder')) return 'thunder'
  if (s.includes('sleet')) return 'sleet'
  if (s.includes('snow')) return 'snow'
  if (s.includes('heavyrain')) return 'heavyrain'
  if (s.includes('rainshowers')) return 'rain'
  if (s.includes('rain')) return 'rain'
  if (s.includes('drizzle')) return 'drizzle'
  if (s.includes('fog')) return 'fog'
  if (s === 'cloudy') return 'cloudy'
  if (s === 'partlycloudy') return 'partly'
  if (s === 'fair') return 'clear'
  if (s === 'clearsky') return 'clear'
  return 'cloudy'
}

function wwoMap(code: number): WxCode {
  const m: Record<number, WxCode> = {
    113: 'clear', 116: 'partly', 119: 'cloudy', 122: 'cloudy',
    143: 'fog', 248: 'fog', 260: 'fog',
    176: 'drizzle', 263: 'drizzle', 266: 'drizzle', 293: 'drizzle',
    296: 'rain', 299: 'rain', 302: 'rain', 305: 'heavyrain', 308: 'heavyrain', 350: 'rain',
    200: 'thunder', 386: 'thunder', 389: 'thunder',
    179: 'snow', 227: 'snow', 230: 'snow', 323: 'snow', 326: 'snow', 329: 'snow',
    332: 'snow', 335: 'snow', 338: 'snow', 371: 'snow', 395: 'snow',
    182: 'sleet', 185: 'sleet', 320: 'sleet', 368: 'sleet',
    374: 'hail', 377: 'hail',
  }
  return m[code] ?? 'cloudy'
}

// ─── تأمین‌کننده ۱: Open-Meteo ───

async function fetchOpenMeteo(c: WeatherCity): Promise<WeatherPayload> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m` +
    `&hourly=temperature_2m,precipitation_probability` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max` +
    `&timezone=Asia%2FTehran&forecast_days=7&cell_selection=land`
  type OM = {
    elevation: number
    current: {
      temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number
      is_day: number; weather_code: number; wind_speed_10m: number; wind_direction_10m: number; time: string
    }
    hourly: { time: string[]; temperature_2m: (number | null)[]; precipitation_probability: (number | null)[] }
    daily: {
      time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]
      precipitation_probability_max: (number | null)[]; precipitation_sum: (number | null)[]
      sunrise: string[]; sunset: string[]; uv_index_max: (number | null)[]
    }
  }
  const j = await jfetch<OM>(url)
  if (j?.error || !j.current) throw new Error('open-meteo: پاسخ نامعتبر')

  const now: WeatherNow = {
    temp: j.current.temperature_2m,
    feelsLike: j.current.apparent_temperature,
    humidity: j.current.relative_humidity_2m,
    windKmh: j.current.wind_speed_10m,
    windDirFa: windDirFa(j.current.wind_direction_10m),
    uv: j.daily.uv_index_max?.[0] ?? null,
    isDay: j.current.is_day === 1,
    code: wmoMap(j.current.weather_code),
  }

  // ۲۴ ساعت آینده از همین لحظه
  const hours: WeatherHour[] = []
  const startIdx = Math.max(0, j.hourly.time.findIndex((t) => t >= j.current.time))
  for (let i = startIdx; i < j.hourly.time.length && hours.length < 24; i++) {
    const temp = j.hourly.temperature_2m[i]
    if (temp === null || temp === undefined) continue
    hours.push({ tFa: j.hourly.time[i].slice(11, 16), temp, precipProb: j.hourly.precipitation_probability?.[i] ?? null })
  }

  const days: WeatherDay[] = j.daily.time.map((d, i) => ({
    date: d,
    weekdayFa: faWeekday(d),
    labelFa: '',
    code: wmoMap(j.daily.weather_code[i]),
    min: j.daily.temperature_2m_min[i],
    max: j.daily.temperature_2m_max[i],
    precipProb: j.daily.precipitation_probability_max?.[i] ?? null,
    precipMM: j.daily.precipitation_sum?.[i] ?? null,
    sunriseFa: j.daily.sunrise?.[i]?.slice(11, 16) ?? null,
    sunsetFa: j.daily.sunset?.[i]?.slice(11, 16) ?? null,
  }))

  return {
    city: c.key, cityFa: c.fa, provinceFa: c.province,
    provider: 'open-meteo',
    providerFa: 'Open-Meteo — مدل‌های عددی ترکیبی (ECMWF/GFS/ICON)',
    elevation: j.elevation ?? null,
    fetchedAt: new Date().toISOString(),
    now, days: finalizeDays(days), hours,
  }
}

// ─── تأمین‌کننده ۲: yr.no (مؤسسه هواشناسی نروژ — ECMWF) ───

async function fetchYrNo(c: WeatherCity): Promise<WeatherPayload> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${c.lat.toFixed(4)}&lon=${c.lon.toFixed(4)}`
  type Yr = {
    geometry: { coordinates: [number, number, number] }
    properties: {
      timeseries: Array<{
        time: string
        data: {
          instant: { details: { air_temperature?: number; relative_humidity?: number; wind_from_direction?: number; wind_speed?: number } }
          next_1_hours?: { summary?: { symbol_code?: string } }
          next_6_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } }
          next_12_hours?: { summary?: { symbol_code?: string } }
        }
      }>
    }
  }
  const j = await jfetch<Yr>(url, {
    headers: {
      // yr.no کاربر-ایجنت توصیفی الزام می‌کند
      'User-Agent': 'jange-sanj-local-dashboard/1.0 (personal weather tab; sandbox)',
      Accept: 'application/json',
    },
  })
  const series = j?.properties?.timeseries
  if (!Array.isArray(series) || series.length === 0) throw new Error('yrno: پاسخ نامعتبر')

  const nowMs = Date.now()
  let curIdx = series.findIndex((e) => new Date(e.time).getTime() >= nowMs)
  if (curIdx <= 0) curIdx = series.length - 1
  const cur = series[curIdx]
  const det = cur.data.instant.details
  const sym =
    cur.data.next_1_hours?.summary?.symbol_code ??
    cur.data.next_6_hours?.summary?.symbol_code ??
    cur.data.next_12_hours?.summary?.symbol_code ??
    ''
  const tehranHour = Number(hourFmt.format(new Date()).slice(0, 2))
  const isDay = sym.endsWith('_day') ? true : sym.endsWith('_night') ? false : tehranHour >= 6 && tehranHour < 19

  const now: WeatherNow = {
    temp: det.air_temperature ?? NaN,
    feelsLike: null,
    humidity: det.relative_humidity ?? null,
    windKmh: det.wind_speed !== undefined ? Math.round(det.wind_speed * 3.6 * 10) / 10 : null,
    windDirFa: windDirFa(det.wind_from_direction ?? null),
    uv: null,
    isDay,
    code: sym ? yrSymbolMap(sym) : 'cloudy',
  }
  if (Number.isNaN(now.temp)) throw new Error('yrno: دما در پاسخ نبود')

  const hours: WeatherHour[] = []
  for (let i = curIdx; i < series.length && hours.length < 24; i++) {
    const t = series[i].data.instant.details.air_temperature
    if (t === undefined) continue
    hours.push({ tFa: tehranHHMM(series[i].time), temp: t, precipProb: null })
  }

  // تجمیع روزانه کمترین/بیشترین به وقت تهران
  const byDay = new Map<string, { min: number; max: number; midSym?: string; midDist: number }>()
  for (const e of series) {
    const dk = tehranDateKey(new Date(e.time))
    const t = e.data.instant.details.air_temperature
    if (t === undefined) continue
    const b = byDay.get(dk) ?? { min: t, max: t, midDist: 99 }
    b.min = Math.min(b.min, t)
    b.max = Math.max(b.max, t)
    const hh = Number(tehranHHMM(e.time).slice(0, 2))
    const dist = Math.abs(hh - 13)
    if (dist < b.midDist) {
      b.midDist = dist
      b.midSym =
        e.data.next_1_hours?.summary?.symbol_code ??
        e.data.next_6_hours?.summary?.symbol_code ??
        e.data.next_12_hours?.summary?.symbol_code
    }
    byDay.set(dk, b)
  }
  const dkeys = [...byDay.keys()].sort().slice(0, 7)
  const days: WeatherDay[] = dkeys.map((dk) => {
    const b = byDay.get(dk)!
    return {
      date: dk,
      weekdayFa: faWeekday(dk),
      labelFa: '',
      code: b.midSym ? yrSymbolMap(b.midSym) : 'cloudy',
      min: Math.round(b.min * 10) / 10,
      max: Math.round(b.max * 10) / 10,
      precipProb: null,
      precipMM: null,
      sunriseFa: null,
      sunsetFa: null,
    }
  })

  return {
    city: c.key, cityFa: c.fa, provinceFa: c.province,
    provider: 'yrno',
    providerFa: 'yr.no — مؤسسه هواشناسی نروژ (مدل ECMWF)',
    elevation: j.geometry?.coordinates?.[2] ?? null,
    fetchedAt: new Date().toISOString(),
    now, days: finalizeDays(days, true), hours,
  }
}

// ─── تأمین‌کننده ۳: wttr.in (WWO — مشاهده‌شده) ───

async function fetchWttr(c: WeatherCity): Promise<WeatherPayload> {
  const url = `https://wttr.in/${c.lat},${c.lon}?format=j1`
  type Wttr = {
    current_condition: Array<{
      temp_C: string; FeelsLikeC: string; humidity: string; weatherCode: string
      winddir16Point: string; windspeedKmph: string; uvIndex?: string
    }>
    weather: Array<{
      date: string; mintempC: string; maxtempC: string; totalprecipMM?: string
      astronomy: Array<{ sunrise: string; sunset: string }>
      hourly: Array<{ time: string; tempC: string; weatherCode: string; chanceofrain?: string }>
    }>
  }
  const j = await jfetch<Wttr>(url)
  const cc = j?.current_condition?.[0]
  const wrows = j?.weather
  if (!cc || !Array.isArray(wrows) || wrows.length === 0) throw new Error('wttr: پاسخ نامعتبر')

  const tehranHour = Number(hourFmt.format(new Date()).slice(0, 2))
  const now: WeatherNow = {
    temp: Number(cc.temp_C),
    feelsLike: Number(cc.FeelsLikeC),
    humidity: Number(cc.humidity),
    windKmh: Number(cc.windspeedKmph),
    windDirFa: DIR16[cc.winddir16Point] ?? null,
    uv: cc.uvIndex ? Number(cc.uvIndex) : null,
    isDay: tehranHour >= 6 && tehranHour < 19,
    code: wwoMap(Number(cc.weatherCode)),
  }

  const hours: WeatherHour[] = []
  const today = wrows[0]
  for (const h of today.hourly ?? []) {
    const raw = h.time.padStart(4, '0')
    const hh = Number(raw.slice(0, 2))
    if (hh < tehranHour) continue // فقط ساعات باقی‌مانده امروز
    hours.push({ tFa: `${raw.slice(0, 2)}:00`, temp: Number(h.tempC), precipProb: h.chanceofrain ? Number(h.chanceofrain) : null })
  }

  const ampm24 = (s: string): string => {
    const m = s.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (!m) return s
    let h = Number(m[1]) % 24
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${m[2]}`
  }

  const days: WeatherDay[] = wrows.slice(0, 3).map((d) => {
    const mid = d.hourly?.[4] ?? d.hourly?.[0]
    return {
      date: d.date,
      weekdayFa: faWeekday(d.date),
      labelFa: '',
      code: mid ? wwoMap(Number(mid.weatherCode)) : wwoMap(Number(d.hourly?.[0]?.weatherCode ?? 119)),
      min: Number(d.mintempC),
      max: Number(d.maxtempC),
      precipProb: null,
      precipMM: d.totalprecipMM ? Number(d.totalprecipMM) : null,
      sunriseFa: ampm24(d.astronomy?.[0]?.sunrise ?? ''),
      sunsetFa: ampm24(d.astronomy?.[0]?.sunset ?? ''),
    }
  })

  return {
    city: c.key, cityFa: c.fa, provinceFa: c.province,
    provider: 'wttr',
    providerFa: 'wttr.in — مشاهدات WorldWeatherOnline',
    elevation: null,
    fetchedAt: new Date().toISOString(),
    now, days: finalizeDays(days), hours,
  }
}

// ─── برچسب امروز/فردا ───

function finalizeDays(days: WeatherDay[], partialToday = false): WeatherDay[] {
  const today = tehranDateKey(new Date())
  return days.map((d, i) => ({
    ...d,
    partial: d.date === today ? partialToday : false,
    labelFa: d.date === today ? (partialToday ? 'امشب' : 'امروز') : i === 1 ? 'فردا' : d.weekdayFa,
  }))
}

// ─── کش + زنجیره ───

const TTL_MS = 15 * 60 * 1000
const cache = new Map<string, { p: WeatherPayload; at: number }>()
const staleCache = new Map<string, { p: WeatherPayload; at: number }>()

export function isCityKey(k: string): boolean {
  return CITY_LIST.some((c) => c.key === k)
}

export async function getWeather(key: string, force = false): Promise<WeatherPayload> {
  const city = CITY_LIST.find((c) => c.key === key)
  if (!city) throw new Error('شهر یافت نشد')

  if (!force) {
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) return hit.p
  }

  const providers: Array<{ run: () => Promise<WeatherPayload> }> = [
    { run: () => fetchOpenMeteo(city) },
    { run: () => fetchYrNo(city) },
    { run: () => fetchWttr(city) },
  ]

  let lastErr: unknown = null
  for (const p of providers) {
    try {
      const payload = await p.run()
      cache.set(key, { p: payload, at: Date.now() })
      staleCache.set(key, { p: payload, at: Date.now() })
      return payload
    } catch (e) {
      lastErr = e
    }
  }
  console.error(`[weather] همهٔ منابع برای ${key} خطا خوردند:`, lastErr instanceof Error ? lastErr.message : lastErr)

  const stale = staleCache.get(key)
  if (stale) return { ...stale.p, stale: true }

  throw new Error('هیچ منبع هواشناسی پاسخ نداد — کمی بعد دوباره تلاش کن')
}
