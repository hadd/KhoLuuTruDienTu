import { ChevronRight, FileIcon } from 'lucide-react'
import * as React from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'

export interface SelectOption {
  id: string
  name: string
  filePath?: string
}

interface LinkDocumentBreadcrumbProps {
  folderSegments: string[]
  fileName?: string
  selectOptions: Array<SelectOption>
  selectedValue: string
  onValueChange: (value: string) => void
  disabled?: boolean
  placeholder: string
  noDocumentLabel: string
}

const MAX_VISIBLE_SEGMENTS = 2

function useTruncatedSegments(segments: string[]) {
  return React.useMemo(() => {
    if (segments.length <= MAX_VISIBLE_SEGMENTS + 1) return segments
    return [
      segments[0],
      '...',
      ...segments.slice(-MAX_VISIBLE_SEGMENTS),
    ]
  }, [segments])
}

export function LinkDocumentBreadcrumb({
  folderSegments,
  fileName,
  selectOptions,
  selectedValue,
  onValueChange,
  disabled = false,
  placeholder,
  noDocumentLabel,
}: LinkDocumentBreadcrumbProps) {
  const hasFile = Boolean(fileName)
  const displaySegments = useTruncatedSegments(folderSegments)
  const fullTooltipPath = folderSegments.join(' > ')

  return (
    <div className="flex items-center gap-0.5 text-xs font-mono flex-wrap">
      {displaySegments.map((segment, index) => (
        <React.Fragment key={`${segment}-${index}`}>
          {index > 0 && (
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/40" />
          )}
          <span
            className={cn(
              'truncate max-w-[140px]',
              segment === '...'
                ? 'text-muted-foreground/60'
                : 'text-muted-foreground',
            )}
            title={segment === '...' ? undefined : segment}
          >
            {segment === '...' ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="cursor-help border-b border-dotted border-muted-foreground/30"
                    tabIndex={-1}
                  >
                    {'...'}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="font-mono text-xs">{fullTooltipPath}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              segment
            )}
          </span>
        </React.Fragment>
      ))}

      <ChevronRight className="size-3 shrink-0 text-muted-foreground/40" />

      <Select
        value={selectedValue}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            'inline-flex h-auto w-auto min-w-0 shrink gap-1 rounded-full border bg-transparent px-2 py-0.5 text-xs font-mono shadow-none',
            'transition-colors',
            'hover:bg-accent/50',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'cursor-pointer',
            hasFile
              ? 'border-transparent text-primary'
              : 'border-dashed border-muted-foreground/30 text-muted-foreground italic',
          )}
        >
          <FileIcon className="size-3 shrink-0" />
          <span>{hasFile ? fileName : placeholder}</span>
        </SelectTrigger>
        <SelectContent className="max-h-60 max-w-[400px]">
          <SelectItem
            value="none"
            className="text-destructive font-medium focus:text-destructive"
          >
            {noDocumentLabel}
          </SelectItem>
          {selectOptions.map((opt) => (
            <SelectItem key={opt.id} value={opt.id} className="text-xs">
              <span className="truncate" title={opt.name}>
                {opt.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
