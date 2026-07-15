import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

type SectionBackNavProps = {
  to:
    | '/app/warehouse-management'
    | '/app/general-catalog'
    | '/app/data-config'
  currentLabel: string
  description?: string
  backAriaLabel: string
}

export function SectionBackNav({
  to,
  currentLabel,
  description,
  backAriaLabel,
}: SectionBackNavProps) {
  return (
    <div className="space-y-1">
      <Link
        to={to}
        className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground transition-colors hover:text-primary sm:text-2xl"
        aria-label={backAriaLabel}
      >
        <ArrowLeft className="size-5 shrink-0 text-primary sm:size-6" aria-hidden />
        <span>{currentLabel}</span>
      </Link>
      {description ? (
        <p className="pl-7 text-sm text-muted-foreground sm:pl-8">{description}</p>
      ) : null}
    </div>
  )
}

/** Underline tab bar for hub section pages. */
export const sectionUnderlineTabsListClassName =
  'h-auto w-full flex-wrap justify-start gap-0 rounded-none border-b border-border bg-transparent p-0 text-muted-foreground'

export const sectionUnderlineTabsTriggerClassName =
  'gap-2 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none sm:px-4'
