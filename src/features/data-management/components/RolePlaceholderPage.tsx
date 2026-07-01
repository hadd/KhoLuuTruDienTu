import { useTranslation } from 'react-i18next'

export function RolePlaceholderPage({
  titleKey,
}: {
  titleKey:
    | 'sidebar.items.editing'
    | 'sidebar.items.review'
    | 'sidebar.items.kpiReport'
}) {
  const { t } = useTranslation('data-management')

  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card p-8">
      <p className="text-sm text-muted-foreground">{t(titleKey)}</p>
    </div>
  )
}
