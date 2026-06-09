import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { MetadataSchemaGroupT } from '@/features/group/types'
import { resolveAssignedGroupLabels } from '@/features/group/lib/field-assignment'

interface EditorFieldSummaryProps {
  allowedFields: Array<string>
  schema?: Array<MetadataSchemaGroupT>
  isLoading?: boolean
}

export function EditorFieldSummary({
  allowedFields,
  schema = [],
  isLoading = false,
}: EditorFieldSummaryProps) {
  const { t } = useTranslation('group')

  if (isLoading) {
    return (
      <span className="text-[10px] text-muted-foreground italic">
        {t('fieldAssignment.summary.loading')}
      </span>
    )
  }

  if (allowedFields.length === 0) {
    return (
      <span className="text-[10px] text-muted-foreground italic">
        {t('fieldAssignment.summary.empty')}
      </span>
    )
  }

  const labels = resolveAssignedGroupLabels(allowedFields, schema)

  if (labels.length === 0) {
    return (
      <span className="text-[10px] text-muted-foreground italic">
        {t('fieldAssignment.summary.empty')}
      </span>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1 mt-1">
        {labels.map((label) => (
          <Tooltip key={label.groupCode}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-[10px] font-normal py-0 px-1.5 cursor-default"
              >
                {label.groupName}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <ul className="list-disc pl-4 text-xs space-y-0.5">
                {label.fieldDisplays.map((display) => (
                  <li key={display}>{display}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
