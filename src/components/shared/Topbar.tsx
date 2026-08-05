'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useProfileStore } from '@/store/useProfileStore'
import { calculateOCS } from '@/shared/ocs'
import { Bell, ChevronDown, Users, LogOut, Settings } from 'lucide-react'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { getSession, signOut as authSignOut } from '@/shared/auth-client'

interface TopbarProps {
  title: string
  /** Force demo mode — always show user switcher, never auth dropdown (used on /demo route) */
  forceDemo?: boolean
}

export function Topbar({ title, forceDemo = false }: TopbarProps) {
  const router = useRouter()
  const { profile, activities, currentUserId, userOptions, setCurrentUser } = useProfileStore()
  const { total_ocs } = calculateOCS(activities, profile.target_major)


  // Auth state
  const [authUser, setAuthUser] = useState<{ name: string; email: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  // Profile dropdown
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (forceDemo) {
      setAuthChecked(true)
      return
    }
    const session = getSession()
    if (session?.user) {
      setAuthUser({
        name: session.user.display_name || session.user.email || '',
        email: session.user.email || '',
      })
    }
    setAuthChecked(true)
  }, [forceDemo])

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = () => {
    authSignOut()
    router.push('/login')
  }

  const isAuth = authChecked && authUser !== null

  return (
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-4 sm:px-6 shrink-0 gap-3 transition-colors">

      {/* Left: title + demo controls */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">{title}</h1>

        {/* Demo user switcher — hidden when authenticated */}
        {authChecked && !isAuth && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <Users className="w-4 h-4 text-muted-foreground hidden sm:block" />
              <span className="sr-only">Chọn hồ sơ demo</span>
              <select
                value={currentUserId}
                onChange={(e) => setCurrentUser(e.target.value)}
                className="w-[150px] sm:w-[210px] border border-border rounded-lg px-2.5 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                title="Đổi user — mỗi user có dữ liệu profile & portfolio riêng (demo)"
              >
                {userOptions.map((opt) => (
                  <option key={opt.user_id} value={opt.user_id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
        )}
      </div>

      {/* Right: OCS badge, theme toggle, bell, avatar */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3.5 py-1.5">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-sm font-semibold text-primary">OCS {total_ocs}</span>
          <span className="text-sm text-primary/70">/100</span>
        </div>

        <ThemeToggle variant="ghost" />

        <button type="button" className="relative text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white text-[10px] rounded-full flex items-center justify-center">2</span>
        </button>

        {/* Authenticated: profile dropdown */}
        {isAuth ? (
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 hover:bg-muted rounded-lg px-2 py-1.5 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
                {authUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-sm hidden md:block text-left">
                <div className="font-medium text-foreground leading-tight">{authUser.name}</div>
                <div className="text-sm text-muted-foreground leading-tight">{authUser.email}</div>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold text-foreground truncate">{authUser.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{authUser.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setProfileOpen(false); router.push('/profile') }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Cài đặt hồ sơ
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Demo mode: static avatar */
          <div className="flex items-center gap-2 hover:bg-muted rounded-lg px-2 py-1.5 transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
              {profile.display_name.charAt(0)}
            </div>
            <div className="text-sm hidden md:block">
              <div className="font-medium text-foreground leading-tight">{profile.display_name}</div>
              <div className="text-sm text-muted-foreground">Lớp {profile.grade} · {profile.school_name}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </header>
  )
}
