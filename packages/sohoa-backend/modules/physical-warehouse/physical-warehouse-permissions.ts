import { eq } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { physicalWarehouseItems } from "../../db/schemas/physical-warehouse-item.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";

/** Legacy — mapped to item.read in role migration. */
const LEGACY_PHYSICAL_WAREHOUSE_ITEM_MANAGE = "physical-warehouse.item.manage";

export const PHYSICAL_WAREHOUSE_LOCATION_MANAGE_PERMISSIONS = [
    Permission.PHYSICAL_WAREHOUSE_LOCATION_MANAGE,
] as const;

export const PHYSICAL_WAREHOUSE_WAREHOUSE_MANAGE_PERMISSIONS = [
    Permission.PHYSICAL_WAREHOUSE_WAREHOUSE_MANAGE,
] as const;

export const PHYSICAL_WAREHOUSE_CONTENTS_PERMISSIONS = [
    Permission.PHYSICAL_WAREHOUSE_ITEM_READ,
    LEGACY_PHYSICAL_WAREHOUSE_ITEM_MANAGE,
] as const;

function isLocationItem(item: { parentId: string | null }): boolean {
    return item.parentId == null;
}

async function getParentItem(parentId: string) {
    const [parent] = await db
        .select({
            id: physicalWarehouseItems.id,
            parentId: physicalWarehouseItems.parentId,
        })
        .from(physicalWarehouseItems)
        .where(eq(physicalWarehouseItems.id, parentId))
        .limit(1);

    if (!parent) {
        throw httpError.notFound("Không tìm thấy mục kho cha");
    }
    return parent;
}

function isWarehouseUnderLocation(
    parent: { parentId: string | null },
): boolean {
    return isLocationItem(parent);
}

export function hasPhysicalWarehouseLocationManage(profile: UserWithRoles): boolean {
    return authHelper.hasPermissionAny(
        profile,
        PHYSICAL_WAREHOUSE_LOCATION_MANAGE_PERMISSIONS,
    );
}

export function hasPhysicalWarehouseWarehouseManage(profile: UserWithRoles): boolean {
    return authHelper.hasPermissionAny(
        profile,
        PHYSICAL_WAREHOUSE_WAREHOUSE_MANAGE_PERMISSIONS,
    );
}

export function hasPhysicalWarehouseContentsManage(profile: UserWithRoles): boolean {
    return authHelper.hasPermissionAny(
        profile,
        PHYSICAL_WAREHOUSE_CONTENTS_PERMISSIONS,
    );
}

export function assertPhysicalWarehouseLocationManage(profile: UserWithRoles) {
    if (!hasPhysicalWarehouseLocationManage(profile)) {
        throw httpError.forbidden("Bạn không có quyền quản lý địa điểm kho vật lý");
    }
}

export function assertPhysicalWarehouseWarehouseManage(profile: UserWithRoles) {
    if (!hasPhysicalWarehouseWarehouseManage(profile)) {
        throw httpError.forbidden("Bạn không có quyền quản lý kho trong địa điểm");
    }
}

export function assertPhysicalWarehouseContentsManage(profile: UserWithRoles) {
    if (!hasPhysicalWarehouseContentsManage(profile)) {
        throw httpError.forbidden("Bạn không có quyền quản lý cấu trúc bên trong kho vật lý");
    }
}

export function assertPhysicalWarehouseImageUpload(profile: UserWithRoles) {
    if (
        hasPhysicalWarehouseLocationManage(profile) ||
        hasPhysicalWarehouseWarehouseManage(profile) ||
        hasPhysicalWarehouseContentsManage(profile)
    ) {
        return;
    }
    throw httpError.forbidden("Bạn không có quyền tải ảnh kho vật lý");
}

export async function assertPhysicalWarehouseManageForItem(
    profile: UserWithRoles,
    item: { parentId: string | null },
) {
    if (isLocationItem(item)) {
        assertPhysicalWarehouseLocationManage(profile);
        return;
    }

    const parent = await getParentItem(item.parentId!);
    if (isWarehouseUnderLocation(parent)) {
        if (!hasPhysicalWarehouseWarehouseManage(profile)) {
            throw httpError.forbidden("Bạn không có quyền quản lý kho trong địa điểm");
        }
        return;
    }

    assertPhysicalWarehouseContentsManage(profile);
}

export async function assertPhysicalWarehouseManageForCreate(
    profile: UserWithRoles,
    input: { parentId?: string | null },
) {
    if (input.parentId == null) {
        assertPhysicalWarehouseLocationManage(profile);
        return;
    }

    const parent = await getParentItem(input.parentId);
    if (isWarehouseUnderLocation(parent)) {
        if (!hasPhysicalWarehouseWarehouseManage(profile)) {
            throw httpError.forbidden("Bạn không có quyền quản lý kho trong địa điểm");
        }
        return;
    }

    assertPhysicalWarehouseContentsManage(profile);
}
