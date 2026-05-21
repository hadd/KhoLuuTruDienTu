// import { Loader2 } from 'lucide-react'
// import { useTranslation } from 'react-i18next'

// import {
//   Sheet,
//   SheetContent,
//   SheetHeader,
//   SheetTitle,
// } from '@/components/ui/sheet'

// interface EntitySheetProps<TEntity extends { id: string } | null | undefined> {
//   open: boolean
//   onOpenChange: (open: boolean) => void
//   entity: TEntity
//   isLoadingData?: boolean
//   createTitleKey: string
//   editTitleKey: string
//   namespace?: string
//   maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
//   children: React.ReactNode
// }

// /**
//  * Reusable Sheet wrapper component for entity create/edit forms
//  *
//  * Handles:
//  * - Sheet layout and structure
//  * - Loading state display
//  * - Header with title and ID display
//  * - Form key management (forces remount on entity change)
//  *
//  * @example
//  * ```tsx
//  * <EntitySheet
//  *   open={open}
//  *   onOpenChange={setOpen}
//  *   entity={classroom}
//  *   isLoadingData={isLoading}
//  *   createTitleKey="classes.form.createTitle"
//  *   editTitleKey="classes.form.editTitle"
//  *   namespace="school"
//  * >
//  *   <ClassForm
//  *     key={classroom?.id ?? 'new'}
//  *     classroom={classroom}
//  *     onSubmit={handleSubmit}
//  *     onCancel={() => setOpen(false)}
//  *   />
//  * </EntitySheet>
//  * ```
//  */
// export function EntitySheet<TEntity extends { id: string } | null | undefined>({
//   open,
//   onOpenChange,
//   entity,
//   isLoadingData = false,
//   createTitleKey,
//   editTitleKey,
//   namespace = 'school',
//   maxWidth = 'lg',
//   children,
// }: EntitySheetProps<TEntity>) {
//   const { t } = useTranslation("common")
//   const { t: tCommon } = useTranslation('common')

//   const maxWidthClass = {
//     sm: 'sm:max-w-sm',
//     md: 'sm:max-w-md',
//     lg: 'sm:max-w-lg',
//     xl: 'sm:max-w-xl',
//   }[maxWidth]

//   return (
//     <Sheet open={open} onOpenChange={onOpenChange}>
//       <SheetContent className={`flex flex-col w-full ${maxWidthClass} p-0`}>
//         <SheetHeader className="px-6 pt-6 pb-4 border-b">
//           <SheetTitle>
//             {entity ? t(editTitleKey) : t(createTitleKey)}
//           </SheetTitle>
//           {entity && (
//             <div className="mt-1 text-xs text-muted-foreground">
//               {tCommon('common.id')}: {entity.id}
//             </div>
//           )}
//         </SheetHeader>
//         <div className="flex-1 overflow-y-auto px-6 py-6">
//           {isLoadingData ? (
//             <div className="flex items-center justify-center py-12">
//               <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
//             </div>
//           ) : (
//             children
//           )}
//         </div>
//       </SheetContent>
//     </Sheet>
//   )
// }
