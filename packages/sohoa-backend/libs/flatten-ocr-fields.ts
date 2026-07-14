import type { SearchOcrField } from "@shared/search-engine";
import type { DossierMetadata } from "./metadata-types.ts";

/**
 * Gộp mọi group/file trong hồ sơ thành một mảng `fields` phẳng
 * (cùng shape với script nạp ES: file + group + field trên mỗi phần tử).
 */
export function flattenOcrFields(metadata: DossierMetadata): SearchOcrField[] {
  const fields: SearchOcrField[] = [];

  for (const group of metadata.metadata_groups) {
    const fileName = group.source_document?.file_name ?? null;
    const filePath = group.source_document?.file_path ?? null;

    for (const field of group.fields) {
      const value = field.value?.trim();
      if (!value) continue;

      fields.push({
        file_name: fileName,
        file_path: filePath,
        group_code: group.group_code,
        group_name: group.group_name,
        name: field.name,
        display: field.display,
        type: field.type || "string",
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
