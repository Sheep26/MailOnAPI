import { Command } from "./command.js";
import { parseEmailAddress } from "../../email/email.js";
import STATES from '../imapStates.js';
import crypto from 'node:crypto';

const accepted_headers = ["to", "from", "subject", "message-id", "content-type", "cc", "bcc", "reply-to"];

export class AppendCommand extends Command {
    command = async (tag, args) => {
        if (this.connection.state == STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} NO Please Authenticate First`);

        if (args[0].length < 2)
            return this.connection.send(`${tag} BAD APPEND Requires at least 2 args.`);

        const info = this.getInfo(args);

        this.mailbox = await this.database.getMailBox(this.connection.user.email, info[0]);
        this.flags = info[1] ?? [];
        this.date = info[2];
        this.literal = info[3];

        this.tag = tag;

        if (!this.mailbox || !this.literal)
            return this.connection.send(`${tag} BAD APPEND ${this.mailbox ? "" : "mail box "}${this.literal ? "" : "literal "}Invalid.`);

        this.buffer = [];
        this.recieved = 0;
        this.appendListenerBound = this.appendListener.bind(this);
        
        this.connection.addListener(this.appendListenerBound);
        this.connection.send(`+ Ready for literal data`);
    };

    async appendListener(line, next) {
        this.buffer.push(line);
        this.recieved += Buffer.byteLength(line, "utf8");

        if (this.recieved >= this.literal) {
            this.connection.removeListener(this.appendListenerBound);
            let data = {to: null, from: null, 'reply-to': null, bcc: null, cc: null, 'message-id': null, subject: null, 'content-type': null, mail_id: crypto.randomBytes(8).readUInt32BE(), content: ""};

            for (let line of this.buffer) {
                if (line == this.connection.newLine && !this.content_started) {
                    this.content_started = true;

                    continue;
                }

                if (this.content_started) {
                    data.content += `${line}`;

                    continue;
                }

                const split = line.split(": ");

                const header = split[0].toLowerCase();
                const header_content = split[1];

                if (accepted_headers.includes(header))
                    data[header] = header_content;
            }

            console.log(data.content)

            this.database.addEmail(this.connection.user.email, data.to, data.from, data.from, data.bcc ?? [], data.cc ?? [], data.mail_id, data['message-id'], data['content-type'], data.subject, data.content, null, null, this.mailbox.uid, this.flags);
            this.connection.send(`${this.tag} OK APPEND completed`);
        }
    }

    getInfo(args) {
        const mailbox = args[0];
        let flags = null;
        let date = null;
        let literal = null;

        for (let arg of args) {
            if (arg === mailbox)
                continue;

            if (Array.isArray(arg)) {
                flags = arg;

                continue;
            }

            if (arg.startsWith('{') && arg.endsWith('}')) {
                try {
                    literal = Number(arg.replace("{", "").replace("}", ""));
                } catch (e) {
                    literal = null;
                }

                continue;
            }

            date = arg;
        }

        return [mailbox, flags, date, literal];
    }
}