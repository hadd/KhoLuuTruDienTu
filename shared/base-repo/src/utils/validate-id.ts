export function validateId<ID extends string | number>(id: ID): void {
    if (typeof id === "string") {
        if (id.trim() === "") throw new Error("Invalid ID");
        const num = Number(id);
        if (!Number.isNaN(num) && (num <= 0 || !Number.isFinite(num))) throw new Error("Invalid ID");
    } else if (typeof id === "number") {
        if (!Number.isFinite(id) || Number.isNaN(id) || id <= 0) throw new Error("Invalid ID");
    }
}
