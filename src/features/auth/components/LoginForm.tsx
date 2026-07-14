import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { ArrowRight, Eye, EyeOff, Lock, User } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login } from '@/features/auth/api/authClient'
import { APP_HOME_PATH } from '@/features/auth/constants'
import { resetDataManagementClientCache } from '@/features/data-management/api/dataManagementClient'
import { LoginSchema } from '@/features/auth/schemas'
import { authStore } from '@/features/auth/store'
import type { LoginForm as LoginFormValues } from '@/features/auth/types'
import { useFormError } from '@/lib/hooks/useFormError'
import { getFieldError } from '@/lib/utils/form-validation'

export const LoginForm = () => {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { formError, setFormError, clearFormError } = useFormError()
  const [showPassword, setShowPassword] = useState(false)

  const getLoginErrorMessage = (error: unknown) => {
    if (isAxiosError(error)) {
      const status = error.response?.status
      const message = [
        error.response?.data?.message,
        error.response?.data?.error,
        error.response?.data?.detail,
        error.message,
      ]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase()

      if (message.includes('inactive')) {
        return t('errors.accountInactive')
      }

      if (
        status === 400 ||
        status === 401 ||
        status === 422 ||
        message.includes('password') ||
        message.includes('credential') ||
        message.includes('mật khẩu')
      ) {
        return t('errors.invalidCredentials')
      }
    }

    return t('errors.loginFailed')
  }

  const mutation = useMutation({
    mutationFn: (values: LoginFormValues) => login(values),
    onSuccess: (data) => {
      resetDataManagementClientCache()
      authStore.setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      })
      authStore.setRoles(data.roles ?? [])
      authStore.setUser(null)
      queryClient.clear()

      if ((data.roles ?? []).length > 0) {
        navigate({ to: APP_HOME_PATH })
        return
      }

      setFormError(t('errors.noRoleAccess'))
    },
    onError: (error: Error) => {
      setFormError(getLoginErrorMessage(error))
    },
  })

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      clearFormError()
      await mutation.mutateAsync(value)
    },
  })

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.Field
        name="email"
        validators={{
          onBlur: ({ value }) => getFieldError(LoginSchema.shape.email, value),
        }}
      >
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t('placeholders.email')}
                value={field.state.value}
                disabled={mutation.isPending}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                className="pl-10"
              />
            </div>
            {field.state.meta.errors[0] && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <form.Field
        name="password"
        validators={{
          onBlur: ({ value }) =>
            getFieldError(LoginSchema.shape.password, value),
        }}
      >
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={t('placeholders.password')}
                value={field.state.value}
                disabled={mutation.isPending}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                className="pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {field.state.meta.errors[0] && (
              <p className="text-sm text-destructive">
                {field.state.meta.errors[0]}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700"
        disabled={mutation.isPending || form.state.isSubmitting}
      >
        {mutation.isPending ? t('loggingIn') : t('loginCta')}
        {!mutation.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
    </form>
  )
}
