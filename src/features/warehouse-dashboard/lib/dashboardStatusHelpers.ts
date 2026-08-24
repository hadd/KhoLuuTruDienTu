import type {
    WarehouseDashboardDossierStatusCountsT,
    WarehouseDashboardDossierStatusT,
} from '@/features/warehouse-dashboard/types'
import type { DossierStatusCategoryT } from '@/features/admin-dashboard/lib/dashboardStatusHelpers'

const DOSSIER_STATUS_CATEGORY: Record<
    WarehouseDashboardDossierStatusT,
    DossierStatusCategoryT
> = {
    NEW: 'editing',
    OCR_PROCESSING: 'editing',
    OCR_FAILED: 'editing',
    READY_FOR_ENTRY: 'editing',
    ENTRY_PROCESSING: 'editing',
    WAITING_CHECKER_1: 'editing',
    CHECKER_1_PROCESSING: 'editing',
    CHECKER_1_REJECTED: 'editing',
    WAITING_CHECKER_2: 'editing',
    CHECKER_2_PROCESSING: 'editing',
    CHECKER_2_REJECTED: 'editing',
    WAITING_CHECKER_3: 'editing',
    CHECKER_3_PROCESSING: 'editing',
    CHECKER_3_REJECTED: 'editing',
    WAITING_CHECKER_4: 'editing',
    CHECKER_4_PROCESSING: 'editing',
    CHECKER_4_REJECTED: 'editing',
    WAITING_CHECKER_5: 'editing',
    CHECKER_5_PROCESSING: 'editing',
    CHECKER_5_REJECTED: 'editing',
    APPROVED: 'waitingApproval',
    PENDING_ARCHIVE: 'waitingApproval',
    ARCHIVE_REJECTED: 'waitingApproval',
    ARCHIVED: 'completed',
    ERROR: 'editing',
}

export function aggregateDossierStatusCategories(
    byStatus: WarehouseDashboardDossierStatusCountsT,
): Record<DossierStatusCategoryT, number> {
    const totals: Record<DossierStatusCategoryT, number> = {
        completed: 0,
        waitingApproval: 0,
        editing: 0,
        overdue: 0,
    }

    for (const [status, count] of Object.entries(byStatus)) {
        if (!count) continue

        const category =
            DOSSIER_STATUS_CATEGORY[status as WarehouseDashboardDossierStatusT] ??
            'editing'
        totals[category] += count
    }

    return totals
}