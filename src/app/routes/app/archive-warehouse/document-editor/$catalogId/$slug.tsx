import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { DisposalDocumentEditorPage } from '@/features/archive-disposal/components/DisposalDocumentEditorPage'
import type { EditableDocumentSlugT } from '@/features/archive-disposal/types'

const slugSchema = z.enum(['pl3', 'minutes-council', 'minutes-destruction'])

const searchSchema = z.object({
  canEdit: z.union([z.literal('0'), z.literal('1')]).optional(),
  titleKey: z.string().optional(),
})

export const Route = createFileRoute(
  '/app/archive-warehouse/document-editor/$catalogId/$slug',
)({
  validateSearch: searchSchema,
  component: DisposalDocumentEditorRoute,
})

const TITLE_KEY_BY_SLUG: Record<EditableDocumentSlugT, string> = {
  pl3: 'appraisalExport.pl3',
  'minutes-council': 'appraisalExport.minutesCouncil',
  'minutes-destruction': 'appraisalExport.minutesDestruction',
}

function DisposalDocumentEditorRoute() {
  const { catalogId, slug: rawSlug } = Route.useParams()
  const search = Route.useSearch()
  const parsedSlug = slugSchema.safeParse(rawSlug)
  if (!parsedSlug.success) {
    return (
      <div className="flex h-dvh items-center justify-center p-6 text-sm text-destructive">
        Invalid document type
      </div>
    )
  }
  const slug = parsedSlug.data
  const canEdit = search.canEdit !== '0'
  const titleKey = search.titleKey || TITLE_KEY_BY_SLUG[slug]

  return (
    <DisposalDocumentEditorPage
      catalogId={catalogId}
      slug={slug}
      titleKey={titleKey}
      canEdit={canEdit}
      closeBrowserWindowOnExit
    />
  )
}
