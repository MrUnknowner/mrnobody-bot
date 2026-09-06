module.exports = {
    name: "heavytest",
    heavy: true,

    async execute({ sock, msg, signal }) {
        await new Promise((resolve, reject) => {
            const timer = setTimeout(
                resolve,
                10000
            );

            if (signal.aborted) {
                clearTimeout(timer);

                reject(
                    new Error(
                        "Heavy job was aborted."
                    )
                );

                return;
            }

            signal.addEventListener(
                "abort",
                () => {
                    clearTimeout(timer);

                    reject(
                        new Error(
                            "Heavy job was aborted."
                        )
                    );
                },
                { once: true }
            );
        });

        if (signal.aborted) {
            return;
        }

        await sock.sendMessage(
            msg.key.remoteJid,
            {
                text: "✅ Heavy test completed!"
            }
        );
    }
};
