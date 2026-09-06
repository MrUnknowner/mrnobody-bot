const PAIR_API_URL =
    "https://mrnobody-pair-production-9530.up.railway.app";

function getSessionId() {
    return process.env.SESSION_ID
        ?.replace("MrNobody~", "")
        .trim();
}

async function pairRequest(
    endpoint,
    options = {}
) {
    const sessionId = getSessionId();

    if (!sessionId) {
        console.error(
            "PAIR API ERROR: SESSION_ID is missing."
        );

        return null;
    }

    if (!/^[a-f0-9]{16}$/i.test(sessionId)) {
        console.error(
            "PAIR API ERROR: Invalid SESSION_ID format."
        );

        return null;
    }

    try {
        const response = await fetch(
            `${PAIR_API_URL}${endpoint}`,
            {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    "x-session-id": sessionId,
                    ...(options.headers || {})
                }
            }
        );

        if (!response.ok) {
            const errorText =
                await response.text();

            console.error(
                `PAIR API ERROR [${response.status}]:`,
                errorText
            );

            return null;
        }

        return await response.json();
    } catch (error) {
        console.error(
            "PAIR API REQUEST ERROR:",
            error.message
        );

        return null;
    }
}

async function ensureUser(
    jid,
    name = null
) {
    if (!jid) {
        return null;
    }

    const result = await pairRequest(
        "/users/ensure",
        {
            method: "POST",
            body: JSON.stringify({
                jid,
                name
            })
        }
    );

    return result?.user || null;
}

async function getUser(jid) {
    if (!jid) {
        return null;
    }

    const result = await pairRequest(
        `/users/${encodeURIComponent(jid)}`
    );

    return result?.user || null;
}

async function banUser(
    jid,
    reason = "Banned by owner/admin"
) {
    if (!jid) {
        return false;
    }

    const result = await pairRequest(
        `/users/${encodeURIComponent(jid)}/ban`,
        {
            method: "POST",
            body: JSON.stringify({
                reason
            })
        }
    );

    return !!result?.success;
}

async function unbanUser(jid) {
    if (!jid) {
        return false;
    }

    const result = await pairRequest(
        `/users/${encodeURIComponent(jid)}/unban`,
        {
            method: "POST"
        }
    );

    return !!result?.success;
}

function isValidUserJid(jid) {
    if (
        !jid ||
        typeof jid !== "string"
    ) {
        return false;
    }

    return /^[^@\s]+@(s\.whatsapp\.net|lid)$/i.test(
        jid
    );
}

module.exports = {
    ensureUser,
    getUser,
    banUser,
    unbanUser,
    isValidUserJid
};
