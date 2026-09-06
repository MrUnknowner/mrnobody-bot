const {
    unbanUser,
    isValidUserJid
} = require("../services/user-service");

module.exports = {
    name: "unban",
    ownerOnly: true,

    async execute({ sock, msg, args }) {
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
                        "❌ Reply to a user's message or use:\n.unban <user-jid>"
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
                        "❌ You cannot unban yourself."
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

        const success = await unbanUser(
            targetJid
        );

        if (!success) {
            await sock.sendMessage(
                msg.key.remoteJid,
                {
                    text:
                        "❌ Failed to unban user."
                }
            );

            return;
        }

        await sock.sendMessage(
            msg.key.remoteJid,
            {
                text:
                    `✅ User unbanned: ${targetJid}`
            }
        );
    }
};
