// ─── زمان‌بند بات‌های رادار تنش ───
// هر ۳ دقیقه بات‌های اصلی را از طریق API Next.js اجرا می‌کند
// حتی اگر مرورگر کاربر باز نباشد داده‌ها تازه می‌مانند

const APP_URL = 'http://localhost:3000'
const PORT = 3021
const TICK_INTERVAL_MS = 3 * 60 * 1000

let lastTickAt: string | null = null
let lastTickStatus: string = 'آغاز نشده'
let tickCount = 0

async function runTick(): Promise<void> {
  tickCount++
  try {
    const res = await fetch(`${APP_URL}/api/bots/tick`, { method: 'POST' })
    if (res.ok) {
      lastTickStatus = 'موفق'
    } else {
      lastTickStatus = `HTTP ${res.status}`
    }
  } catch (e) {
    lastTickStatus = `خطا: ${e instanceof Error ? e.message : String(e)}`
  }
  lastTickAt = new Date().toISOString()
  console.log(
    `[scheduler] tick #${tickCount} — ${lastTickStatus} — ${lastTickAt}`
  )
}

// تیک اولیه بعد از ۸ ثانیه (تا سرور بالا بیاید)
setTimeout(runTick, 8000)
setInterval(runTick, TICK_INTERVAL_MS)

// سرور وضعیت کوچک برای مانیتورینگ
Bun.serve({
  port: PORT,
  fetch() {
    return new Response(
      JSON.stringify(
        {
          service: 'tension-radar-bot-scheduler',
          intervalMs: TICK_INTERVAL_MS,
          tickCount,
          lastTickAt,
          lastTickStatus,
        },
        null,
        2
      ),
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    )
  },
})

console.log(`[scheduler] bot scheduler running on port ${PORT}`)
