export type SearchAcl = {
  fondIds?: string[];
  projectCodes?: string[];
  assigneeIds?: string[];
};

export type SearchDocument = {
  entityType: string;
  entityId: string;
  title: string;
  content: string;
  fondId?: string | null;
  projectCode?: string | null;
  dossierStatus?: string | null;
  archiveSubmissionId?: string | null;
  isIndexed?: boolean;
  indexedAt?: string;
  acl?: SearchAcl;
  metadata?: Record<string, unknown>;
};

export type SearchFilter = {
  entityTypes?: string[];
  fondIds?: string[];
  dossierStatus?: string;
  terms?: Array<{ field: string; value: string }>;
};

export type SearchRequest = {
  q: string;
  filters?: SearchFilter;
  from?: number;
  size?: number;
};

export type SearchHit = {
  entityType: string;
  entityId: string;
  title: string;
  snippet: string;
  score: number;
  fondId?: string | null;
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
