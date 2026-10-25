// ─── هوش مصنوعی: کلاینت سازگار OpenAI — کلید از دیتابیس (با /setkey) ───
// z-ai-web-dev-sdk روی tgcloud اجرا نمیشود؛ هر API سازگار OpenAI کار میکند
// (OpenAI / OpenRouter / Gemini با سازگاری OpenAI و...)
import { fetchJsonPost } from './util.js';

export async function getSetting(db, setting, key) {
  const { eq } = await import('sdk/db');
  const row = await db.select().from(setting).where(eq(setting.key, key)).get();
  return row?.value ?? null;
}

export async function setSetting(db, setting, key, value) {
  const { sql } = await import('sdk/db');
  await db
    .insert(setting)
    .values({ key, value })
    .onConflictDoUpdate({ target: setting.key, set: { value } })
    .run();
}

export async function aiReady(db, setting) {
  return !!(await getSetting(db, setting, 'ai_key'));
}

/** chat completions — messages: [{role, content}] */
export async function aiChat(db, setting, messages, maxTokens = 1200) {
  const base = (await getSetting(db, setting, 'ai_base')) ?? 'https://api.openai.com/v1';
  const key = await getSetting(db, setting, 'ai_key');
  const model = (await getSetting(db, setting, 'ai_model')) ?? 'gpt-4o-mini';
  if (!key) throw new Error('کلید هوش مصنوعی تنظیم نشده — در چت بات بنویس: /setkey sk-...');
  const j = await fetchJsonPost(`${base.replace(/\/$/, '')}/chat/completions`, {
    model,
    messages,
    max_tokens: maxTokens,
    temperature: 0.4,
  }, 60000);
  const text = j?.choices?.[0]?.message?.content;
  if (!text) throw new Error('پاسخ خالی از سرویس هوش مصنوعی');
  return text;
}
