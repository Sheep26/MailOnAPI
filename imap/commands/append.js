import { Command } from "./command.js";
import STATES from '../imapStates.js';
import crypto from 'node:crypto';

const accepted_headers = ["to", "from", "subject", "message-id", "content-type", "cc", "bcc", "reply-to", "in-reply-to", "mime-version"];

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

        if (this.recieved < this.literal)
            return;

        this.connection.removeListener(this.appendListenerBound);

        let data = {
            to: null,
            from: null,
            'reply-to': null,
            bcc: null,
            cc: null,
            'message-id': null,
            subject: null,
            'content-type': null,
            mail_id: crypto.randomBytes(8).readUInt32BE(),
            content: "",
            "in-reply-to": null,
            "mime-version": null
        };

        let content_started = false;

        for (let line of this.buffer) {
            if (!content_started) {
                const isEmptyLine = line === this.connection.newLine || line === "";

                if (isEmptyLine) {
                    content_started = true;

                    continue;
                }
            }

            if (content_started) {
                data.content += `${line}`;

                continue;
            }

            const separator = line.indexOf(":");

            if (separator === -1)
                continue;

            const header = line.slice(0, separator).trim().toLowerCase();
            const header_content = line.slice(separator + 1).trim();

            if (accepted_headers.includes(header))
                data[header] = header_content;
        }

        const contentTypeHeader = data['content-type'] ?? "text/plain";

        const [content_type, ...params] = contentTypeHeader.split(";").map(value => value.trim());
        const charset = params.find(param => param.toLowerCase().startsWith("charset="))?.slice("charset=".length).trim() ?? null ?? "utf-8";
        const boundary = params.find(param => param.toLowerCase().startsWith("boundary="))?.slice("boundary=".length).trim().replace(/["']/g, '') ?? null;

        const bcc = data.bcc?.split(',').map(value => value.trim()) ?? [];
        const cc = data.cc?.split(',').map(value => value.trim()) ?? [];

        const to = data.to.split(',').map(x => x.trim()) ?? [];
        const reply_to = (data['reply-to'] ?? data.from).split(",").map(x => x.trim()) ?? [];

        this.database.addEmail(this.connection.user.email, to, data.from, reply_to, bcc, cc, data.mail_id, data['message-id'], null, data.subject, data.content, null, null, this.mailbox.uid, this.flags, data['in-reply-to'], data['mime-version'], charset, content_type, null, boundary);
        this.connection.send(`${this.tag} OK APPEND completed`);
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