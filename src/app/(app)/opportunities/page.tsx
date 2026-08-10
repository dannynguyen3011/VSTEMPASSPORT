'use client'

import { useEffect, useMemo, useState } from 'react'
import { Topbar } from '@/components/shared/Topbar'
import { DEMO_OPPORTUNITIES } from '@/shared/constants'
import { useProfileStore } from '@/store/useProfileStore'
import { getSession } from '@/shared/auth-client'
import type { Opportunity } from '@/types'
import { ExternalLink, Search, X } from 'lucide-react'

type TypeFilter = 'all' | Opportunity['type']
type ScopeFilter = 'all' | Opportunity['scope']

const TYPE_LABELS: Record<Opportunity['type'], string> = {
  competition: 'Cuộc thi',
  scholarship: 'Học bổng',
  workshop: 'Hội thảo',
  summer_program: 'Trại hè',
}

const SCOPE_LABELS: Record<Opportunity['scope'], string> = {
  international: 'Quốc tế',
  national: 'Quốc gia',
  regional: 'Khu vực',
}

function daysUntil(deadline: string) {
  const now = new Date()
  const target = new Date(`${deadline}T23:59:59`)
  const diffMs = target.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function monthLabel(key: string) {
  const [year, month] = key.split('-')
  return `Tháng ${Number(month)}/${year}`
}

function deadlineTone(days: number) {
  if (days < 0) return { text: 'Đã hết hạn', className: 'bg-muted text-muted-foreground' }
  if (days <= 3) return { text: `Còn ${days} ngày`, className: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' }
  if (days <= 10) return { text: `Còn ${days} ngày`, className: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' }
  return { text: `Còn ${days} ngày`, className: 'bg-primary/15 text-primary' }
}

export default function OpportunitiesPage() {
  const { profile } = useProfileStore()

  const [opportunities, setOpportunities] = useState<Opportunity[]>(DEMO_OPPORTUNITIES)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all')
  const [monthFilter, setMonthFilter] = useState<'all' | string>('all')
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [freeOnly, setFreeOnly] = useState(false)

  const majorTag = profile.target_major

  useEffect(() => {
    const session = getSession()
    if (!session) return // demo mode — keep showing DEMO_OPPORTUNITIES

    fetch('/api/opportunities?upcoming_only=false', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Record<string, unknown>[]) => {
        setOpportunities(
          rows.map((row) => ({
            opp_id: row.opp_id as string,
            name: row.name as string,
            type: row.type as Opportunity['type'],
            field_tags: row.field_tags as Opportunity['field_tags'],
            scope: row.scope as Opportunity['scope'],
            is_online: row.is_online as boolean,
            is_free: row.is_free as boolean,
            deadline: new Date(row.deadline as string).toISOString().slice(0, 10),
            source_url: row.source_url as string,
            admin_verified: row.admin_verified as boolean,
            description: row.description as string | undefined,
          }))
        )
      })
      .catch((err) => console.error('[opportunities] fetch failed:', err))
  }, [])

  // Expired entries drop out on their own as the deadline passes — no manual
  // cleanup needed (BA §3.6.1: "Ẩn entry nếu deadline đã qua").
  const notExpired = useMemo(
    () => opportunities.filter((opportunity) => daysUntil(opportunity.deadline) >= 0),
    [opportunities]
  )

  const relevantToMajor = useMemo(
    () =>
      notExpired.filter(
        (opportunity) => opportunity.field_tags.includes(majorTag) || opportunity.field_tags.includes('stem')
      ),
    [notExpired, majorTag]
  )

  const availableMonths = useMemo(() => {
    const keys = new Set<string>()
    relevantToMajor.forEach((opportunity) => keys.add(opportunity.deadline.slice(0, 7)))
    return [...keys].sort()
  }, [relevantToMajor])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return relevantToMajor
      .filter((opportunity) => (typeFilter === 'all' ? true : opportunity.type === typeFilter))
      .filter((opportunity) => (scopeFilter === 'all' ? true : opportunity.scope === scopeFilter))
      .filter((opportunity) => (monthFilter === 'all' ? true : opportunity.deadline.startsWith(monthFilter)))
      .filter((opportunity) => (onlineOnly ? opportunity.is_online : true))
      .filter((opportunity) => (freeOnly ? opportunity.is_free : true))
      .filter((opportunity) => {
        if (!normalizedQuery) return true
        return (
          opportunity.name.toLowerCase().includes(normalizedQuery) ||
          (opportunity.description ?? '').toLowerCase().includes(normalizedQuery)
        )
      })
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  }, [relevantToMajor, typeFilter, scopeFilter, monthFilter, onlineOnly, freeOnly, query])

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar title="Kho Cơ Hội STEM" />

      <main className="flex-1 p-4 sm:p-6 space-y-5">
        <section className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Danh sách cơ hội theo ngành mục tiêu</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Đang ưu tiên cơ hội phù hợp với ngành:
                {' '}
                <span className="font-semibold text-foreground">
                  {majorTag === 'cntt' ? 'CNTT' : 'Toán & Thống kê'}
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
              {filtered.length} cơ hội phù hợp
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên cuộc thi, chương trình, lĩnh vực..."
                className="w-full border border-border rounded-lg pl-9 pr-9 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Xoá tìm kiếm"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <select
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              title="Lọc theo tháng"
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer sm:w-56"
            >
              <option value="all">Tất cả các tháng</option>
              {availableMonths.map((key) => (
                <option key={key} value={key}>
                  {monthLabel(key)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Loại cơ hội</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    typeFilter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  Tất cả
                </button>
                {(Object.keys(TYPE_LABELS) as Opportunity['type'][]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      typeFilter === type
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`}
                  >
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phạm vi</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setScopeFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    scopeFilter === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  Tất cả
                </button>
                {(Object.keys(SCOPE_LABELS) as Opportunity['scope'][]).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setScopeFilter(scope)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      scopeFilter === scope
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`}
                  >
                    {SCOPE_LABELS[scope]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={onlineOnly}
                onChange={(event) => setOnlineOnly(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-foreground">Chỉ online</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={freeOnly}
                onChange={(event) => setFreeOnly(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-foreground">Chỉ miễn phí</span>
            </label>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((opportunity) => {
            const days = daysUntil(opportunity.deadline)
            const tone = deadlineTone(days)

            return (
              <article
                key={opportunity.opp_id}
                className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground leading-5">{opportunity.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${tone.className}`}>
                    {tone.text}
                  </span>
                </div>

                <p className="text-sm text-foreground/80">{opportunity.description}</p>

                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400">
                    {TYPE_LABELS[opportunity.type]}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400">
                    {SCOPE_LABELS[opportunity.scope]}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                    {opportunity.is_online ? 'Online' : 'Offline'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                    {opportunity.is_free ? 'Miễn phí' : 'Có phí'}
                  </span>
                  {opportunity.admin_verified && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-primary/15 text-primary">
                      Đã xác thực
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Hạn chót: {opportunity.deadline}</span>
                  <a
                    href={opportunity.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                  >
                    Nguồn chính thức
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </article>
            )
          })}
        </section>

        {filtered.length === 0 && (
          <section className="bg-card rounded-xl border border-dashed border-border p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {query
                ? `Không tìm thấy cơ hội nào khớp với "${query}". Thử từ khoá khác hoặc mở rộng bộ lọc.`
                : monthFilter !== 'all'
                ? `Không có cơ hội nào còn hạn trong ${monthLabel(monthFilter)}. Thử tháng khác hoặc "Tất cả các tháng".`
                : 'Không tìm thấy cơ hội phù hợp với bộ lọc hiện tại. Thử mở rộng bộ lọc để xem thêm.'}
            </p>
            {(query || monthFilter !== 'all' || typeFilter !== 'all' || scopeFilter !== 'all' || onlineOnly || freeOnly) && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setMonthFilter('all')
                  setTypeFilter('all')
                  setScopeFilter('all')
                  setOnlineOnly(false)
                  setFreeOnly(false)
                }}
                className="text-sm font-medium text-primary hover:underline"
              >
                Xoá tất cả bộ lọc
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
