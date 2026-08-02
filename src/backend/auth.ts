/**
 * JWT-based auth helpers for API route authentication.
 */
import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

interface TokenPayload {
  sub: string
  email: string
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return secret
}

/**
 * Sign a JWT for a freshly registered/logged-in user.
 */
export function signToken(user: { id: string; email: string }): string {
  const payload: TokenPayload = { sub: user.id, email: user.email }
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
  })
}

export async function getAuthUser(
  req: NextRequest
): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)

  try {
    const payload = jwt.verify(token, getJwtSecret()) as TokenPayload
    return { id: payload.sub, email: payload.email }
  } catch {
    return null
  }
}

/**
 * Require auth — returns user or throws a 401 response.
 * Usage: const user = await requireAuth(req)
 */
export async function requireAuth(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return user
}

/**
 * Minimal admin check — reads ADMIN_USER_IDS env var (comma-separated Mongo ObjectId strings).
 */
export function isAdmin(userId: string): boolean {
  const admins = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim())
  return admins.includes(userId)
}
