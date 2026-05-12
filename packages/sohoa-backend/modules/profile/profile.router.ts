import { Elysia } from "elysia";

export function createProfileRouter(_basePath: string = "/users") {
    return new Elysia({
        name: "profile-router",
        prefix: _basePath,
    });
}
