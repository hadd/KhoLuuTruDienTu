import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { getUserRoles } from '@/features/auth/store'
import {
  getActiveSecurityPermissionDefs,
  getSecurityLevelRules,
  patchSecurityLevelRules,
} from '@/features/security-level/api/securityLevelClient'
import { PasswordInputWithToggle } from '@/features/security-level/components/SecurityAccessPasswordDialog'
import { activeSecurityLevelsQueryOptions } from '@/features/security-level/queries'
import type {
  SecurityLevelT,
  SecurityResolvedRuleT,
} from '@/features/security-level/types'
import { translateError } from '@/lib/utils/translate-error'

const REQUIRE_ACCESS_PASSWORD_RULE = 'permission.require_access_password'
const REQUIRE_FILE_PASSWORD_RULE = 'permission.require_file_password'

function isPermissionRule(ruleKey: string) {
  return ruleKey.startsWith('permission.')
}

type DraftRule = SecurityResolvedRuleT & {
  draftValue: unknown
  baselineValue: unknown
}

interface SecurityLevelConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  securityLevel: SecurityLevelT | null
}

export function SecurityLevelConfigDialog({
  open,
  onOpenChange,
  securityLevel,
}: SecurityLevelConfigDialogProps) {
  const { t } = useTranslation('security-level')
  const queryClient = useQueryClient()
  const isAdmin = getPrimaryAppRole(getUserRoles()) === 'admin'

  const [drafts, setDrafts] = useState<Array<DraftRule>>([])
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [clearPassword, setClearPassword] = useState(false)
  const [filePassword, setFilePassword] = useState('')
  const [currentFilePassword, setCurrentFilePassword] = useState('')
  const [confirmFilePassword, setConfirmFilePassword] = useState('')
  const [clearFilePassword, setClearFilePassword] = useState(false)

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['security-level-rules', securityLevel?.id],
    queryFn: () => getSecurityLevelRules(securityLevel!.id),
    enabled: open && Boolean(securityLevel?.id),
  })

  const { data: activeLevels } = useQuery({
    ...activeSecurityLevelsQueryOptions(),
    enabled: open,
  })

  const hasHigherLevels = useMemo(() => {
    if (!securityLevel || !activeLevels?.items) return false
    return activeLevels.items.some(
      (level) => level.levelOrder > securityLevel.levelOrder,
    )
  }, [activeLevels?.items, securityLevel])

  const { data: permissionDefs } = useQuery({
    queryKey: ['security-permission-defs', 'active'],
    queryFn: getActiveSecurityPermissionDefs,
    enabled: open,
    staleTime: 60_000,
  })

  const permissionLabels = useMemo(() => {
    const map = new Map<string, string>()
    for (const def of permissionDefs?.items ?? []) {
      map.set(`permission.${def.key}`, def.name)
    }
    return map
  }, [permissionDefs])

  const requireAccessPasswordOn = Boolean(
    drafts.find((d) => d.ruleKey === REQUIRE_ACCESS_PASSWORD_RULE)?.draftValue,
  )
  const requireFilePasswordOn = Boolean(
    drafts.find((d) => d.ruleKey === REQUIRE_FILE_PASSWORD_RULE)?.draftValue,
  )

  useEffect(() => {
    if (!data) return
    setDrafts(
      data.rules
        .filter((rule) => isPermissionRule(rule.ruleKey))
        .map((rule) => ({
          ...rule,
          draftValue: rule.effectiveValue,
          baselineValue: rule.effectiveValue,
        })),
    )
    setPassword('')
    setCurrentPassword('')
    setConfirmPassword('')
    setClearPassword(false)
    setFilePassword('')
    setCurrentFilePassword('')
    setConfirmFilePassword('')
    setClearFilePassword(false)
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!securityLevel) return
      const rules = drafts.map((d) => ({
        ruleKey: d.ruleKey,
        isOverridden: true,
        value: d.draftValue,
      }))

      const changingPassword =
        clearPassword || Boolean(password.trim())
      const changingFilePassword =
        clearFilePassword || Boolean(filePassword.trim())

      return patchSecurityLevelRules(securityLevel.id, {
        rules,
        password: password.trim() ? password.trim() : undefined,
        currentPassword:
          !isAdmin && changingPassword && data?.hasPassword
            ? currentPassword.trim() || undefined
            : undefined,
        clearPassword: clearPassword || undefined,
        filePassword: filePassword.trim() ? filePassword.trim() : undefined,
        currentFilePassword:
          !isAdmin && changingFilePassword && data?.hasFilePassword
            ? currentFilePassword.trim() || undefined
            : undefined,
        clearFilePassword: clearFilePassword || undefined,
      })
    },
    onSuccess: async () => {
      toast.success(
        hasHigherLevels ? t('config.successWithCascade') : t('config.success'),
      )
      await queryClient.invalidateQueries({
        queryKey: ['security-level-rules'],
      })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })

  function setRuleValue(ruleKey: string, checked: boolean) {
    setDrafts((prev) =>
      prev.map((row) =>
        row.ruleKey === ruleKey
          ? { ...row, draftValue: checked, isOverridden: true }
          : row,
      ),
    )
    if (ruleKey === REQUIRE_ACCESS_PASSWORD_RULE && checked) {
      setClearPassword(false)
    }
    if (ruleKey === REQUIRE_FILE_PASSWORD_RULE && checked) {
      setClearFilePassword(false)
    }
  }

  function validatePasswordBlock(options: {
    requireOn: boolean
    hasPassword: boolean
    password: string
    confirmPassword: string
    currentPassword: string
    clearPassword: boolean
    requiredHintKey: string
    mismatchKey: string
    currentRequiredKey: string
  }): boolean {
    const {
      requireOn,
      hasPassword,
      password: newPw,
      confirmPassword: confirmPw,
      currentPassword: currentPw,
      clearPassword: clear,
      requiredHintKey,
      mismatchKey,
      currentRequiredKey,
    } = options

    if (requireOn) {
      if (clear) {
        toast.error(t(requiredHintKey))
        return false
      }
      if (!hasPassword && !newPw.trim()) {
        toast.error(t(requiredHintKey))
        return false
      }
    }

    if (isAdmin) return true

    const changing = clear || Boolean(newPw.trim())
    if (!changing) return true

    if (hasPassword && !currentPw.trim()) {
      toast.error(t(currentRequiredKey))
      return false
    }

    if (newPw.trim() && newPw.trim() !== confirmPw.trim()) {
      toast.error(t(mismatchKey))
      return false
    }

    return true
  }

  function handleSave() {
    const accessOk = validatePasswordBlock({
      requireOn: requireAccessPasswordOn,
      hasPassword: Boolean(data?.hasPassword),
      password,
      confirmPassword,
      currentPassword,
      clearPassword,
      requiredHintKey: 'config.password.requiredHint',
      mismatchKey: 'config.password.mismatch',
      currentRequiredKey: 'config.password.currentRequired',
    })
    if (!accessOk) return

    const fileOk = validatePasswordBlock({
      requireOn: requireFilePasswordOn,
      hasPassword: Boolean(data?.hasFilePassword),
      password: filePassword,
      confirmPassword: confirmFilePassword,
      currentPassword: currentFilePassword,
      clearPassword: clearFilePassword,
      requiredHintKey: 'config.filePassword.requiredHint',
      mismatchKey: 'config.filePassword.mismatch',
      currentRequiredKey: 'config.filePassword.currentRequired',
    })
    if (!fileOk) return

    saveMutation.mutate()
  }

  function renderPasswordFields(kind: 'access' | 'file') {
    const isAccess = kind === 'access'
    const hasPassword = isAccess
      ? Boolean(data?.hasPassword)
      : Boolean(data?.hasFilePassword)
    const requireOn = isAccess
      ? requireAccessPasswordOn
      : requireFilePasswordOn
    const prefix = isAccess ? 'config.password' : 'config.filePassword'
    const idPrefix = isAccess
      ? 'security-level-dossier'
      : 'security-level-file'

    const newValue = isAccess ? password : filePassword
    const setNew = isAccess ? setPassword : setFilePassword
    const currentValue = isAccess ? currentPassword : currentFilePassword
    const setCurrent = isAccess ? setCurrentPassword : setCurrentFilePassword
    const confirmValue = isAccess ? confirmPassword : confirmFilePassword
    const setConfirm = isAccess ? setConfirmPassword : setConfirmFilePassword
    const clearValue = isAccess ? clearPassword : clearFilePassword
    const setClear = isAccess ? setClearPassword : setClearFilePassword

    if (!requireOn) {
      if (!hasPassword) return null
      return (
        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={clearValue}
              onCheckedChange={setClear}
            />
            <span className="text-sm">{t(`${prefix}.clear`)}</span>
          </div>
          {!isAdmin && clearValue ? (
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-current-clear`}>
                {t(`${prefix}.current`)}
              </Label>
              <PasswordInputWithToggle
                id={`${idPrefix}-current-clear`}
                value={currentValue}
                onChange={setCurrent}
                placeholder={t(`${prefix}.currentPlaceholder`)}
                autoComplete="current-password"
              />
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t(`${prefix}.hasPassword`)}
          </p>
        </div>
      )
    }

    if (isAdmin) {
      return (
        <div className="mt-3 space-y-2 border-t pt-3">
          <PasswordInputWithToggle
            id={`${idPrefix}-password`}
            value={newValue}
            onChange={setNew}
            placeholder={
              hasPassword
                ? t(`${prefix}.placeholderSet`)
                : t(`${prefix}.placeholder`)
            }
            autoComplete="new-password"
          />
          {hasPassword ? (
            <p className="text-xs text-muted-foreground">
              {t(`${prefix}.hasPassword`)}
            </p>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t(`${prefix}.requiredHint`)}
            </p>
          )}
        </div>
      )
    }

    return (
      <div className="mt-3 space-y-3 border-t pt-3">
        {hasPassword ? (
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-current`}>
              {t(`${prefix}.current`)}
            </Label>
            <PasswordInputWithToggle
              id={`${idPrefix}-current`}
              value={currentValue}
              onChange={setCurrent}
              placeholder={t(`${prefix}.currentPlaceholder`)}
              autoComplete="current-password"
            />
            <p className="text-xs text-muted-foreground">
              {t(`${prefix}.hasPassword`)}
            </p>
          </div>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-new`}>{t(`${prefix}.new`)}</Label>
          <PasswordInputWithToggle
            id={`${idPrefix}-new`}
            value={newValue}
            onChange={setNew}
            placeholder={
              hasPassword
                ? t(`${prefix}.newPlaceholder`)
                : t(`${prefix}.placeholder`)
            }
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-confirm`}>
            {t(`${prefix}.confirm`)}
          </Label>
          <PasswordInputWithToggle
            id={`${idPrefix}-confirm`}
            value={confirmValue}
            onChange={setConfirm}
            placeholder={t(`${prefix}.confirmPlaceholder`)}
            autoComplete="new-password"
          />
        </div>
        {!hasPassword ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t(`${prefix}.requiredHint`)}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {t('config.title', { name: securityLevel?.name ?? '' })}
          </DialogTitle>
        </DialogHeader>

        {isPending ? (
          <p className="text-sm text-muted-foreground">{t('config.loading')}</p>
        ) : isError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{t('config.loadFailed')}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
            >
              {t('config.retry')}
            </Button>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {hasHigherLevels ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t('config.cascadeWarning')}
              </p>
            ) : null}

            <div className="space-y-2">
              {drafts.map((rule) => {
                const label =
                  permissionLabels.get(rule.ruleKey) ??
                  rule.ruleKey.replace('permission.', '')
                const status = rule.isLowestLevel
                  ? t('config.status.default')
                  : !rule.isOverridden && rule.inheritedFromLevelName
                    ? t('config.status.inheritedFrom', {
                        name: rule.inheritedFromLevelName,
                      })
                    : rule.isOverridden
                      ? t('config.status.overridden')
                      : t('config.status.configured')

                const isAccessRule =
                  rule.ruleKey === REQUIRE_ACCESS_PASSWORD_RULE
                const isFileRule =
                  rule.ruleKey === REQUIRE_FILE_PASSWORD_RULE

                return (
                  <div
                    key={rule.ruleKey}
                    className="rounded-md border p-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {status}
                        </p>
                      </div>
                      <Switch
                        checked={Boolean(rule.draftValue)}
                        onCheckedChange={(checked) =>
                          setRuleValue(rule.ruleKey, checked)
                        }
                      />
                    </div>
                    {isAccessRule ? renderPasswordFields('access') : null}
                    {isFileRule ? renderPasswordFields('file') : null}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            {t('form.actions.cancel')}
          </Button>
          <Button
            type="button"
            disabled={saveMutation.isPending || isPending || isError}
            onClick={handleSave}
          >
            {saveMutation.isPending
              ? t('form.actions.saving')
              : t('config.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
