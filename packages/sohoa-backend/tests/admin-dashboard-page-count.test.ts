import { assertEquals, assert } from "@std/assert";
import { DashboardService } from "../modules/dashboard/dashboard-service.ts";

Deno.test("DashboardService.aggregateEmployeeKpis returns valid page count structure", async () => {
    const kpis = await DashboardService.aggregateEmployeeKpis();
    assert(Array.isArray(kpis));
    for (const item of kpis) {
        assert(!isNaN(item.assignedPagesCount), "assignedPagesCount should not be NaN");
        assert(!isNaN(item.completedPagesCount), "completedPagesCount should not be NaN");
        assert(typeof item.assignedPagesCount === "number");
        assert(typeof item.completedPagesCount === "number");
    }
});

Deno.test("DashboardService.getAdminDashboard runs without SQL error", async () => {
    const res = await DashboardService.getAdminDashboard("month");
    assert(res !== null && typeof res === "object");
    assert(typeof res.systemDossiers.total === "number");
});
