import type { SearchOcrField } from "@shared/search-engine";
import type { DossierMetadata } from "./metadata-types.ts";

/** Flatten nested metadata_groups into a single nested-searchable fields array. */
export function flattenOcrFields(metadata: DossierMetadata): SearchOcrField[] {
  const fields: SearchOcrField[] = [];

  for (const group of metadata.metadata_groups) {
    for (const field of group.fields) {
      const value = field.value?.trim();
      if (!value) continue;

      fields.push({
        group_code: group.group_code,
        group_name: group.group_name,
        file_name: group.source_document?.file_name ?? null,
        file_path: group.source_document?.file_path ?? null,
        name: field.name,
        display: field.display,
        value,
        page: field.page,
        bbox: field.bbox,
      });
    }
  }

  return fields;
}

/** Join OCR field values for legacy flat-text consumers. */
export function extractOcrText(metadata: DossierMetadata): string {
  return flattenOcrFields(metadata)
    .map((field) => field.value)
    .join("\n");
}
