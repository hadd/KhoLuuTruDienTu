import { useMatches } from '@tanstack/react-router'

/**
 * Hook to extract active course and class IDs from the current route matches.
 * This is useful for determining which course/class context the user is currently viewing,
 * which can be used to highlight active menu items in the sidebar.
 *
 * Extracts IDs from:
 * 1. Route params (e.g., /course/$courseId)
 * 2. Loader data (e.g., assignment.courseId, assignment.classroomId)
 * 3. Breadcrumb parents (e.g., from assignment print route breadcrumbs)
 *
 * @returns Object with activeCourseId and activeClassId (both can be null)
 */
export function useActiveContext(): {
  activeCourseId: string | null
  activeClassId: string | null
} {
  const matches = useMatches()

  let activeCourseId: string | null = null
  let activeClassId: string | null = null

  // Helper to extract ID from a path like "/course/123" or "/school-management/classes/456"
  const extractIdFromPath = (path: string, pattern: RegExp): string | null => {
    const match = path.match(pattern)
    return match ? match[1] : null
  }

  // Iterate through matches to find course and class IDs
  for (const match of matches) {
    // 1. Extract from route params
    // Extract courseId from /course/$courseId routes
    if (match.routeId === '/course/$courseId' && match.params?.courseId) {
      activeCourseId = match.params.courseId
    }

    // Extract classId from /school-management/classes/$classId routes
    if (
      match.routeId === '/school-management/classes/$classId' &&
      match.params?.classId
    ) {
      activeClassId = match.params.classId
    }

    // Also check for courseId in nested routes (e.g., lessons, assignments)
    if (match.params?.courseId && !activeCourseId) {
      activeCourseId = match.params.courseId as string
    }

    // Also check for classId in nested routes
    if (match.params?.classId && !activeClassId) {
      if (
        match.routeId?.includes('/classes/') ||
        match.pathname?.includes('/classes/')
      ) {
        activeClassId = match.params.classId as string
      }
    }

    // 2. Extract from loader data (e.g., assignment routes)
    if (match.loaderData) {
      const loaderData = match.loaderData as Record<string, unknown>

      // Check for assignment data
      if (loaderData.assignment) {
        const assignment = loaderData.assignment as {
          courseId?: string | null
          classroomId?: string | null
          course?: { id: string } | null
          classroom?: { id: string } | null
        }

        // Prefer nested objects, then direct IDs
        if (assignment.course?.id && !activeCourseId) {
          activeCourseId = assignment.course.id
        } else if (assignment.courseId && !activeCourseId) {
          activeCourseId = assignment.courseId
        }

        if (assignment.classroom?.id && !activeClassId) {
          activeClassId = assignment.classroom.id
        } else if (assignment.classroomId && !activeClassId) {
          activeClassId = assignment.classroomId
        }
      }

      // Check for lesson data (lessons have course info)
      if (loaderData.lesson) {
        const lesson = loaderData.lesson as {
          courseId?: string
          course?: { id: string }
        }

        if (lesson.course?.id && !activeCourseId) {
          activeCourseId = lesson.course.id
        } else if (lesson.courseId && !activeCourseId) {
          activeCourseId = lesson.courseId
        }
      }
    }

    // 3. Extract from breadcrumb parents (e.g., assignment print route)
    const staticData = match.staticData as { crumb?: unknown } | undefined
    if (staticData?.crumb) {
      let crumbResult: unknown
      if (typeof staticData.crumb === 'function') {
        crumbResult = (staticData.crumb as (loaderData: unknown) => unknown)(
          match.loaderData,
        )
      } else {
        crumbResult = staticData.crumb
      }

      if (
        typeof crumbResult === 'object' &&
        crumbResult !== null &&
        'parents' in crumbResult
      ) {
        const parents = (crumbResult as { parents?: Array<{ to: string }> })
          .parents

        if (Array.isArray(parents)) {
          for (const parent of parents) {
            // Extract course ID from breadcrumb parent path like "/course/123"
            if (parent.to.startsWith('/course/') && !activeCourseId) {
              const courseId = extractIdFromPath(
                parent.to,
                /^\/course\/([^/]+)/,
              )
              if (courseId) {
                activeCourseId = courseId
              }
            }

            // Extract class ID from breadcrumb parent path like "/school-management/classes/456"
            if (
              parent.to.startsWith('/school-management/classes/') &&
              !activeClassId
            ) {
              const classId = extractIdFromPath(
                parent.to,
                /^\/school-management\/classes\/([^/]+)/,
              )
              if (classId) {
                activeClassId = classId
              }
            }
          }
        }
      }
    }
  }

  return {
    activeCourseId,
    activeClassId,
  }
}
