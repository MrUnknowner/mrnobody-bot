
const {
    selectionNumber,
    startSelection,
    executeSelection
} = require("../services/downloader-command");

const CHOICES = [
    { number: 1, label: "144P — Document", quality: "144p", outputType: "document" },
    { number: 2, label: "240P — Document", quality: "240p", outputType: "document" },
    { number: 3, label: "360P — Document", quality: "360p", outputType: "document" },
    { number: 4, label: "480P — Document", quality: "480p", outputType: "document" },
    { number: 5, label: "720P — Document", quality: "720p", outputType: "document" },
    { number: 6, label: "1080P — Document", quality: "1080p", outputType: "document" },
    { number: 7, label: "144P — Video", quality: "144p", outputType: "video" },
    { number: 8, label: "240P — Video", quality: "240p", outputType: "video" },
    { number: 9, label: "360P — Video", quality: "360p", outputType: "video" },
    { number: 10, label: "480P — Video", quality: "480p", outputType: "video" },
    { number: 11, label: "720P — Video", quality: "720p", outputType: "video" },
    { number: 12, label: "1080P — Video", quality: "1080p", outputType: "video" }
];

module.exports = {
    name: "fb",
    heavy: true,

    async execute({
        sock,
        msg,
        args,
        signal
    }) {
        const number =
            selectionNumber(args);

        if (number !== null) {
            await executeSelection({
                sock,
                msg,
                commandName: "fb",
                number,
                choices: CHOICES,
                buildPayload: (
                    source,
                    choice
                ) => ({
                    url: source,
                    quality: choice.quality,
                    output: choice.outputType
                }),
                signal
            });

            return;
        }

        const source =
            args.join(" ").trim();

        if (!source) {
            await sock.sendMessage(
                msg.key.remoteJid,
                {
                    text:
                        "📥 Usage:\n.fb <Facebook URL>"
                }
            );

            return;
        }

        await startSelection({
            sock,
            msg,
            commandName: "fb",
            source,
            choices: CHOICES,
            prompt:
                "📥 Facebook media"
        });
    }
};
