/**
 * S3 Helper Utilities
 * 
 * Utility functions for S3 and file operations
 */

/**
 * Get MIME type from file extension
 * 
 * @param filename - The filename with extension
 * @returns MIME type string
 */
export function getMimeTypeFromFilename(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    const mimeTypes: Record<string, string> = {
        // Documents
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'rtf': 'application/rtf',
        
        // Images
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        
        // Audio
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'm4a': 'audio/mp4',
        
        // Video
        'mp4': 'video/mp4',
        'avi': 'video/x-msvideo',
        'mov': 'video/quicktime',
        'wmv': 'video/x-ms-wmv',
        'flv': 'video/x-flv',
        'webm': 'video/webm',
        
        // Archives
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed',
        'tar': 'application/x-tar',
        'gz': 'application/gzip',
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Sanitize name to URL-safe slug format with Vietnamese character support
 * 
 * Examples:
 * - "Tiểu học Quốc tế" -> "tieu-hoc-quoc-te"
 * 
 * @param name - The name to sanitize
 * @returns URL-safe slug
 */
export function sanitizeName(name: string): string {
    return changeToSlugWithReplacerAll(name);
}

function changeToSlugWithReplacerAll(str: string, replacer = '-'): string {
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
}

/**
 * Generate timestamp-based file path component
 * Format: yyyy_mm_dd/hh_mm_{id}
 * 
 * Uses server local time.
 *
 * @param id - Identifier to append (e.g., nanoid)
 * @param date - Optional date to use (defaults to now)
 * @returns File path component
 */
export function generateTimestampPath(id: string, date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');

    const datePart = `${year}_${month}_${day}`;
    const timePart = `${hour}_${minute}`;
    return `${datePart}/${timePart}_${id}`;
}

/**
 * Slugify a filename while preserving its extension
 *
 * Example: "My Worksheet.PDF" -> "my-worksheet.pdf"
 */
export function slugifyFilename(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.')
    if (lastDotIndex <= 0 || lastDotIndex === filename.length - 1) {
        return sanitizeName(filename);
    }
    const base = filename.slice(0, lastDotIndex);
    const ext = filename.slice(lastDotIndex + 1).toLowerCase();
    const baseSlug = sanitizeName(base);
    return `${baseSlug}.${ext}`;
}

/**
 * Generate public asset file path
 * Format: public-asset/yyyy/mm/dd/<file_id>.<extension>
 * 
 * Example: public-asset/2025/01/15/abc123xyz.png
 * 
 * @param fileId - Unique identifier (e.g., nanoid)
 * @param filename - Original filename with extension
 * @param date - Optional date to use (defaults to now)
 * @returns Public asset file path
 */
export function generatePublicAssetPath(
    fileId: string,
    filename: string,
    date: Date = new Date()
): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const datePart = `${year}/${month}/${day}`;
    
    const lastDotIndex = filename.lastIndexOf('.');
    const extension = lastDotIndex > 0 && lastDotIndex < filename.length - 1
        ? filename.slice(lastDotIndex + 1).toLowerCase()
        : '';
    
    const fileName = extension ? `${fileId}.${extension}` : fileId;
    
    return `public-asset/${datePart}/${fileName}`;
}
