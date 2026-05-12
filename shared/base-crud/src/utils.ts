/**
 * Utility functions for base CRUD service
 */

/**
 * Convert kebab-case or snake_case to camelCase
 */
export function toCamelCase(s: string): string {
    if (s.length === 0) return s;
    const hasLeadingSeparator = /^[_-]/.test(s);
    const trimmed = s.replace(/^[_-]+/, "");
    if (trimmed.length === 0) return s;
    const firstChar = hasLeadingSeparator ? trimmed[0].toUpperCase() : trimmed[0].toLowerCase();
    const rest = trimmed.slice(1).replace(/[_-](\w)/g, (_: unknown, c: string) => c.toUpperCase());
    return firstChar + rest;
}

/**
 * Attempt to extract the table name from a Drizzle table object
 */
export function getTableName(table: unknown): string | undefined {
    const tbl: any = table as any;
    return (
        tbl?.[Symbol.for("drizzle:Name")] ||
        tbl?.tableName ||
        tbl?.dbName ||
        tbl?._?.name ||
        tbl?.name ||
        undefined
    );
}

/**
 * Infer the query key for relational queries from the table name
 */
export function inferRelationalQueryKey(
    table: unknown,
    availableQueryKeys: string[],
): string | undefined {
    if (!availableQueryKeys.length) return undefined;

    const rawName = getTableName(table);
    if (!rawName || typeof rawName !== "string") return undefined;

    const candidates = [
        rawName,
        toCamelCase(rawName),
        rawName.replace(/s$/, ""),
        toCamelCase(rawName.replace(/s$/, "")),
    ];

    for (const candidate of candidates) {
        if (availableQueryKeys.includes(candidate)) {
            return candidate;
        }
    }

    const lowerCaseMap = new Map(availableQueryKeys.map((k) => [k.toLowerCase(), k] as const));
    for (const candidate of candidates) {
        const match = lowerCaseMap.get(candidate.toLowerCase());
        if (match) return match;
    }

    return undefined;
}

/**
 * Validate an ID parameter
 */
export function validateId<ID extends string | number>(id: ID): void {
    if (typeof id === "string") {
        if (id.trim() === "") {
            throw new Error("Invalid ID");
        }
        const num = Number(id);
        if (!Number.isNaN(num) && (num <= 0 || !Number.isFinite(num))) {
            throw new Error("Invalid ID");
        }
    } else if (typeof id === "number") {
        if (!Number.isFinite(id) || Number.isNaN(id) || id <= 0) {
            throw new Error("Invalid ID");
        }
    }
}

/**
 * Infer relations from Drizzle schema and table structure
 * Attempts to discover relations by:
 * 1. Checking foreign key columns on the main table (e.g., authorId -> author relation)
 * 2. Checking if db.query API is available (indicates relations are in schema)
 * 
 * Note: This is a best-effort inference. Manual relationTables and relationForeignKeys
 * should be provided for complex cases or when inference fails.
 */
export function inferRelationsFromSchema(
    db: unknown,
    table: unknown,
): { relationTables: Record<string, any>; relationForeignKeys: Record<string, any> } {
    const relationTables: Record<string, any> = {};
    const relationForeignKeys: Record<string, any> = {};

    const relationalQueryApi = (db as any)?.query;
    if (!relationalQueryApi) {
        return { relationTables, relationForeignKeys };
    }

    const availableQueryKeys = Object.keys(relationalQueryApi);
    const resolvedQueryKey = inferRelationalQueryKey(table, availableQueryKeys);

    if (!resolvedQueryKey) {
        return { relationTables, relationForeignKeys };
    }

    const queryApi = relationalQueryApi[resolvedQueryKey];
    if (!queryApi || !queryApi.findMany) {
        return { relationTables, relationForeignKeys };
    }

    const tableObj = table as any;

    for (const key in tableObj) {
        if (key === 'id' || key === 'createdAt' || key === 'updatedAt' || key === 'deletedAt') {
            continue;
        }

        const column = tableObj[key];
        if (!column || typeof column !== 'object') {
            continue;
        }

        const columnName = column.name || key;

        if (columnName.endsWith('Id') && columnName !== 'id') {
            const relationName = columnName.slice(0, -2);
            const camelRelationName = toCamelCase(relationName);

            try {
                const referencedTable = (column as any).reference?.()?.();
                if (referencedTable) {
                    relationTables[camelRelationName] = referencedTable;
                    relationForeignKeys[camelRelationName] = column;
                }
            } catch {
                const fkCol = column;
                if (fkCol && typeof fkCol === 'object') {
                    relationForeignKeys[camelRelationName] = fkCol;
                }
            }
        }
    }

    return { relationTables, relationForeignKeys };
}

/**
 * Sanitize the 'with' object to prevent reverse relation loading
 * Preserves `true` values and strips empty objects `{}` from the result.
 * Removes `false` values.
 */
export function sanitizeWithObject(withObj: Record<string, unknown>): Record<string, unknown> {
    if (!withObj || typeof withObj !== 'object') {
        return {};
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(withObj)) {
        if (value === true) {
            sanitized[key] = true;
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            const nested = value as Record<string, unknown>;
            const sanitizedNested = sanitizeWithObject(nested);
            if (Object.keys(sanitizedNested).length > 0) {
                sanitized[key] = sanitizedNested;
            }
        } else if (value !== false) {
            sanitized[key] = value;
        }
    }

    return sanitized;
}
/**
 * Detect array columns from a Drizzle table schema
 * Checks for columns that have been defined with .array() method
 * 
 * Drizzle array columns can be detected by:
 * 1. Checking the column's dataType property
 * 2. Checking the SQL type representation
 * 3. Inspecting internal Drizzle column structure
 * 4. Checking column's internal _ property structure
 */
export function detectArrayColumns(
    table: any,
    searchableFields: string[],
): Set<string> {
    const arrayFields = new Set<string>();

    if (!table || !searchableFields.length) {
        return arrayFields;
    }

    for (const fieldName of searchableFields) {
        const column = (table as any)[fieldName];
        if (!column) continue;

        const columnObj = column as any;
        let isArray = false;

        // Method 1: Check dataType directly
        if (columnObj?.dataType === 'array' || columnObj?.columnType === 'array') {
            isArray = true;
        }

        // Method 2: Check SQL type (array columns have [] in their SQL type)
        if (!isArray) {
            const sqlType = columnObj?.sqlType || columnObj?.dataType || columnObj?._?.dataType || '';
            if (typeof sqlType === 'string' && sqlType.includes('[]')) {
                isArray = true;
            }
        }

        // Method 3: Check column name property (sometimes contains type info)
        if (!isArray && columnObj?.name) {
            const nameStr = String(columnObj.name);
            if (nameStr.includes('[]') || nameStr.includes('array')) {
                isArray = true;
            }
        }

        // Method 4: Check internal column structure (nested column object)
        if (!isArray && columnObj?.column) {
            const innerCol = columnObj.column;
            if (innerCol?.dataType === 'array' || innerCol?.columnType === 'array') {
                isArray = true;
            }
            const innerSqlType = innerCol?.sqlType || innerCol?.dataType || innerCol?._?.dataType || '';
            if (typeof innerSqlType === 'string' && innerSqlType.includes('[]')) {
                isArray = true;
            }
        }

        // Method 5: Check internal _ property (Drizzle stores type info here)
        if (!isArray && columnObj?._) {
            const internal = columnObj._;
            if (internal?.dataType === 'array' ||
                (typeof internal?.dataType === 'string' && internal.dataType.includes('[]'))) {
                isArray = true;
            }
            // Check if it's a PgArray type
            if (internal?.pgType === 'array' || internal?.type === 'array') {
                isArray = true;
            }
        }

        // Method 6: Try to access the column's getSQL method and check the result
        if (!isArray && typeof columnObj?.getSQL === 'function') {
            try {
                const sql = columnObj.getSQL();
                if (sql && typeof sql === 'object' && 'sql' in sql) {
                    const sqlStr = String((sql as any).sql || '');
                    if (sqlStr.includes('[]') || sqlStr.toLowerCase().includes('array')) {
                        isArray = true;
                    }
                }
            } catch {
                // Ignore errors from getSQL
            }
        }

        if (isArray) {
            arrayFields.add(fieldName);
        }
    }

    return arrayFields;
}


export function mergeRelationOptions(
    defaults: Record<string, unknown> | undefined,
    overrides: any
): Record<string, unknown> {
    const effectiveWith = { ...(defaults ?? {}) };

    if (overrides === undefined || overrides === null || overrides === true) {
        return effectiveWith;
    }

    if (overrides === false) {
        return {};
    }

    if (typeof overrides === 'object') {
        for (const [key, value] of Object.entries(overrides)) {
            // Case 1: User tắt relation
            if (value === false) {
                delete effectiveWith[key];
                continue;
            }

            const baseValue = effectiveWith[key];
            const isBaseObj = baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue);

            // --- FIX START: Xử lý Empty Object {} ---
            // Nếu user truyền {}, ta coi như là true (enable relation) để tránh bị sanitize mất.
            // Tuy nhiên, nếu base đã có config (isBaseObj), ta giữ nguyên base (coi như merge {} vào base).
            if (value && typeof value === 'object' && Object.keys(value).length === 0) {
                if (!isBaseObj) {
                    effectiveWith[key] = true;
                }
                // Nếu isBaseObj = true, ta không làm gì (giữ nguyên baseValue), vì merge {} vào object có data thì vẫn là object đó.
                continue;
            }
            // --- FIX END ---

            // Case 2: Cả Base và Override đều là Object (có data) -> Merge properties
            const isOverrideObj = value && typeof value === 'object' && !Array.isArray(value);

            if (isBaseObj && isOverrideObj) {
                const baseObj = baseValue as Record<string, unknown>;
                const overrideObj = value as Record<string, unknown>;

                const merged: Record<string, unknown> = {
                    ...baseObj,
                    ...overrideObj,
                };

                // Deep merge cho 'with'
                if ('with' in baseObj && 'with' in overrideObj) {
                    merged.with = mergeRelationOptions(
                        baseObj.with as Record<string, unknown>,
                        overrideObj.with
                    );
                }

                effectiveWith[key] = merged;
            }
            // Case 3: Override là object (có data) nhưng Base không phải object -> Ghi đè
            else if (isOverrideObj) {
                effectiveWith[key] = value;
            }
            // Case 4: Các trường hợp primitive khác
            else {
                effectiveWith[key] = value;
            }
        }
    }    return effectiveWith;
}
