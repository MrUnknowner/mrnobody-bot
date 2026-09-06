const PAIR_API_URL =
    "https://mrnobody-pair-production-9530.up.railway.app";

function getSessionId() {
    return process.env.SESSION_ID
        ?.replace("MrNobody~", "")
        .trim();
}

async function pairRequest(endpoint) {
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
                method: "GET",
                headers: {
                    "x-session-id": sessionId
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

async function getOwner(jid) {
    if (!jid) {
        return null;
    }

    const result = await pairRequest(
        `/owners/${encodeURIComponent(jid)}`
    );

    return result?.owner || null;
}

async function isOwnerOrAdmin(jid) {
    const owner = await getOwner(jid);

    if (!owner) {
        return false;
    }

    return (
        owner.is_active === true &&
        (
            owner.role === "owner" ||
            owner.role === "admin"
        )
    );
}

module.exports = {
    getOwner,
    isOwnerOrAdmin
};
