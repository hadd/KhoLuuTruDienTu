import { DataConfigSectionTabs } from '@/features/data-config/components/DataConfigSectionTabs'
import { MetadataHiddenFieldsSection } from '@/features/metadata-extract/components/MetadataHiddenFieldsSection'

export function MetadataHiddenFieldsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto pb-8">
      <DataConfigSectionTabs active="metadata-hidden-fields" />
      <div className="max-w-4xl">
        <MetadataHiddenFieldsSection />
      </div>
    </div>
  )
}
