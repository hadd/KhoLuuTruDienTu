export interface MetadataField {
    name: string;
    display: string;
    type: string;
    value: string | null;
    page: number | null;
    bbox: number[] | null;
    /** TT05 OCR shape — normalized to `bbox` when parsing. */
    bboxes?: number[][] | null;
}

export interface MetadataSourceDocument {
    file_name: string | null;
    file_path: string | null;
}

export interface MetadataDocumentItem {
    source_document: MetadataSourceDocument;
    fields: MetadataField[];
}

export interface MetadataGroup {
    group_code: string;
    group_name: string;
    source_document: MetadataSourceDocument;
    fields: MetadataField[];
    /** TT05 nested documents under TAI_LIEU_LUU_TRU. */
    documents?: MetadataDocumentItem[];
    /** Alias accepted from some OCR payloads. */
    document?: MetadataDocumentItem[];
}

export interface DossierMetadata {
    ho_so_id?: string | null;
    trang_thai_ho_so?: string | null;
    metadata_groups: MetadataGroup[];
}

export function isDossierMetadata(data: unknown): data is DossierMetadata {
    if (!data || typeof data !== "object") {
        return false;
    }
    const obj = data as Record<string, unknown>;
    return Array.isArray(obj.metadata_groups);
}
