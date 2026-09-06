
const {
    setSelection,
    consumeSelection
} = require("./selection-store");

const {
    requestMedia,
    sendMedia
} = require("./media-service");

function getUserId(msg) {
    return (
        msg.key.participant ||
        msg.key.remoteJid
    );
}

function getRemoteJid(msg) {
    return msg.key.remoteJid;
}

function parseUrl(value) {
    if (!value) {
        return null;
    }

    try {
        const url = new URL(value);

        if (
            url.protocol !== "http:" &&
            url.protocol !== "https:"
        ) {
            return null;
        }

        return url.toString();
    } catch {
        return null;
    }
}

function selectionNumber(args) {
    if (!args?.length) {
        return null;
    }

    const number =
        Number(args[0]);

    if (!Number.isInteger(number)) {
        return null;
    }

    return number;
}

async function startSelection({
    sock,
    msg,
    commandName,
    source,
    choices,
    prompt
}) {
    const userId =
        getUserId(msg);

    const jid =
        getRemoteJid(msg);

    setSelection(
        userId,
        commandName,
        { source }
    );

    await sock.sendMessage(
        jid,
        {
            text:
                `${prompt}\n\n` +
                choices
                    .map(
                        (choice) =>
                            `${choice.number}. ${choice.label}`
                    )
                    .join("\n") +
                "\n\nReply with the number."
        }
    );
}

async function executeSelection({
    sock,
    msg,
    commandName,
    number,
    choices,
    buildPayload,
    signal
}) {
    const userId =
        getUserId(msg);

    const jid =
        getRemoteJid(msg);

    const choice =
        choices.find(
            (item) =>
                item.number === number
        );

    if (!choice) {
        await sock.sendMessage(
            jid,
            {
                text:
                    "❌ Invalid selection."
            }
        );

        return;
    }

    const pending =
        consumeSelection(
            userId,
            commandName
        );

    if (!pending) {
        await sock.sendMessage(
            jid,
            {
                text:
                    `⌛ This .${commandName} selection expired.\nPlease send the URL again.`
            }
        );

        return;
    }

    await sock.sendMessage(
        jid,
        {
            text:
                `⏳ Processing .${commandName} (${choice.label})...`
        }
    );

    const result =
        await requestMedia(
            commandName,
            buildPayload(
                pending.source,
                choice
            ),
            signal
        );

    await sendMedia(
        sock,
        jid,
        result,
        choice.outputType,
        result.caption || ""
    );
}

module.exports = {
    parseUrl,
    selectionNumber,
    startSelection,
    executeSelection
};
