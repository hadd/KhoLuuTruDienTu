import {
  SectionPageHeader,
  sectionBoxedSubTabsListClassName,
  sectionBoxedSubTabsTriggerClassName,
  sectionBoxedTabsListClassName,
  sectionBoxedTabsTriggerClassName,
  sectionBoxedTabsTriggerCompactClassName,
} from '@/features/navigation/components/SectionBackNav'

export function UserManagementBackNav({
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
export const userTabsListClassName = sectionBoxedTabsListClassName
export const userTabsTriggerClassName = sectionBoxedTabsTriggerClassName
export const userTabsTriggerCompactClassName = sectionBoxedTabsTriggerCompactClassName
export const userSubTabsListClassName = sectionBoxedSubTabsListClassName
export const userSubTabsTriggerClassName = sectionBoxedSubTabsTriggerClassName
