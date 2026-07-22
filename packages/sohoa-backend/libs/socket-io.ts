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

export type UserNotificationRealtimePayload = {
    id: string;
    type: string;
    title: string;
    body: string;
    actionUrl: string;
    createdAt: string;
};

let io: SocketServer | null = null;

const allowedOrigins = new Set(env.CORS_ORIGINS);

function isSocketOriginAllowed(origin: string | undefined): boolean {
    if (!origin) {
        return true;
    }
    if (allowedOrigins.size === 0) {
        return true;
    }
    return allowedOrigins.has(origin);
}

function socketHandshakeOrigin(socket: { handshake: { headers: { origin?: string } } }): string {
    return socket.handshake.headers.origin ?? "(no Origin header)";
}

export function initSocketIo(httpServer: HttpServer): SocketServer {
    if (io) {
        return io;
    }

    io = new Server(httpServer, {
        path: env.SOCKET_PATH,
        cors: {
            origin: (origin, callback) => {
                if (isSocketOriginAllowed(origin)) {
                    callback(null, true);
                    return;
                }
                console.warn(`[Socket.IO] CORS rejected origin=${origin ?? "(none)"}`);
                callback(new Error("CORS not allowed"));
            },
            credentials: true,
        },
    });

    io.use(async (socket, next) => {
        const origin = socketHandshakeOrigin(socket);
        if (!isSocketOriginAllowed(socket.handshake.headers.origin)) {
            console.warn(`[Socket.IO] handshake blocked origin=${origin}`);
            return next(new Error("CORS not allowed"));
        }

        try {
            const token = extractSocketToken(
                socket.handshake.auth,
                socket.handshake.headers.authorization,
            );
            if (!token) {
                console.warn(`[Socket.IO] auth missing token origin=${origin}`);
                return next(new Error("Authentication required"));
            }
            const user = await verifySocketAccessToken(token);
            socket.data.userId = user.userId;
            next();
        } catch {
            console.warn(`[Socket.IO] auth failed origin=${origin}`);
            next(new Error("Authentication required"));
        }
    });

    io.on("connection", (socket) => {
        const origin = socketHandshakeOrigin(socket);
        const userId = socket.data.userId as string | undefined;
        console.info(
            `[Socket.IO] client connected id=${socket.id} origin=${origin} userId=${userId}`,
        );

        if (userId) {
            const userRoom = roomUser(userId);
            socket.join(userRoom);
            console.info(`[Socket.IO] auto-join user room=${userRoom} socket=${socket.id}`);
        }

        socket.on("disconnect", (reason) => {
            console.info(`[Socket.IO] client disconnected id=${socket.id} origin=${origin} reason=${reason}`);
        });

        socket.on("join:dossier", (dossierId: unknown) => {
            if (typeof dossierId === "string" && dossierId.trim()) {
                const room = roomDossier(dossierId.trim());
                socket.join(room);
                console.info(`[Socket.IO] join:dossier socket=${socket.id} room=${room} origin=${origin}`);
            }
        });

        socket.on("leave:dossier", (dossierId: unknown) => {
            if (typeof dossierId === "string" && dossierId.trim()) {
                socket.leave(roomDossier(dossierId.trim()));
            }
        });

        socket.on("join:folder", (folderId: unknown) => {
            if (typeof folderId === "string" && folderId.trim()) {
                const room = roomFolder(folderId.trim());
                socket.join(room);
                console.info(`[Socket.IO] join:folder socket=${socket.id} room=${room} origin=${origin}`);
            }
        });

        socket.on("leave:folder", (folderId: unknown) => {
            if (typeof folderId === "string" && folderId.trim()) {
                socket.leave(roomFolder(folderId.trim()));
            }
        });
    });

    console.info(
        `[Socket.IO] path=${env.SOCKET_PATH} allowedOrigins=${[...allowedOrigins].join(", ") || "(all)"}`,
    );
    return io;
}

function roomDossier(dossierId: string) {
    return `dossier:${dossierId}`;
}

function roomFolder(folderId: string) {
    return `folder:${folderId}`;
}

function roomUser(userId: string) {
    return `user:${userId}`;
}

function roomMemberCount(room: string): number {
    if (!io) {
        return 0;
    }
    return io.sockets.adapter.rooms.get(room)?.size ?? 0;
}

/** Broadcast after OCR metadata is persisted to the database. */
export function emitOcrCompleted(payload: OcrCompletedRealtimePayload): void {
    if (!io) {
        console.info("[Socket.IO] ocr:completed skipped (Socket.IO not initialized)");
        return;
    }

    const message = {
        event: "ocr:completed" as const,
        at: new Date().toISOString(),
        ...payload,
    };

    const dossierRoom = roomDossier(payload.dossierId);
    const folderRoom = roomFolder(payload.folderId);
    const dossierListeners = roomMemberCount(dossierRoom);
    const folderListeners = roomMemberCount(folderRoom);

    io.to(dossierRoom).emit("ocr:completed", message);
    io.to(folderRoom).emit("ocr:completed", message);

    console.info(
        `[Socket.IO] ocr:completed emitted dossierId=${payload.dossierId} folderId=${payload.folderId} `
            + `rooms=[${dossierRoom} listeners=${dossierListeners}, ${folderRoom} listeners=${folderListeners}] `
            + `status=${payload.status} fromStatus=${payload.fromStatus}`,
    );
}

/** Push a persisted inbox notification to the recipient's user room. */
export function emitUserNotification(
    userId: string,
    payload: UserNotificationRealtimePayload,
): void {
    if (!io) {
        console.info("[Socket.IO] notification:new skipped (Socket.IO not initialized)");
        return;
    }

    const userRoom = roomUser(userId);
    const listeners = roomMemberCount(userRoom);
    io.to(userRoom).emit("notification:new", payload);

    console.info(
        `[Socket.IO] notification:new emitted userId=${userId} room=${userRoom} listeners=${listeners} `
            + `notificationId=${payload.id} type=${payload.type}`,
    );
}

export function getSocketIo(): SocketServer | null {
    return io;
}
