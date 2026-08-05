'use client'

import { useEffect, useMemo, useState } from 'react'
import { Topbar } from '@/components/shared/Topbar'
import { DEMO_MENTORS } from '@/shared/constants'
import { useProfileStore } from '@/store/useProfileStore'
import { getSession } from '@/shared/auth-client'
import type { MentorProfile } from '@/types'
import { Star, ShieldCheck, MessageSquareShare, Search } from 'lucide-react'

export default function MentorPage() {
  const { profile } = useProfileStore()

  const [allMentors, setAllMentors] = useState<MentorProfile[]>(DEMO_MENTORS)
  const [query, setQuery] = useState('')
  const [schoolFilter, setSchoolFilter] = useState<'all' | string>('all')
  const [onlyVerified, setOnlyVerified] = useState(true)
  const [notice, setNotice] = useState('')
  const [connecting, setConnecting] = useState<string | null>(null)
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const session = getSession()
    if (!session) return // demo mode — keep showing DEMO_MENTORS

    fetch('/api/mentor', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: MentorProfile[]) => setAllMentors(rows))
      .catch((err) => console.error('[mentor] fetch failed:', err))
  }, [])

  const schools = useMemo(
    () => Array.from(new Set(allMentors.map((mentor) => mentor.school))),
    [allMentors]
  )

  const mentors = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return allMentors
      .filter((mentor) => (onlyVerified ? mentor.verified : true))
      .filter((mentor) => (schoolFilter === 'all' ? true : mentor.school === schoolFilter))
      .filter((mentor) => {
        if (!normalizedQuery) return true
        return (
          mentor.display_name.toLowerCase().includes(normalizedQuery) ||
          mentor.major.toLowerCase().includes(normalizedQuery) ||
          mentor.expertise_tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
        )
      })
      .sort((a, b) => b.rating - a.rating)
  }, [allMentors, query, schoolFilter, onlyVerified])

  const handleConnect = async (mentor: MentorProfile) => {
    const session = getSession()
    if (!session) {
      // Demo mode — no account to attach the connection to
      setNotice(`Đã gửi yêu cầu kết nối tới ${mentor.display_name}. Mentor sẽ phản hồi trong 24h.`)
      setTimeout(() => setNotice(''), 3000)
      return
    }

    setConnecting(mentor.mentor_id)
    try {
      const res = await fetch('/api/mentor/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mentor_id: mentor.mentor_id, consent: true }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setNotice(typeof data?.error === 'string' ? data.error : 'Không thể kết nối. Hãy thử lại.')
        setTimeout(() => setNotice(''), 3000)
        return
      }

      setConnectedIds((prev) => new Set(prev).add(mentor.mentor_id))
      setNotice(data.message ?? `Đã kết nối với ${mentor.display_name}.`)
      setTimeout(() => setNotice(''), 3000)
    } catch (err) {
      console.error('[mentor] connect failed:', err)
      setNotice('Network error. Hãy thử lại.')
      setTimeout(() => setNotice(''), 3000)
    } finally {
      setConnecting(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar title="Kết nối Mentor" />

      <main className="flex-1 p-4 sm:p-6 space-y-5">
        {notice && (
          <section className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            {notice}
          </section>
        )}

        <section className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Kết nối mentor phù hợp</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Hồ sơ hiện tại:
              {' '}
              <span className="font-medium text-foreground">
                {profile.display_name} · Lớp {profile.grade} · {profile.target_major === 'cntt' ? 'CNTT' : 'Toán & Thống kê'}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên, ngành, chuyên môn..."
                className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            <select
              value={schoolFilter}
              onChange={(event) => setSchoolFilter(event.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">Tất cả trường</option>
              {schools.map((school) => (
                <option key={school} value={school}>
                  {school}
                </option>
              ))}
            </select>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input
              type="checkbox"
              checked={onlyVerified}
              onChange={(event) => setOnlyVerified(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Chỉ hiện mentor đã xác thực
          </label>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {mentors.map((mentor) => (
            <article
              key={mentor.mentor_id}
              className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{mentor.display_name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {mentor.school} · {mentor.major}
                  </p>
                </div>

                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-full px-2 py-0.5 text-xs font-semibold">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {mentor.rating.toFixed(1)}
                </div>
              </div>

              <p className="text-sm text-foreground/80 leading-6">{mentor.bio}</p>

              <div className="flex flex-wrap gap-2">
                {mentor.expertise_tags.map((tag) => (
                  <span
                    key={`${mentor.mentor_id}-${tag}`}
                    className="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {mentor.verified ? (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Đã xác thực
                    </span>
                  ) : (
                    <span>Chưa xác minh</span>
                  )}
                  <span>•</span>
                  <span>{mentor.is_active ? 'Đang hoạt động' : 'Tạm nghỉ'}</span>
                </div>

                <button
                  onClick={() => handleConnect(mentor)}
                  disabled={connecting === mentor.mentor_id || connectedIds.has(mentor.mentor_id)}
                  className="inline-flex items-center gap-1.5 text-sm bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground px-3 py-1.5 rounded-lg transition-colors"
                >
                  <MessageSquareShare className="h-4 w-4" />
                  {connectedIds.has(mentor.mentor_id)
                    ? 'Đã kết nối'
                    : connecting === mentor.mentor_id
                    ? 'Đang gửi...'
                    : 'Kết nối'}
                </button>
              </div>
            </article>
          ))}
        </section>

        {mentors.length === 0 && (
          <section className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Không tìm thấy mentor phù hợp với bộ lọc hiện tại.
            </p>
          </section>
        )}
      </main>
    </div>
  )
}
