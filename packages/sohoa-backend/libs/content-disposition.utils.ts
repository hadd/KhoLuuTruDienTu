/**
 * Formats a Content-Disposition header value using RFC 5987 standard encoding
 * for handling non-ASCII / Unicode filenames (such as Vietnamese characters) safely in HTTP responses.
 */
export function formatContentDisposition(
  dispositionType: "inline" | "attachment",
  filename: string,
): string {
  const cleanName = filename.replace(/[\r\n"]+/g, "_").trim() || "file";

  // Create ASCII fallback filename (strip accents, replace non-ASCII with _)
  const asciiFallback = cleanName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/"/g, '\\"');

  const encodedName = encodeURIComponent(cleanName);

  return `${dispositionType}; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`;
}
