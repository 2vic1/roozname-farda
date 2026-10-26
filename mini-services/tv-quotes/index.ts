// ─── سرویس کوتی زنده تریدینگ‌ویو (وب‌سوکت رسمی خود سایت) ───
// چرا؟ نمادهای اسپات/CFD نفت (OANDA:BCOUSD و CFI:WTI — مرجع واچ‌لیست کاربر)
// در اسکنر عمومی و یاهو وجود ندارند؛ فقط وب‌سوکت data.tradingview.com کوتی زنده می‌دهد.
// این سرویس اتصال را دائم زنده نگه می‌دارد و روی پورت 3030 به‌صورت HTTP سرو می‌کند.
// GET /quotes?symbols=A,B,C  →  { "A": { price, changePct, ts }, ... }
// GET /health               →  { ok, connected, symbols }

const PORT = 3030
const TV_WS_URL = 'wss://data.tradingview.com/socket.io/websocket'
const ORIGIN = 'https://www.tradingview.com'

// نمادهای پیش‌فرض که همیشه سابسکرایب‌اند (نفت — دقیقاً نمادهای واچ‌لیست کاربر)
const DEFAULT_SYMBOLS = ['OANDA:BCOUSD', 'CFI:WTI']

interface TvQuote {
  price: number
  changePct: number
  changeAbs?: number
  description?: string
  ts: number
}

const quotes = new Map<string, TvQuote>()
const subscribed = new Set<string>()
let ws: WebSocket | null = null
let reconnectDelay = 2000
let lastMessageAt = 0
let rawCount = 0

function frame(payload: string): string {
  return `~m~${payload.length}~m~${payload}`
}

function connect() {
  try {
    ws = new WebSocket(TV_WS_URL, {
      headers: { Origin: ORIGIN, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36' },
    } as unknown as undefined)
  } catch (e) {
    console.error('[tv-quotes] ws create failed:', e)
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    console.log('[tv-quotes] connected to tradingview')
    reconnectDelay = 2000
    lastMessageAt = Date.now()
    const syms = [...new Set([...DEFAULT_SYMBOLS, ...subscribed])]
    subscribed.clear()
    send({ m: 'set_auth_token', p: ['unauthorized_user_token'] })
    send({ m: 'quote_create_session', p: ['qs_main'] })
    send({
      m: 'quote_set_fields',
      p: ['qs_main', 'lp', 'ch', 'chp', 'description', 'update_mode'],
    })
    if (syms.length) send({ m: 'quote_add_symbols', p: ['qs_main', ...syms] })
    for (const s of syms) subscribed.add(s)
  }

  ws.onmessage = (ev) => {
    lastMessageAt = Date.now()
    const raw = String(ev.data)
    if (process.env.TVQ_DEBUG && rawCount < 6) { rawCount++; console.log('[tv-quotes][raw]', raw.slice(0, 240)) }
    // پاسخ به heartbeat سرور
    const h = raw.match(/~m~\d+~m~~h~(\d+)/)
    if (h) {
      ws?.send(frame('~h~' + h[1]))
      return
    }
    if (!raw.startsWith('~m~')) return
    const parts = raw.split('~m~')
    for (let i = 1; i < parts.length; i += 2) {
      const payload = parts[i + 1]
      if (!payload) continue
      try {
        const j = JSON.parse(payload)
        if (j.m === 'qsd' && Array.isArray(j.p) && j.p[1]) {
          const d = j.p[1] as { n: string; s: string; v?: Record<string, number | string>; errmsg?: string }
          if (d.s === 'ok' && d.v && typeof d.v.lp === 'number') {
            const prev = quotes.get(d.n)
            quotes.set(d.n, {
              price: d.v.lp,
              changePct: typeof d.v.chp === 'number' ? d.v.chp : (prev?.changePct ?? 0),
              changeAbs: typeof d.v.ch === 'number' ? d.v.ch : undefined,
              description: typeof d.v.description === 'string' ? d.v.description : undefined,
              ts: Date.now(),
            })
          } else if (d.s === 'error') {
            console.warn('[tv-quotes] symbol error:', d.n, d.errmsg)
          }
        } else if (j.m === 'du' && Array.isArray(j.p) && j.p[1]) {
          // آپدیت جزئی: { SYM: { lp?, ch?, chp? ... } }
          const updates = j.p[1] as Record<string, Record<string, number | string>>
          for (const [sym, patch] of Object.entries(updates)) {
            const cur = quotes.get(sym)
            if (!cur) continue
            if (typeof patch.lp === 'number') cur.price = patch.lp
            if (typeof patch.chp === 'number') cur.changePct = patch.chp
            if (typeof patch.ch === 'number') cur.changeAbs = patch.ch
            cur.ts = Date.now()
          }
        }
      } catch {
        // فریم‌های غیر JSON نادیده گرفته می‌شوند
      }
    }
  }

  ws.onclose = (e) => {
    console.warn('[tv-quotes] closed:', e.code, e.reason?.slice(0, 100))
    ws = null
    scheduleReconnect()
  }

  ws.onerror = () => {
    // onclose بعدش می‌آید
  }
}

function scheduleReconnect() {
  setTimeout(connect, reconnectDelay)
  reconnectDelay = Math.min(reconnectDelay * 1.5, 30000)
}

function send(m: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(frame(JSON.stringify(m)))
}

// نظارت: اگر ۴۵ ثانیه پیام نیامد، اتصال را ری‌ست کن
setInterval(() => {
  if (ws && Date.now() - lastMessageAt > 45000) {
    console.warn('[tv-quotes] stale connection, reconnecting')
    try { ws.close() } catch {}
    ws = null
    scheduleReconnect()
  }
}, 15000)

connect()

// ─── HTTP ───
const SUB_RE = /^[A-Z0-9_]{1,24}:[A-Z0-9_.!]{1,24}$/

function addSymbols(list: string[]) {
  const fresh = list.filter((s) => s && !subscribed.has(s))
  if (fresh.length && ws && ws.readyState === WebSocket.OPEN) {
    send({ m: 'quote_add_symbols', p: ['qs_main', ...fresh] })
    for (const s of fresh) subscribed.add(s)
  }
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/health') {
      return Response.json({
        ok: true,
        connected: !!ws && ws.readyState === WebSocket.OPEN,
        symbols: [...subscribed],
        quotes: quotes.size,
      })
    }
    if (url.pathname === '/quotes') {
      const raw = url.searchParams.get('symbols') ?? ''
      const list = raw.split(',').map((s) => s.trim()).filter((s) => SUB_RE.test(s)).slice(0, 20)
      if (list.length) addSymbols(list)
      const out: Record<string, { price: number; changePct: number; ts: number }> = {}
      for (const s of list) {
        const q = quotes.get(s)
        if (q) out[s] = { price: q.price, changePct: q.changePct, ts: q.ts }
      }
      return Response.json(out)
    }
    return new Response('tv-quotes service', { status: 200 })
  },
})

console.log(`[tv-quotes] listening on :${PORT}`)
