/**
 * Client-side auth — replaces the old Supabase browser SDK.
 * Session is a JWT + flat user object stored in localStorage, matching the
 * old `{ access_token, user }` shape closely enough that most call sites
 * only need an import swap.
 */
const STORAGE_KEY = 'gsc_auth'

export interface SessionUser {
  user_id: string
  email: string
  username?: string
  display_name: string
  grade: 10 | 11 | 12
  school_name: string
  province: string
  gpa: number | null
  sat_score: number | null
  ielts_score: number | null
  target_major: 'cntt' | 'toan_thong_ke' | null
  target_schools: string[]
}

export interface Session {
  access_token: string
  user: SessionUser
}

function readSession(): Session | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

function writeSession(session: Session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as { error: unknown }).error
    if (typeof err === 'string') return err
  }
  return fallback
}

/** Synchronous — reads straight from localStorage, no network round trip. */
export function getSession(): Session | null {
  return readSession()
}

export interface RegisterPayload {
  email: string
  password: string
  username?: string
  display_name: string
  grade: 10 | 11 | 12
  school_name: string
  province: string
  target_major?: 'cntt' | 'toan_thong_ke'
}

export async function signUp(
  payload: RegisterPayload
): Promise<{ error?: string; warning?: string | null }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    return { error: extractErrorMessage(data, 'Không thể tạo tài khoản. Vui lòng thử lại.') }
  }

  writeSession({ access_token: data.token, user: data.user })
  return { warning: data.warning ?? null }
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    return { error: extractErrorMessage(data, 'Đăng nhập thất bại. Vui lòng thử lại.') }
  }

  writeSession({ access_token: data.token, user: data.user })
  return {}
}

/** Pure local token discard — JWT is stateless, no server-side session to invalidate. */
export function signOut(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
