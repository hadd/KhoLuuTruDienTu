import {
    DISPOSAL_COUNCIL_MEMBER_HISTORY_ACTION_VALUES,
    DISPOSAL_COUNCIL_MEMBER_POSITION_ROLE_VALUES,
    DISPOSAL_COUNCIL_MEMBER_REPRESENTATION_TYPE_VALUES,
    DISPOSAL_COUNCIL_REVIEW_RESULT_VALUES,
    DISPOSAL_COUNCIL_EVALUATION_DECISION_VALUES,
    DISPOSAL_PROPOSAL_CATALOG_STATUS_VALUES,
    DISPOSAL_PROPOSAL_ITEM_SOURCE_VALUES,
    DISPOSAL_APPRAISAL_DOCUMENT_TYPE_VALUES,
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

export const disposalCouncilMemberPositionRoleEnum = schema.enum(
    "disposal_council_member_position_role",
    DISPOSAL_COUNCIL_MEMBER_POSITION_ROLE_VALUES,
);

export const disposalCouncilMemberRepresentationTypeEnum = schema.enum(
    "disposal_council_member_representation_type",
    DISPOSAL_COUNCIL_MEMBER_REPRESENTATION_TYPE_VALUES,
);

export const disposalCouncilMemberHistoryActionEnum = schema.enum(
    "disposal_council_member_history_action",
    DISPOSAL_COUNCIL_MEMBER_HISTORY_ACTION_VALUES,
);

export const disposalCouncilReviewResultEnum = schema.enum(
    "disposal_council_review_result",
    DISPOSAL_COUNCIL_REVIEW_RESULT_VALUES,
);

export const disposalCouncilEvaluationDecisionEnum = schema.enum(
    "disposal_council_evaluation_decision",
    DISPOSAL_COUNCIL_EVALUATION_DECISION_VALUES,
);

export const disposalAppraisalDocumentTypeEnum = schema.enum(
    "disposal_appraisal_document_type",
    DISPOSAL_APPRAISAL_DOCUMENT_TYPE_VALUES,
);
