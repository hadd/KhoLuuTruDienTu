---
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
execution: code
title: Workflow QC/PM Notifications - Plan
created: 2026-07-13
---

# Workflow QC/PM Notifications - Plan

## Goal Capsule

- **Objective:** Extend the existing notification config + inbox system with three workflow milestones so assigned QC and the project PM learn when a dossier is ready for their next action, with deep links matching the current bell UX.
- **Product authority:** Product decisions locked in brainstorm (2026-07-13).
- **Open blockers:** None.

## Product Contract

### Summary

Reuse the current notification configuration and delivery substrate. Add three notification types triggered by dossier workflow transitions. Recipients are specific people already on the dossier/project (not role-wide broadcast). Interaction stays the same: inbox/bell rows carry an `actionUrl` into the dossier.

### Requirements

- **R1.** When all makers finish entry and the dossier enters waiting for QC step 1, notify the **assigned** `CHECKER_1` user (if any).
- **R2.** When a QC step is approved and another QC step remains, notify the **assigned** next-step checker (if any).
- **R3.** When a dossier reaches `APPROVED` — including skip-QC paths — notify the **project manager** of the dossier’s project (if configured).
- **R4.** If the intended QC assignee or project manager is missing, skip sending (no claim-queue broadcast).
- **R5.** Active notification configs still gate delivery by type, channels, and role intersection (same as existing types).
- **R6.** Bell/inbox deep links: QC → checker dossier path; PM → admin dossier path.

### Key Decisions

- **KD1.** Three types: `EDITORS_COMPLETED`, `QC_STEP_COMPLETED`, `DOSSIER_APPROVED` (alongside existing `OCR_COMPLETED` / `DOSSIER_ASSIGNED`).
- **KD2.** QC audience is assignment-scoped only; no notify when waiting for claim without an assignee.
- **KD3.** PM audience is `projects.managerId` for the dossier’s project (via `projectCode` or assigned group), intersected with config roles.
- **KD4.** `APPROVED` always attempts PM notify, including `requiredQcCount === 0`.

### Scope Boundaries

**In scope**
- Backend notification types, content/recipient resolution, schedule helpers, and workflow hooks on maker submit / checker approve.
- Admin can configure the new types with the existing notification-config APIs.

**Out of scope**
- Changing `DOSSIER_ASSIGNED` / `OCR_COMPLETED` behavior.
- Issue-report escalate / PM “thông báo vấn đề” flow.
- Frontend admin UI beyond consuming the expanded type enum from the API.
- Claim-queue broadcast notifications.

### Acceptance Criteria

- **AC1.** With an active `EDITORS_COMPLETED` config for role `qc`, submitting the last maker entry to `WAITING_CHECKER_1` creates an inbox row for the assigned CHECKER_1 only.
- **AC2.** With an active `QC_STEP_COMPLETED` config, approving QC step N when step N+1 remains notifies only the assigned next checker.
- **AC3.** With an active `DOSSIER_APPROVED` config for `project_manager`, reaching `APPROVED` notifies that project’s manager and includes an admin dossier `actionUrl`.
- **AC4.** Missing assignee/manager produces no notification and does not fail the workflow action.
- **AC5.** Existing OCR/assign notification tests and behaviors remain green.
