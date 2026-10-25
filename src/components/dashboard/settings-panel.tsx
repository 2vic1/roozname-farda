'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { History, Loader2, Plus, Rss, Trash2, Camera } from 'lucide-react'
import { faNum, SOURCE_TYPE_FA } from './types'
import { SourceTypeIcon } from './news-feed'
import type { RefEventData, SourceData, SourceType } from './types'

const HANDLE_PLACEHOLDER: Record<string, string> = {
  telegram: 'Middle_East_Spectator',
  x: 'CENTCOM',
  instagram: 'yashar',
  rss: 'https://example.com/rss',
}

// پنل منابع: جدول منابع + افزودن منبع جدید + رویدادهای مرجع
export function SettingsPanel({
  sources,
  refEvents,
  onChanged,
}: {
  sources: SourceData[]
  refEvents: RefEventData[]
  onChanged: () => void
}) {
  const [type, setType] = useState<SourceType>('telegram')
  const [handle, setHandle] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const addSource = async () => {
    if (!handle.trim() || !label.trim()) {
      toast.error('خطا', { description: 'شناسه و عنوان منبع را کامل کنید' })
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, handle: handle.trim(), label: label.trim() }),
      })
      const j = await res.json()
      if (j.ok) {
        toast.success('منبع اضافه شد', {
          description: 'در تیک بعدی بات خبرگیر فعال می‌شود',
        })
        setHandle('')
        setLabel('')
        onChanged()
      } else {
        toast.error('خطا در افزودن منبع', { description: j.error ?? 'دوباره تلاش کنید' })
      }
    } catch {
      toast.error('خطای شبکه')
    } finally {
      setBusy(false)
    }
  }

  const toggleSource = async (id: string, active: boolean) => {
    try {
      await fetch(`/api/sources/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      })
      toast.success(active ? 'منبع فعال شد' : 'منبع غیرفعال شد')
      onChanged()
    } catch {
      toast.error('خطا در تغییر وضعیت منبع')
    }
  }

  const removeSource = async () => {
    if (!deleteId) return
    try {
      await fetch(`/api/sources/${deleteId}`, { method: 'DELETE' })
      toast.success('منبع حذف شد', { description: 'اخبار قبلی آن در آرشیو می‌ماند' })
      onChanged()
    } catch {
      toast.error('خطا در حذف منبع')
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* افزودن منبع */}
      <Card className="border-zinc-800/70 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4 text-amber-500" />
            افزودن منبع جدید
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="src-type" className="text-xs text-zinc-400">
                نوع منبع
              </label>
              <Select value={type} onValueChange={(v) => setType(v as SourceType)}>
                <SelectTrigger id="src-type" className="bg-zinc-950/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telegram">کانال تلگرام</SelectItem>
                  <SelectItem value="x">حساب ایکس (توییتر)</SelectItem>
                  <SelectItem value="instagram">اینستاگرام (فقط استوری)</SelectItem>
                  <SelectItem value="rss">فید RSS وب‌سایت</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="src-handle" className="text-xs text-zinc-400">
                شناسه / آدرس
              </label>
              <Input
                id="src-handle"
                dir="ltr"
                className="bg-zinc-950/60 text-left"
                placeholder={HANDLE_PLACEHOLDER[type]}
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="src-label" className="text-xs text-zinc-400">
                عنوان نمایشی
              </label>
              <Input
                id="src-label"
                className="bg-zinc-950/60"
                placeholder="مثلاً: کانال تحلیل نظامی"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={addSource} disabled={busy} className="w-full sm:w-40">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            افزودن منبع
          </Button>
        </CardContent>
      </Card>

      {/* جدول منابع */}
      <Card className="border-zinc-800/70 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Rss className="h-4 w-4 text-amber-500" />
            منابع خبری ({faNum(sources.length)} منبع)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">هنوز منبعی ثبت نشده</p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border border-zinc-800/60">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-start text-[11px] text-zinc-500">منبع</TableHead>
                    <TableHead className="text-start text-[11px] text-zinc-500">نوع</TableHead>
                    <TableHead className="text-start text-[11px] text-zinc-500">زبان</TableHead>
                    <TableHead className="text-start text-[11px] text-zinc-500">وزن</TableHead>
                    <TableHead className="text-start text-[11px] text-zinc-500">فعال</TableHead>
                    <TableHead className="text-start text-[11px] text-zinc-500">حذف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((s) => (
                    <TableRow key={s.id} className={s.active ? '' : 'opacity-50'}>
                      <TableCell className="text-start">
                        <div className="flex items-center gap-2">
                          <SourceTypeIcon type={s.type} className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-xs font-medium text-zinc-200">
                              {s.label}
                              {s.storiesOnly && (
                                <Badge
                                  variant="outline"
                                  className="gap-0.5 border-zinc-700 px-1 text-[9px] text-zinc-500"
                                  title="فقط استوری‌ها جمع‌آوری می‌شود"
                                >
                                  <Camera className="h-2.5 w-2.5" />
                                  فقط استوری
                                </Badge>
                              )}
                            </p>
                            <p className="truncate text-[10px] text-zinc-500" dir="ltr">
                              {s.handle}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-start">
                        <Badge
                          variant="outline"
                          className="border-zinc-700 text-[10px] text-zinc-400"
                        >
                          {SOURCE_TYPE_FA[s.type] ?? s.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-start text-xs text-zinc-400" dir="ltr">
                        {s.lang}
                      </TableCell>
                      <TableCell className="text-start">
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 text-[10px] text-amber-400"
                        >
                          ×{s.weight}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-start">
                        <Switch
                          checked={s.active}
                          onCheckedChange={(v) => toggleSource(s.id, v)}
                          aria-label={`تغییر وضعیت ${s.label}`}
                        />
                      </TableCell>
                      <TableCell className="text-start">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-zinc-500 hover:text-red-400"
                          onClick={() => setDeleteId(s.id)}
                          aria-label={`حذف ${s.label}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* رویدادهای مرجع */}
      <Card className="border-zinc-800/70 bg-zinc-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="h-4 w-4 text-amber-500" />
            رویدادهای مرجع تاریخی (پایه مدل چرخه‌ای)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {refEvents.length === 0 && (
            <p className="text-xs text-zinc-500">رویداد مرجعی ثبت نشده</p>
          )}
          {refEvents.map((e) => (
            <div
              key={e.id}
              className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-3"
            >
              <p className="text-sm font-semibold text-zinc-200">{e.name}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500" dir="ltr">
                {e.startDate} → {e.endDate}
              </p>
              {e.note && (
                <p className="mt-1.5 text-[11px] leading-5 text-zinc-500">{e.note}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف منبع خبری؟</AlertDialogTitle>
            <AlertDialogDescription>
              این منبع از لیست گردآوری حذف می‌شود. اخبار قبلی‌اش در آرشیو می‌ماند.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault()
                removeSource()
              }}
            >
              حذف کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
