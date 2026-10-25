// ─── اسکیمای دیتابیس tgcloud (SQLite داخلی تلگرام) ───
// پورت سبک‌شده از prisma/schema.prisma اپ وب — جدول‌های اصلی سیستم هشدار
import { table, text, integer, real, boolean, sql } from 'sdk/db';

// اخبار مرتبط (فقط جنگ/تنش ایران-آمریکا-اسرائیل-هرمز)
export const newsItem = table('news_item', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  externalId: text('external_id').notNull().unique(),
  sourceType: text('source_type').notNull(),
  sourceLabel: text('source_label').notNull(),
  title: text('title').notNull(),
  url: text('url'),
  lang: text('lang').notNull().default('en'),
  publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(),
  textFa: text('text_fa'),
  aiVerdict: text('ai_verdict'), // war_signal | tension | diplomacy | routine | irrelevant
  tensionScore: real('tension_score').notNull().default(0),
  isAd: boolean('is_ad').notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// قیمت لحظه‌ای دارایی‌ها (۱۱ دارایی — همان مرجع تریدینگ‌ویو اپ وب)
export const assetSnapshot = table('asset_snapshot', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  symbol: text('symbol').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  unit: text('unit').notNull().default('$'),
  price: real('price').notNull().default(0),
  change1d: real('change1d').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// امتیاز ریسک روزانه + ۴ تاریخ حمله
export const riskDaily = table('risk_daily', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(), // YYYY-MM-DD (تقویم میلادی)
  score: integer('score').notNull().default(0), // 0..100
  level: text('level').notNull().default('آرام'),
  newsComponent: real('news_component').notNull().default(0),
  marketComponent: real('market_component').notNull().default(0),
  attackDateNear: text('attack_date_near'),
  attackDateMid: text('attack_date_mid'),
  attackDateFar: text('attack_date_far'),
  attackDateLikely: text('attack_date_likely'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// گزارش هوش مصنوعی (کش‌شده با ترمز ۲۰ دقیقه + جهش ≥۸ امتیاز)
export const report = table('report', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  riskScore: integer('risk_score').notNull().default(0),
  generatedAt: integer('generated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  contentFa: text('content_fa').notNull(),
  nearDate: text('near_date'),
  midDate: text('mid_date'),
  farDate: text('far_date'),
  likelyDate: text('likely_date'),
});

// تنظیمات (کلید هوش مصنوعی، اندیس گردش منابع و...) — بدون هاردکد رمز در کد
export const setting = table('setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
