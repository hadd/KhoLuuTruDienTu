export const util  = {
     changeToSlugWithReplacerAll(str: string, replacer = '-'): string {
        // Chuyển hết sang chữ thường
        str = str.toLowerCase();
    
        // xóa dấu
        str = str.replace(/([àáạảãâầấậẩẫăằắặẳẵ])/g, 'a');
        str = str.replace(/([èéẹẻẽêềếệểễ])/g, 'e');
        str = str.replace(/([ìíịỉĩ])/g, 'i');
        str = str.replace(/([òóọỏõôồốộổỗơờớợởỡ])/g, 'o');
        str = str.replace(/([ùúụủũưừứựửữ])/g, 'u');
        str = str.replace(/([ỳýỵỷỹ])/g, 'y');
        str = str.replace(/(đ)/g, 'd');
    
        // Xóa ký tự đặc biệt
        str = str.replace(/([^0-9a-z-\s])/g, replacer);
    
        // Xóa khoảng trắng thay bằng ký tự -
        str = str.replace(/(\s+)/g, replacer);
    
        // xóa phần dự - ở đầu
        str = str.replace(/^-+/g, '');
    
        // xóa phần dư - ở cuối
        str = str.replace(/-+$/g, '');
    
        // return
        return str;
    },

    generateRandomPassword(): string {
        const length = 16;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, (byte) => charset[byte % charset.length]).join("");
    },

    // Normalize S3 file path by trimming leading slashes and stripping accidental bucket prefix
    normalizeS3FilePath(filePath: string, bucket: string): string {
        let normalized = filePath || "";
        if (normalized.startsWith("/")) {
            normalized = normalized.replace(/^\/+/, "");
        }
        const bucketPrefix = `${bucket}/`;
        if (normalized.startsWith(bucketPrefix)) {
            normalized = normalized.slice(bucketPrefix.length);
        }
        return normalized;
    },

    // Extract category as the second segment of the path; fallback if missing
    extractCategoryFromPath(filePath: string, fallback: string): string {
        const parts = (filePath || "").split("/");
        return parts.length >= 2 ? parts[1] || fallback : fallback;
    },

    // Strip timestamp/id prefix from a filename-like segment
    // Expected pattern in path: {year}_{month}_{day}/{hour}_{minute}_{id}_{filename}
    stripTimestampPrefix(segment: string): string {
        const last = segment || "";
        if (last.includes("_") && last.split("_").length >= 4) {
            const parts = last.split("_");
            const filenamePart = parts.slice(4).join("_");
            if (filenamePart) return filenamePart;
        }
        return last;
    },

    // Derive filename from S3 stat metadata or from the path, with timestamp prefix stripped
    deriveFileNameFromStat(stat: { metaData?: Record<string, string> | undefined }, path: string): string {
        const parts = (path || "").split("/");
        const lastSegment = parts[parts.length - 1] || "";
        const fromMeta = stat?.metaData?.["original-filename"]
            || stat?.metaData?.["x-amz-meta-original-filename"]
            || lastSegment;
        return this.stripTimestampPrefix(fromMeta || "");
    },

    /**
     * Generate a short nanoid using 0-9A-Z alphabet
     * @param size - Length of the generated ID (default: 3)
     * @returns A random string of the specified length
     */
    generateNanoId(size: number = 3): string {
        const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const bytes = new Uint8Array(size);
        crypto.getRandomValues(bytes);
        let id = "";
        for (let i = 0; i < size; i++) {
            id += alphabet[bytes[i] % alphabet.length];
        }
        return id;
    }
}