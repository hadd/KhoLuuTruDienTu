import {
    ARCHIVE_FIELD_TYPE_VALUES,
    ARCHIVE_REFERENCE_SOURCE_VALUES,
    ARCHIVE_SUBMISSION_STATUS_VALUES,
} from "./archive-constants.ts";
import { schema } from "./schema-helper.ts";

export const archiveFieldTypeEnum = schema.enum("archive_field_type", ARCHIVE_FIELD_TYPE_VALUES);

export const archiveReferenceSourceEnum = schema.enum(
    "archive_reference_source",
    ARCHIVE_REFERENCE_SOURCE_VALUES,
);

export const archiveSubmissionStatusEnum = schema.enum(
    "archive_submission_status",
    ARCHIVE_SUBMISSION_STATUS_VALUES,
);
