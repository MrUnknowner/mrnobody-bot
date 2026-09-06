
const DEFAULT_TIMEOUT_MS = 90 * 1000;

function getProviderUrl(commandName) {
    const envName = `${commandName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "_")}_API_URL`;

    return process.env[envName] || "";
}

function getProviderKey(commandName) {
    const envName = `${commandName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "_")}_API_KEY`;

    return process.env[envName] || "";
}

function assertHttpUrl(value, label) {
    if (!value) {
        throw new Error(
            `${label} is not configured`
        );
    }

    let url;

    try {
        url = new URL(value);
    } catch {
        throw new Error(
            `${label} must be a valid URL`
        );
    }

    if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
    ) {
        throw new Error(
            `${label} must use HTTP or HTTPS`
        );
    }

    return url.toString();
}

async function requestMedia(
    commandName,
    payload,
    signal
) {
    const baseUrl = assertHttpUrl(
        getProviderUrl(commandName),
        `${commandName.toUpperCase()}_API_URL`
    );

    const apiKey =
        getProviderKey(commandName);

    const controller =
        new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        Number(
            process.env.MEDIA_API_TIMEOUT_MS ||
            DEFAULT_TIMEOUT_MS
        )
    );

    const abortHandler = () => {
        controller.abort();
    };

    if (signal) {
        if (signal.aborted) {
            clearTimeout(timeout);
            throw new Error(
                "Media request was aborted"
            );
        }

        signal.addEventListener(
            "abort",
            abortHandler,
            { once: true }
        );
    }

    try {
        const headers = {
            "Content-Type":
                "application/json",
            "Accept":
                "application/json"
        };

        if (apiKey) {
            headers.Authorization =
                `Bearer ${apiKey}`;
        }

        const response = await fetch(
            baseUrl,
            {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal
            }
        );

        const raw =
            await response.text();

        let data;

        try {
            data = JSON.parse(raw);
        } catch {
            throw new Error(
                "Media API returned invalid JSON"
            );
        }

        if (!response.ok) {
            throw new Error(
                data?.message ||
                data?.error ||
                `Media API error: ${response.status}`
            );
        }

        return normalizeMediaResult(
            data
        );
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error(
                "Media API request timed out or was aborted"
            );
        }

        throw error;
    } finally {
        clearTimeout(timeout);

        if (signal) {
            signal.removeEventListener(
                "abort",
                abortHandler
            );
        }
    }
}

function normalizeMediaResult(data) {
    const root =
        data?.result ||
        data?.data ||
        data;

    const url =
        root?.url ||
        root?.download_url ||
        root?.downloadUrl ||
        root?.media_url ||
        root?.mediaUrl ||
        root?.link ||
        null;

    const base64 =
        root?.base64 ||
        root?.data_base64 ||
        null;

    if (!url && !base64) {
        throw new Error(
            "Media API response does not contain a downloadable URL or base64 media"
        );
    }

    return {
        url,
        base64,
        title:
            root?.title ||
            root?.name ||
            "MRNOBODY MD",
        fileName:
            root?.fileName ||
            root?.filename ||
            root?.file_name ||
            null,
        mimeType:
            root?.mimeType ||
            root?.mimetype ||
            root?.mime ||
            null,
        size:
            root?.size ||
            null,
        caption:
            root?.caption ||
            null
    };
}

function mediaToMessageContent(
    result,
    type
) {
    if (result.base64) {
        const buffer =
            Buffer.from(
                result.base64,
                "base64"
            );

        if (type === "document") {
            return {
                document: buffer,
                mimetype:
                    result.mimeType ||
                    "application/octet-stream",
                fileName:
                    result.fileName ||
                    `${result.title}.bin`
            };
        }

        if (type === "audio") {
            return {
                audio: buffer,
                mimetype:
                    result.mimeType ||
                    "audio/mpeg",
                ptt: false
            };
        }

        if (type === "voice") {
            return {
                audio: buffer,
                mimetype:
                    result.mimeType ||
                    "audio/ogg; codecs=opus",
                ptt: true
            };
        }

        if (type === "video") {
            return {
                video: buffer,
                mimetype:
                    result.mimeType ||
                    "video/mp4"
            };
        }
    }

    if (!result.url) {
        throw new Error(
            "No downloadable media URL returned"
        );
    }

    if (type === "document") {
        return {
            document: {
                url: result.url
            },
            mimetype:
                result.mimeType ||
                "application/octet-stream",
            fileName:
                result.fileName ||
                `${result.title}.bin`
        };
    }

    if (type === "audio") {
        return {
            audio: {
                url: result.url
            },
            mimetype:
                result.mimeType ||
                "audio/mpeg",
            ptt: false
        };
    }

    if (type === "voice") {
        return {
            audio: {
                url: result.url
            },
            mimetype:
                result.mimeType ||
                "audio/ogg; codecs=opus",
            ptt: true
        };
    }

    if (type === "video") {
        return {
            video: {
                url: result.url
            },
            mimetype:
                result.mimeType ||
                "video/mp4"
        };
    }

    throw new Error(
        `Unsupported media output type: ${type}`
    );
}

async function sendMedia(
    sock,
    jid,
    result,
    type,
    caption = ""
) {
    const content =
        mediaToMessageContent(
            result,
            type
        );

    if (caption) {
        content.caption = caption;
    }

    await sock.sendMessage(
        jid,
        content
    );
}

module.exports = {
    requestMedia,
    sendMedia
};
