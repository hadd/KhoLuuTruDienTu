import {
  SectionPageHeader,
  sectionBoxedSubTabsListClassName,
  sectionBoxedSubTabsTriggerClassName,
  sectionBoxedTabsListClassName,
  sectionBoxedTabsTriggerClassName,
  sectionBoxedTabsTriggerCompactClassName,
} from '@/features/navigation/components/SectionBackNav'

export function ProjectManagementBackNav({
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

export const projectTabsListClassName = sectionBoxedTabsListClassName
export const projectTabsTriggerClassName = sectionBoxedTabsTriggerClassName
export const projectTabsTriggerCompactClassName =
  sectionBoxedTabsTriggerCompactClassName
export const projectSubTabsListClassName = sectionBoxedSubTabsListClassName
export const projectSubTabsTriggerClassName = sectionBoxedSubTabsTriggerClassName
