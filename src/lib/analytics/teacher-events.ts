// import { getCurrentSchoolId } from '@/features/auth/store'
// import { posthog } from '@/lib/analytics/posthog'

// // ---------------------------------------------------------------------------
// // Event name constants (single source of truth)
// // ---------------------------------------------------------------------------

// export const TeacherEventName = {
//   LESSON_ASSIGNMENT_TAB_VIEW: 'teacher_lesson_assignment_tab_view',
//   LESSON_QUESTION_STUDIO_OPEN: 'teacher_lesson_question_studio_open',
//   QUESTION_CREATE: 'teacher_question_create',
//   QUESTION_UPDATE: 'teacher_question_update',
//   QUESTION_DELETE: 'teacher_question_delete',
//   QUESTION_APPROVE: 'teacher_question_approve',
//   QUESTION_REJECT: 'teacher_question_reject',
//   AI_QUESTION_GENERATE_SUCCESS: 'teacher_ai_question_generate_success',
//   AI_QUESTION_GENERATE_FAIL: 'teacher_ai_question_generate_fail',
//   AI_QUESTION_IMPORT_SUCCESS: 'teacher_ai_question_import_success',
//   AI_QUESTION_IMPORT_FAIL: 'teacher_ai_question_import_fail',
//   AI_QUESTION_APPROVE_ALL: 'teacher_ai_question_approve_all',
//   AI_QUESTION_REJECT_ALL: 'teacher_ai_question_reject_all',
//   ASSIGNMENT_CREATE: 'teacher_assignment_create',
//   ASSIGNMENT_CREATE_FROM_PDF: 'teacher_assignment_create_from_pdf',
//   ASSIGNMENT_PUBLISH: 'teacher_assignment_publish',
//   ASSIGNMENT_QUESTION_ADD: 'teacher_assignment_question_add',
//   ASSIGNMENT_QUESTION_REMOVE: 'teacher_assignment_question_remove',
//   SUBMISSION_GRADING_SAVE: 'teacher_submission_grading_save',
//   SUBMISSION_APPROVE: 'teacher_submission_approve',
//   FEEDBACK_CREATE: 'teacher_feedback_create',
// } as const

// export type TeacherEventNameType =
//   (typeof TeacherEventName)[keyof typeof TeacherEventName]

// // ---------------------------------------------------------------------------
// // Payload types (snake_case for PostHog properties)
// // ---------------------------------------------------------------------------

// export interface TeacherEventContext {
//   school_id?: string
// }

// export interface TeacherLessonAssignmentTabViewPayload {
//   lesson_id: string
//   course_id?: string
//   school_id?: string
// }

// export interface TeacherLessonQuestionStudioOpenPayload {
//   lesson_id: string
//   course_id?: string
//   assignment_id?: string
//   school_id?: string
// }

// export interface TeacherQuestionCrudPayload {
//   lesson_id?: string
//   assignment_id?: string
//   question_id?: string
//   source?: 'lesson' | 'assignment'
// }

// export interface TeacherQuestionApproveRejectPayload {
//   question_id: string
//   lesson_id?: string
//   assignment_id?: string
//   source?: 'lesson' | 'assignment'
// }

// export interface TeacherAiQuestionPayload {
//   lesson_id?: string
//   assignment_id?: string
//   question_count?: number
//   question_types?: Array<string>
//   content_language?: string
//   error_message?: string
// }

// export interface TeacherAiQuestionBatchPayload {
//   lesson_id?: string
//   assignment_id?: string
//   question_count?: number
// }

// export interface TeacherAssignmentCreatePayload {
//   assignment_id: string
//   course_id: string
//   lesson_id?: string
//   assignment_type?: string
//   source?: 'template' | 'pdf'
// }

// export interface TeacherAssignmentPublishPayload {
//   assignment_id: string
//   lesson_id?: string
//   course_id?: string
// }

// export interface TeacherAssignmentQuestionPayload {
//   assignment_id: string
//   question_id: string
//   lesson_id?: string
// }

// export interface TeacherSubmissionPayload {
//   assignment_id: string
//   submission_id: string
//   lesson_id?: string
// }

// export interface TeacherFeedbackCreatePayload {
//   classroom_student_id: string
//   course_id?: string
//   school_id?: string
// }

// // Map event name -> payload type for type-safe trackTeacher
// export interface TeacherEventMap {
//   [TeacherEventName.LESSON_ASSIGNMENT_TAB_VIEW]: TeacherLessonAssignmentTabViewPayload
//   [TeacherEventName.LESSON_QUESTION_STUDIO_OPEN]: TeacherLessonQuestionStudioOpenPayload
//   [TeacherEventName.QUESTION_CREATE]: TeacherQuestionCrudPayload
//   [TeacherEventName.QUESTION_UPDATE]: TeacherQuestionCrudPayload
//   [TeacherEventName.QUESTION_DELETE]: TeacherQuestionCrudPayload
//   [TeacherEventName.QUESTION_APPROVE]: TeacherQuestionApproveRejectPayload
//   [TeacherEventName.QUESTION_REJECT]: TeacherQuestionApproveRejectPayload
//   [TeacherEventName.AI_QUESTION_GENERATE_SUCCESS]: TeacherAiQuestionPayload
//   [TeacherEventName.AI_QUESTION_GENERATE_FAIL]: TeacherAiQuestionPayload
//   [TeacherEventName.AI_QUESTION_IMPORT_SUCCESS]: TeacherAiQuestionPayload
//   [TeacherEventName.AI_QUESTION_IMPORT_FAIL]: TeacherAiQuestionPayload
//   [TeacherEventName.AI_QUESTION_APPROVE_ALL]: TeacherAiQuestionBatchPayload
//   [TeacherEventName.AI_QUESTION_REJECT_ALL]: TeacherAiQuestionBatchPayload
//   [TeacherEventName.ASSIGNMENT_CREATE]: TeacherAssignmentCreatePayload
//   [TeacherEventName.ASSIGNMENT_CREATE_FROM_PDF]: TeacherAssignmentCreatePayload
//   [TeacherEventName.ASSIGNMENT_PUBLISH]: TeacherAssignmentPublishPayload
//   [TeacherEventName.ASSIGNMENT_QUESTION_ADD]: TeacherAssignmentQuestionPayload
//   [TeacherEventName.ASSIGNMENT_QUESTION_REMOVE]: TeacherAssignmentQuestionPayload
//   [TeacherEventName.SUBMISSION_GRADING_SAVE]: TeacherSubmissionPayload
//   [TeacherEventName.SUBMISSION_APPROVE]: TeacherSubmissionPayload
//   [TeacherEventName.FEEDBACK_CREATE]: TeacherFeedbackCreatePayload
// }

// // ---------------------------------------------------------------------------
// // Single capture function
// // ---------------------------------------------------------------------------

// function isPostHogLoaded(): boolean {
//   return (
//     typeof window !== 'undefined' &&
//     (posthog as { __loaded?: boolean }).__loaded === true
//   )
// }

// export function trackTeacher<TEvent extends keyof TeacherEventMap>(
//   event: TEvent,
//   payload: TeacherEventMap[TEvent],
// ): void {
//   if (!isPostHogLoaded()) return
//   const schoolId = getCurrentSchoolId()
//   const context: TeacherEventContext = schoolId ? { school_id: schoolId } : {}
//   posthog.capture(event, { ...payload, ...context })
// }

// // ---------------------------------------------------------------------------
// // Convenience API: track.teacher.*
// // ---------------------------------------------------------------------------

// export const track = {
//   teacher: {
//     lessonAssignmentTabView(payload: TeacherLessonAssignmentTabViewPayload) {
//       trackTeacher(TeacherEventName.LESSON_ASSIGNMENT_TAB_VIEW, payload)
//     },
//     lessonQuestionStudioOpen(payload: TeacherLessonQuestionStudioOpenPayload) {
//       trackTeacher(TeacherEventName.LESSON_QUESTION_STUDIO_OPEN, payload)
//     },
//     questionCreate(payload: TeacherQuestionCrudPayload) {
//       trackTeacher(TeacherEventName.QUESTION_CREATE, payload)
//     },
//     questionUpdate(payload: TeacherQuestionCrudPayload) {
//       trackTeacher(TeacherEventName.QUESTION_UPDATE, payload)
//     },
//     questionDelete(payload: TeacherQuestionCrudPayload) {
//       trackTeacher(TeacherEventName.QUESTION_DELETE, payload)
//     },
//     questionApproved(payload: TeacherQuestionApproveRejectPayload) {
//       trackTeacher(TeacherEventName.QUESTION_APPROVE, payload)
//     },
//     questionRejected(payload: TeacherQuestionApproveRejectPayload) {
//       trackTeacher(TeacherEventName.QUESTION_REJECT, payload)
//     },
//     aiQuestionGenerateSuccess(payload: TeacherAiQuestionPayload) {
//       trackTeacher(TeacherEventName.AI_QUESTION_GENERATE_SUCCESS, payload)
//     },
//     aiQuestionGenerateFail(payload: TeacherAiQuestionPayload) {
//       trackTeacher(TeacherEventName.AI_QUESTION_GENERATE_FAIL, payload)
//     },
//     aiQuestionImportSuccess(payload: TeacherAiQuestionPayload) {
//       trackTeacher(TeacherEventName.AI_QUESTION_IMPORT_SUCCESS, payload)
//     },
//     aiQuestionImportFail(payload: TeacherAiQuestionPayload) {
//       trackTeacher(TeacherEventName.AI_QUESTION_IMPORT_FAIL, payload)
//     },
//     aiQuestionApproveAll(payload: TeacherAiQuestionBatchPayload) {
//       trackTeacher(TeacherEventName.AI_QUESTION_APPROVE_ALL, payload)
//     },
//     aiQuestionRejectAll(payload: TeacherAiQuestionBatchPayload) {
//       trackTeacher(TeacherEventName.AI_QUESTION_REJECT_ALL, payload)
//     },
//     assignmentCreate(payload: TeacherAssignmentCreatePayload) {
//       trackTeacher(TeacherEventName.ASSIGNMENT_CREATE, payload)
//     },
//     assignmentCreateFromPdf(payload: TeacherAssignmentCreatePayload) {
//       trackTeacher(TeacherEventName.ASSIGNMENT_CREATE_FROM_PDF, payload)
//     },
//     assignmentPublish(payload: TeacherAssignmentPublishPayload) {
//       trackTeacher(TeacherEventName.ASSIGNMENT_PUBLISH, payload)
//     },
//     assignmentQuestionAdd(payload: TeacherAssignmentQuestionPayload) {
//       trackTeacher(TeacherEventName.ASSIGNMENT_QUESTION_ADD, payload)
//     },
//     assignmentQuestionRemove(payload: TeacherAssignmentQuestionPayload) {
//       trackTeacher(TeacherEventName.ASSIGNMENT_QUESTION_REMOVE, payload)
//     },
//     submissionGradingSave(payload: TeacherSubmissionPayload) {
//       trackTeacher(TeacherEventName.SUBMISSION_GRADING_SAVE, payload)
//     },
//     submissionApprove(payload: TeacherSubmissionPayload) {
//       trackTeacher(TeacherEventName.SUBMISSION_APPROVE, payload)
//     },
//     feedbackCreate(payload: TeacherFeedbackCreatePayload) {
//       trackTeacher(TeacherEventName.FEEDBACK_CREATE, payload)
//     },
//   },
// }
