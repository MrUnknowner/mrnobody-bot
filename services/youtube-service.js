const ytSearch = require("yt-search");
const ytdl = require("@pontalabs/ytdl");

function normalizeQuery(query) {
    return String(query || "").trim();
}

async function search(query, limit = 8) {
    const q = normalizeQuery(query);
    if (!q) return [];

    // Prefer the requested package for reliable YouTube search.
    const result = await ytSearch(q);

    return (result.videos || [])
        .slice(0, limit)
        .map((video) => ({
            title: video.title,
            url: video.url,
            duration: video.timestamp || video.duration?.toString() || "",
            thumbnail: video.thumbnail || null,
            author: video.author?.name || ""
        }));
}

async function downloadVideo(url, quality) {
    if (!url) throw new Error("YouTube URL is required.");

    const result = await ytdl.downloadVideo(url, String(quality));

    return normalizeDownloadResult(result, {
        sourceUrl: url,
        kind: "video",
        quality: String(quality)
    });
}

async function downloadAudio(url, quality) {
    if (!url) throw new Error("YouTube URL is required.");

    const result = await ytdl.downloadAudio(url, String(quality));

    return normalizeDownloadResult(result, {
        sourceUrl: url,
        kind: "audio",
        quality: String(quality)
    });
}

function normalizeDownloadResult(result, meta) {
    if (!result) {
        throw new Error("Downloader returned an empty result.");
    }

    if (typeof result === "string") {
        return {
            ...meta,
            url: result,
            filename: undefined
        };
    }

    const url =
        result.url ||
        result.downloadUrl ||
        result.download_url ||
        result.videoUrl ||
        result.audioUrl ||
        result.link ||
        null;

    if (!url) {
        throw new Error("Downloader did not return a download URL.");
    }

    return {
        ...meta,
        url,
        filename: result.filename || result.fileName || undefined,
        mimeType: result.mimeType || result.mime || undefined
    };
}

module.exports = {
    search,
    downloadVideo,
    downloadAudio
};
