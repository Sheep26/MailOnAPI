import getCommands from "./commands/commands.js";
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

        this.commands = getCommands(this.database, this);
        this.newLine = "\r\n";

        this.auth_tag = null;
        this.active = true;

        this.idle = false;
        this.idle_tag = null;
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
        const root = [];
        const stack = [root];

        let current = "";
        let quoted = false;
        let escaped = false;

        const pushCurrent = () => {
            if (current.length > 0) {
                stack[stack.length - 1].push(current);
                current = "";
            }
        };

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

            if (!quoted) {
                if (char === "(") {
                    pushCurrent();

                    const group = [];
                    stack[stack.length - 1].push(group);
                    stack.push(group);

                    continue;
                }

                if (char === ")") {
                    pushCurrent();

                    if (stack.length === 1)
                        return null;

                    stack.pop();
                    continue;
                }

                if (/\s/.test(char)) {
                    pushCurrent();

                    continue;
                }
            }

            current += char;
        }

        pushCurrent();

        if (stack.length !== 1 || quoted || escaped)
            return null;

        if (root.length < 2)
            return null;

        return root;
    }

    async handleCommand(line) {
        console.log("C:", line);

        if (this.state == STATES.AUTHENTICATING_PLAIN) {
            const authenication_parts = new TextDecoder().decode(Uint8Array.fromBase64(line)).split('\0');
            
            const email = authenication_parts[1];
            const password = authenication_parts[2];

            const session = await this.database.login(email, password);

            if (!session) {
                this.state = STATES.NOT_AUTHENTICATED;

                return this.send(`${this.auth_tag} NO Authentication failed`);
            }

            this.user = await this.database.getUser(email);
            this.state = STATES.AUTHENTICATED;

            this.send(`${this.auth_tag} OK AUTHENTICATE success`);
            this.auth_tag = null; // Free the couple bytes of memory.
            return;
        }

        if (line === "DONE" && this.idle) {
            this.idle = false;
            this.send(`${this.idle_tag} OK IDLE terminated`);

            this.idle_tag = null; // Free the couple bytes of memory.
            return;
        }

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