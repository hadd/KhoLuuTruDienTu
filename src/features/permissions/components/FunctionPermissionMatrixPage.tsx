import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import {
  FunctionPermissionMatrix,
  PermissionMatrixLegend,
} from '@/features/permissions/components/FunctionPermissionMatrix'
import {
  permissionMatrixQueryOptions,
  permissionRolesQueryOptions,
  systemFunctionsQueryOptions,
} from '@/features/permissions/queries'
import { useDebouncedCallback } from '@/lib/hooks/useDebouncedCallback'

const routeApi = getRouteApi('/admin/permissions/function-matrix')

export function FunctionPermissionMatrixPage() {
  const { t } = useTranslation('permissions')
  const navigate = routeApi.useNavigate()
  const { q } = routeApi.useSearch()

  const rolesQuery = useQuery(permissionRolesQueryOptions())
  const functionsQuery = useQuery(systemFunctionsQueryOptions())
  const matrixQuery = useQuery(permissionMatrixQueryOptions())

  const isLoading =
    rolesQuery.isLoading || functionsQuery.isLoading || matrixQuery.isLoading
  const isError =
    rolesQuery.isError || functionsQuery.isError || matrixQuery.isError

  const debouncedSearch = useDebouncedCallback((value: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: value.trim() || undefined,
      }),
    })
  }, 300)

  const handleRetry = () => {
    void rolesQuery.refetch()
    void functionsQuery.refetch()
    void matrixQuery.refetch()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            defaultValue={q ?? ''}
            placeholder={t('search.placeholder')}
            className="pl-9"
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </div>
        <PermissionMatrixLegend />
      </div>

      {isLoading ? (
        <MatrixLoadingSkeleton />
      ) : isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
          <p className="text-sm text-muted-foreground">{t('errors.loadFailed')}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t('actions.retry')}
          </button>
        </div>
      ) : (
        <FunctionPermissionMatrix
          roles={rolesQuery.data ?? []}
          functions={functionsQuery.data ?? []}
          grants={matrixQuery.data ?? []}
          searchQuery={q}
        />
      )}
    </div>
  )
}

function MatrixLoadingSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-md border border-border p-4">
      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
      <div className="min-h-[200px] flex-1 w-full animate-pulse rounded-md bg-muted" />
    </div>
  )
}
