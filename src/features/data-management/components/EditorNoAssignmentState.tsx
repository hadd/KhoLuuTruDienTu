import { FileX2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'

export function EditorNoAssignmentState() {
  const { t } = useTranslation('data-management')

  return (
    <div className="flex min-h-[320px] flex-1 items-center justify-center p-4">
      <Card variant="detail" className="max-w-md">
        <CardContent className="flex flex-col items-center gap-3 px-8 py-10 text-center">
          <FileX2 className="size-10 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {t('errors.noAssignedDossier')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
