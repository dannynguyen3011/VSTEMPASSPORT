'use client'

import { useState } from 'react'
import { ShieldCheck, Mail, Award } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getSession } from '@/shared/auth-client'

type Props = {
  activityId: string
  /** Tier hiện tại — disable tier đã đạt */
  currentTier: number
}

type Tier = 2 | 3

/**
 * Modal cho phép student request TrustFactor verification:
 *  - Tier 2: nhập email giáo viên xác nhận (sẽ gửi email từ Resend nếu config)
 *  - Tier 3: nhập URL chứng chỉ + tổ chức cấp (admin review trong 24-48h)
 *
 * Submit → POST /api/activities/[id]/trust → trigger notification Rocket.Chat.
 */
export function TrustVerifyDialog({ activityId, currentTier }: Props) {
  const [open, setOpen] = useState(false)
  const [tier, setTier] = useState<Tier>(currentTier >= 2 ? 3 : 2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Tier 2 form
  const [verifierEmail, setVerifierEmail] = useState('')
  const [verifierName, setVerifierName] = useState('')

  // Tier 3 form
  const [certUrl, setCertUrl] = useState('')
  const [certIssuer, setCertIssuer] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const session = getSession()
      if (!session) {
        setError('Phiên đăng nhập đã hết hạn. Hãy login lại.')
        return
      }

      const body =
        tier === 2
          ? { tier: 2, verifier_email: verifierEmail, verifier_name: verifierName }
          : { tier: 3, certificate_url: certUrl, certificate_issuer: certIssuer }

      const res = await fetch(`/api/activities/${activityId}/trust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(json?.error?.formErrors?.[0] || json?.error || 'Có lỗi xảy ra. Hãy thử lại.')
        return
      }

      setSuccess(json.message || 'Đã gửi yêu cầu xác thực thành công.')
      // Tự đóng modal sau 2 giây
      setTimeout(() => {
        setOpen(false)
        // Reset state để lần sau mở modal sạch
        setVerifierEmail('')
        setVerifierName('')
        setCertUrl('')
        setCertIssuer('')
        setSuccess(null)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
        <ShieldCheck className="w-3.5 h-3.5" />
        Xác thực
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yêu cầu xác thực TrustFactor</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Tier selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTier(2)}
              disabled={currentTier >= 2}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                tier === 2
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span className="font-medium">Tier 2</span>
              <span className="text-[10px]">Giáo viên xác nhận</span>
            </button>

            <button
              type="button"
              onClick={() => setTier(3)}
              disabled={currentTier >= 3}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                tier === 3
                  ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
              }`}
            >
              <Award className="w-4 h-4" />
              <span className="font-medium">Tier 3</span>
              <span className="text-[10px]">Chứng chỉ + admin review</span>
            </button>
          </div>

          {tier === 2 && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Tên giáo viên xác nhận
                </label>
                <Input
                  value={verifierName}
                  onChange={(e) => setVerifierName(e.target.value)}
                  placeholder="Cô Nguyễn Thị Hương"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Email giáo viên
                </label>
                <Input
                  type="email"
                  value={verifierEmail}
                  onChange={(e) => setVerifierEmail(e.target.value)}
                  placeholder="huong.nguyen@school.edu.vn"
                  required
                />
              </div>
            </>
          )}

          {tier === 3 && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Tổ chức cấp chứng chỉ
                </label>
                <Input
                  value={certIssuer}
                  onChange={(e) => setCertIssuer(e.target.value)}
                  placeholder="VinUni, NASA Space Apps, ..."
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  URL chứng chỉ (PDF / link xác minh)
                </label>
                <Input
                  type="url"
                  value={certUrl}
                  onChange={(e) => setCertUrl(e.target.value)}
                  placeholder="https://example.com/certificate.pdf"
                  required
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded">
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-3 py-2 rounded">
              ✓ {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Đang gửi...' : 'Gửi yêu cầu xác thực'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
