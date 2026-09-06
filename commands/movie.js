const movieService = require("../services/movie-service");

const pending = new Map();
const TTL = 5 * 60 * 1000;
const qualities = ["480", "720", "1080"];

function cleanup() {
    const now = Date.now();
    for (const [key, value] of pending) {
        if (value.expiresAt <= now) pending.delete(key);
    }
}
setInterval(cleanup, 60 * 1000).unref();

async function execute({ sock, msg, args, userJid }) {
    const query = args.join(" ").trim();

    if (!query) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "🎬 Movie name එක දෙන්න.\n\nExample: .movie avatar"
        });
    }

    await sock.sendMessage(msg.key.remoteJid, {
        text: "🔎 Cinesubz + SinhalaSub search කරමින්..."
    });

    let results;
    try {
        results = await movieService.search(query);
    } catch (error) {
        console.error("Movie search error:", error.message);
        results = [];
    }

    if (!results.length) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Movie results හම්බුනේ නැහැ."
        });
    }

    pending.set(userJid, {
        type: "movie-result",
        results,
        expiresAt: Date.now() + TTL
    });

    return sock.sendMessage(msg.key.remoteJid, {
        text: `🎬 *Movie Results*\n\n${results.map((item, i) =>
            `${i + 1}. [${item.source}] ${item.title}`
        ).join("\n")}\n\nReply with 1-${results.length} to select.`
    });
}

async function handleSelection({ sock, msg, userJid, selection }) {
    const state = pending.get(userJid);
    if (!state || state.type !== "movie-result") return false;

    const index = Number(selection) - 1;
    if (!Number.isInteger(index) || !state.results[index]) return false;

    const movie = state.results[index];
    pending.delete(userJid);

    await sock.sendMessage(msg.key.remoteJid, {
        text: `⏳ ${movie.title}\n\nDownload links හොයමින්...`
    });

    try {
        const info = await movieService.getDownloadInfo(movie);

        const available = info.links.map((link) => {
            const q = String(link.quality || "").toLowerCase();
            const found = qualities.find((wanted) => q.includes(wanted));
            return found ? { ...link, quality: found } : link;
        });

        pending.set(userJid, {
            type: "movie-quality",
            movie,
            links: available,
            expiresAt: Date.now() + TTL
        });

        await sock.sendMessage(msg.key.remoteJid, {
            text: `🎬 Quality එක තෝරන්න:\n1. 480P\n2. 720P\n3. 1080P\n\n*Document ලෙස යවනු ලැබේ.*`
        });
    } catch (error) {
        console.error("Movie download-link error:", error.message);
        await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ Download links ලබාගන්න බැරි වුණා.\n${error.message}`
        });
    }

    return true;
}

async function handleQuality({ sock, msg, userJid, selection }) {
    const state = pending.get(userJid);
    if (!state || state.type !== "movie-quality") return false;

    const index = Number(selection) - 1;
    if (!qualities[index]) return false;

    const wanted = qualities[index];
    const match =
        state.links.find((item) => String(item.quality) === wanted) ||
        state.links.find((item) => String(item.quality || "").includes(wanted)) ||
        state.links.find((item) => !item.quality);

    pending.delete(userJid);

    if (!match?.url) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: `❌ ${wanted}P link එක provider එකෙන් ලැබුණේ නැහැ.`
        });
    }

    await sock.sendMessage(msg.key.remoteJid, {
        text: `⏳ ${wanted}P file එක යවමින්...`
    });

    try {
        await sock.sendMessage(msg.key.remoteJid, {
            document: { url: match.url },
            mimetype: "video/mp4",
            fileName: `${state.movie.title} - ${wanted}P.mp4`
        });
    } catch (error) {
        console.error("Movie send error:", error.message);
        await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ File send failed.\n${error.message}`
        });
    }

    return true;
}

module.exports = {
    name: "movie",
    description: "Search movies on Cinesubz and SinhalaSub",
    execute,
    handleSelection,
    handleQuality
};
