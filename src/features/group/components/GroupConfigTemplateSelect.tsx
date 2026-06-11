import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { groupConfigStore } from '@/features/group/store'
import type { GroupConfigTemplateT } from '@/features/group/types'

interface GroupConfigTemplateSelectProps {
  groupId: string
  templates: Array<GroupConfigTemplateT>
  templateId: string
}

export function GroupConfigTemplateSelect({
  groupId,
  templates,
  templateId,
}: GroupConfigTemplateSelectProps) {
  const { t } = useTranslation('group')

  const getTemplateLabel = (template: GroupConfigTemplateT) =>
    template.isDefault ? t('configTemplate.defaultName') : template.name

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{t('configTemplate.label')}</Label>
      <Select
        value={templateId}
        onValueChange={(value) => groupConfigStore.setGroupTemplate(groupId, value)}
      >
        <SelectTrigger className="h-8 w-full max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {getTemplateLabel(template)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
