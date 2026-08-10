import { httpError, AppError } from "@shared/common-lib";

let cachedSofficePath: string | null | undefined;

async function findSofficeOnWindows(): Promise<string | null> {
    const roots = ["C:/Program Files", "C:/Program Files (x86)"];
    for (const root of roots) {
        try {
            for await (const entry of Deno.readDir(root)) {
                if (!entry.isDirectory) continue;
                if (!entry.name.toLowerCase().startsWith("libreoffice")) continue;
                const exe = `${root}/${entry.name}/program/soffice.exe`;
                try {
                    Deno.statSync(exe);
                    return exe;
                } catch {
                    // continue
                }
            }
        } catch {
            // continue
        }
    }
    return null;
}

/** Resolve LibreOffice soffice executable, or null if not installed. */
export async function resolveSofficeExecutable(): Promise<string | null> {
    if (cachedSofficePath !== undefined) return cachedSofficePath;

    const fromEnv = Deno.env.get("LIBREOFFICE_PATH")?.trim();
    if (fromEnv) {
        try {
            Deno.statSync(fromEnv);
            cachedSofficePath = fromEnv;
            return fromEnv;
        } catch {
            cachedSofficePath = null;
            return null;
        }
    }

    if (Deno.build.os === "windows") {
        const fixed = [
            "C:/Program Files/LibreOffice/program/soffice.exe",
            "C:/Program Files (x86)/LibreOffice/program/soffice.exe",
        ];
        for (const p of fixed) {
            try {
                Deno.statSync(p);
                cachedSofficePath = p;
                return p;
            } catch {
                // next
            }
        }
        const scanned = await findSofficeOnWindows();
        if (scanned) {
            cachedSofficePath = scanned;
            return scanned;
        }
        for (const name of ["soffice.exe", "soffice"]) {
            try {
                const which = new Deno.Command("where", {
                    args: [name],
                    stdout: "piped",
                    stderr: "null",
                });
                const out = await which.output();
                if (out.success) {
                    const path = new TextDecoder().decode(out.stdout).trim().split(/\r?\n/)[0]?.trim();
                    if (path) {
                        try {
                            Deno.statSync(path);
                            cachedSofficePath = path;
                            return path;
                        } catch {
                            // not a valid path
                        }
                    }
                }
            } catch {
                // next
            }
        }
        cachedSofficePath = null;
        return null;
    }

    for (const cmd of ["soffice", "/usr/bin/soffice", "/usr/bin/libreoffice"]) {
        try {
            const which = new Deno.Command("which", {
                args: [cmd.replace(/^.*\//, "")],
                stdout: "piped",
                stderr: "null",
            });
            const out = await which.output();
            if (out.success) {
                const path = new TextDecoder().decode(out.stdout).trim().split(/\r?\n/)[0]?.trim();
                if (path) {
                    cachedSofficePath = path;
                    return path;
                }
            }
        } catch {
            // next
        }
    }

    cachedSofficePath = null;
    return null;
}

export async function isLibreOfficeAvailable(): Promise<boolean> {
    return (await resolveSofficeExecutable()) !== null;
}

function isSpawnNotFoundError(error: unknown): boolean {
    if (error instanceof Deno.errors.NotFound) return true;
    const msg = error instanceof Error ? error.message : String(error);
    return /entity not found|not found|ENOENT|Failed to spawn/i.test(msg);
}

function libreOfficeProgramDir(sofficePath: string): string {
    const normalized = sofficePath.replace(/\\/g, "/");
    const idx = normalized.lastIndexOf("/");
    return idx > 0 ? normalized.slice(0, idx) : normalized;
}

function toOsPath(path: string): string {
    return Deno.build.os === "windows" ? path.replace(/\//g, "\\") : path;
}

function libreOfficeCommandEnv(programDir: string): Record<string, string> {
    const sep = Deno.build.os === "windows" ? ";" : ":";
    const pathKey = Deno.build.os === "windows" ? "Path" : "PATH";
    const existing = Deno.env.get(pathKey) ?? Deno.env.get("PATH") ?? "";
    return {
        ...Deno.env.toObject(),
        [pathKey]: `${programDir}${sep}${existing}`,
    };
}

export async function convertDocxBytesToPdf(
    docxBytes: Uint8Array,
    sofficePath?: string,
): Promise<Uint8Array> {
    const soffice = sofficePath ?? await resolveSofficeExecutable();
    if (!soffice) {
        throw httpError.internal(
            "Chưa cài LibreOffice (soffice). Cài LibreOffice hoặc đặt biến LIBREOFFICE_PATH trỏ tới soffice.exe.",
        );
    }

    const tmpDir = await Deno.makeTempDir({ prefix: "disposal-appendix-" });
    const inputPath = toOsPath(`${tmpDir}/input.docx`);
    const outputPath = toOsPath(`${tmpDir}/input.pdf`);
    const outDir = toOsPath(tmpDir);
    const programDir = libreOfficeProgramDir(soffice);
    try {
        await Deno.writeFile(inputPath, docxBytes);
        const cmd = new Deno.Command(soffice, {
            cwd: programDir,
            env: libreOfficeCommandEnv(programDir),
            args: [
                "--headless",
                "--norestore",
                "--convert-to",
                "pdf",
                "--outdir",
                outDir,
                inputPath,
            ],
            stdout: "piped",
            stderr: "piped",
        });
        let result: Deno.CommandOutput;
        try {
            result = await cmd.output();
        } catch (error) {
            if (isSpawnNotFoundError(error)) {
                cachedSofficePath = undefined;
            }
            throw error;
        }
        if (!result.success) {
            const err = new TextDecoder().decode(result.stderr);
            throw httpError.internal(
                `Không chuyển DOCX sang PDF (LibreOffice). ${err.slice(0, 500)}`,
            );
        }
        try {
            return await Deno.readFile(outputPath);
        } catch {
            throw httpError.internal(
                "LibreOffice không tạo được file PDF. Kiểm tra cài đặt soffice.",
            );
        }
    } finally {
        try {
            await Deno.remove(tmpDir, { recursive: true });
        } catch {
            // ignore cleanup errors
        }
    }
}

/** Prefer Word template → PDF via LibreOffice; use fallback when soffice is unavailable. */
export async function convertDocxToPdfWithFallback(
    docxBytes: Uint8Array,
    fallback: () => Promise<Uint8Array>,
): Promise<Uint8Array> {
    const soffice = await resolveSofficeExecutable();
    if (!soffice) {
        console.warn("[archive-disposal] LibreOffice không tìm thấy — xuất Phụ lục bằng PDF fallback (không theo mẫu Word).");
        return await fallback();
    }
    try {
        return await convertDocxBytesToPdf(docxBytes, soffice);
    } catch (error) {
        if (isSpawnNotFoundError(error)) {
            cachedSofficePath = undefined;
            console.warn("[archive-disposal] Không chạy được soffice — dùng PDF fallback.");
            return await fallback();
        }
        if (error instanceof AppError && error.status >= 500) {
            const detail = error.message?.slice(0, 200) ?? String(error);
            console.warn(
                `[archive-disposal] LibreOffice chuyển DOCX→PDF thất bại — dùng PDF fallback: ${detail}`,
            );
            return await fallback();
        }
        throw error;
    }
}
