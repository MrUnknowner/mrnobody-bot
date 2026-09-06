
const selections = new Map();

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_SELECTIONS = 10000;

function keyFor(jid, commandName) {
    return `${jid}:${commandName}`;
}

function setSelection(
    jid,
    commandName,
    data,
    ttlMs = DEFAULT_TTL_MS
) {
    if (!jid || !commandName) {
        return;
    }

    if (selections.size >= MAX_SELECTIONS) {
        cleanupSelections(true);
    }

    const key = keyFor(jid, commandName);

    selections.set(key, {
        ...data,
        expiresAt: Date.now() + ttlMs
    });
}

function getSelection(jid, commandName) {
    const key = keyFor(jid, commandName);
    const item = selections.get(key);

    if (!item) {
        return null;
    }

    if (item.expiresAt <= Date.now()) {
        selections.delete(key);
        return null;
    }

    return item;
}

function consumeSelection(jid, commandName) {
    const item = getSelection(
        jid,
        commandName
    );

    if (!item) {
        return null;
    }

    selections.delete(
        keyFor(jid, commandName)
    );

    return item;
}

function deleteSelection(jid, commandName) {
    selections.delete(
        keyFor(jid, commandName)
    );
}

function cleanupSelections(force = false) {
    const now = Date.now();

    for (const [key, item] of selections) {
        if (force || item.expiresAt <= now) {
            selections.delete(key);
        }
    }
}

setInterval(
    () => cleanupSelections(),
    60 * 1000
).unref();

module.exports = {
    setSelection,
    getSelection,
    consumeSelection,
    deleteSelection
};
