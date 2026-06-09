import { PenLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'

export function EditingPermissionPlaceholder() {
  const { t } = useTranslation('permissions')

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
      <Card variant="bordered" className="max-w-md w-full text-center">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <PenLine className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">
              {t('editing.placeholder.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('editing.placeholder.description')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
