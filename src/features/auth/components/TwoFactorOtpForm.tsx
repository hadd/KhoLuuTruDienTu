import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { ArrowLeft, ArrowRight, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resend2FA, verify2FA } from '@/features/auth/api/authClient'
import { APP_HOME_PATH } from '@/features/auth/constants'
import { authStore } from '@/features/auth/store'
import type { LoginResponseT } from '@/features/auth/types'
import { resetDataManagementClientCache } from '@/features/data-management/api/dataManagementClient'
import { clearAllSecurityAccessTokens } from '@/features/security-level/lib/securityAccessTokenStore'

type TwoFactorOtpFormProps = {
  challengeToken: string
  maskedEmail?: string
  onBackToLogin: () => void
}

export const TwoFactorOtpForm = ({
  challengeToken,
  maskedEmail,
  onBackToLogin,
}: TwoFactorOtpFormProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [otpCode, setOtpCode] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(60)

  // Countdown timer for resend button (60s)
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleLoginSuccess = (data: LoginResponseT) => {
    resetDataManagementClientCache()
    clearAllSecurityAccessTokens()
    authStore.setTokens({
      accessToken: data.accessToken ?? '',
      refreshToken: data.refreshToken ?? '',
    })
    authStore.setRoles(data.roles ?? [])
    authStore.setUser(null)
    queryClient.clear()

    if ((data.roles ?? []).length > 0) {
      navigate({ to: APP_HOME_PATH })
      return
    }

    setErrorMessage('Tài khoản chưa được gán vai trò sử dụng hệ thống.')
  }

  const verifyMutation = useMutation({
    mutationFn: () => verify2FA({ challengeToken, otpCode: otpCode.trim() }),
    onSuccess: (data) => {
      handleLoginSuccess(data)
    },
    onError: (error: unknown) => {
      if (isAxiosError(error)) {
        const message =
          error.response?.data?.message ||
          error.response?.data?.error ||
          'Mã OTP không chính xác hoặc đã hết hạn.'
        setErrorMessage(message)
      } else {
        setErrorMessage('Xác thực 2 lớp thất bại. Vui lòng thử lại.')
      }
    },
  })

  const resendMutation = useMutation({
    mutationFn: () => resend2FA({ challengeToken }),
    onSuccess: () => {
      setSuccessMessage('Đã gửi lại mã OTP mới qua email.')
      setErrorMessage(null)
      setResendCooldown(60)
    },
    onError: (error: unknown) => {
      if (isAxiosError(error)) {
        const message =
          error.response?.data?.message ||
          error.response?.data?.error ||
          'Không thể gửi lại mã OTP.'
        setErrorMessage(message)
      } else {
        setErrorMessage('Không thể gửi lại mã OTP. Vui lòng thử lại.')
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setErrorMessage('Vui lòng nhập đủ 6 chữ số mã OTP.')
      return
    }
    verifyMutation.mutate()
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/50">
          <ShieldCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Xác thực 2 lớp (2FA)
        </h2>
        <p className="text-xs text-muted-foreground">
          Mã xác thực OTP đã được gửi đến email{' '}
          <span className="font-semibold text-foreground">
            {maskedEmail || 'của bạn'}
          </span>
          . Vui lòng kiểm tra hòm thư và nhập mã bên dưới.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="otpCode">Mã OTP 6 chữ số</Label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="otpCode"
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            placeholder="000000"
            value={otpCode}
            disabled={verifyMutation.isPending}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
            className="pl-10 text-center tracking-[0.4em] font-mono text-lg"
          />
        </div>
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive text-center font-medium animate-in fade-in-50">
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 text-center font-medium animate-in fade-in-50">
          {successMessage}
        </p>
      )}

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-md transition-all"
        disabled={verifyMutation.isPending || otpCode.length !== 6}
      >
        {verifyMutation.isPending ? 'Đang xác thực...' : 'Xác nhận OTP'}
        {!verifyMutation.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>

      <div className="flex items-center justify-between pt-2 text-xs">
        <button
          type="button"
          onClick={onBackToLogin}
          className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Quay lại
        </button>

        <button
          type="button"
          disabled={resendCooldown > 0 || resendMutation.isPending}
          onClick={() => resendMutation.mutate()}
          className="flex items-center text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw
            className={`mr-1 h-3.5 w-3.5 ${
              resendMutation.isPending ? 'animate-spin' : ''
            }`}
          />
          {resendCooldown > 0
            ? `Gửi lại mã (${resendCooldown}s)`
            : 'Gửi lại mã OTP'}
        </button>
      </div>
    </form>
  )
}
