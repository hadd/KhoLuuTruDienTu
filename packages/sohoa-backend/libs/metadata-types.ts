export interface MetadataField {
    name: string;
    display: string;
    type: string;
    value: string | null;
    page: number | null;
    bbox: number[] | null;
}

export interface MetadataSourceDocument {
    file_name: string | null;
    file_path: string | null;
}

export interface MetadataGroup {
    group_code: string;
    group_name: string;
    source_document: MetadataSourceDocument;
    fields: MetadataField[];
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
