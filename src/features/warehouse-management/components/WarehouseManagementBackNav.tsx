import { useTranslation } from 'react-i18next'

import {
  SectionBackNav,
  sectionBoxedSubTabsListClassName,
  sectionBoxedSubTabsTriggerClassName,
  sectionBoxedTabsListClassName,
  sectionBoxedTabsTriggerClassName,
  sectionBoxedTabsTriggerCompactClassName,
} from '@/features/navigation/components/SectionBackNav'

export function WarehouseManagementBackNav({
  currentLabel,
  description,
}: {
  currentLabel: string
  description?: string
}) {
  const { t } = useTranslation('warehouse-management')

  return (
    <SectionBackNav
      to="/app/warehouse-management"
      currentLabel={currentLabel}
      description={description}
      backAriaLabel={`${t('breadcrumb.back')}: ${t('title')}`}
    />
  )
}

export const warehouseTabsListClassName = sectionBoxedTabsListClassName
export const warehouseTabsTriggerClassName = sectionBoxedTabsTriggerClassName
export const warehouseTabsTriggerCompactClassName =
  sectionBoxedTabsTriggerCompactClassName
export const warehouseSubTabsListClassName = sectionBoxedSubTabsListClassName
export const warehouseSubTabsTriggerClassName =
  sectionBoxedSubTabsTriggerClassName
