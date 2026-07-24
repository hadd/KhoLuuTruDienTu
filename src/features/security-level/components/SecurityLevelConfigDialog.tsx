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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  getActiveSecurityPermissionDefs,
  getSecurityLevelRules,
  patchSecurityLevelRules,
} from '@/features/security-level/api/securityLevelClient'
import { activeSecurityLevelsQueryOptions } from '@/features/security-level/queries'
import type {
  SecurityLevelT,
  SecurityResolvedRuleT,
} from '@/features/security-level/types'
import { translateError } from '@/lib/utils/translate-error'

const HIDDEN_RULE_KEYS = new Set([
  'flag.limit_export_actors',
  'flag.limit_export_formats',
])

const FLAG_LABELS: Record<string, string> = {
  'flag.require_password': 'Yêu cầu mật khẩu cấp',
  'flag.require_watermark': 'Watermark bắt buộc',
  'flag.require_encryption': 'Mã hóa khi tải',
  'flag.block_export_download': 'Cấm xuất/tải hoàn toàn',
}

function isBoolRule(ruleKey: string) {
  return (
    ruleKey.startsWith('permission.') ||
    ruleKey === 'flag.require_password' ||
    ruleKey === 'flag.require_watermark' ||
    ruleKey === 'flag.require_encryption' ||
    ruleKey === 'flag.block_export_download'
  )
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
  const [drafts, setDrafts] = useState<Array<DraftRule>>([])
  const [password, setPassword] = useState('')
  const [clearPassword, setClearPassword] = useState(false)
  const [confirmLooser, setConfirmLooser] = useState(false)

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

  useEffect(() => {
    if (!data) return
    setDrafts(
      data.rules
        .filter((rule) => !HIDDEN_RULE_KEYS.has(rule.ruleKey))
        .filter((rule) => isBoolRule(rule.ruleKey))
        .map((rule) => ({
          ...rule,
          draftValue: rule.effectiveValue,
          baselineValue: rule.effectiveValue,
        })),
    )
    setPassword('')
    setClearPassword(false)
    setConfirmLooser(false)
  }, [data])

  const requirePasswordOn = useMemo(() => {
    const rule = drafts.find((r) => r.ruleKey === 'flag.require_password')
    return Boolean(rule?.draftValue)
  }, [drafts])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!securityLevel) return
      const rules = drafts.map((d) => ({
        ruleKey: d.ruleKey,
        isOverridden: true,
        value: d.draftValue,
      }))
      return patchSecurityLevelRules(securityLevel.id, {
        rules,
        confirmLooser: confirmLooser || undefined,
        password: password.trim() ? password.trim() : undefined,
        clearPassword: clearPassword || undefined,
      })
    },
    onSuccess: async () => {
      toast.success(
        hasHigherLevels
          ? t('config.successWithCascade')
          : t('config.success'),
      )
      await queryClient.invalidateQueries({
        queryKey: ['security-level-rules'],
      })
      onOpenChange(false)
    },
    onError: (error) => {
      const message = translateError(error)
      if (message.includes('confirmLooser') || message.includes('nới lỏng')) {
        setConfirmLooser(true)
        toast.error(t('config.looserConfirmHint'))
        return
      }
      toast.error(message)
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
            <Button type="button" variant="outline" onClick={() => void refetch()}>
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

            <div className="space-y-2 rounded-md border p-3">
              <Label>{t('config.password.label')}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('config.password.placeholder')}
                disabled={clearPassword}
              />
              <div className="flex items-center gap-2">
                <Switch
                  checked={clearPassword}
                  onCheckedChange={setClearPassword}
                />
                <span className="text-sm">{t('config.password.clear')}</span>
              </div>
              {requirePasswordOn ? (
                <p className="text-xs text-muted-foreground">
                  {t('config.password.requiredHint')}
                </p>
              ) : null}
              {data?.hasPassword ? (
                <p className="text-xs text-muted-foreground">
                  {t('config.password.hasPassword')}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              {drafts.map((rule) => {
                const label = rule.ruleKey.startsWith('permission.')
                  ? (permissionLabels.get(rule.ruleKey) ??
                    rule.ruleKey.replace('permission.', ''))
                  : (FLAG_LABELS[rule.ruleKey] ?? rule.ruleKey)
                const status = rule.isLowestLevel
                  ? t('config.status.default')
                  : !rule.isOverridden && rule.inheritedFromLevelName
                    ? t('config.status.inheritedFrom', {
                        name: rule.inheritedFromLevelName,
                      })
                    : rule.isOverridden
                      ? t('config.status.overridden')
                      : t('config.status.configured')

                return (
                  <div
                    key={rule.ruleKey}
                    className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{status}</p>
                    </div>
                    <Switch
                      checked={Boolean(rule.draftValue)}
                      onCheckedChange={(checked) =>
                        setRuleValue(rule.ruleKey, checked)
                      }
                    />
                  </div>
                )
              })}
            </div>

            {confirmLooser ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t('config.looserConfirmHint')}
              </p>
            ) : null}
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
            onClick={() => saveMutation.mutate()}
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
