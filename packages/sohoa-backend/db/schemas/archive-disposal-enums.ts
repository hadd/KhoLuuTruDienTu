import {
    DISPOSAL_PROPOSAL_CATALOG_STATUS_VALUES,
    DISPOSAL_PROPOSAL_ITEM_SOURCE_VALUES,
    DUPLICATE_DETECTION_RULE_KEY_VALUES,
} from "./archive-disposal-constants.ts";
import { schema } from "./schema-helper.ts";

export const disposalProposalCatalogStatusEnum = schema.enum(
    "disposal_proposal_catalog_status",
    DISPOSAL_PROPOSAL_CATALOG_STATUS_VALUES,
);

export const disposalProposalItemSourceEnum = schema.enum(
    "disposal_proposal_item_source",
    DISPOSAL_PROPOSAL_ITEM_SOURCE_VALUES,
);

export const duplicateDetectionRuleKeyEnum = schema.enum(
    "duplicate_detection_rule_key",
    DUPLICATE_DETECTION_RULE_KEY_VALUES,
);
