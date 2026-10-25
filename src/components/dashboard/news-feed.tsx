'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  AtSign,
  Globe,
  Instagram,
  Languages,
  Megaphone,
  MessageSquareQuote,
  Send,
  Sparkles,
} from 'lucide-react'
import { levelMeta, langFa, relTimeFa, SOURCE_TYPE_FA, verdictMeta } from './types'
import type { NewsData, SourceType, Verdict } from './types'

type VerdictFilter = 'all' | 'analyzable' | Verdict
type TypeFilter = 'all' | SourceType

const SOURCE_TYPE_ICON: Record<string, typeof Send> = {
  telegram: Send,
  x: AtSign,
  instagram: Instagram,
  rss: Globe,
}

export function SourceTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = SOURCE_TYPE_ICON[type] ?? Globe
  return <Icon className={className} aria-hidden />
}

// فید زنده اخبار با ترجمه فارسی، حکم هوش مصنوعی و فیلترها
export function NewsFeed({ news }: { news: NewsData[] }) {
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [showAds, setShowAds] = useState(false)

  // زمان مرجع برای «چند دقیقه پیش» — با هر بروزرسانی اخبار تازه می‌شود
  const now = useMemo(() => new Date(), [news])

  const filtered = useMemo(() => {
    let out = news
    // اخبار نامرتبط با جنگ ایران/اسرائیل/آمریکا/هرمز هرگز نمایش داده نمی‌شوند (الزام کاربر)
    out = out.filter((n) => n.aiVerdict !== 'irrelevant')
    if (!showAds) out = out.filter((n) => !n.isAd)
    if (verdictFilter === 'analyzable') {
      out = out.filter((n) => !n.isAd && !n.isOpinion)
    } else if (verdictFilter !== 'all') {
      out = out.filter((n) => n.aiVerdict === verdictFilter)
    }
    if (typeFilter !== 'all') out = out.filter((n) => n.sourceType === typeFilter)
    return out
  }, [news, verdictFilter, typeFilter, showAds])

  const verdictFilters: Array<{ key: VerdictFilter; label: string }> = [
    { key: 'all', label: 'همه' },
    { key: 'analyzable', label: 'فقط تحلیل‌پذیر' },
    { key: 'war_signal', label: 'سیگنال جنگی' },
    { key: 'tension', label: 'تنش' },
    { key: 'diplomacy', label: 'دیپلماتیک' },
  ]

  const typeFilters: Array<{ key: TypeFilter; label: string }> = [
    { key: 'all', label: 'همه منابع' },
    { key: 'telegram', label: 'تلگرام' },
    { key: 'x', label: 'ایکس' },
    { key: 'instagram', label: 'اینستاگرام' },
    { key: 'rss', label: 'وب‌سایت' },
  ]

  return (
    <div className="space-y-3">
      {/* فیلترها */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {verdictFilters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={verdictFilter === f.key ? 'default' : 'outline'}
              className={`h-8 rounded-full text-xs ${
                verdictFilter === f.key ? '' : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              onClick={() => setVerdictFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
          <label className="ms-auto flex cursor-pointer items-center gap-2 text-[11px] text-zinc-500">
            نمایش تبلیغ‌ها
            <Switch checked={showAds} onCheckedChange={setShowAds} aria-label="نمایش تبلیغ‌ها" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {typeFilters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={typeFilter === f.key ? 'secondary' : 'ghost'}
              className={`h-7 rounded-full px-3 text-[11px] ${
                typeFilter === f.key ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              onClick={() => setTypeFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
          <span className="ms-auto text-xs text-zinc-500">
            {filtered.length.toLocaleString('fa-IR')} خبر
          </span>
        </div>
      </div>

      {/* لیست اخبار */}
      <div className="max-h-[560px] divide-y divide-zinc-800/60 overflow-y-auto rounded-lg border border-zinc-800/60">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-zinc-500">
            خبری در این دسته نیست — بات خبرگیر در حال کار است
          </div>
        )}
        {filtered.map((n) => {
          const meta = levelMeta(n.level)
          const verdict = verdictMeta(n.aiVerdict)
          const SourceIcon = SOURCE_TYPE_ICON[n.sourceType] ?? Globe
          const keywords = parseKeywords(n.keywords)

          return (
            <article key={n.id} className="px-4 py-3.5 transition-colors hover:bg-zinc-800/30">
              <div className="flex items-start gap-3">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: meta.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  {/* متن اصلی: برای خبر غیرفارسی، ترجمه فارسی در اولویت نمایش است */}
                  {n.lang !== 'fa' && n.textFa ? (
                    <>
                      <a
                        href={n.url ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block text-sm leading-6 text-zinc-200 ${
                          n.url ? 'hover:text-amber-300 hover:underline' : ''
                        }`}
                      >
                        {n.textFa}
                      </a>
                      <a
                        href={n.url ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-xs leading-5 text-zinc-500 hover:text-zinc-400"
                        dir="auto"
                      >
                        {n.title}
                      </a>
                    </>
                  ) : (
                    <a
                      href={n.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block text-sm leading-6 text-zinc-200 ${
                        n.url ? 'hover:text-amber-300 hover:underline' : ''
                      }`}
                      dir="auto"
                    >
                      {n.title}
                    </a>
                  )}

                  {/* ترجمه فارسی (فقط برای خبرهای فارسی‌زبان که ترجمه‌شان جدا نمایش داده شود) */}
                  {n.textFa && n.lang === 'fa' && n.textFa !== n.title && (
                    <div className="mt-2 rounded-lg border border-amber-500/20 bg-zinc-950/60 p-2.5">
                      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-amber-400">
                        <Languages className="h-3 w-3" />
                        ترجمه فارسی:
                      </p>
                      <p className="text-xs leading-6 text-zinc-300">{n.textFa}</p>
                    </div>
                  )}

                  {/* خبر غیرفارسی بدون ترجمه — در صف ترجمه */}
                  {n.lang !== 'fa' && !n.textFa && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-600">
                      <Languages className="h-3 w-3 animate-pulse" />
                      ترجمه فارسی در حال آماده‌سازی…
                    </p>
                  )}

                  {/* متادیتا */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                    <Badge
                      variant="outline"
                      className="h-5 gap-1 border-zinc-700/70 px-1.5 text-[10px] font-normal text-zinc-400"
                    >
                      <SourceIcon className="h-2.5 w-2.5" />
                      {SOURCE_TYPE_FA[n.sourceType] ?? n.sourceType}
                    </Badge>
                    <span className="font-medium text-zinc-400">{n.sourceLabel}</span>

                    {/* زبان خبر */}
                    {n.lang !== 'fa' && (
                      <Badge
                        variant="outline"
                        className="h-5 gap-1 border-sky-900/60 bg-sky-950/30 px-1.5 text-[10px] font-normal text-sky-300/80"
                        title="زبان اصلی خبر — ترجمه فارسی نمایش داده شده است"
                      >
                        <Globe className="h-2.5 w-2.5" />
                        {langFa(n.lang)}
                      </Badge>
                    )}
                    <span dir="ltr" className="text-zinc-600">·</span>
                    <span suppressHydrationWarning>
                      {now ? relTimeFa(new Date(n.publishedAt), now) : ''}
                    </span>

                    {/* حکم هوش مصنوعی */}
                    <Badge
                      variant="outline"
                      className={`h-5 gap-1 px-1.5 text-[10px] font-bold ${verdict.chip}`}
                      title="ارزیابی هوش مصنوعی از ماهیت خبر"
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      {verdict.fa}
                    </Badge>

                    {n.isAd && (
                      <Badge
                        variant="outline"
                        className="h-5 gap-1 border-zinc-700/60 bg-zinc-800/40 px-1.5 text-[10px] font-normal text-zinc-500"
                      >
                        <Megaphone className="h-2.5 w-2.5" />
                        تبلیغ
                      </Badge>
                    )}
                    {n.isOpinion && (
                      <Badge
                        variant="outline"
                        className="h-5 gap-1 border-zinc-700/60 bg-zinc-800/40 px-1.5 text-[10px] font-normal text-zinc-500"
                      >
                        <MessageSquareQuote className="h-2.5 w-2.5" />
                        نظر شخصی
                      </Badge>
                    )}

                    {/* نوار امتیاز تنش */}
                    <span className="flex items-center gap-1" title="امتیاز تنش">
                      <span className="inline-block h-1 w-12 overflow-hidden rounded-full bg-zinc-800">
                        <span
                          className={`inline-block h-full ${meta.bar}`}
                          style={{ width: `${Math.min(100, n.tensionScore)}%` }}
                        />
                      </span>
                      <span dir="ltr" className="tabular-nums">
                        {Math.round(n.tensionScore)}
                      </span>
                    </span>
                  </div>

                  {/* کلیدواژه‌ها */}
                  {keywords.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {keywords.slice(0, 6).map((k, i) => (
                        <span
                          key={i}
                          className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-[9px] text-zinc-500"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function parseKeywords(raw: string): string[] {
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}
