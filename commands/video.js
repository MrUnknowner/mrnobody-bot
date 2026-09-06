const {
    search,
    downloadVideo
} = require("../services/youtube-service");

const pending = new Map();
const TTL = 5 * 60 * 1000;

const qualities = ["144", "240", "360", "480", "720", "1080"];

function cleanup() {
    const now = Date.now();
    for (const [key, value] of pending) {
        if (value.expiresAt <= now) pending.delete(key);
    }
}
setInterval(cleanup, 60 * 1000).unref();

async function execute({ sock, msg, args, userJid }) {
    const input = args.join(" ").trim();
    if (!input) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "❌ YouTube URL එකක් හෝ search එකක් දෙන්න.\n\nExample: .video alan walker faded"
        });
    }

    let results;
    try {
        results = await search(input, 8);
    } catch (error) {
        console.error("YouTube search error:", error.message);
        return sock.sendMessage(msg.key.remoteJid, {
            text: "❌ YouTube search failed."
        });
    }

    if (!results.length) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Results හම්බුනේ නැහැ."
        });
    }

    const lines = results.map((item, i) =>
        `${i + 1}. ${item.title}\n   ${item.duration ? `Duration: ${item.duration}` : ""}`
    );

    pending.set(userJid, {
        type: "video-result",
        results,
        expiresAt: Date.now() + TTL
    });

    return sock.sendMessage(msg.key.remoteJid, {
        text: `🎬 *YouTube Results*\n\n${lines.join("\n\n")}\n\nReply with 1-${results.length} to select.`
    });
}

async function handleSelection({ sock, msg, userJid, selection }) {
    const state = pending.get(userJid);
    if (!state || state.type !== "video-result") return false;

    const index = Number(selection) - 1;
    if (!Number.isInteger(index) || !state.results[index]) return false;

    pending.delete(userJid);

    const video = state.results[index];
    const jid = msg.key.remoteJid;

    await sock.sendMessage(jid, {
        text: `🎬 ${video.title}\n\nQuality එක තෝරන්න:\n${qualities.map((q, i) => `${i + 1}. ${q}P`).join("\n")}`
    });

    pending.set(userJid, {
        type: "video-quality",
        video,
        expiresAt: Date.now() + TTL
    });

    return true;
}

async function handleQuality({ sock, msg, userJid, selection }) {
    const state = pending.get(userJid);
    if (!state || state.type !== "video-quality") return false;

    const index = Number(selection) - 1;
    if (!qualities[index]) return false;

    pending.delete(userJid);

    const quality = qualities[index];
    const jid = msg.key.remoteJid;

    await sock.sendMessage(jid, {
        text: `⏳ ${quality}P download කරමින්...`
    });

    try {
        const result = await downloadVideo(state.video.url, quality);
        await sock.sendMessage(jid, {
            document: { url: result.url },
            mimetype: result.mimeType || "video/mp4",
            fileName: result.filename || `${state.video.title} - ${quality}P.mp4`
        });
    } catch (error) {
        console.error("YouTube video download error:", error.message);
        await sock.sendMessage(jid, {
            text: `❌ ${quality}P download failed.\n${error.message}`
        });
    }

    return true;
}

module.exports = {
    name: "video",
    aliases: ["yt"],
    description: "Download YouTube videos",
    execute,
    handleSelection,
    handleQuality
};
