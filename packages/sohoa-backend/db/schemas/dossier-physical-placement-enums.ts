import { DOSSIER_PHYSICAL_PLACEMENT_STATUS_VALUES } from "./dossier-physical-placement-constants.ts";
import { schema } from "./schema-helper.ts";

export const dossierPhysicalPlacementStatusEnum = schema.enum(
    "dossier_physical_placement_status",
    DOSSIER_PHYSICAL_PLACEMENT_STATUS_VALUES,
);
