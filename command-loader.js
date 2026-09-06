
const fs = require("fs");
const path = require("path");

const commands = new Map();

const COMMANDS_DIR = path.join(
    __dirname,
    "commands"
);

function loadCommands() {
    commands.clear();

    if (!fs.existsSync(COMMANDS_DIR)) {
        fs.mkdirSync(
            COMMANDS_DIR,
            { recursive: true }
        );
    }

    const files = fs.readdirSync(
        COMMANDS_DIR
    );

    for (const file of files) {
        if (!file.endsWith(".js")) {
            continue;
        }

        const filePath = path.join(
            COMMANDS_DIR,
            file
        );

        try {
            delete require.cache[
                require.resolve(filePath)
            ];

            const command = require(filePath);

            if (
                !command.name ||
                typeof command.execute !== "function"
            ) {
                console.log(
                    `⚠️ Invalid command file: ${file}`
                );

                continue;
            }

            const name =
                command.name.toLowerCase();

            commands.set(
                name,
                command
            );

            if (Array.isArray(command.aliases)) {
                for (const alias of command.aliases) {
                    if (
                        typeof alias !== "string" ||
                        !alias.trim()
                    ) {
                        continue;
                    }

                    commands.set(
                        alias.toLowerCase(),
                        command
                    );
                }
            }

            console.log(
                `✅ Command loaded: .${command.name}`
            );
        } catch (error) {
            console.error(
                `❌ Failed to load command ${file}:`,
                error.message
            );
        }
    }
}

function getCommand(name) {
    if (!name) {
        return null;
    }

    return commands.get(
        name.toLowerCase()
    );
}

function getCommands() {
    return Array.from(
        new Set(commands.values())
    );
}

module.exports = {
    loadCommands,
    getCommand,
    getCommands
};
