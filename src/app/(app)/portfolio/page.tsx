'use client'

import { useState } from 'react'
import { Topbar } from '@/components/shared/Topbar'
import { useProfileStore } from '@/store/useProfileStore'
import { TrustBadge } from '@/components/shared/TrustBadge'
import { TrustVerifyDialog } from '@/components/shared/TrustVerifyDialog'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/shared/constants'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Star, Trash2 } from 'lucide-react'
import type { ActivityCategory, Activity, TrustTier } from '@/types'
import { getSession } from '@/shared/auth-client'

const CATEGORIES: { value: ActivityCategory; label: string }[] = [
  { value: 'scholarship', label: 'Học bổng' },
  { value: 'competition', label: 'Cuộc thi' },
  { value: 'extracurricular', label: 'Ngoại khoá' },
  { value: 'research', label: 'Nghiên cứu' },
  { value: 'self_learning', label: 'Tự học' },
  { value: 'green_ethics', label: 'Green Ethics' },
]

const activitySchema = z.object({
  title: z.string().min(3, 'Tên hoạt động cần ít nhất 3 ký tự'),
  category: z.enum(['scholarship', 'competition', 'extracurricular', 'research', 'self_learning', 'green_ethics']),
  slot_order: z.number().min(1).max(10),
  star_situation: z.string().min(30, 'Cần ít nhất 30 ký tự'),
  star_task: z.string().min(30, 'Cần ít nhất 30 ký tự'),
  star_action: z.string().min(50, 'Cần ít nhất 50 ký tự'),
  star_result: z.string().min(30, 'Cần ít nhất 30 ký tự'),
})

type ActivityFormData = z.infer<typeof activitySchema>

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i <= score ? 'fill-amber-400 text-amber-400' : 'text-muted'
          }`}
        />
      ))}
    </div>
  )
}

function CharCount({
  value,
  min,
  label,
}: {
  value: string
  min: number
  label?: string
}) {
  const len = value.length
  const ok = len >= min
  return (
    <span className={`text-xs ${ok ? 'text-primary' : 'text-destructive'}`}>
      {len}/{min} ký tự{label ? ` ${label}` : ''}
    </span>
  )
}

export default function PortfolioPage() {
  const { activities, addServerActivity, removeActivity } = useProfileStore()
  const [open, setOpen] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    mode: 'onChange',
    defaultValues: {
      category: 'competition',
      slot_order: 1,
    },
  })

  const watchedValues = watch()
  const slottedActivities = activities
    .filter((a) => a.slot_order !== null)
    .sort((a, b) => (a.slot_order ?? 0) - (b.slot_order ?? 0))

  const unslottedActivities = activities.filter((a) => a.slot_order === null)

  const onSubmit = async (data: ActivityFormData) => {
    const isFull = slottedActivities.length >= 10
    const currentInSelectedSlot = slottedActivities.find((a) => a.slot_order === data.slot_order)
    const shouldReplace = Boolean(currentInSelectedSlot)

    if (isFull) {
      const confirmed = window.confirm(
        `Da du 10 slot. Ban muon thay the Slot ${data.slot_order}${
          currentInSelectedSlot ? ` (${currentInSelectedSlot.title})` : ''
        } khong?`
      )

      if (!confirmed) {
        return
      }
    } else if (shouldReplace) {
      const confirmed = window.confirm(
        `Slot ${data.slot_order} dang co "${currentInSelectedSlot?.title}". Ban co muon thay the khong?`
      )

      if (!confirmed) {
        return
      }
    }

    // POST lên server trước → nhận activity với DB-backed activity_id
    try {
      const session = getSession()
      if (!session) {
        setSuccessMsg('Phiên đăng nhập đã hết hạn. Hãy login lại.')
        setTimeout(() => setSuccessMsg(''), 3000)
        return
      }

      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: data.title,
          category: data.category,
          slot_order: data.slot_order,
          star_situation: data.star_situation,
          star_task: data.star_task,
          star_action: data.star_action,
          star_result: data.star_result,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg =
          typeof body?.error === 'string'
            ? body.error
            : 'Không thể lưu hoạt động. Hãy thử lại.'
        setSuccessMsg(msg)
        setTimeout(() => setSuccessMsg(''), 3000)
        return
      }

      const created = (await res.json()) as Activity & { trust_tier?: number }
      // Server có thể không trả trust_tier; default về 1
      addServerActivity({
        ...created,
        trust_tier: (created.trust_tier ?? 1) as TrustTier,
      })

      reset()
      setOpen(false)
      setSuccessMsg('Đã thêm hoạt động!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      console.error('[portfolio] create activity failed:', err)
      setSuccessMsg('Network error. Hãy thử lại.')
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const handleDelete = async (activityId: string) => {
    const session = getSession()
    if (!session) {
      // Demo mode — no server record to delete, just update local state
      removeActivity(activityId)
      return
    }

    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        setSuccessMsg('Không thể xoá hoạt động. Hãy thử lại.')
        setTimeout(() => setSuccessMsg(''), 3000)
        return
      }
      removeActivity(activityId)
    } catch (err) {
      console.error('[portfolio] delete activity failed:', err)
      setSuccessMsg('Network error. Hãy thử lại.')
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const slotMap = new Map(slottedActivities.map((a) => [a.slot_order!, a]))

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar title="Portfolio 10-Slot Optimizer" />

      <main className="flex-1 p-6 space-y-6">
        {successMsg && (
          <div className="bg-primary/10 border border-primary/20 text-primary rounded-lg px-4 py-3 text-sm font-medium">
            {successMsg}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">10 Slot Portfolio</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {slottedActivities.length}/10 slot đã được lấp đầy
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              Thêm hoạt động mới
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Thêm hoạt động mới (Định dạng STAR)</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Tên hoạt động</label>
                  <Input {...register('title')} placeholder="VD: NASA Space Apps Challenge 2024" />
                  {errors.title && (
                    <p className="text-xs text-destructive">{errors.title.message}</p>
                  )}
                </div>

                {/* Category + Slot */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Danh mục</label>
                    <select
                      {...register('category')}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Slot (1–10)</label>
                    <select
                      {...register('slot_order', { setValueAs: (value) => Number(value) })}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          Slot {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Situation */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      S — Situation (Bối cảnh)
                    </label>
                    <CharCount value={watchedValues.star_situation ?? ''} min={30} />
                  </div>
                  <Textarea
                    {...register('star_situation')}
                    rows={3}
                    placeholder="Mô tả bối cảnh, thời gian, địa điểm, quy mô..."
                    className={
                      (watchedValues.star_situation?.length ?? 0) > 0 &&
                      (watchedValues.star_situation?.length ?? 0) < 30
                        ? 'border-destructive focus:ring-destructive/30'
                        : (watchedValues.star_situation?.length ?? 0) >= 30
                        ? 'border-primary focus:ring-primary/30'
                        : ''
                    }
                  />
                </div>

                {/* Task */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      T — Task (Nhiệm vụ)
                    </label>
                    <CharCount value={watchedValues.star_task ?? ''} min={30} />
                  </div>
                  <Textarea
                    {...register('star_task')}
                    rows={3}
                    placeholder="Vai trò và trách nhiệm của bạn là gì?"
                    className={
                      (watchedValues.star_task?.length ?? 0) > 0 &&
                      (watchedValues.star_task?.length ?? 0) < 30
                        ? 'border-destructive focus:ring-destructive/30'
                        : (watchedValues.star_task?.length ?? 0) >= 30
                        ? 'border-primary focus:ring-primary/30'
                        : ''
                    }
                  />
                </div>

                {/* Action */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      A — Action (Hành động){' '}
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        Phần quan trọng nhất
                      </span>
                    </label>
                    <CharCount value={watchedValues.star_action ?? ''} min={50} />
                  </div>
                  <Textarea
                    {...register('star_action')}
                    rows={4}
                    placeholder="Bạn đã làm gì cụ thể? Dùng công cụ gì? Phương pháp nào?"
                    className={
                      (watchedValues.star_action?.length ?? 0) > 0 &&
                      (watchedValues.star_action?.length ?? 0) < 50
                        ? 'border-destructive focus:ring-destructive/30'
                        : (watchedValues.star_action?.length ?? 0) >= 50
                        ? 'border-primary focus:ring-primary/30'
                        : ''
                    }
                  />
                  {(watchedValues.star_action?.length ?? 0) > 0 &&
                    (watchedValues.star_action?.length ?? 0) < 50 && (
                      <p className="text-xs text-destructive">
                        Phần Action cần mô tả chi tiết ít nhất 50 ký tự để hội đồng đánh giá cao.
                      </p>
                    )}
                </div>

                {/* Result */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      R — Result (Kết quả)
                    </label>
                    <CharCount value={watchedValues.star_result ?? ''} min={30} />
                  </div>
                  <Textarea
                    {...register('star_result')}
                    rows={3}
                    placeholder="Kết quả đạt được là gì? Có số liệu cụ thể không?"
                    className={
                      (watchedValues.star_result?.length ?? 0) > 0 &&
                      (watchedValues.star_result?.length ?? 0) < 30
                        ? 'border-destructive focus:ring-destructive/30'
                        : (watchedValues.star_result?.length ?? 0) >= 30
                        ? 'border-primary focus:ring-primary/30'
                        : ''
                    }
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!isValid}
                  className="w-full h-10 rounded-lg text-sm font-medium"
                >
                  Thêm hoạt động
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* 10-slot grid */}
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((slot) => {
            const activity = slotMap.get(slot)
            if (!activity) {
              return (
                <div
                  key={slot}
                  className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center gap-2 min-h-[120px] bg-muted/40 text-muted-foreground"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <p className="text-sm">Slot {slot} — Chưa có hoạt động</p>
                </div>
              )
            }

            return (
              <div
                key={slot}
                className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0">
                      {slot}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground leading-tight">
                      {activity.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => handleDelete(activity.activity_id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      CATEGORY_COLORS[activity.category]
                    }`}
                  >
                    {CATEGORY_LABELS[activity.category]}
                  </span>
                  <TrustBadge tier={activity.trust_tier} />
                </div>

                {activity.tech_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {activity.tech_tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <StarRating score={activity.base_score} />
                  <TrustVerifyDialog
                    activityId={activity.activity_id}
                    currentTier={activity.trust_tier}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Unslotted activities */}
        {unslottedActivities.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              Hoạt động chưa vào slot ({unslottedActivities.length})
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {unslottedActivities.map((activity) => (
                <div
                  key={activity.activity_id}
                  className="bg-card rounded-xl border border-dashed border-border p-4 space-y-2 opacity-70"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-medium text-foreground">{activity.title}</h3>
                    <button
                      onClick={() => handleDelete(activity.activity_id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        CATEGORY_COLORS[activity.category]
                      }`}
                    >
                      {CATEGORY_LABELS[activity.category]}
                    </span>
                    <TrustBadge tier={activity.trust_tier} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
