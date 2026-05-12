/**
 * Unified status badge utility for all entity types
 * Follows UI guidelines for status badge styling
 * Standardizes draft status to gray/neutral across the project
 */

/**
 * Union type for all valid status values used across the application
 * This ensures type safety when using status badges
 */
export type StatusValue =
  // Common statuses
  | 'draft'
  | 'active'
  | 'publish'
  | 'published'
  | 'archived'
  | 'inactive'
  | 'closed'
  // Assignment/Submission statuses
  | 'pending'
  | 'pending_leave'
  | 'review'
  | 'submitted'
  | 'graded'
  // Question/Review statuses
  | 'under_review'
  | 'inputed'
  | 'approved'
  | 'rejected'
  // Student statuses
  | 'enrolled'
  | 'withdrawn'
  | 'graduated'
  | 'transferred'
  | 'suspended'
  // Grading/Processing statuses
  | 'processing'
  | 'done'
  | 'error'
  | 'ai_grading'
  | 'ai_graded'
  // Attendance summary statuses
  | 'attendance_unmarked'
  | 'attendance_leave'

/**
 * Maps status to badge color classes for all entity types
 * Handles: Assignment, Question, Learning Standard, Category, Grading statuses
 *
 * @param status - Status value (case-insensitive). Use StatusValue type for type safety.
 * @param includeBorder - Whether to include border color classes (default: false)
 * @returns Tailwind classes for badge styling
 *
 * @example
 * // ✅ Correct - Use with StatusBadge component
 * <StatusBadge status="published" />
 *
 * @example
 * // ✅ Also correct - Use utility for edge cases
 * const classes = getStatusBadgeClass('pending', true)
 *
 * @example
 * // ❌ Wrong - Don't hardcode status badge styles
 * <Badge className="bg-emerald-100 text-emerald-700">Published</Badge>
 */
export function getStatusBadgeClass(
  status?: string | null,
  includeBorder = false,
): string {
  if (!status) {
    return includeBorder
      ? 'bg-muted text-muted-foreground border-gray-300'
      : 'bg-muted text-muted-foreground'
  }

  const normalizedStatus = status.toLowerCase()

  switch (normalizedStatus) {
    // Success/Active states
    case 'published':
    case 'publish':
    case 'approved':
    case 'active':
    case 'done': // Grading completed successfully
    case 'present':
      return includeBorder
        ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
        : 'bg-emerald-100 text-emerald-700'

    // Graded status - custom colors
    case 'graded':
      return includeBorder
        ? 'bg-[#ECFDF3] text-[#067647] border-[#ABEFC6]'
        : 'bg-[#ECFDF3] text-[#067647]'

    // AI Grading status - custom colors
    case 'ai_grading':
      return includeBorder
        ? 'bg-[#FFFAEB] text-[#B54708] border-[#FEDF89]'
        : 'bg-[#FFFAEB] text-[#B54708]'

    // AI Graded status - custom colors
    case 'ai_graded':
      return includeBorder
        ? 'bg-[#F0F9FF] text-[#026AA2] border-[#B9E6FE]'
        : 'bg-[#F0F9FF] text-[#026AA2]'

    // Warning/Pending states
    case 'under_review':
    case 'inputed':
    case 'pending_leave':
    case 'attendance_unmarked':
    case 'late':
    case 'half_day':
      return includeBorder
        ? 'bg-amber-100 text-amber-700 border-amber-300'
        : 'bg-amber-100 text-amber-700'

    // Pending status - custom colors
    case 'pending': // Waiting for action
      return includeBorder
        ? 'bg-[#FAFAFA] text-[#414651] border-[#E9EAEB]'
        : 'bg-[#FAFAFA] text-[#414651]'

    // Review status - unassigned submission
    case 'review': // Unassigned submission
    case 'excused':
      return includeBorder
        ? 'bg-[#FEE4E2] text-[#F97066] border-[#FECDCA]'
        : 'bg-[#FEE4E2] text-[#F97066]'

    // Processing/In-progress states
    case 'processing':
      return includeBorder
        ? 'bg-blue-100 text-blue-700 border-blue-300'
        : 'bg-blue-100 text-blue-700'

    // Destructive/Error states
    case 'rejected':
    case 'error': // Processing failed
    case 'absent':
      return includeBorder
        ? 'bg-red-100 text-red-700 border-red-300'
        : 'bg-red-100 text-red-700'

    // AI Error status - custom colors
    case 'ai_error':
      return includeBorder
        ? 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]'
        : 'bg-[#FEF3F2] text-[#B42318]'

    // Neutral/Inactive states
    case 'closed':
    case 'archived':
    case 'inactive':
    case 'attendance_leave':
      return includeBorder
        ? 'bg-muted text-muted-foreground border-gray-300'
        : 'bg-muted text-muted-foreground'

    // Draft - standardized to gray/neutral
    case 'draft':
    default:
      return includeBorder
        ? 'bg-gray-100 text-gray-700 border-gray-300'
        : 'bg-gray-100 text-gray-700'
  }
}
