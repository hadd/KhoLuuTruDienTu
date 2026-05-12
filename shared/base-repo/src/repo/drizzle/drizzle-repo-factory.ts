import type { IBaseRepository } from "../interface.ts";
import { DrizzleBaseRepository } from "./drizzle-repo.ts";
import type { BaseRepoConfig } from "./drizzle-context.ts";

export type BaseRepo<T> = IBaseRepository<T>;

export function createBaseRepo<TEntity = unknown, TTable = unknown>(
    config: BaseRepoConfig<TTable>,
    customMethods?: Record<string, unknown>,
): BaseRepo<TEntity> {
    const base = new DrizzleBaseRepository<TEntity>(config as BaseRepoConfig) as unknown as BaseRepo<TEntity> &
        Record<string, unknown>;
    if (!customMethods || Object.keys(customMethods).length === 0) return base as BaseRepo<TEntity>;
    Object.assign(base, customMethods);
    return base as BaseRepo<TEntity>;
}
