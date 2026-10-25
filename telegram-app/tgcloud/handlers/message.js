// ─── هندلر پیام‌های چت بات: /start /help /check /setkey /setbase /setmodel ───
import { db } from 'sdk';
import { api } from 'sdk';
import { newsItem, assetSnapshot, riskDaily, report, setting } from '../schema.js';
import { newsTick } from '../lib/news.js';
import { refreshMarketQuotes } from '../lib/market.js';
import { computeRisk, getTodayRisk, riskTextFa } from '../lib/risk.js';
import { setSetting, aiChat } from '../lib/ai.js';
import { jalaliFa } from '../lib/util.js';

export default async function (message) {
  const chatId = message.chat?.id;
  if (!chatId) return;
  const text = (message.text ?? '').trim();
  if (!text.startsWith('/')) return; // پیام عادی → نادیده
  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(' ').trim();

  switch (cmd) {
    case '/start':
    case '/help':
      await api.sendMessage({
        chat_id: chatId,
        text:
          '🛡️ <b>روزنامه فردا — سامانه هشدار جنگ و پیش‌بینی بازارها</b>\n\n' +
          'دستورها:\n' +
          '/check — بروزرسانی کامل: بازار + اخبار + امتیاز تنش + ۴ تاریخ حمله\n' +
          '/report — گزارش تحلیلی هوش مصنوعی\n' +
          '/setkey sk-... — ثبت کلید API هوش مصنوعی (سازگار OpenAI)\n' +
          '/setbase https://... — آدرس پایه API (پیش‌فرض OpenAI)\n' +
          '/setmodel gpt-4o-mini — انتخاب مدل\n\n' +
          'اپ کامل را از دکمه منوی بات باز کن 👇',
        parse_mode: 'HTML',
      });
      return;

    case '/setkey': {
      if (!arg || arg.length < 8) {
        await api.sendMessage({ chat_id: chatId, text: '❌ فرمت درست: /setkey sk-...' });
        return;
      }
      await setSetting(db, setting, 'ai_key', arg);
      await api.sendMessage({ chat_id: chatId, text: '✅ کلید هوش مصنوعی ذخیره شد.' });
      return;
    }
    case '/setbase': {
      if (!/^https:\/\//.test(arg)) {
        await api.sendMessage({ chat_id: chatId, text: '❌ فرمت درست: /setbase https://api.openai.com/v1' });
        return;
      }
      await setSetting(db, setting, 'ai_base', arg);
      await api.sendMessage({ chat_id: chatId, text: '✅ آدرس API ذخیره شد.' });
      return;
    }
    case '/setmodel': {
      await setSetting(db, setting, 'ai_model', arg || 'gpt-4o-mini');
      await api.sendMessage({ chat_id: chatId, text: `✅ مدل روی «${arg || 'gpt-4o-mini'}» تنظیم شد.` });
      return;
    }

    case '/check': {
      const st = await api.sendMessage({ chat_id: chatId, text: '⏳ در حال بروزرسانی: بازار + اخبار + ریسک...' });
      let market = 0;
      let news = 0;
      try {
        market = await refreshMarketQuotes(db, assetSnapshot);
      } catch {}
      try {
        const r = await newsTick(db, { newsItem, setting });
        news = r.added;
      } catch {}
      const risk = await computeRisk(db, { riskDaily, assetSnapshot, newsItem });
      try {
        await api.deleteMessage({ chat_id: chatId, message_id: st.message_id });
      } catch {}
      await api.sendMessage({
        chat_id: chatId,
        text:
          `✅ بروزرسانی شد — ${jalaliFa(new Date())}\n` +
          `💱 دارایی: ${market} | 📰 خبر جدید: ${news}\n\n` +
          riskTextFa(risk),
      });
      return;
    }

    case '/report': {
      await api.sendMessage({ chat_id: chatId, text: '🧠 در حال تولید گزارش تحلیلی...' });
      try {
        const risk = await computeRisk(db, { riskDaily, assetSnapshot, newsItem });
        const content = await aiChat(
          db,
          setting,
          [
            {
              role: 'system',
              content:
                'تو تحلیلگر جنگ و امنیت بین‌الملل هستی. فقط به فارسی روان، خلاصه و بی‌طرف تحلیل کن. از رسانه‌های ایرانی رسمی استفاده نکن.',
            },
            {
              role: 'user',
              content:
                `امتیاز تنش امروز ${risk.score}/100 (وضعیت ${risk.level}). ` +
                `اخبار ۲۴ ساعت اخیر را با زبان ساده تحلیل کن: احتمال درگیری ایران-آمریکا-اسرائیل، وضعیت تنگه هرمز، بازار نفت/طلا/کریپتو. ` +
                `در پایان ۴ تاریخ پیشنهادی بده: نزدیک‌ترین، میانه، دورترین و محتمل‌ترین (تا ۱۴ روز آینده).`,
            },
          ],
          1000
        );
        await api.sendMessage({ chat_id: chatId, text: content.slice(0, 4000) });
      } catch (e) {
        await api.sendMessage({
          chat_id: chatId,
          text: `❌ خطا: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
      return;
    }

    default:
      await api.sendMessage({
        chat_id: chatId,
        text: 'دستور ناشناخته — /help را بزن',
      });
  }
}
