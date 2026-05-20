---
trigger: model_decision
description: Teacher workflow analytics (PostHog) – use teacher-events API only, update catalog when adding events
globs:
---
# Analytics (Teacher workflow tracking)

When adding or changing **teacher workflow** analytics:

## API usage

- **Use only** the teacher tracking API: `track.teacher.*` or `trackTeacher()` from `@/lib/analytics/teacher-events`.
- **Do not** call `posthog.capture` directly from features. All teacher events go through Layer 2 for consistent naming and properties.

## Event naming

- **Prefix**: `teacher_`
- **Format**: snake_case, present tense (e.g. `teacher_question_approve`, `teacher_assignment_create`)
- **Reference**: See `docs/analytics/event-catalog.md` and `src/lib/analytics/teacher-events.ts` for the full list

## When adding a new event

1. Add the event name constant and payload type in `src/lib/analytics/teacher-events.ts`
2. Add a convenience method on `track.teacher` and the entry in `TeacherEventMap`
3. Wire the call at the correct trigger (e.g. mutation `onSuccess`, or when tab/view becomes active)
4. Update `docs/analytics/event-catalog.md` with: what (user action), when (trigger), why (business goal), required/optional properties, and where in code it is fired

This keeps AI and developers aligned with the same taxonomy and documentation.
