'use client'

// ─── تب فال تاروت — سرگرمی (جدا از موتور جدی ریسک) ───
import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wand2, RotateCcw, Eye, Sparkles, AlertTriangle } from 'lucide-react'

interface DrawnCard {
  name: string
  sym: string
  arcanaFa: string
  reversed: boolean
  position: string
}

interface TarotResult {
  ok: boolean
  spreadFa: string
  question: string
  cards: DrawnCard[]
  reading: string
  disclaimer: string
  error?: string
}

const SPREAD_OPTIONS = [
  { key: 'single', fa: 'کارت روزانه', hint: 'یک کارت، یک پیام' },
  { key: 'three', fa: 'گذشته · حال · آینده', hint: 'کلاسیک سه‌کارته' },
  { key: 'five', fa: 'صلیب پنج‌کارته', hint: 'عمیق‌ترین خوانش' },
] as const

const LS_KEY = 'tarot-last-v1'

export function TarotTab() {
  const [question, setQuestion] = useState('')
  const [spread, setSpread] = useState<'single' | 'three' | 'five'>('three')
  const [result, setResult] = useState<TarotResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [revealed, setRevealed] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const readingRef = useRef<HTMLDivElement>(null)

  // بازیابی آخرین فال
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const j = JSON.parse(raw) as TarotResult
        if (j?.ok && j.cards?.length) {
          setResult(j)
          setRevealed(j.cards.map((_, i) => i))
        }
      }
    } catch {
      // بی‌اهمیت
    }
  }, [])

  const draw = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setRevealed([])
    try {
      const res = await fetch('/api/tarot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, spread }),
      })
      const j = (await res.json()) as TarotResult
      if (!j.ok) throw new Error(j.error ?? 'خطا در گرفتن فال')
      setResult(j)
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(j))
      } catch {
        // بی‌اهمیت
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای ناشناخته')
    } finally {
      setLoading(false)
    }
  }, [loading, question, spread])

  // باز شدن تدریجی کارت‌ها بعد از رسیدن نتیجه
  useEffect(() => {
    if (!result?.cards?.length) return
    const timers: ReturnType<typeof setTimeout>[] = []
    result.cards.forEach((_, i) => {
      timers.push(
        setTimeout(() => setRevealed((r) => (r.includes(i) ? r : [...r, i])), 400 + i * 700),
      )
    })
    return () => timers.forEach(clearTimeout)
  }, [result])

  const revealAll = () => {
    if (!result) return
    setRevealed(result.cards.map((_, i) => i))
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* هدر بنفش */}
      <Card className="border-fuchsia-500/30 bg-gradient-to-l from-violet-950/60 via-fuchsia-950/30 to-zinc-950">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-fuchsia-500/15 p-3 text-2xl">🔮</div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-fuchsia-200">فال تاروت — بخش سرگرمی</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                سؤالت را بنویس (یا خالی بگذار)، چیدمان را انتخاب کن و کارت‌ها را بکش. تفسیرِ عمیق و
                حرفه‌ای با هوش مصنوعی انجام می‌شود — ۷۸ کارت کامل با حالت معکوس.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="سؤالت از تاروت چیست؟ (اختیاری — مثلاً: مسیر شغلی من چطور می‌شود؟)"
              className="border-zinc-700 bg-zinc-900/70 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-fuchsia-500/50"
              maxLength={500}
            />
            <div className="flex flex-wrap gap-2">
              {SPREAD_OPTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSpread(s.key)}
                  className={`rounded-lg border px-3 py-2 text-xs transition ${
                    spread === s.key
                      ? 'border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-200'
                      : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-fuchsia-500/40 hover:text-zinc-200'
                  }`}
                >
                  <span className="block font-bold">{s.fa}</span>
                  <span className="block text-[10px] opacity-70">{s.hint}</span>
                </button>
              ))}
            </div>
            <Button
              onClick={draw}
              disabled={loading}
              className="w-full bg-fuchsia-600 text-white hover:bg-fuchsia-500 sm:w-auto"
            >
              {loading ? (
                <>
                  <Sparkles className="h-4 w-4 animate-spin" /> در حال آماده‌سازی تقدیر...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" /> کارت‌ها را بکش
                </>
              )}
            </Button>
            {error && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* بارگذاری */}
      {loading && (
        <Card className="border-fuchsia-500/20 bg-zinc-950">
          <CardContent className="p-6 text-center text-sm text-zinc-400">
            <div className="mx-auto mb-3 flex max-w-xs justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 w-16 animate-pulse rounded-lg border border-fuchsia-500/30 bg-gradient-to-b from-violet-900/60 to-zinc-900"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
            کارت‌ها در حال برهم‌خوردن و افتادن‌اند... چند لحظه صبر کن 🌙
          </CardContent>
        </Card>
      )}

      {/* کارت‌ها */}
      {result && !loading && (
        <>
          <Card className="border-fuchsia-500/20 bg-zinc-950">
            <CardContent className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-fuchsia-200">
                  چیدمان: {result.spreadFa}
                  {result.question ? (
                    <span className="mr-2 text-xs font-normal text-zinc-500">
                      «{result.question}»
                    </span>
                  ) : (
                    <span className="mr-2 text-xs font-normal text-zinc-600">(بدون سؤال)</span>
                  )}
                </h3>
                <div className="flex gap-2">
                  {revealed.length < result.cards.length && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={revealAll}
                      className="border-fuchsia-500/40 text-fuchsia-300 hover:bg-fuchsia-500/10"
                    >
                      <Eye className="h-3.5 w-3.5" /> نمایان‌کردن همه
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={draw}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> فال جدید
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {result.cards.map((c, i) => {
                  const open = revealed.includes(i)
                  return (
                    <div
                      key={i}
                      className="[perspective:1000px] cursor-pointer"
                      onClick={() => setRevealed((r) => (r.includes(i) ? r : [...r, i]))}
                      role="button"
                      aria-label={`کارت ${i + 1}: ${open ? c.name : 'پشت'}`}
                    >
                      <div
                        className="relative h-56 w-full [transform-style:preserve-3d] transition-transform duration-700"
                        style={{ transform: open ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
                      >
                        {/* پشت کارت */}
                        <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-fuchsia-500/40 bg-gradient-to-br from-violet-950 via-fuchsia-950 to-zinc-950 [backface-visibility:hidden]">
                          <div className="text-center">
                            <div className="text-3xl text-fuchsia-400/70">✦</div>
                            <div className="mt-1 text-[10px] tracking-widest text-fuchsia-300/50">
                              TAROT
                            </div>
                          </div>
                        </div>
                        {/* روی کارت */}
                        <div
                          className={`absolute inset-0 flex flex-col items-center justify-center rounded-xl border p-3 text-center [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                            c.reversed
                              ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/40 to-zinc-950'
                              : 'border-fuchsia-400/40 bg-gradient-to-b from-violet-900/50 to-zinc-950'
                          }`}
                        >
                          <div className={`text-4xl ${c.reversed ? 'rotate-180' : ''}`}>{c.sym}</div>
                          <div className="mt-2 text-sm font-bold leading-6 text-zinc-100">
                            {c.name}
                          </div>
                          <div className="mt-0.5 text-[10px] text-zinc-500">{c.arcanaFa}</div>
                          <div className="mt-1 text-[10px] text-fuchsia-300/80">{c.position}</div>
                          {c.reversed && (
                            <div className="mt-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                              ⚠️ معکوس
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* تفسیر */}
          <Card className="border-fuchsia-500/20 bg-zinc-950">
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-bold text-fuchsia-200">📜 تفسیر کامل</h3>
              <div
                ref={readingRef}
                className="max-h-[520px] space-y-2 overflow-y-auto pr-2 text-sm leading-7 text-zinc-300 [scrollbar-width:thin]"
              >
                {result.reading.split('\n').map((line, i) => {
                  const t = line.trim()
                  if (!t) return <div key={i} className="h-1" />
                  if (t.startsWith('◆'))
                    return (
                      <h4 key={i} className="mt-4 border-r-2 border-fuchsia-500/60 pr-2 text-sm font-bold text-fuchsia-300">
                        {t.replace(/^◆\s*/, '')}
                      </h4>
                    )
                  if (t.startsWith('—'))
                    return (
                      <p key={i} className="mt-3 font-bold text-violet-300">
                        {t}
                      </p>
                    )
                  return (
                    <p key={i} className="text-zinc-300">
                      {t}
                    </p>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* سلب مسئولیت */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs leading-6 text-amber-300/90">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{result.disclaimer}</span>
          </div>
        </>
      )}
    </div>
  )
}
