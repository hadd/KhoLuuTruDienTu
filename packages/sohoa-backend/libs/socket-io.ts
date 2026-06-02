import { Server, type Server as SocketServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { env } from "../env.ts";
import { extractSocketToken, verifySocketAccessToken } from "./socket-auth.ts";

export type OcrCompletedRealtimePayload = {
    dossierId: string;
    folderId: string;
    folderPath: string;
    status: string;
    fromStatus: string;
    ocrMetadataKey: string;
};

let io: SocketServer | null = null;

function socketCorsOrigin() {
    return env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : true;
}

export function initSocketIo(httpServer: HttpServer): SocketServer {
    if (io) {
        return io;
    }

    io = new Server(httpServer, {
        path: env.SOCKET_PATH,
        cors: {
            origin: socketCorsOrigin(),
            credentials: true,
        },
    });

    io.use(async (socket, next) => {
        try {
            const token = extractSocketToken(
                socket.handshake.auth,
                socket.handshake.headers.authorization,
            );
            if (!token) {
                return next(new Error("Authentication required"));
            }
            const user = await verifySocketAccessToken(token);
            socket.data.userId = user.userId;
            next();
        } catch {
            next(new Error("Authentication required"));
        }
    });

    io.on("connection", (socket) => {
        socket.on("join:dossier", (dossierId: unknown) => {
            if (typeof dossierId === "string" && dossierId.trim()) {
                socket.join(roomDossier(dossierId.trim()));
            }
        });

        socket.on("leave:dossier", (dossierId: unknown) => {
            if (typeof dossierId === "string" && dossierId.trim()) {
                socket.leave(roomDossier(dossierId.trim()));
            }
        });

        socket.on("join:folder", (folderId: unknown) => {
            if (typeof folderId === "string" && folderId.trim()) {
                socket.join(roomFolder(folderId.trim()));
            }
        });

        socket.on("leave:folder", (folderId: unknown) => {
            if (typeof folderId === "string" && folderId.trim()) {
                socket.leave(roomFolder(folderId.trim()));
            }
        });
    });

    console.info(`[Socket.IO] Listening on path ${env.SOCKET_PATH}`);
    return io;
}

function roomDossier(dossierId: string) {
    return `dossier:${dossierId}`;
}

function roomFolder(folderId: string) {
    return `folder:${folderId}`;
}

/** Broadcast after OCR metadata is persisted to the database. */
export function emitOcrCompleted(payload: OcrCompletedRealtimePayload): void {
    if (!io) {
        return;
    }

    const message = {
        event: "ocr:completed" as const,
        at: new Date().toISOString(),
        ...payload,
    };

    io.to(roomDossier(payload.dossierId)).emit("ocr:completed", message);
    io.to(roomFolder(payload.folderId)).emit("ocr:completed", message);
}

export function getSocketIo(): SocketServer | null {
    return io;
}
