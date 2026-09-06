module.exports = {
    name: "ping",

    async execute({ sock, msg }) {
        await sock.sendMessage(
            msg.key.remoteJid,
            {
                text: "🏓 Pong!"
            }
        );
    }
};
