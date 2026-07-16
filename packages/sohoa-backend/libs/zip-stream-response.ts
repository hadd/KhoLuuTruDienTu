/** Build an HTTP Response that streams a ZIP download. */
export function zipStreamResponse(
    stream: ReadableStream<Uint8Array>,
    filename: string,
    contentType = "application/zip",
): Response {
    return new Response(stream, {
        headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
            // Hint proxies/browsers not to buffer the whole body before download starts.
            "X-Content-Type-Options": "nosniff",
        },
    });
}
