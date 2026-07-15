export type SearchAcl = {
  fondIds?: string[];
  projectCodes?: string[];
  assigneeIds?: string[];
};

/** Một phần tử trong mảng fields phẳng (sau flatten metadata_groups). */
export type SearchOcrField = {
  file_name: string | null;
  file_path: string | null;
  group_code: string;
  group_name: string;
  name: string;
  display: string;
  type: string;
  value: string;
  page: number | null;
  bbox: number[] | null;
};

export type SearchDocument = {
  entityType: string;
  entityId: string;
  title: string;
  /** Flat text for fond / non-OCR entities. */
  content?: string;
  hoSoId?: string | null;
  trangThaiHoSo?: string | null;
  fields?: SearchOcrField[];
  /** File names attached to the dossier (for metadata search). */
  fileNames?: string[];
  fondId?: string | null;
  fondName?: string | null;
  dossierTypeId?: string | null;
  dossierTypeName?: string | null;
  projectCode?: string | null;
  dossierStatus?: string | null;
  archiveSubmissionId?: string | null;
  /** Completed MAKER assignees (biên tập). */
  editorIds?: string[];
  editorNames?: string[];
  /** Latest MAKER completed_at. */
  editCompletedAt?: string | null;
  /** Approved archive submission reviewed_at. */
  archivedAt?: string | null;
  isIndexed?: boolean;
  indexedAt?: string;
  acl?: SearchAcl;
  metadata?: Record<string, unknown>;
};

export type SearchFilter = {
  entityTypes?: string[];
  fondIds?: string[];
  dossierTypeIds?: string[];
  dossierStatus?: string;
  terms?: Array<{ field: string; value: string }>;
};

export type SearchRequest = {
  q: string;
  groupCode?: string;
  trangThaiHoSo?: string;
  filters?: SearchFilter;
  from?: number;
  size?: number;
};

/** Structured metadata search (AND of provided criteria; no OCR nested query). */
export type MetadataSearchRequest = {
  dossierName?: string;
  documentName?: string;
  fondIds?: string[];
  dossierTypeId?: string;
  editorName?: string;
  editCompletedAtFrom?: string;
  editCompletedAtTo?: string;
  archivedAtFrom?: string;
  archivedAtTo?: string;
  filters?: SearchFilter;
  from?: number;
  size?: number;
};

export type SearchFieldMatch = {
  groupCode: string;
  groupName: string;
  name: string;
  display: string;
  value: string;
  fileName: string | null;
  filePath: string | null;
  page: number | null;
  bbox: number[] | null;
  highlight: string;
};

export type SearchHit = {
  entityType: string;
  entityId: string;
  title: string;
  snippet: string;
  score: number;
  fondId?: string | null;
  fondName?: string | null;
  dossierTypeId?: string | null;
  dossierTypeName?: string | null;
  editorId?: string | null;
  editorName?: string | null;
  editCompletedAt?: string | null;
  archivedAt?: string | null;
  fileNames?: string[];
  hoSoId?: string | null;
  trangThaiHoSo?: string | null;
  matches?: SearchFieldMatch[];
  metadata?: Record<string, unknown>;
};

export type SearchResult = {
  hits: SearchHit[];
  total: number;
  took: number;
};

export type IndexAdapter<T = unknown> = {
  entityType: string;
  toSearchDocument: (entity: T) => Promise<SearchDocument | null>;
};

export type IndexEvent = {
  entityType: string;
  entityId: string;
  action: "index" | "delete";
};
