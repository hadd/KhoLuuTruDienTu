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

/** Static page heading for section pages navigated via tabs (no back link). */
export function SectionPageHeader({
  currentLabel,
  description,
}: {
  currentLabel: string
  description?: string
}) {
  return (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {currentLabel}
      </h1>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

/**
 * Boxed tab bar for hub section pages: every tab is a bordered cell sitting on
 * the bottom rule; the active tab lifts up with a frame that opens into the
 * content below instead of an underline.
 */
const sectionBoxedTabsTriggerBaseClassName =
  '-mb-px rounded-t-md rounded-b-none border border-border/60 bg-muted/40 font-medium text-muted-foreground shadow-none transition-colors hover:bg-muted/70 hover:text-foreground data-[state=active]:border-border data-[state=active]:border-b-transparent data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-none'

/** Level-1 (parent) tab bar. */
export const sectionBoxedTabsListClassName =
  'flex h-auto w-full flex-wrap items-end justify-start gap-1 rounded-none border-b border-border bg-transparent p-0 text-muted-foreground'

/** Level-1 (parent) tabs: larger, active tab gets a primary accent on top. */
export const sectionBoxedTabsTriggerClassName = `${sectionBoxedTabsTriggerBaseClassName} gap-2 px-4 py-2.5 text-base data-[state=active]:border-t-2 data-[state=active]:border-t-primary data-[state=active]:font-semibold sm:px-5`

export const sectionBoxedTabsTriggerCompactClassName = `${sectionBoxedTabsTriggerBaseClassName} gap-1.5 px-3.5 py-2 text-base data-[state=active]:border-t-2 data-[state=active]:border-t-primary data-[state=active]:font-semibold`

/** Level-2 (child) tab bar: indented to show nesting under the parent tabs. */
export const sectionBoxedSubTabsListClassName =
  'flex h-auto w-full flex-wrap items-end justify-start gap-1 rounded-none border-b border-border/70 bg-transparent p-0 pl-2 text-muted-foreground sm:pl-3'

/** Level-2 (child) tabs: smaller, boxed active state without the top accent. */
export const sectionBoxedSubTabsTriggerClassName = `${sectionBoxedTabsTriggerBaseClassName} gap-1.5 px-3 py-1.5 text-sm`
