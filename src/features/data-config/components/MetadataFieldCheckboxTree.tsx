import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  getGroupCheckState,
  isFieldAllowed,
} from '@/features/data-config/lib/assignmentHelpers'
import type { MetadataSchemaGroupT } from '@/features/group/types'
import { cn } from '@/lib/utils/cn'

interface MetadataFieldCheckboxTreeProps {
  schema: Array<MetadataSchemaGroupT>
  allowedFields: Array<string>
  onToggleGroup: (group: MetadataSchemaGroupT, checked: boolean) => void
  onToggleField: (fieldKey: string, checked: boolean) => void
}

export function MetadataFieldCheckboxTree({
  schema,
  allowedFields,
  onToggleGroup,
  onToggleField,
}: MetadataFieldCheckboxTreeProps) {
  const { t } = useTranslation('data-config')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(schema.map((g) => g.groupCode)),
  )

  const toggleExpand = (groupCode: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupCode)) next.delete(groupCode)
      else next.add(groupCode)
      return next
    })
  }

  if (schema.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('documentAssignment.empty.noFields')}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {schema.map((group) => {
        const checkState = getGroupCheckState(group, allowedFields)
        const isExpanded = expandedGroups.has(group.groupCode)

        return (
          <div key={group.groupCode} className="rounded-md border border-border">
            <div className="flex items-center gap-2 bg-muted/20 px-3 py-2">
              <button
                type="button"
                onClick={() => toggleExpand(group.groupCode)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={
                  isExpanded
                    ? t('documentAssignment.metadata.collapse')
                    : t('documentAssignment.metadata.expand')
                }
              >
                {isExpanded ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </button>
              <Checkbox
                checked={
                  checkState === 'indeterminate'
                    ? 'indeterminate'
                    : checkState === 'checked'
                }
                onCheckedChange={(value) =>
                  onToggleGroup(group, value === true)
                }
              />
              <span className="flex-1 text-sm font-medium">{group.groupName}</span>
              {group.isDynamic ? (
                <Badge variant="secondary" className="text-[10px]">
                  {t('documentAssignment.metadata.dynamic')}
                </Badge>
              ) : null}
            </div>

            {isExpanded ? (
              <div className="space-y-2 border-t border-border px-3 py-2">
                {group.fields.map((field) => {
                  const isChecked = isFieldAllowed(field.key, allowedFields)

                  return (
                    <label
                      key={field.key}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 pl-6 text-sm',
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(value) =>
                          onToggleField(field.key, value === true)
                        }
                      />
                      <span>{field.display}</span>
                    </label>
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
