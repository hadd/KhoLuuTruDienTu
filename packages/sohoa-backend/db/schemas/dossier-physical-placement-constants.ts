import { t } from "elysia";

export const DossierPhysicalPlacementStatus = {
    ACTIVE: "ACTIVE",
    MOVED: "MOVED",
    REMOVED: "REMOVED",
} as const;

export type DossierPhysicalPlacementStatus =
    (typeof DossierPhysicalPlacementStatus)[keyof typeof DossierPhysicalPlacementStatus];

export const DOSSIER_PHYSICAL_PLACEMENT_STATUS_VALUES = Object.values(
    DossierPhysicalPlacementStatus,
) as [
    DossierPhysicalPlacementStatus,
    DossierPhysicalPlacementStatus,
    DossierPhysicalPlacementStatus,
];

export const dossierPhysicalPlacementStatusSchema = t.Enum(
    DossierPhysicalPlacementStatus,
);
