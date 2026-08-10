import type { DossierMetadata } from "../../libs/metadata-types.ts";
import { DISPOSAL_APPENDIX_METADATA_KEYS } from "./disposal-appendix-metadata-keys.ts";

export function findMetadataFieldValue(
    metadata: DossierMetadata | null,
    keys: readonly string[],
): string {
    if (!metadata) return "";
    const normalized = keys.map((k) => k.toUpperCase());
    for (const group of metadata.metadata_groups) {
        for (const field of group.fields) {
            const fieldName = field.name.toUpperCase();
            if (normalized.some((n) => fieldName === n || fieldName.includes(n))) {
                const v = field.value;
                if (v != null && String(v).trim() !== "") return String(v).trim();
            }
        }
    }
    return "";
}

export function extractAppendixRowMetadata(metadata: DossierMetadata | null) {
    return {
        boxNumber: findMetadataFieldValue(metadata, DISPOSAL_APPENDIX_METADATA_KEYS.boxNumber),
        volumeNumber: findMetadataFieldValue(metadata, DISPOSAL_APPENDIX_METADATA_KEYS.volumeNumber),
        archiveNumber: findMetadataFieldValue(
            metadata,
            DISPOSAL_APPENDIX_METADATA_KEYS.archiveUnitOrFileNumber,
        ),
        metadataTitle: findMetadataFieldValue(metadata, DISPOSAL_APPENDIX_METADATA_KEYS.dossierTitle),
    };
}
