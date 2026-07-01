// import { useMutation, useQueryClient } from '@tanstack/react-query'
// import { useNavigate } from '@tanstack/react-router'
// import {
//   AlertCircle,
//   BarChart3,
//   Check,
//   Clock,
//   ExternalLink,
//   FileSearch,
//   ListTodo,
//   Loader2,
//   RefreshCw,
//   Trash2,
//   X,
// } from 'lucide-react'
// import { useEffect, useMemo, useRef, useState } from 'react'
// import { useTranslation } from 'react-i18next'
// import { toast } from 'sonner'

// import { Badge } from '@/components/ui/badge'
// import { Button } from '@/components/ui/button'
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from '@/components/ui/popover'
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipTrigger,
// } from '@/components/ui/tooltip'
// import { useCurrentSchool } from '@/features/auth/hooks'
// import { useAuthStore } from '@/features/auth/store'
// import { AutofillOutcomeJobReportDialog } from '@/features/school-management/components/AutofillOutcomeJobReportDialog'
// import {
//   clearTerminalBackgroundJobsForSchool,
//   refreshPendingBackgroundJobs,
//   removeBackgroundJobById,
// } from '@/lib/background-jobs/background-jobs-store'
// import type {
//   BackgroundJobContext,
//   BackgroundJobDestination,
// } from '@/lib/background-jobs/types'
// import { useBackgroundJobsList } from '@/lib/background-jobs/useBackgroundJobsList'
// import { useBackgroundJobsPolling } from '@/lib/background-jobs/useBackgroundJobsPolling'
// import { useBackgroundJobsUserSync } from '@/lib/background-jobs/useBackgroundJobsUserSync'
// import { getGradeLabel, getSubjectLabel } from '@/lib/constants/categories'
// import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
// import { cn } from '@/lib/utils/cn'
// import { formatDate } from '@/lib/utils/date'

// function navigateToDestination(
//   navigate: ReturnType<typeof useNavigate>,
//   dest: BackgroundJobDestination,
// ) {
//   navigate({
//     to: dest.to,
//     params: dest.params,
//     search: dest.search ?? {},
//   })
// }

// function buildImportReviewDestination(
//   dest: BackgroundJobDestination,
//   jobId: string,
// ): BackgroundJobDestination {
//   return {
//     ...dest,
//     search: {
//       ...(dest.search ?? {}),
//       importJobId: jobId,
//       importReviewMode: 'continue',
//       importPanel: 'image',
//     },
//   }
// }

// function JobStatusBadge({
//   status,
// }: {
//   status: 'pending' | 'success' | 'failed'
// }) {
//   if (status === 'pending') {
//     return (
//       <div
//         className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"
//         aria-hidden
//       >
//         <Loader2 className="h-4 w-4 animate-spin text-primary" />
//       </div>
//     )
//   }
//   if (status === 'success') {
//     return (
//       <div
//         className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10"
//         aria-hidden
//       >
//         <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
//       </div>
//     )
//   }
//   return (
//     <div
//       className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10"
//       aria-hidden
//     >
//       <AlertCircle className="h-4 w-4 text-destructive" />
//     </div>
//   )
// }

// function buildUniqueCaptionParts(values: Array<string | undefined | null>): Array<string> {
//   const seen = new Set<string>()
//   const out: Array<string> = []
//   for (const raw of values) {
//     const v = typeof raw === 'string' ? raw.trim() : ''
//     if (!v) continue
//     const key = v.toLowerCase()
//     if (seen.has(key)) continue
//     seen.add(key)
//     out.push(v)
//   }
//   return out
// }

// function resolveImportReviewLifecycle(
//   ctx: BackgroundJobContext | undefined,
// ): 'questions_not_created' | 'questions_created' | 'review_completed' {
//   if (ctx?.importReviewLifecycle === 'questions_not_created') {
//     return 'questions_not_created'
//   }
//   if (ctx?.importReviewLifecycle === 'questions_created') {
//     return 'questions_created'
//   }
//   if (ctx?.importReviewLifecycle === 'review_completed') {
//     return 'review_completed'
//   }
//   if (ctx?.reviewState === 'completed' || ctx?.reviewCompleted === true) {
//     return 'review_completed'
//   }
//   if (ctx?.reviewState === 'in_progress') {
//     return 'questions_created'
//   }
//   return 'questions_not_created'
// }

// export function BackgroundJobsMenu() {
//   useBackgroundJobsUserSync()

//   const { t } = useTranslation('home')
//   const navigate = useNavigate()
//   const schoolId = useCurrentSchool()
//   const userId = useAuthStore((s) => s.user?.id ?? null)
//   const queryClient = useQueryClient()
//   const jobs = useBackgroundJobsList()
//   const lang = useCurrentLanguage()
//   const locale = lang === 'vi' ? 'vi' : 'en'

//   const [panelOpen, setPanelOpen] = useState(false)
//   const [reportOpen, setReportOpen] = useState(false)
//   const [reportJobId, setReportJobId] = useState<string | null>(null)
//   const [reportDestination, setReportDestination] =
//     useState<BackgroundJobDestination | null>(null)
//   const [reportJobContext, setReportJobContext] =
//     useState<BackgroundJobContext | null>(null)

//   const prevStatuses = useRef<Map<string, string>>(new Map())

//   useBackgroundJobsPolling(schoolId, userId)

//   const schoolJobs = useMemo(() => {
//     if (!schoolId || !userId) return []
//     return jobs.filter((j) => j.schoolId === schoolId && j.userId === userId)
//   }, [jobs, schoolId, userId])

//   const pendingCount = useMemo(
//     () => schoolJobs.filter((j) => j.status === 'pending').length,
//     [schoolJobs],
//   )

//   const needsActionCount = useMemo(
//     () =>
//       schoolJobs.filter((job) => {
//         if (job.status === 'failed') return true
//         return (
//           job.taskType === 'question-extraction-import' &&
//           job.status === 'success' &&
//           resolveImportReviewLifecycle(job.context) !== 'review_completed'
//         )
//       }).length,
//     [schoolJobs],
//   )

//   const backgroundJobsTriggerAria = useMemo(() => {
//     const base = t('header.backgroundJobs.triggerAriaLabel')
//     const parts: Array<string> = []
//     if (pendingCount > 0) {
//       parts.push(
//         t('header.backgroundJobs.triggerAriaPending', { count: pendingCount }),
//       )
//     }
//     if (needsActionCount > 0) {
//       parts.push(
//         t('header.backgroundJobs.triggerAriaNeedsAction', {
//           count: needsActionCount,
//         }),
//       )
//     }
//     if (parts.length === 0) {
//       return t('header.backgroundJobs.triggerAriaEmpty')
//     }
//     return `${base}. ${parts.join(', ')}`
//   }, [t, pendingCount, needsActionCount])

//   const hasTerminalJobs = useMemo(
//     () => schoolJobs.some((j) => j.status !== 'pending'),
//     [schoolJobs],
//   )

//   useEffect(() => {
//     for (const job of schoolJobs) {
//       const key = job.jobId
//       const prev = prevStatuses.current.get(key)
//       if (prev === 'pending' && job.status === 'success') {
//         toast.success(t('header.backgroundJobs.toastSuccess'))
//         queryClient.invalidateQueries({
//           queryKey: ['question-studio', 'questions'],
//         })
//       } else if (prev === 'pending' && job.status === 'failed') {
//         toast.error(
//           job.errorMessage ?? t('header.backgroundJobs.toastFailed'),
//         )
//       }
//       prevStatuses.current.set(key, job.status)
//     }
//     for (const key of prevStatuses.current.keys()) {
//       if (!schoolJobs.some((j) => j.jobId === key)) {
//         prevStatuses.current.delete(key)
//       }
//     }
//   }, [schoolJobs, t, queryClient])

//   const refreshMutation = useMutation({
//     mutationFn: async () => {
//       if (!schoolId) return []
//       return refreshPendingBackgroundJobs(schoolId)
//     },
//   })

//   const clearDoneMutation = useMutation({
//     mutationFn: () => {
//       if (!schoolId || !userId) return Promise.resolve()
//       clearTerminalBackgroundJobsForSchool(schoolId, { userId })
//       return Promise.resolve()
//     },
//   })

//   const sortedForUi = useMemo(() => {
//     const pending = schoolJobs.filter((j) => j.status === 'pending')
//     const rest = schoolJobs.filter((j) => j.status !== 'pending')
//     rest.sort(
//       (a, b) =>
//         new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
//     )
//     const seenImportIdentities = new Set<string>()
//     const deduped = [...pending, ...rest].filter((job) => {
//       if (job.taskType !== 'question-extraction-import') {
//         return true
//       }
//       const workflowId = job.context?.workflowId?.trim() ?? ''
//       const identity = workflowId ? `workflow:${workflowId}` : `job:${job.jobId}`
//       if (seenImportIdentities.has(identity)) {
//         return false
//       }
//       seenImportIdentities.add(identity)
//       return true
//     })
//     return deduped.slice(0, 20)
//   }, [schoolJobs])

//   const openReport = (
//     jobId: string,
//     dest: BackgroundJobDestination,
//     context?: BackgroundJobContext,
//   ) => {
//     setPanelOpen(false)
//     setReportJobId(jobId)
//     setReportDestination(dest)
//     setReportJobContext(context ?? null)
//     setReportOpen(true)
//   }

//   const handleReportOpenChange = (open: boolean) => {
//     setReportOpen(open)
//     if (!open) {
//       setReportJobId(null)
//       setReportDestination(null)
//       setReportJobContext(null)
//     }
//   }

//   const handleOpenDestination = (dest: BackgroundJobDestination) => {
//     setPanelOpen(false)
//     navigateToDestination(navigate, dest)
//   }

//   if (!schoolId || !userId) return null

//   const captionBullet = t('header.backgroundJobs.contextCaptionBullet')

//   return (
//     <>
//       <Popover open={panelOpen} onOpenChange={setPanelOpen}>
//         <PopoverTrigger asChild>
//           <button
//             type="button"
//             className={cn(
//               'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted',
//               pendingCount > 0 && 'text-foreground',
//             )}
//             aria-label={backgroundJobsTriggerAria}
//             aria-expanded={panelOpen}
//           >
//             <ListTodo className="h-5 w-5" />
//             {pendingCount > 0 ? (
//               <Loader2 className="absolute -bottom-0.5 -left-0.5 h-3 w-3 animate-spin text-primary" />
//             ) : null}
//             {pendingCount > 0 ? (
//               <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
//                 {pendingCount > 9 ? '9+' : pendingCount}
//               </span>
//             ) : null}
//             {needsActionCount > 0 ? (
//               <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
//                 {needsActionCount > 9 ? '9+' : needsActionCount}
//               </span>
//             ) : null}
//           </button>
//         </PopoverTrigger>
//         <PopoverContent
//           align="end"
//           sideOffset={8}
//           className="w-[min(100vw-1rem,32rem)] border-border p-0 shadow-lg sm:w-[min(100vw-2rem,36rem)]"
//         >
//           <div className="flex max-h-[min(85vh,32rem)] flex-col">
//             <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
//               <div className="min-w-0 flex-1">
//                 <h2 className="text-base font-semibold leading-tight text-foreground">
//                   {t('header.backgroundJobs.panelTitle')}
//                 </h2>
//                 <p className="mt-0.5 text-xs text-muted-foreground">
//                   {t('header.backgroundJobs.panelSubtitle')}
//                 </p>
//               </div>
//               <div className="flex shrink-0 items-center gap-0.5">
//                 <Button
//                   type="button"
//                   variant="ghost"
//                   size="icon"
//                   className="h-8 w-8 text-muted-foreground"
//                   disabled={refreshMutation.isPending}
//                   aria-label={t('header.backgroundJobs.refreshAria')}
//                   onClick={() => refreshMutation.mutate()}
//                 >
//                   <RefreshCw
//                     className={cn(
//                       'h-4 w-4',
//                       refreshMutation.isPending && 'animate-spin',
//                     )}
//                   />
//                 </Button>
//                 <Button
//                   type="button"
//                   variant="ghost"
//                   size="icon"
//                   className="h-8 w-8 text-muted-foreground"
//                   aria-label={t('header.backgroundJobs.closePanelAria')}
//                   onClick={() => setPanelOpen(false)}
//                 >
//                   <X className="h-4 w-4" />
//                 </Button>
//               </div>
//             </div>

//             <div className="min-h-0 flex-1 overflow-y-auto px-4">
//               {sortedForUi.length === 0 ? (
//                 <p className="py-10 text-center text-sm text-muted-foreground">
//                   {t('header.backgroundJobs.empty')}
//                 </p>
//               ) : (
//                 sortedForUi.map((job) => {
//                   const ctx = job.context
//                   const gradePart = ctx?.gradeKey
//                     ? getGradeLabel(ctx.gradeKey, locale)
//                     : ''
//                   const subjectPart = ctx?.subjectKey
//                     ? getSubjectLabel(ctx.subjectKey, locale)
//                     : ''
//                   const countPart =
//                     ctx?.questionCount != null
//                       ? t('header.backgroundJobs.questionCount', {
//                           count: ctx.questionCount,
//                         })
//                       : ''

//                   const captionLine = buildUniqueCaptionParts([
//                     ctx?.classroomName,
//                     ctx?.courseName,
//                     gradePart,
//                     subjectPart,
//                     countPart,
//                   ]).join(captionBullet)

//                   const absoluteTime = formatDate(job.createdAt, 'PPp', locale)

//                   const isAutofillJob = job.taskType === 'autofill-outcome-batch'
//                   const isImportJob = job.taskType === 'question-extraction-import'
//                   const taskTitle = isImportJob
//                     ? t('header.backgroundJobs.taskTypes.questionExtractionImport')
//                     : t('header.backgroundJobs.taskTypes.autofillOutcomeBatch')
//                   const importReviewStatus =
//                     isImportJob
//                       ? (() => {
//                           const reviewLifecycle = resolveImportReviewLifecycle(ctx)
//                           if (reviewLifecycle === 'questions_not_created') {
//                             return t('header.backgroundJobs.importReviewUninitialized')
//                           }
//                           if (reviewLifecycle === 'review_completed') {
//                             return t('header.backgroundJobs.importReviewCompleted')
//                           }
//                           if (typeof ctx?.reviewPendingCount === 'number') {
//                             return ctx.reviewPendingCount > 0
//                               ? t('header.backgroundJobs.importReviewPending', {
//                                   count: ctx.reviewPendingCount,
//                                 })
//                               : t('header.backgroundJobs.importReviewInProgress')
//                           }
//                           return t('header.backgroundJobs.importReviewInProgress')
//                         })()
//                       : null
//                   const isImportReviewPending =
//                     isImportJob &&
//                     resolveImportReviewLifecycle(ctx) !== 'review_completed'

//                   return (
//                     <div
//                       key={job.jobId || job.id}
//                       className="flex gap-3 border-b border-border py-3 last:border-b-0"
//                       title={absoluteTime}
//                     >
//                       <JobStatusBadge status={job.status} />
//                       <div className="min-w-0 flex-1 pr-1">
//                         <p className="text-sm font-semibold leading-snug text-foreground">
//                           {taskTitle}
//                         </p>
//                         {captionLine ? (
//                           <p className="mt-1 break-words text-[11px] font-medium uppercase leading-relaxed tracking-wide text-muted-foreground">
//                             {captionLine}
//                           </p>
//                         ) : null}
//                         {importReviewStatus ? (
//                           <div className="mt-1">
//                             <Badge
//                               variant="outline"
//                               className={cn(
//                                 'h-6 px-2 text-xs font-medium',
//                                 isImportReviewPending
//                                   ? 'border-amber-300 bg-amber-50 text-amber-700'
//                                   : 'border-emerald-300 bg-emerald-50 text-emerald-700',
//                               )}
//                             >
//                               {importReviewStatus}
//                             </Badge>
//                           </div>
//                         ) : null}
//                         {job.status === 'failed' && job.errorMessage ? (
//                           <p className="mt-1 line-clamp-2 text-xs text-destructive">
//                             {job.errorMessage}
//                           </p>
//                         ) : null}
//                         <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
//                           <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
//                           {absoluteTime}
//                         </p>
//                       </div>
//                       <div className="flex shrink-0 items-start pt-0.5">
//                         <div className="inline-flex items-stretch divide-x divide-border overflow-hidden rounded-md border border-border bg-background shadow-xs">
//                           {job.status === 'success' && isAutofillJob ? (
//                             <Tooltip>
//                               <TooltipTrigger asChild>
//                                 <Button
//                                   type="button"
//                                   variant="ghost"
//                                   size="icon"
//                                   className="h-8 w-8 shrink-0 rounded-none"
//                                   aria-label={t(
//                                     'header.backgroundJobs.viewReport',
//                                   )}
//                                   onClick={() =>
//                                     openReport(
//                                       job.jobId,
//                                       job.destination,
//                                       job.context,
//                                     )
//                                   }
//                                 >
//                                   <BarChart3 className="h-4 w-4" />
//                                 </Button>
//                               </TooltipTrigger>
//                               <TooltipContent side="top" align="center">
//                                 {t('header.backgroundJobs.viewReport')}
//                               </TooltipContent>
//                             </Tooltip>
//                           ) : null}
//                           {job.status === 'success' && isImportJob ? (
//                             <Tooltip>
//                               <TooltipTrigger asChild>
//                                 <Button
//                                   type="button"
//                                   variant="ghost"
//                                   size="icon"
//                                   className="h-8 w-8 shrink-0 rounded-none"
//                                   aria-label={t(
//                                     'header.backgroundJobs.reviewContinue',
//                                   )}
//                                   onClick={() =>
//                                     handleOpenDestination(
//                                       buildImportReviewDestination(
//                                         job.destination,
//                                         job.jobId,
//                                       ),
//                                     )
//                                   }
//                                 >
//                                   <FileSearch className="h-4 w-4" />
//                                 </Button>
//                               </TooltipTrigger>
//                               <TooltipContent side="top" align="center">
//                                 {t('header.backgroundJobs.reviewContinue')}
//                               </TooltipContent>
//                             </Tooltip>
//                           ) : null}
//                           <Tooltip>
//                             <TooltipTrigger asChild>
//                               <Button
//                                 type="button"
//                                 variant="ghost"
//                                 size="icon"
//                                 className="h-8 w-8 shrink-0 rounded-none"
//                                 aria-label={t(
//                                   'header.backgroundJobs.openLink',
//                                 )}
//                                 onClick={() =>
//                                   handleOpenDestination(job.destination)
//                                 }
//                               >
//                                 <ExternalLink className="h-4 w-4" />
//                               </Button>
//                             </TooltipTrigger>
//                             <TooltipContent side="top" align="center">
//                               {t('header.backgroundJobs.openLink')}
//                             </TooltipContent>
//                           </Tooltip>
//                           {job.status !== 'pending' ? (
//                             <Tooltip>
//                               <TooltipTrigger asChild>
//                                 <Button
//                                   type="button"
//                                   variant="ghost"
//                                   size="icon"
//                                   className="h-8 w-8 shrink-0 rounded-none text-muted-foreground hover:text-destructive"
//                                   aria-label={t(
//                                     'header.backgroundJobs.dismissJobAria',
//                                   )}
//                                   onClick={() =>
//                                     removeBackgroundJobById(job.id)
//                                   }
//                                 >
//                                   <Trash2 className="h-4 w-4" />
//                                 </Button>
//                               </TooltipTrigger>
//                               <TooltipContent side="top" align="center">
//                                 {t('header.backgroundJobs.dismissJobAria')}
//                               </TooltipContent>
//                             </Tooltip>
//                           ) : null}
//                         </div>
//                       </div>
//                     </div>
//                   )
//                 })
//               )}
//             </div>

//             <div className="border-t border-border px-4 py-3">
//               <Button
//                 type="button"
//                 variant="ghost"
//                 size="sm"
//                 className="h-9 gap-2 px-2 text-xs text-muted-foreground hover:text-foreground"
//                 disabled={!hasTerminalJobs || clearDoneMutation.isPending}
//                 onClick={() => clearDoneMutation.mutate()}
//               >
//                 <Trash2 className="h-4 w-4" />
//                 {t('header.backgroundJobs.clearHistory')}
//               </Button>
//             </div>
//           </div>
//         </PopoverContent>
//       </Popover>

//       {schoolId ? (
//         <AutofillOutcomeJobReportDialog
//           open={reportOpen}
//           onOpenChange={handleReportOpenChange}
//           schoolId={schoolId}
//           jobId={reportJobId}
//           courseDestination={reportDestination}
//           jobContext={reportJobContext ?? undefined}
//         />
//       ) : null}
//     </>
//   )
// }
