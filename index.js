
const fs = require("fs");
const path = require("path");
const pino = require("pino");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const {
    AUTH_DIR,
    downloadSession,
    hasLocalSession,
    getSessionId,
    pairRequest
} = require("./session-loader");

const {
    loadCommands,
    getCommand
} = require("./command-loader");

const {
    ensureUser
} = require("./services/user-service");

const {
    isOwnerOrAdmin
} = require("./services/owner-service");

const {
    getSelection
} = require("./services/selection-store");

const {
    addJob,
    waitForQueueToFinish
} = require("./job-queue");

let syncing = false;
let syncPromise = null;
let syncTimer = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let shuttingDown = false;
let startupRetryTimer = null;
let rateLimitCleanupTimer = null;

const userRateLimit = new Map();

const RATE_LIMIT_MS = 1500;
const MAX_RATE_LIMIT_USERS = 10000;

const messageQueue = [];
let processingMessages = false;

const MAX_MESSAGE_QUEUE = 2000;

rateLimitCleanupTimer = setInterval(() => {
    const now = Date.now();

    for (
        const [userId, lastMessageTime]
        of userRateLimit
    ) {
        if (
            now - lastMessageTime >
            RATE_LIMIT_MS * 2
        ) {
            userRateLimit.delete(userId);
        }
    }
}, 60000);

rateLimitCleanupTimer.unref();

function collectAuthFiles() {
    const files = {};

    if (!fs.existsSync(AUTH_DIR)) {
        return files;
    }

    const entries = fs.readdirSync(
        AUTH_DIR,
        { withFileTypes: true }
    );

    for (const entry of entries) {
        if (!entry.isFile()) continue;

        const filePath = path.join(
            AUTH_DIR,
            entry.name
        );

        files[entry.name] =
            fs.readFileSync(filePath)
                .toString("base64");
    }

    return files;
}

async function syncSession() {
    if (syncPromise) {
        return syncPromise;
    }

    syncPromise = (async () => {
        try {
            const session =
                getSessionId();

            const files =
                collectAuthFiles();

            if (!files["creds.json"]) {
                return;
            }

            const response =
                await pairRequest(
                    `/session/${session}`,
                    {
                        method: "PUT",
                        body: JSON.stringify({
                            files
                        })
                    }
                );

            if (!response.ok) {
                const text =
                    await response.text();

                console.error(
                    `Session sync failed [${response.status}]:`,
                    text
                );

                return;
            }

            console.log(
                "🔄 Session synced"
            );
        } catch (error) {
            console.error(
                "Session sync error:",
                error.message
            );
        } finally {
            syncPromise = null;
        }
    })();

    return syncPromise;
}

function scheduleSync() {
    clearTimeout(syncTimer);

    syncTimer = setTimeout(
        () => {
            syncSession().catch(
                (error) => {
                    console.error(
                        "Scheduled sync error:",
                        error.message
                    );
                }
            );
        },
        2000
    );
}

async function handlePendingSelection(
    msg,
    sock,
    text,
    userId
) {
    const number =
        Number(text.trim());

    if (
        !Number.isInteger(number) ||
        number < 1 ||
        number > 99
    ) {
        return false;
    }

    const commandNames = [
        "movie",
        "video",
        "song",
        "fb",
        "tiktok",
        "insta"
    ];

    for (const commandName of commandNames) {
        const pending =
            getSelection(
                userId,
                commandName
            );

        if (!pending) {
            continue;
        }

        const command =
            getCommand(commandName);

        if (
            !command ||
            typeof command.execute !==
                "function"
        ) {
            return false;
        }

        await processCommand(
            msg,
            sock,
            command,
            commandName,
            [String(number)]
        );

        return true;
    }

    return false;
}

async function handleDownloaderSelection({
    sock,
    msg,
    userJid,
    selection
}) {
    const commandNames = ["movie", "video", "song"];

    for (const name of commandNames) {
        const command = getCommand(name);

        if (!command) continue;

        if (typeof command.handleSelection === "function") {
            const handled = await command.handleSelection({
                sock,
                msg,
                userJid,
                selection
            });

            if (handled) return true;
        }

        if (typeof command.handleQuality === "function") {
            const handled = await command.handleQuality({
                sock,
                msg,
                userJid,
                selection
            });

            if (handled) return true;
        }
    }

    return false;
}

async function processCommand(
    msg,
    sock,
    command,
    commandName,
    args
) {
    const numericSelection = String(text || "").trim();

    if (/^\d+$/.test(numericSelection)) {
        const handled = await handleDownloaderSelection({
            sock,
            msg,
            userJid,
            selection: numericSelection
        });

        if (handled) return;
    }


    const userId =
        msg.key.participant ||
        msg.key.remoteJid;

    if (command.ownerOnly) {
        const allowed =
            await isOwnerOrAdmin(userId);

        if (!allowed) {
            return;
        }
    }

    const commandContext = {
        sock,
        msg,
        args,
        command: commandName,
        text:
            `.${commandName} ${args.join(" ")}`
    };

    try {
        if (command.heavy) {
            const queueResult =
                addJob(
                    userId,
                    async (signal) => {
                        await command.execute({
                            ...commandContext,
                            signal
                        });
                    },
                    async (error) => {
                        console.error(
                            `Heavy command error [.${commandName}]:`,
                            error.message
                        );

                        try {
                            await sock.sendMessage(
                                msg.key.remoteJid,
                                {
                                    text:
                                        `❌ Failed to process .${commandName}`
                                }
                            );
                        } catch (sendError) {
                            console.error(
                                "Heavy command error reply failed:",
                                sendError.message
                            );
                        }
                    }
                );

            if (!queueResult.accepted) {
                await sock.sendMessage(
                    msg.key.remoteJid,
                    {
                        text:
                            queueResult.reason ===
                            "user_limit"
                                ? "⚠️ You already have 2 heavy requests running or queued.\nPlease wait for them to finish."
                                : "⚠️ Server is busy right now.\nPlease try again in a little while."
                    }
                );

                return;
            }

            if (queueResult.position === 0) {
                await sock.sendMessage(
                    msg.key.remoteJid,
                    {
                        text:
                            `⏳ .${commandName} started processing...`
                    }
                );
            } else {
                await sock.sendMessage(
                    msg.key.remoteJid,
                    {
                        text:
                            `⏳ Your .${commandName} request is queued.\n` +
                            `📋 Queue position: ${queueResult.position}`
                    }
                );
            }

            return;
        }

        await command.execute(
            commandContext
        );
    } catch (error) {
        console.error(
            `Command error [.${commandName}]:`,
            error.message
        );

        try {
            await sock.sendMessage(
                msg.key.remoteJid,
                {
                    text:
                        "❌ Something went wrong while processing the command."
                }
            );
        } catch (sendError) {
            console.error(
                "Command error reply failed:",
                sendError.message
            );
        }
    }
}

async function processMessage(
    msg,
    sock
) {
    if (!msg || !msg.message) {
        return;
    }

    const text =
        msg.message?.conversation ||
        msg.message
            ?.extendedTextMessage
            ?.text ||
        "";

    const userId =
        msg.key.participant ||
        msg.key.remoteJid;

    if (!text.trim().startsWith(".")) {
        await handlePendingSelection(
            msg,
            sock,
            text,
            userId
        );

        return;
    }

    const user =
        await ensureUser(
            userId,
            msg.pushName || null
        );

    if (user?.is_banned) {
        return;
    }

    const lastMessageTime =
        userRateLimit.get(userId) || 0;

    const now = Date.now();

    if (
        now - lastMessageTime <
        RATE_LIMIT_MS
    ) {
        return;
    }

    if (
        userRateLimit.size >=
        MAX_RATE_LIMIT_USERS
    ) {
        userRateLimit.clear();
    }

    userRateLimit.set(
        userId,
        now
    );

    const parts =
        text.trim().split(/\s+/);

    const commandName =
        parts[0]
            .slice(1)
            .toLowerCase();

    const args =
        parts.slice(1);

    const command =
        getCommand(commandName);

    if (!command) {
        return;
    }

    await processCommand(
        msg,
        sock,
        command,
        commandName,
        args
    );
}

async function processMessageQueue(
    sock
) {
    if (processingMessages) {
        return;
    }

    processingMessages = true;

    try {
        while (
            messageQueue.length > 0
        ) {
            const msg =
                messageQueue.shift();

            try {
                await processMessage(
                    msg,
                    sock
                );
            } catch (error) {
                console.error(
                    "Message processing error:",
                    error.message
                );
            }
        }
    } finally {
        processingMessages = false;

        if (
            messageQueue.length > 0
        ) {
            processMessageQueue(
                sock
            ).catch(
                (error) => {
                    console.error(
                        "Message queue restart error:",
                        error.message
                    );
                }
            );
        }
    }
}

function enqueueMessage(
    msg,
    sock
) {
    if (
        !msg ||
        !msg.message
    ) {
        return;
    }

    if (shuttingDown) {
        return;
    }

    if (
        messageQueue.length >=
        MAX_MESSAGE_QUEUE
    ) {
        console.log(
            "⚠️ Message queue is full. Message skipped."
        );

        return;
    }

    messageQueue.push(msg);

    processMessageQueue(
        sock
    ).catch(
        (error) => {
            console.error(
                "Message queue error:",
                error.message
            );
        }
    );
}

async function startBot() {
    try {
        if (!hasLocalSession()) {
            console.log(
                "📥 Downloading MRNOBODY Session..."
            );

            await downloadSession();
        }

        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(
            AUTH_DIR
        );

        const sock =
            makeWASocket({
                auth: {
                    creds:
                        state.creds,
                    keys:
                        makeCacheableSignalKeyStore(
                            state.keys,
                            pino({
                                level:
                                    "fatal"
                            })
                        )
                },
                logger:
                    pino({
                        level:
                            "fatal"
                    }),
                printQRInTerminal:
                    false,
                browser:
                    Browsers.macOS(
                        "Safari"
                    )
            });

        sock.ev.on(
            "creds.update",
            async () => {
                try {
                    await saveCreds();
                    scheduleSync();
                } catch (error) {
                    console.error(
                        "Credentials save error:",
                        error.message
                    );
                }
            }
        );

        sock.ev.on(
            "connection.update",
            async (
                update
            ) => {
                const {
                    connection,
                    lastDisconnect
                } = update;

                if (
                    connection ===
                    "open"
                ) {
                    reconnectAttempts =
                        0;

                    console.log(
                        "╔════════════════════════════╗"
                    );
                    console.log(
                        "║  MRNOBODY MD BOT ONLINE    ║"
                    );
                    console.log(
                        "╚════════════════════════════╝"
                    );

                    await syncSession();
                }

                if (
                    connection ===
                    "close"
                ) {
                    if (
                        shuttingDown
                    ) {
                        return;
                    }

                    clearTimeout(
                        reconnectTimer
                    );

                    const statusCode =
                        lastDisconnect
                            ?.error
                            ?.output
                            ?.statusCode;

                    if (
                        statusCode ===
                        DisconnectReason.loggedOut
                    ) {
                        console.log(
                            "❌ WhatsApp session logged out."
                        );

                        process.exit(
                            1
                        );
                    }

                    console.log(
                        "🔄 Reconnecting..."
                    );

                    reconnectAttempts++;

                    const reconnectDelay =
                        Math.min(
                            5000 *
                                reconnectAttempts,
                            60000
                        );

                    console.log(
                        `🔄 Reconnecting in ${Math.ceil(
                            reconnectDelay /
                                1000
                        )} seconds...`
                    );

                    reconnectTimer =
                        setTimeout(
                            () => {
                                startBot().catch(
                                    (error) => {
                                        console.error(
                                            "Reconnect startup error:",
                                            error.message
                                        );
                                    }
                                );
                            },
                            reconnectDelay
                        );
                }
            }
        );

        sock.ev.on(
            "messages.upsert",
            async ({
                messages
            }) => {
                for (
                    const msg of messages
                ) {
                    enqueueMessage(
                        msg,
                        sock
                    );
                }
            }
        );
    } catch (error) {
        console.error(
            "Bot startup error:",
            error
        );

        if (shuttingDown) {
            return;
        }

        clearTimeout(
            startupRetryTimer
        );

        startupRetryTimer =
            setTimeout(
                () => {
                    startBot().catch(
                        (retryError) => {
                            console.error(
                                "Startup retry error:",
                                retryError.message
                            );
                        }
                    );
                },
                5000
            );
    }
}

async function gracefulShutdown(
    signal
) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    console.log(
        `🛑 ${signal} received. Shutting down gracefully...`
    );

    clearTimeout(
        syncTimer
    );
    clearTimeout(
        reconnectTimer
    );
    clearTimeout(
        startupRetryTimer
    );
    clearInterval(
        rateLimitCleanupTimer
    );

    try {
        await waitForQueueToFinish();

        await syncSession();
    } catch (error) {
        console.error(
            "Graceful shutdown error:",
            error.message
        );
    }

    process.exit(0);
}

process.on(
    "SIGTERM",
    () => {
        gracefulShutdown(
            "SIGTERM"
        );
    }
);

process.on(
    "SIGINT",
    () => {
        gracefulShutdown(
            "SIGINT"
        );
    }
);

loadCommands();

startBot();
