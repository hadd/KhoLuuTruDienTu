import { ARCHIVE_STORAGE_STATE_VALUES } from "./archive-storage-state-constants.ts"
import { schema } from "./schema-helper.ts"

export const archiveStorageStateEnum = schema.enum(
  "archive_storage_state",
  ARCHIVE_STORAGE_STATE_VALUES,
)
