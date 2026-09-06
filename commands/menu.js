
module.exports = {
    name: "menu",

    async execute({ sock, msg }) {
        await sock.sendMessage(
            msg.key.remoteJid,
            {
                text:
                    "╭────〔 MRNOBODY MD 〕────╮\n" +
                    "│\n" +
                    "│ ⚙️ General Commands\n" +
                    "│ ├ 🏓 .ping\n" +
                    "│ ├ ❤️ .alive\n" +
                    "│ └ 📋 .menu\n" +
                    "│\n" +
                    "│ 📥 Downloader Commands\n" +
                    "│ ├ 🎥 .video <url>\n" +
                    "│ ├ 📘 .fb <url>\n" +
                    "│ ├ 🎵 .tiktok <url>\n" +
                    "│ └ 📸 .insta <url>\n" +
                    "│\n" +
                    "│ 🎬 Movie Commands\n" +
                    "│ └ 🎬 .movie <search / url>\n" +
                    "│\n" +
                    "│ 🎵 Music Commands\n" +
                    "│ └ 🎧 .song <url / search>\n" +
                    "│\n" +
                    "│ 🔐 Owner Commands\n" +
                    "│ ├ 🚫 .ban\n" +
                    "│ └ ♻️ .unban\n" +
                    "│\n" +
                    "╰────────────────────────╯\n\n" +
                    "ℹ️ Downloader commands open a quality/output selection menu."
            }
        );
    }
};
