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

    capitalizeFlag(str) {
        if (!str) return str;
        return `\\${str.charAt(1).toUpperCase()}${str.slice(2).toLowerCase()}`;
    }

    createRawHeaders(email) {
        let message = "";

        message += `From: ${email.mail_from}\r\n`;
        message += `To: ${email.mail_to.join(",")}\r\n`;

        if (email.reply_to)
            message += `Reply-To: ${email.reply_to.join(",")}\r\n`;

        if (email.cc && email.cc.length)
            message += `Cc: ${email.cc.join(", ")}\r\n`;

        if (email.bcc && email.bcc.length)
            message += `Bcc: ${email.bcc.join(", ")}\r\n`;

        message += `Subject: ${email.subject}\r\n`;

        if (email.message_id)
            message += `Message-ID: ${email.message_id}\r\n`;

        message += `Date: ${new Date(Number(email.time)).toUTCString()}\r\n`;

        if (email.priority)
            message += `Priority: ${email.priority}\r\n`;

        if (email.x_priority)
            message += `X-Priority: ${email.x_priority}\r\n`;

        if (email.email_references)
            message += `References: ${email.email_references}\r\n`;

        if (email.in_reply_to)
            message += `In-Reply-To: ${email.in_reply_to}\r\n`;

        if (email.received)
            message += `Received: ${email.received}\r\n`;

        message += `MIME-Version: ${email.mime_version}\r\n`;
        message += `Content-Type: ${email.content_type}; charset=${email.charset ?? 'utf-8'}${email.content_type.startsWith("multipart") ? `; boundary="${email.boundary}"` : ''}\r\n`;
        message += `Content-Transfer-Encoding: ${email.charset == 'utf-7' ? '7bit' : '8bit'}\r\n`;

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

        if (!email.content_type?.startsWith("multipart"))
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
            body += `Content-Transfer-Encoding: ${email.charset == "utf-7" ? '7bit' : '8bit'}\r\n`
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

    async createBodyStructure(email) {
        const quote = value => `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

        const parseHeaders = raw => {
            const headers = {};

            for (const line of raw.split(/\r?\n/)) {
                const index = line.indexOf(":");

                if (index === -1)
                    continue;

                headers[line.slice(0, index).toLowerCase()] = line.slice(index + 1).trim();
            }

            return headers;
        };

        const parsePart = (raw, attachment = null) => {
            const separator = raw.search(/\r?\n\r?\n/);

            const headerText = separator === -1 ? "" : raw.slice(0, separator);
            const content = separator === -1 ? raw : raw.slice(separator + (raw.slice(separator).startsWith("\r\n\r\n") ? 4 : 2));

            const headers = parseHeaders(headerText);
            const contentType = headers["content-type"] || attachment?.content_type || "text/plain";
            const [type = "text", subtype = "plain"] = contentType.split(";")[0].trim().split("/");

            const params = [];
            const charset = contentType.match(/charset\s*=\s*"?([^";\s]+)/i);
            const filename = attachment?.filename;

            if (charset)
                params.push(`"CHARSET" ${quote(charset[1])}`);

            if (filename)
                params.push(`"NAME" ${quote(filename)}`);

            const parameters = params.length ? `(${params.join(" ")})` : "NIL";
            const encoding = headers["content-transfer-encoding"] || (attachment ? "base64" : "8bit");

            let size = Buffer.byteLength(content.replace(/\r?\n$/, ""), "utf8");

            if (attachment && !content.trim()) {
                const base64Length = 4 * Math.ceil((attachment.size || 0) / 3);
                size = base64Length + 2 * Math.ceil(base64Length / 76);
            }

            const disposition = headers["content-disposition"] || (attachment ? `attachment; filename="${filename}"` : "");

            let extension = "";

            if (disposition) {
                const [kind, ...attrs] = disposition.split(";");
                const dispositionParams = attrs.map(attr => {
                    const [key, ...value] = attr.trim().split("=");
                    return `"${key.toUpperCase()}" ${quote(value.join("=").replace(/^"|"$/g, ""))}`;
                });

                extension += ` (${quote(kind.trim().toUpperCase())} ${dispositionParams.length ? `(${dispositionParams.join(" ")})` : "NIL"})`;
            } else
                extension += " NIL";

            if (type.toLowerCase() === "text") {
                const lines = (content.match(/\r\n|\n|\r/g) || []).length;

                return `(${quote(type.toUpperCase())} ${quote(subtype.toUpperCase())} ${parameters} NIL NIL ${quote(encoding.toUpperCase())} ${size} ${lines}${extension})`;
            }

            return `(${quote(type.toUpperCase())} ${quote(subtype.toUpperCase())} ${parameters} NIL NIL ${quote(encoding.toUpperCase())} ${size}${extension})`;
        };

        const contentType = email.content_type || "text/plain";

        if (!contentType.toLowerCase().startsWith("multipart/"))
            return parsePart(email.content ?? "");

        const boundary = email.boundary;

        if (!boundary)
            return parsePart(email.content ?? "");

        const body = await this.createMessageBody(email, true);
        const sections = body.split(`--${boundary}`).slice(1).filter(section => !section.trim().startsWith("--")).map(section => section.replace(/^\r?\n/, "").replace(/\r?\n$/, ""));

        const parts = sections.map((section, index) => {
            const attachment = email.attachments?.[index - 1] ?? null;
            return parsePart(section, attachment);
        });

        const subtype = contentType.split("/")[1].split(";")[0].trim().toUpperCase();
        return `(${parts.join(" ")} ${quote(subtype)} ("BOUNDARY" ${quote(boundary)}) NIL NIL)`;
    }

    randStr(len) {
        return crypto.randomBytes(len).toString('base64url').slice(0, len);
    }
}