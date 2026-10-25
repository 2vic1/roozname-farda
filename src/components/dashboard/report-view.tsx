'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Sparkles } from 'lucide-react'
import { faNum, relTimeFa } from './types'
import type { ReportData } from './types'
import { toast } from 'sonner'

// نمایش گزارش تحلیلی هوش مصنوعی
export function ReportView({
  report,
  onRegenerated,
}: {
  report: ReportData | null
  onRegenerated: (r: ReportData) => void
}) {
  const [busy, setBusy] = useState(false)

  const regenerate = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/report', { method: 'POST' })
      const j = await res.json()
      if (j.ok && j.report) {
        onRegenerated(j.report)
        toast.success('گزارش تازه تولید شد')
      } else {
        toast.error('خطا در تولید گزارش', { description: j.error ?? 'دوباره تلاش کنید' })
      }
    } catch {
      toast.error('خطای شبکه در تولید گزارش')
    } finally {
      setBusy(false)
    }
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Sparkles className="h-8 w-8 text-amber-500/60" />
        <p className="text-sm text-zinc-400">
          هنوز گزارشی تولید نشده — با دکمه زیر یا «بروزرسانی» هدر، گزارش‌ساز اجرا می‌شود
        </p>
        <Button size="sm" onClick={regenerate} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          تولید گزارش با هوش مصنوعی
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-amber-400"
          >
            <Sparkles className="h-3 w-3" />
            {report.model}
          </Badge>
          <span>امتیاز ریسک هنگام تولید: {faNum(report.riskScore)}</span>
          <span suppressHydrationWarning>{relTimeFa(new Date(report.createdAt))}</span>
        </div>
        <Button size="sm" variant="outline" onClick={regenerate} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          گزارش تازه
        </Button>
      </div>

      <ScrollArea className="h-[520px] rounded-xl border border-zinc-800/70 bg-zinc-900/40">
        <div className="max-w-none space-y-3 p-5 text-sm leading-7 text-zinc-200 [&_blockquote]:border-e-2 [&_blockquote]:border-amber-500/40 [&_blockquote]:ps-3 [&_blockquote]:text-zinc-400 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-amber-400 [&_h2]:mt-5 [&_h2]:border-b [&_h2]:border-zinc-800 [&_h2]:pb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-amber-400 [&_h3]:font-bold [&_h3]:text-zinc-100 [&_hr]:border-zinc-800 [&_li]:ms-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:text-zinc-300 [&_strong]:text-zinc-100 [&_table_td]:border [&_table_td]:border-zinc-800 [&_table_td]:px-2 [&_table_th]:border [&_table_th]:border-zinc-800 [&_table_th]:px-2">
          <ReactMarkdown>{report.content}</ReactMarkdown>
        </div>
      </ScrollArea>
    </div>
  )
}
