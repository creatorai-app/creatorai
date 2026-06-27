export async function fetchVideoAsBuffer(videoUrl: string): Promise<Buffer> {
    if (!videoUrl) throw new Error("Video URL is required");

    const response = await fetch(videoUrl);
    if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("Video downloaded as buffer, size:", buffer.length);

    return buffer;
}

export function getFileNameFromUrl(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        const parts = pathname.split("/");
        return parts[parts.length - 1] || `video-${Date.now()}.mp4`;
    } catch {
        return `video-${Date.now()}.mp4`;
    }
}

const VIDEO_MIME_TYPES: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
};

export function getMimeTypeFromUrl(url: string): string {
    const extension = url.split(".").pop()?.toLowerCase() ?? "";
    return VIDEO_MIME_TYPES[extension] ?? "application/octet-stream";
}
