const fs = require("fs");
const path = require("path");

const BACKEND_URL =
    process.env.PAIR_API_URL ||
    "https://mrnobody-pair-production-627d.up.railway.app";

const AUTH_DIR = path.join(__dirname, "auth_info");

function getSessionId() {
    const raw = process.env.SESSION_ID || "";

    if (!raw) {
        throw new Error(
            "SESSION_ID environment variable is required"
        );
    }

    if (!raw.startsWith("MrNobody~")) {
        throw new Error(
            "Invalid SESSION_ID format"
        );
    }

    const id = raw.replace("MrNobody~", "").trim();

    if (!/^[a-f0-9]{16}$/i.test(id)) {
        throw new Error(
            "Invalid SESSION_ID value"
        );
    }

    return id;
}

async function pairRequest(endpoint, options = {}) {
    const id = getSessionId();

    const response = await fetch(
        `${BACKEND_URL}${endpoint}`,
        {
            ...options,
            headers: {
                ...(options.body
                    ? {
                        "Content-Type":
                            "application/json"
                    }
                    : {}),
                "x-session-id": id,
                ...(options.headers || {})
            }
        }
    );

    return response;
}

async function downloadSession() {
    const id = getSessionId();

    const response = await pairRequest(
        `/session/${id}`
    );

    if (!response.ok) {
        throw new Error(
            `Session download failed: ${response.status}`
        );
    }

    const data = await response.json();

    if (!data.success || !data.files) {
        throw new Error(
            "Invalid session response"
        );
    }

    if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(
            AUTH_DIR,
            { recursive: true }
        );
    }

    for (const [filename, encoded] of Object.entries(data.files)) {
        const safeName = path.basename(filename);

        if (safeName !== filename) {
            continue;
        }

        fs.writeFileSync(
            path.join(AUTH_DIR, safeName),
            Buffer.from(encoded, "base64")
        );
    }

    if (!fs.existsSync(
        path.join(AUTH_DIR, "creds.json")
    )) {
        throw new Error(
            "Session response does not contain creds.json"
        );
    }

    console.log(
        "✅ Full MRNOBODY session loaded"
    );
}

function hasLocalSession() {
    return fs.existsSync(
        path.join(AUTH_DIR, "creds.json")
    );
}

module.exports = {
    AUTH_DIR,
    downloadSession,
    hasLocalSession,
    getSessionId,
    pairRequest
};
