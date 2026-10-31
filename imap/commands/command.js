import crypto from 'node:crypto';
import config from "../../config.json" with { type: "json" };

export class Command {
    constructor (database, connection) {
        this.database = database;
        this.connection = connection;
    }

    command = () => {};

    selectEmails(mailboxEmails, sequence, uid) {
        if (!sequence)
            return [];

        const selectedEmails = new Set();

        for (const part of sequence.split(",")) {
            const range = part.trim();

            if (!range)
                continue;

            if (range.includes(":")) {
                const [startValue, endValue] =
                    range.split(":");

                const start = this.resolveSequenceValue(startValue, mailboxEmails, uid);

                const end = this.resolveSequenceValue(endValue, mailboxEmails, uid);

                if (start === null || end === null)
                    continue;

                const lower = Math.min(start, end);
                const upper = Math.max(start, end);

                for (let i = 0; i < mailboxEmails.length; i++) {
                    const email = mailboxEmails[i];

                    const value = uid ? email.uid : i + 1;

                    if (value >= lower && value <= upper)
                        selectedEmails.add(email);
                }
            } else {
                const value = this.resolveSequenceValue(range, mailboxEmails, uid);

                if (value === null)
                    continue;

                if (uid) {
                    const email = mailboxEmails.find(email => email.uid === value);

                    if (email)
                        selectedEmails.add(email);
                } else {
                    const index = value - 1;

                    if (index >= 0 && index < mailboxEmails.length)
                        selectedEmails.add(mailboxEmails[index]);
                }
            }
        }

        return mailboxEmails.filter(email => selectedEmails.has(email));
    }

    resolveSequenceValue(value, mailboxEmails, uid) {
        value = value.trim();

        if (value === "*") {
            if (mailboxEmails.length === 0)
                return null;

            if (uid)
                return mailboxEmails[mailboxEmails.length - 1].uid;

            return mailboxEmails.length;
        }

        const number = Number(value);

        if (!Number.isInteger(number) || number < 1)
            return null;

        return number;
    }

    flattenArgs(args) {
        const result = [];
        const flatten = (value, depth = 0) => {
            for (const item of value)
                if (Array.isArray(item)) {
                    if (depth > 0)
                        result.push("(");

                    flatten(item, depth + 1);

                    if (depth > 0)
                        result.push(")");
                } else
                    result.push(item);
        };

        flatten(args);
        return result;
    }

    hasFlag(email, flag) {
        return email.flags.map(x => this.capitalizeFlag(x)).includes(this.capitalizeFlag(flag));
    }

    capitalize(str) {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    capitalizeSeparated(str) {
        if (!str) return str;
        return str.split('-').map(part => this.capitalize(part)).join('-');
    }

    capitalizeFlag(str) {
        if (!str) return str;
        return `\\${str.charAt(1).toUpperCase()}${str.slice(2).toLowerCase()}`;
    }

    getContentTransferEncoding(email) {
        const charset = email.charset ?? 'utf-8';

        for (const [encoding, charsets] of Object.entries(config.encodings))
            if (charsets.includes(charset.toLowerCase()))
                return encoding;

        return "quoted-printable";
    }

    checkInHeaders(message, header) {
        if (!header || header === "")
            return false;

        return message.split('\r\n').some(line => line.trim().toLowerCase().startsWith(header.trim().toLowerCase()));
    }

    createRawHeaders(email) {
        let message = "";

        for (let [key, value] of Object.entries(email.headers))
            message += `${this.capitalizeSeparated(key)}: ${value}\r\n`;

        if (!this.checkInHeaders(message, 'from'))
            message += `From: ${email.mail_from}\r\n`;

        if (!this.checkInHeaders(message, 'to'))
            message += `To: ${email.mail_to.join(",")}\r\n`;

        if (!this.checkInHeaders(message, 'reply-to') && email.reply_to)
            message += `Reply-To: ${email.reply_to.join(",")}\r\n`;

        if (!this.checkInHeaders(message, 'cc') && email.cc && email.cc.length)
            message += `Cc: ${email.cc.join(", ")}\r\n`;

        if (!this.checkInHeaders(message, 'bcc') && email.bcc && email.bcc.length)
            message += `Bcc: ${email.bcc.join(", ")}\r\n`;

        if (!this.checkInHeaders(message, 'subject'))
            message += `Subject: ${email.subject}\r\n`;

        if (!this.checkInHeaders(message, 'message-id') && email.message_id)
            message += `Message-ID: ${email.message_id}\r\n`;

        if (!this.checkInHeaders(message, 'date'))
            message += `Date: ${new Date(Number(email.time)).toUTCString()}\r\n`;

        if (!this.checkInHeaders(message, 'priority') && email.priority)
            message += `Priority: ${email.priority}\r\n`;

        if (!this.checkInHeaders(message, 'references') && email.email_references)
            message += `References: ${email.email_references}\r\n`;

        if (!this.checkInHeaders(message, 'in-reply-to') && email.in_reply_to)
            message += `In-Reply-To: ${email.in_reply_to}\r\n`;

        if (!this.checkInHeaders(message, 'received') && email.received)
            message += `Received: ${email.received}\r\n`;

        if (!this.checkInHeaders(message, 'received'))
            message += `MIME-Version: ${email.mime_version}\r\n`;

        if(!this.checkInHeaders(message, 'received'))
            message += `Content-Type: ${email.content_type}; charset=${email.charset ?? 'utf-8'}${email.content_type.startsWith("multipart") ? `; boundary="${email.boundary}"` : ''}\r\n`;

        if(!this.checkInHeaders(message, 'received'))
            message += `Content-Transfer-Encoding: ${this.getContentTransferEncoding(email)}\r\n`;

        return message;
    }

    async getAttachmentAsBase64(email, attachment) {
        const { data, error, path } = await this.connection.attachments.getAttatchment(email.mail_id, attachment.id);

        if (error)
            return error.toString('base64');

        return data.toString('base64');
    }

    async createMessageBody(email, skip_attachments_content=false) {
        const content = email.content ?? "";

        if (!email.content_type?.startsWith("multipart") && email.attachments?.length === 0)
            return content;

        let body = `${content}\r\n`;

        /*
        [{"id": "a4725d19-3628-43e3-917c-ee2eebe9d5e4", "size": 3879, "filename": "Screenshot_20260820_101002.png",
        "content_id": "<ii_muuvphhg0>", "content_type": "image/png",
        "content_disposition": "inline"},
        {"id": "7a7fc67b-8a6e-48d1-89f1-be8e50d60ace", "size": 4045216,
        "filename": "Composition 2 - FINAL.mp3", "content_id": "<f_muuvpkn01>",
        "content_type": "audio/mpeg", "content_disposition": "attachment"}]
        */

        if (!body.trim().startsWith(`--${email.boundary}`) && !body.trim().toLowerCase().replaceAll('-', '').startsWith(`this is a multipart message in mime format.`)) {
            body = `--${email.boundary}\r\n`;
            body += `Content-Type: text/html; charset=${email.charset ?? 'utf-8'}\r\n`;
            body += `Content-Transfer-Encoding: ${this.getContentTransferEncoding(email)}\r\n`
            body += `\r\n${content}\r\n`;
        }

        for (let attachment of email.attachments ?? []) {
            body += `--${email.boundary}\r\n`;
            body += `Content-Type: ${attachment.content_type || "application/octet-stream"}\r\n`;
            body += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
            body += `Content-Transfer-Encoding: base64\r\n`;
            body += `\r\n`;

            if (!skip_attachments_content)
                body += `${await this.getAttachmentAsBase64(email, attachment)}\r\n`;
        }

        if (!body.trim().endsWith(`--${email.boundary}--`))
            body += `--${email.boundary}--`;

        return body;
    }

    async createRawEmail(email, skip_attachments_content=false) {
        const headers  = this.createRawHeaders(email);

        return `${headers}\r\n${await this.createMessageBody(email, skip_attachments_content)}`;
    }

    randStr(len) {
        return crypto.randomBytes(len).toString('base64url').slice(0, len);
    }
}