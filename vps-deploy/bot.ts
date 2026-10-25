// ─── بات تلگرام مستقل — نسخه سرور مجازی (VPS) ───
// اجرا: bun vps-deploy/bot.ts  (با Bun روی سرور)
// متغیرهای محیطی:
//   TELEGRAM_BOT_TOKEN  (اجباری) — توکن بات از BotFather → API Token
//   DATABASE_URL        (اجباری) — مثل file:/opt/warrisk/db/custom.db
//   MINIAPP_URL         (اختیاری) — https://دامنه → دکمه باز کردن اپ در /start
//   ADMIN_CHAT_ID       (اختیاری) — فقط این chat_id ها می‌توانند /setkey و... بزنند
// دستورها: /start /help /check /report /setkey /setbase /setmodel
// نکته: این بات فقط از دیتابیس می‌خواند — محاسبه ریسک/خبر/بازار با اپ وب (تیک هر ۶۰ ثانیه)

import { PrismaClient } from '@prisma/client'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const DB_URL = process.env.DATABASE_URL ?? ''
const MINIAPP_URL = (process.env.MINIAPP_URL ?? '').replace(/\/+$/, '')
const ADMIN_IDS = (process.env.ADMIN_CHAT_ID ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN تنظیم نشده است.')
  process.exit(1)
}
if (!DB_URL) {
  console.error('❌ DATABASE_URL تنظیم نشده است.')
  process.exit(1)
}

const db = new PrismaClient({
  datasources: { db: { url: DB_URL } },
})

// ─── ابزارها ───
const API = `https://api.telegram.org/bot${TOKEN}`

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function tg(method: string, payload: Record<string, unknown>): Promise<any> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 65_000)
  try {
    const res = await fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    })
    const j = await res.json()
    if (!j.ok) throw new Error(`Telegram ${method}: ${j.description ?? res.status}`)
    return j.result
  } finally {
    clearTimeout(t)
  }
}

const faToday = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

const faJalali = (ymd: string): string => {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(`${ymd}T12:00:00Z`))
  } catch {
    return ymd
  }
}

const LEVEL_FA: Record<string, string> = {
  calm: 'آرام',
  watch: 'پایش',
  elevated: 'هشدار',
  high: 'بحرانی',
  critical: 'فوری',
}
const TREND_FA: Record<string, string> = { up: '↑ صعودی', down: '↓ نزولی', flat: '→ ثابت' }

// ─── تنظیمات AI ───
async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
}

const isAdmin = (chatId: number): boolean => ADMIN_IDS.length === 0 || ADMIN_IDS.includes(String(chatId))

// ─── متن /check ───
async function checkText(): Promise<string> {
  const today = faToday()
  const risk =
    (await db.riskDaily.findUnique({ where: { date: today } })) ??
    (await db.riskDaily.findFirst({ orderBy: { date: 'desc' } }))

  const assets = await db.assetSnapshot.findMany({ orderBy: { updatedAt: 'desc' } })
  const pick = (re: RegExp) => assets.find((a) => re.test(a.symbol))
  const fmtAsset = (a: { name: string; price: number; change1d: number | null; unit: string | null }) => {
    const ch = a.change1d == null ? '' : ` (${a.change1d >= 0 ? '+' : ''}${a.change1d.toFixed(1)}%)`
    return `• ${a.name}: ${a.unit ?? ''}${a.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}${ch}`
  }

  const since24 = new Date(Date.now() - 24 * 3600 * 1000)
  const [newsTotal, newsHot] = await Promise.all([
    db.newsItem.count({ where: { publishedAt: { gte: since24 }, aiVerdict: { not: 'irrelevant' }, isAd: false } }),
    db.newsItem.count({
      where: {
        publishedAt: { gte: since24 },
        isAd: false,
        OR: [{ aiVerdict: 'war_signal' }, { tensionScore: { gte: 60 } }],
      },
    }),
  ])

  const lines: string[] = []
  lines.push(`🛡️ <b>وضعیت سامانه — ${esc(faJalali(today))}</b>`)
  if (!risk) {
    lines.push('هنوز داده ریسکی ثبت نشده — اپ وب را باز کن تا اولین محاسبه انجام شود.')
    return lines.join('\n')
  }
  lines.push(
    `تنش امروز: <b>${Math.round(risk.score)}/100</b> — ${esc(LEVEL_FA[risk.level] ?? risk.level)} | روند ${esc(TREND_FA[risk.trend] ?? risk.trend)}`,
  )
  lines.push('━━━━━━━━━━━━━━━')
  const btc = pick(/BTC/i)
  const oil = pick(/BZ|CL|BRENT|WTI/i)
  const gold = pick(/GC|GOLD|XAU/i)
  const spx = pick(/SPX|GSPC/i)
  const vix = pick(/VIX/i)
  const shown = [btc, oil, gold, spx, vix].filter(Boolean)
  if (shown.length) {
    lines.push('💱 <b>بازار:</b>')
    for (const a of shown) lines.push(fmtAsset(a))
  }
  lines.push(`📰 خبر ۲۴ ساعت: <b>${newsTotal}</b> مورد${newsHot ? ` (🔥 ${newsHot} داغ)` : ''}`)
  const dates: Array<[string, string | null]> = [
    ['نزدیک‌ترین', risk.attackDateNear],
    ['میانه', risk.attackDateMid],
    ['دورترین', risk.attackDateFar],
    ['محتمل‌ترین ⭐', risk.predictedAttackDate],
  ]
  if (dates.some(([, v]) => v)) {
    lines.push('🎯 <b>سناریوهای روز حمله:</b>')
    for (const [label, v] of dates) {
      if (!v) continue
      lines.push(`• ${label}: <b>${esc(faJalali(v))}</b>`)
    }
    if (risk.attackConfidence > 0) lines.push(`اطمینان مدل: <b>${Math.round(risk.attackConfidence)}٪</b>`)
  }
  if (risk.rationaleFa) lines.push(`💡 ${esc(risk.rationaleFa.slice(0, 400))}`)
  return lines.join('\n')
}

// ─── دکمه مینی‌اپ ───
function startKeyboard() {
  if (!MINIAPP_URL) return undefined
  return {
    inline_keyboard: [[{ text: '🚀 باز کردن داشبورد', web_app: { url: MINIAPP_URL } }]],
  }
}

// ─── پردازش هر دستور ───
async function handle(msg: any): Promise<void> {
  const chatId = msg?.chat?.id
  if (!chatId) return
  const text = (msg.text ?? '').trim()
  if (!text.startsWith('/')) return
  const [cmdRaw, ...rest] = text.split(/\s+/)
  const cmd = cmdRaw.split('@')[0].toLowerCase()
  const arg = rest.join(' ').trim()

  try {
    switch (cmd) {
      case '/start':
      case '/help':
        await tg('sendMessage', {
          chat_id: chatId,
          text:
            '🛡️ <b>سامانه هشدار زودهنگام جنگ</b>\n\n' +
            'دستورها:\n' +
            '/check — وضعیت کامل: بازار + اخبار + امتیاز تنش + ۴ تاریخ حمله\n' +
            '/report — آخرین گزارش تحلیلی هوش مصنوعی\n' +
            '/setkey sk-... — ثبت کلید API هوش مصنوعی (سازگار OpenAI)\n' +
            '/setbase https://... — آدرس پایه API (پیش‌فرض OpenAI)\n' +
            '/setmodel نام‌مدل — انتخاب مدل\n\n' +
            'داده‌ها هر ۶۰ ثانیه خودکار بروز می‌شوند.',
          parse_mode: 'HTML',
          reply_markup: startKeyboard(),
          disable_web_page_preview: true,
        })
        return

      case '/check': {
        const st = await tg('sendMessage', { chat_id: chatId, text: '⏳ در حال خواندن داده‌ها...' })
        const body = await checkText()
        await tg('editMessageText', {
          chat_id: chatId,
          message_id: st.message_id,
          text: body,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        })
        return
      }

      case '/report': {
        const st = await tg('sendMessage', { chat_id: chatId, text: '🧠 در حال واکشی گزارش...' })
        const rep = await db.report.findFirst({ orderBy: { createdAt: 'desc' } })
        if (!rep) {
          await tg('editMessageText', {
            chat_id: chatId,
            message_id: st.message_id,
            text: 'هنوز گزارشی تولید نشده. اپ وب را باز کن و چند دقیقه صبر کن تا گزارش اول ساخته شود.',
          })
          return
        }
        await tg('editMessageText', {
          chat_id: chatId,
          message_id: st.message_id,
          text: `🧠 <b>گزارش تحلیلی — ${esc(faJalali(faToday()))}</b>\n\n${esc(rep.content).slice(0, 3800)}`,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        })
        return
      }

      case '/setkey':
      case '/setbase':
      case '/setmodel': {
        if (!isAdmin(chatId)) {
          await tg('sendMessage', { chat_id: chatId, text: '⛔ این دستور فقط برای مدیر بات است.' })
          return
        }
        if (cmd === '/setkey') {
          if (!arg || arg.length < 8) {
            await tg('sendMessage', { chat_id: chatId, text: '❌ فرمت درست: /setkey sk-...' })
            return
          }
          await setSetting('ai_key', arg)
          await tg('sendMessage', { chat_id: chatId, text: '✅ کلید هوش مصنوعی ذخیره شد. (تا ۳۰ ثانیه دیگر همه‌جا فعال می‌شود)' })
        } else if (cmd === '/setbase') {
          if (!/^https:\/\//.test(arg)) {
            await tg('sendMessage', { chat_id: chatId, text: '❌ فرمت درست: /setbase https://api.openai.com/v1' })
            return
          }
          await setSetting('ai_base', arg)
          await tg('sendMessage', { chat_id: chatId, text: '✅ آدرس پایه API ذخیره شد.' })
        } else {
          if (!arg) {
            await tg('sendMessage', { chat_id: chatId, text: '❌ فرمت درست: /setmodel gpt-4o-mini' })
            return
          }
          await setSetting('ai_model', arg)
          await tg('sendMessage', { chat_id: chatId, text: `✅ مدل روی «${esc(arg)}» تنظیم شد.` })
        }
        return
      }

      default:
        await tg('sendMessage', { chat_id: chatId, text: 'دستور ناشناخته — /help را بزن.' })
    }
  } catch (e) {
    try {
      await tg('sendMessage', {
        chat_id: chatId,
        text: `❌ خطا: ${esc(e instanceof Error ? e.message : String(e)).slice(0, 300)}`,
      })
    } catch {
      // بی‌خیال
    }
  }
}

// ─── حلقه polling ───
async function main(): Promise<void> {
  let me: { username?: string }
  try {
    me = await tg('getMe')
  } catch {
    console.error('❌ اتصال به تلگرام نشد — توکن نامعتبر است یا سرور به api.telegram.org دسترسی ندارد.')
    process.exit(1)
  }
  console.log(`✅ بات متصل شد: @${me.username} — در حال گوش دادن...`)
  let offset = 0
  let failures = 0
  for (;;) {
    try {
      const updates = await tg('getUpdates', {
        offset,
        timeout: 30,
        allowed_updates: ['message'],
      })
      failures = 0
      for (const u of updates) {
        offset = u.update_id + 1
        if (u.message) await handle(u.message)
      }
    } catch (e) {
      failures++
      const msgText = e instanceof Error ? e.message : String(e)
      if (msgText.includes('409')) {
        console.error('⚠️ 409: یک بات دیگر همان توکن را poll می‌کند — نمونه قبلی را خاموش کن.')
      }
      console.error(`خطای polling (${failures}): ${msgText.slice(0, 200)}`)
      await new Promise((r) => setTimeout(r, Math.min(3000 * failures, 15_000)))
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('💥 بات متوقف شد:', e)
    process.exit(1)
  })
