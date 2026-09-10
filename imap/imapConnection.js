import declarations from "./commands/declarations.js";
import config from "../config.json" with { type: "json" };
import crypto from 'node:crypto';
import STATES from './imapStates.js';

export class ImapConnection {
    constructor(socket, database) {
        this.socket = socket;
        this.database = database;

        this.buffer = "";
        this.state = STATES.NOT_AUTHENTICATED;

        this.user = null;
        this.mailbox = null;

        this.commands = declarations(this.database, this);
        this.newLine = "\r\n";
    }

    start() {
        this.send(`* OK ${config.imapGreetings[crypto.randomInt(0, config.imapGreetings.length)]}`);

        this.socket.on("data", (data) => {
            this.buffer += data.toString();

            this.processBuffer();
        });

        this.socket.on("error", (error) => {
            console.error("IMAP socket error:", error);
        });
    }

    processBuffer() {
        let newLine;

        while ((newLine = this.buffer.indexOf(this.newLine)) != -1) {
            const line = this.buffer.slice(0, newLine);

            this.buffer = this.buffer.slice(newLine + this.newLine.length);

            if (line.length === 0)
                continue;

            this.handleCommand(line);
        }
    }

    parseCommand(line) {
        const parts = [];
        let current = "";
        let quoted = false;
        let escaped = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (escaped) {
                current += char;
                escaped = false;
                continue;
            }

            if (char === "\\" && quoted) {
                escaped = true;
                current += char;
                continue;
            }

            if (char === '"') {
                quoted = !quoted;
                continue;
            }

            if (!quoted && /\s/.test(char)) {
                if (current.length > 0) {
                    parts.push(current);
                    current = "";
                }

                continue;
            }

            current += char;
        }

        if (current.length > 0)
            parts.push(current);

        if (parts.length < 2)
            return null;

        return parts;
    }

    async handleCommand(line) {
        console.log("C:", line);

        const parts = this.parseCommand(line);

        if (!parts)
            return;

        let tag = parts[0];
        let command = parts[1]?.toUpperCase();
        let args = parts.slice(2);

        let options = {
            uid: false
        };

        if (command === "UID") {
            options.uid = true;

            command = args.shift()?.toUpperCase();
        }

        try {
            const handler = this.commands[command];

            if (!handler)
                return this.send(`${tag} BAD Unknown command`);

            await handler(tag, args, options);
        } catch (error) {
            console.error("IMAP command error:", error);

            this.send(`${tag} NO Internal server error`);
        }
    }

    send(message) {
        console.log("S:", message);
        this.socket.write(message + "\r\n");
    }

    sendRaw(message) {
        console.log("S:", message);
        this.socket.write(message);
    }
}