import {
    ARCHIVE_BORROW_ANNOTATION_KIND_VALUES,
    ARCHIVE_BORROW_DIP_LAYOUT_VALUES,
    ARCHIVE_BORROW_DIP_STATUS_VALUES,
    ARCHIVE_BORROW_ITEM_KIND_VALUES,
    ARCHIVE_BORROW_MEDIUM_VALUES,
    ARCHIVE_BORROW_STATUS_VALUES,
} from "./archive-borrow-constants.ts";
import { schema } from "./schema-helper.ts";

export const archiveBorrowMediumEnum = schema.enum(
    "archive_borrow_medium",
    ARCHIVE_BORROW_MEDIUM_VALUES,
);

export const archiveBorrowStatusEnum = schema.enum(
    "archive_borrow_status",
    ARCHIVE_BORROW_STATUS_VALUES,
);

export const archiveBorrowItemKindEnum = schema.enum(
    "archive_borrow_item_kind",
    ARCHIVE_BORROW_ITEM_KIND_VALUES,
);

export const archiveBorrowDipStatusEnum = schema.enum(
    "archive_borrow_dip_status",
    ARCHIVE_BORROW_DIP_STATUS_VALUES,
);

export const archiveBorrowDipLayoutEnum = schema.enum(
    "archive_borrow_dip_layout",
    ARCHIVE_BORROW_DIP_LAYOUT_VALUES,
);

export const archiveBorrowAnnotationKindEnum = schema.enum(
    "archive_borrow_annotation_kind",
    ARCHIVE_BORROW_ANNOTATION_KIND_VALUES,
);
