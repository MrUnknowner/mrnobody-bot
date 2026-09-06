const {
    search,
    downloadAudio
} = require("../services/youtube-service");

const pending = new Map();
const TTL = 5 * 60 * 1000;
const qualities = ["320", "256", "128"];

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
            text: "❌ YouTube URL එකක් හෝ search එකක් දෙන්න.\n\nExample: .song alan walker faded"
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

    pending.set(userJid, {
        type: "song-result",
        results,
        expiresAt: Date.now() + TTL
    });

    return sock.sendMessage(msg.key.remoteJid, {
        text: `🎵 *YouTube Results*\n\n${results.map((item, i) =>
            `${i + 1}. ${item.title}\n   ${item.duration || ""}`
        ).join("\n\n")}\n\nReply with 1-${results.length} to select.`
    });
}

async function handleSelection({ sock, msg, userJid, selection }) {
    const state = pending.get(userJid);
    if (!state || state.type !== "song-result") return false;

    const index = Number(selection) - 1;
    if (!Number.isInteger(index) || !state.results[index]) return false;

    pending.delete(userJid);

    pending.set(userJid, {
        type: "song-quality",
        video: state.results[index],
        expiresAt: Date.now() + TTL
    });

    await sock.sendMessage(msg.key.remoteJid, {
        text: `🎵 Quality එක තෝරන්න:\n1. 320kbps\n2. 256kbps\n3. 128kbps`
    });

    return true;
}

async function handleQuality({ sock, msg, userJid, selection }) {
    const state = pending.get(userJid);
    if (!state || state.type !== "song-quality") return false;

    const index = Number(selection) - 1;
    if (!qualities[index]) return false;

    pending.delete(userJid);

    const quality = qualities[index];
    const jid = msg.key.remoteJid;

    await sock.sendMessage(jid, {
        text: `⏳ ${quality}kbps MP3 download කරමින්...`
    });

    try {
        const result = await downloadAudio(state.video.url, quality);
        await sock.sendMessage(jid, {
            audio: { url: result.url },
            mimetype: result.mimeType || "audio/mpeg",
            fileName: result.filename || `${state.video.title} - ${quality}kbps.mp3`
        });
    } catch (error) {
        console.error("YouTube audio download error:", error.message);
        await sock.sendMessage(jid, {
            text: `❌ ${quality}kbps download failed.\n${error.message}`
        });
    }

    return true;
}

module.exports = {
    name: "song",
    aliases: ["mp3"],
    description: "Download YouTube audio as MP3",
    execute,
    handleSelection,
    handleQuality
};
