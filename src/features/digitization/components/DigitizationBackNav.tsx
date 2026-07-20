import {
  SectionPageHeader,
  sectionBoxedSubTabsListClassName,
  sectionBoxedSubTabsTriggerClassName,
  sectionBoxedTabsListClassName,
  sectionBoxedTabsTriggerClassName,
  sectionBoxedTabsTriggerCompactClassName,
} from '@/features/navigation/components/SectionBackNav'

export function DigitizationBackNav({
  currentLabel,
  description,
}: {
  currentLabel: string
  description?: string
}) {
  return (
    <SectionPageHeader currentLabel={currentLabel} description={description} />
  )
}

export const digitizationTabsListClassName = sectionBoxedTabsListClassName
export const digitizationTabsTriggerClassName = sectionBoxedTabsTriggerClassName
export const digitizationTabsTriggerCompactClassName =
  sectionBoxedTabsTriggerCompactClassName
export const digitizationSubTabsListClassName = sectionBoxedSubTabsListClassName
export const digitizationSubTabsTriggerClassName =
  sectionBoxedSubTabsTriggerClassName
