// ─── لایه یکپارچه هوش مصنوعی (AI Gateway) ───
// اولویت ۱: کلید سازگار-OpenAI کاربر — از جدول Setting (با /setkey بات تلگرام) یا env
//   → این مسیر روی سرور مجازی (VPS) استفاده میشود؛ z-ai-web-dev-sdk آنجا در دسترس نیست
// اولویت ۲: z-ai-web-dev-sdk (سندباکس) — رفتار بدون تغییر
// هر دو مسیر رشتهٔ متن پاسخ را برمی‌گردانند؛ ساختار callsite ها دست‌نخورده می‌ماند.

import { db } from '@/lib/db'

export interface AiMessage {
  role: string
  content: string
}

export interface AiChatOptions {
  messages: AiMessage[]
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
}

interface UserAiConfig {
  base: string
  key: string
  model: string
}

// کش ۳۰ ثانیه‌ای تنظیمات — هر ۳۰ ثانیه تغییرات /setkey بات دیده می‌شود
let cache: { at: number; cfg: UserAiConfig | null } | null = null
const CACHE_MS = 30_000

async function loadUserAi(): Promise<UserAiConfig | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.cfg
  // ابتدا env (مناسب VPS) — بعد جدول Setting (با /setkey بات، اولویت بالاتر)
  let base = (process.env.AI_BASE_URL ?? '').trim()
  let key = (process.env.AI_API_KEY ?? '').trim()
  let model = (process.env.AI_MODEL ?? '').trim()
  try {
    const rows = await db.setting.findMany({
      where: { key: { in: ['ai_base', 'ai_key', 'ai_model'] } },
    })
    for (const r of rows) {
      if (!r.value) continue
      if (r.key === 'ai_base') base = r.value.trim()
      else if (r.key === 'ai_key') key = r.value.trim()
      else if (r.key === 'ai_model') model = r.value.trim()
    }
  } catch {
    // جدول Setting هنوز ساخته نشده — فقط env
  }
  const cfg: UserAiConfig | null = key
    ? {
        base: (base || 'https://api.openai.com/v1').replace(/\/+$/, ''),
        key,
        model: model || 'gpt-4o-mini',
      }
    : null
  cache = { at: Date.now(), cfg }
  return cfg
}

/** پاک کردن کش تنظیمات — بعد از /setkey بات صدا زده می‌شود (همان پروسه وب) */
export function clearAiConfigCache(): void {
  cache = null
}

/**
 * چت‌کامپلیشن یکپارچه: اگر کلید کاربر تنظیم باشد OpenAI-سازگار، وگرنه z-ai (سندباکس).
 * خروجی: متن پیام پاسخ (choices[0].message.content)
 */
export async function aiChatCompletion(opts: AiChatOptions): Promise<string> {
  const user = await loadUserAi()

  if (user) {
    // ─── مسیر VPS: کلاینت سازگار OpenAI ───
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 120_000)
    try {
      // سازگاری نقش‌ها: پیام اول «assistant» سبک z-ai است → «system» استاندارد
      const messages = opts.messages.map((m, i) =>
        i === 0 && m.role === 'assistant' ? { role: 'system', content: m.content } : m,
      )
      const res = await fetch(`${user.base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.key}`,
        },
        body: JSON.stringify({
          model: user.model,
          messages,
          max_tokens: opts.maxTokens ?? 2000,
          temperature: opts.temperature ?? 0.4,
        }),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`سرویس هوش مصنوعی خطای ${res.status} داد${body ? `: ${body.slice(0, 180)}` : ''}`)
      }
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      const text = j?.choices?.[0]?.message?.content
      if (!text) throw new Error('پاسخ خالی از سرویس هوش مصنوعی')
      return text
    } finally {
      clearTimeout(timer)
    }
  }

  // ─── مسیر سندباکس: z-ai-web-dev-sdk (رفتار قبلی، بدون تغییر) ───
  const { default: ZAI } = await import('z-ai-web-dev-sdk')
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: opts.messages,
    thinking: { type: 'disabled' },
  })
  return ((completion.choices?.[0]?.message?.content as string) ?? '') as string
}
