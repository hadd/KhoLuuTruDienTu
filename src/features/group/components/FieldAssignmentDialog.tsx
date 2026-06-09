import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Group } from '@/features/group/types'
import type { MetadataSchemaGroupT } from '@/features/group/types'
import {
  buildClaimedFieldOwners,
  compressAllowedFields,
  expandAllowedFieldsToKeys,
  getAllSchemaFieldKeys,
  getAssignedFieldKeysAcrossEditors,
  getClaimedFieldKeysByOthers,
  getExclusiveGroupCheckState,
  isAssignmentComplete,
  isFieldAllowed,
  normalizeAllowedFields,
  toggleFieldExclusive,
  toggleGroupFieldsExclusive,
} from '@/features/group/lib/field-assignment'
import {
  groupFieldTemplateQueryOptions,
  metadataSchemaQueryOptions,
  useUpdateGroupFieldTemplate,
} from '@/features/group/queries'
import { cn } from '@/lib/utils/cn'

interface FieldAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: Group | null
}

type EditorAssignmentsT = Record<string, Array<string>>

function buildInitialAssignments(
  editors: Array<{ editorId: string; allowedFields?: unknown }>,
): EditorAssignmentsT {
  return editors.reduce<EditorAssignmentsT>((acc, editor) => {
    acc[editor.editorId] = normalizeAllowedFields(editor.allowedFields)
    return acc
  }, {})
}

function MetadataFieldTree({
  schema,
  allowedFields,
  claimedByOthers,
  claimedFieldOwners,
  expandedGroups,
  onToggleExpand,
  onToggleGroup,
  onToggleField,
}: {
  schema: Array<MetadataSchemaGroupT>
  allowedFields: Array<string>
  claimedByOthers: Set<string>
  claimedFieldOwners: Map<string, string>
  expandedGroups: Set<string>
  onToggleExpand: (groupCode: string) => void
  onToggleGroup: (group: MetadataSchemaGroupT, checked: boolean) => void
  onToggleField: (fieldKey: string, checked: boolean) => void
}) {
  const { t } = useTranslation('group')

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {schema.map((group) => {
          const checkState = getExclusiveGroupCheckState(
            group,
            allowedFields,
            claimedByOthers,
          )
          const isExpanded = expandedGroups.has(group.groupCode)
          const selectableCount = group.fields.filter(
            (field) => !claimedByOthers.has(field.key),
          ).length
          const isGroupDisabled = selectableCount === 0

          return (
            <div key={group.groupCode} className="rounded-md border border-border">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
                <button
                  type="button"
                  onClick={() => onToggleExpand(group.groupCode)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={
                    isExpanded
                      ? t('fieldAssignment.collapse')
                      : t('fieldAssignment.expand')
                  }
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <Checkbox
                  checked={
                    checkState === 'indeterminate'
                      ? 'indeterminate'
                      : checkState === 'checked'
                  }
                  disabled={isGroupDisabled}
                  onCheckedChange={(value) =>
                    onToggleGroup(group, value === true)
                  }
                />
                <span className="text-sm font-medium flex-1">{group.groupName}</span>
                {group.isDynamic && (
                  <Badge variant="secondary" className="text-[10px]">
                    {t('fieldAssignment.dynamic')}
                  </Badge>
                )}
              </div>

              {isExpanded && (
                <div className="px-3 py-2 space-y-2 border-t border-border">
                  {group.fields.map((field) => {
                    const isChecked = isFieldAllowed(field.key, allowedFields)
                    const isClaimedByOther = claimedByOthers.has(field.key)
                    const claimedByName = claimedFieldOwners.get(field.key)

                    const fieldLabel = (
                      <label
                        className={cn(
                          'flex items-center gap-2 pl-6 text-sm',
                          isClaimedByOther
                            ? 'cursor-not-allowed opacity-60'
                            : 'cursor-pointer',
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          disabled={isClaimedByOther}
                          onCheckedChange={(value) =>
                            onToggleField(field.key, value === true)
                          }
                        />
                        <span>{field.display}</span>
                      </label>
                    )

                    if (!isClaimedByOther || !claimedByName) {
                      return <div key={field.key}>{fieldLabel}</div>
                    }

                    return (
                      <Tooltip key={field.key}>
                        <TooltipTrigger asChild>
                          <div>{fieldLabel}</div>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          {t('fieldAssignment.claimedBy', { name: claimedByName })}
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

export function FieldAssignmentDialog({
  open,
  onOpenChange,
  group,
}: FieldAssignmentDialogProps) {
  const { t } = useTranslation('group')
  const groupId = group?.id ?? ''

  const { data: schemaData, isLoading: isLoadingSchema } = useQuery({
    ...metadataSchemaQueryOptions(),
    enabled: open,
  })

  const { data: templateData, isLoading: isLoadingTemplate } = useQuery({
    ...groupFieldTemplateQueryOptions(groupId),
    enabled: open && !!groupId,
  })

  const updateMutation = useUpdateGroupFieldTemplate()

  const [assignments, setAssignments] = useState<EditorAssignmentsT>({})
  const [activeEditorId, setActiveEditorId] = useState<string>('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const schema = schemaData?.groups ?? []
  const editors = templateData?.editors ?? []

  useEffect(() => {
    if (!open || !templateData) return

    setAssignments(buildInitialAssignments(templateData.editors))
    setActiveEditorId(templateData.editors[0]?.editorId ?? '')
    setExpandedGroups(new Set(schemaData?.groups.map((item) => item.groupCode) ?? []))
  }, [open, templateData, schemaData])

  const activeAllowedFields = useMemo(
    () => (activeEditorId ? assignments[activeEditorId] ?? [] : []),
    [assignments, activeEditorId],
  )

  const claimedByOthers = useMemo(
    () =>
      activeEditorId
        ? getClaimedFieldKeysByOthers(assignments, schema, activeEditorId)
        : new Set<string>(),
    [assignments, schema, activeEditorId],
  )

  const claimedFieldOwners = useMemo(
    () =>
      activeEditorId
        ? buildClaimedFieldOwners(assignments, schema, editors, activeEditorId)
        : new Map<string, string>(),
    [assignments, schema, editors, activeEditorId],
  )

  const totalFieldCount = useMemo(() => getAllSchemaFieldKeys(schema).length, [schema])

  const assignedFieldCount = useMemo(
    () => getAssignedFieldKeysAcrossEditors(assignments, schema).size,
    [assignments, schema],
  )

  const canSave = useMemo(
    () => isAssignmentComplete(assignments, schema),
    [assignments, schema],
  )

  const handleToggleExpand = (groupCode: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupCode)) {
        next.delete(groupCode)
      } else {
        next.add(groupCode)
      }
      return next
    })
  }

  const updateActiveEditorFields = (nextFields: Array<string>) => {
    if (!activeEditorId) return
    setAssignments((prev) => ({
      ...prev,
      [activeEditorId]: nextFields,
    }))
  }

  const handleToggleGroup = (metadataGroup: MetadataSchemaGroupT, checked: boolean) => {
    updateActiveEditorFields(
      toggleGroupFieldsExclusive(
        metadataGroup,
        activeAllowedFields,
        checked,
        schema,
        claimedByOthers,
      ),
    )
  }

  const handleToggleField = (fieldKey: string, checked: boolean) => {
    updateActiveEditorFields(
      toggleFieldExclusive(
        fieldKey,
        activeAllowedFields,
        checked,
        schema,
        claimedByOthers,
      ),
    )
  }

  const handleSave = () => {
    if (!group || !canSave) return

    const editorFieldTemplate = editors.map((editor) => {
      const allowedFields =
        assignments[editor.editorId] ??
        normalizeAllowedFields(editor.allowedFields)
      const expandedKeys = expandAllowedFieldsToKeys(allowedFields, schema)

      return {
        editorId: editor.editorId,
        allowedFields: compressAllowedFields(expandedKeys, schema),
      }
    })

    updateMutation.mutate(
      {
        groupId: group.id,
        payload: { editorFieldTemplate },
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    )
  }

  const handleReset = () => {
    setAssignments({})
    setActiveEditorId('')
    setExpandedGroups(new Set())
  }

  const isLoading = isLoadingSchema || isLoadingTemplate
  const hasEditors = editors.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen)
        if (!isOpen) handleReset()
      }}
    >
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('fieldAssignment.title')}</DialogTitle>
          <DialogDescription>
            {t('fieldAssignment.description', { name: group?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>

        {templateData && (
          <div className="text-sm text-muted-foreground">
            {t('fieldAssignment.splitMode')}:{' '}
            <span className="font-medium text-foreground">
              {templateData.isFieldSplitMode
                ? t('fieldAssignment.splitModeOn')
                : t('fieldAssignment.splitModeOff')}
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasEditors ? (
          <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground">
            {t('fieldAssignment.noEditors')}
          </div>
        ) : (
          <>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {t('fieldAssignment.progress', {
                assigned: assignedFieldCount,
                total: totalFieldCount,
              })}
            </span>
            {!canSave && (
              <span className="text-destructive text-xs">
                {t('fieldAssignment.completeRequired')}
              </span>
            )}
          </div>
          <Tabs
            value={activeEditorId}
            onValueChange={setActiveEditorId}
            className="flex flex-1 flex-col min-h-0"
          >
            <TabsList className="w-full justify-start overflow-x-auto">
              {editors.map((editor) => (
                <TabsTrigger key={editor.editorId} value={editor.editorId}>
                  {editor.fullName}
                </TabsTrigger>
              ))}
            </TabsList>

            {editors.map((editor) => (
              <TabsContent
                key={editor.editorId}
                value={editor.editorId}
                className={cn(
                  'flex-1 overflow-y-auto min-h-0 mt-4 pr-1',
                  activeEditorId !== editor.editorId && 'hidden',
                )}
              >
                <MetadataFieldTree
                  schema={schema}
                  allowedFields={assignments[editor.editorId] ?? []}
                  claimedByOthers={
                    editor.editorId === activeEditorId
                      ? claimedByOthers
                      : getClaimedFieldKeysByOthers(assignments, schema, editor.editorId)
                  }
                  claimedFieldOwners={
                    editor.editorId === activeEditorId
                      ? claimedFieldOwners
                      : buildClaimedFieldOwners(
                          assignments,
                          schema,
                          editors,
                          editor.editorId,
                        )
                  }
                  expandedGroups={expandedGroups}
                  onToggleExpand={handleToggleExpand}
                  onToggleGroup={handleToggleGroup}
                  onToggleField={handleToggleField}
                />
              </TabsContent>
            ))}
          </Tabs>
          </>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            {t('fieldAssignment.actions.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={
              isLoading || !hasEditors || !canSave || updateMutation.isPending
            }
          >
            {updateMutation.isPending
              ? t('fieldAssignment.actions.saving')
              : t('fieldAssignment.actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
