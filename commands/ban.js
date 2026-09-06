const {
    banUser,
    isValidUserJid
} = require("../services/user-service");

module.exports = {
    name: "ban",
    ownerOnly: true,

    async execute({ sock, msg, args }) {
        const quotedMessage =
            msg.message?.extendedTextMessage
                ?.contextInfo
                ?.quotedMessage;

        const quotedParticipant =
            msg.message?.extendedTextMessage
                ?.contextInfo
                ?.participant;

        const targetJid =
            quotedParticipant ||
            args[0];

        if (!targetJid) {
            await sock.sendMessage(
                msg.key.remoteJid,
                {
                    text:
                        "❌ Reply to a user's message or use:\n.ban <user-jid>"
                }
            );

            return;
        }

        const senderJid =
            msg.key.participant ||
            msg.key.remoteJid;

        if (targetJid === senderJid) {
            await sock.sendMessage(
                msg.key.remoteJid,
                {
                    text:
                        "❌ You cannot ban yourself."
                }
            );

            return;
        }

        if (!isValidUserJid(targetJid)) {
            await sock.sendMessage(
                msg.key.remoteJid,
                {
                    text:
                        "❌ Invalid user JID."
                }
            );

            return;
        }

        const success = await banUser(
            targetJid,
            "Banned by owner/admin"
        );

        if (!success) {
            await sock.sendMessage(
                msg.key.remoteJid,
                {
                    text:
                        "❌ Failed to ban user."
                }
            );

            return;
        }

        await sock.sendMessage(
            msg.key.remoteJid,
            {
                text:
                    `🚫 User banned: ${targetJid}`
            }
        );
    }
};
