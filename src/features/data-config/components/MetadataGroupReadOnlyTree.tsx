import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import type { MetadataSchemaGroupT } from '@/features/group/types'

export function MetadataGroupReadOnlyTree({
  groups,
}: {
  groups: Array<MetadataSchemaGroupT>
}) {
  const { t } = useTranslation('data-config')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.groupCode)),
  )

  const toggleExpand = (groupCode: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupCode)) next.delete(groupCode)
      else next.add(groupCode)
      return next
    })
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('documentTypes.empty.noGroups')}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
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
                    ? t('documentTypes.metadata.collapse')
                    : t('documentTypes.metadata.expand')
                }
              >
                {isExpanded ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </button>
              <span className="flex-1 text-sm font-medium">{group.groupName}</span>
              {group.isDynamic ? (
                <Badge variant="secondary" className="text-[10px]">
                  {t('documentTypes.metadata.dynamic')}
                </Badge>
              ) : null}
            </div>

            {isExpanded ? (
              <div className="space-y-2 border-t border-border px-3 py-2">
                {group.fields.map((field) => (
                  <div key={field.key} className="pl-6 text-sm text-foreground">
                    {field.display}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
