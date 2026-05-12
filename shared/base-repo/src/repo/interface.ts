import type { SQL } from "drizzle-orm";
import type { ListQuery } from "../parse/types.ts";
import type { ListQueryBuilder } from "./query-builder.ts";
import type { ListResult } from "./list-result.ts";
import type { PaginatedPageInfo } from "./types.ts";

export type Actor = { id: string } | string;
export type Transaction = unknown;
export type GetByIdOptions = {
    with?: Record<string, unknown>;
    where?: SQL;
    includedSoftDelete?: boolean;
    transaction?: Transaction;
};
export type CreateOptions = { with?: Record<string, unknown>; actor?: Actor; transaction?: Transaction };
export type UpdateOptions = {
    with?: Record<string, unknown>;
    where?: SQL;
    actor?: Actor;
    includedSoftDelete?: boolean;
    transaction?: Transaction;
};
export type DeleteOptions = {
    forceDelete?: boolean;
    where?: SQL;
    actor?: Actor;
    includedSoftDelete?: boolean;
    transaction?: Transaction;
};
export type ListOptions = { includedSoftDelete?: boolean; transaction?: Transaction };

export interface IBaseRepository<T> {
    parseQuery(params?: Record<string, unknown>): ListQueryBuilder;
    list(query: ListQuery | ListQueryBuilder, options?: ListOptions): Promise<ListResult<T>>;
    page(query: ListQuery | ListQueryBuilder, options?: ListOptions): Promise<PaginatedPageInfo>;

    findById(id: string | number, options?: GetByIdOptions): Promise<T | null>;
    getOne(id: string | number, options?: GetByIdOptions): Promise<T>;

    create(data: Record<string, unknown>, options?: CreateOptions): Promise<T>;
    update(id: string | number, data: Record<string, unknown>, options?: UpdateOptions): Promise<T>;
    delete(id: string | number, options?: DeleteOptions): Promise<{ id: string | number }>;
}

export type { PaginatedPageInfo } from "./types.ts";
