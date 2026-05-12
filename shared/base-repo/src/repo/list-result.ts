import type { PaginatedPageInfo } from "./types.ts";

export class ListResult<T> {
    readonly items: T[];

    constructor(
        items: T[],
        private readonly _meta: PaginatedPageInfo,
    ) {
        this.items = items;
    }

    pageInfo(): PaginatedPageInfo {
        return { ...this._meta };
    }

    get page(): number {
        return this._meta.page;
    }

    get totalPages(): number {
        return this._meta.totalPages;
    }

    get limit(): number {
        return this._meta.limit;
    }

    get total(): number {
        return this._meta.total;
    }

    get hasNextPage(): boolean {
        return this._meta.hasNextPage;
    }

    get hasPreviousPage(): boolean {
        return this._meta.hasPreviousPage;
    }

    toJSON(): { items: T[] } {
        return { items: this.items };
    }
}
