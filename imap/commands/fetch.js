import { Command } from "./command.js";
import STATES from "../imapStates.js";

export class FetchCommand extends Command {
    command = async (tag, args, options = {}) => {
        const uid = options.uid ?? false;

        if (this.connection.state == STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} NO Please Authenticate First`);

        if (this.connection.state != STATES.SELECTED)
            return this.connection.send(`${tag} NO Select a mailbox first`);

        if (args.length < 2)
            return this.connection.send(`${tag} BAD FETCH requires sequence and data`);

        const sequence = args[0];
        const dataItem = this.flattenArgs(args.slice(1)).join(" ");
        const emails = await this.database.getUsersEmails(this.connection.user.email);

        const mailboxEmails = emails.filter(email => email.mail_box === this.connection.mailbox.uid).sort((a, b) => a.uid - b.uid);
        const selectedEmails = this.selectEmails(mailboxEmails, sequence, uid);

        for (const email of selectedEmails) {
            const sequenceNumber = mailboxEmails.indexOf(email) + 1;

            const responseParts = [];
            const bodyMatch = dataItem.match(/BODY(?:\.PEEK)?\[((?:\d+|\d+\.\d+)|TEXT|HEADER|HEADER\.FIELDS|HEADER\.FIELDS\.NOT|)(?:\s*\(\s*([^)]*?)\s*\)\s*)?\](?:<(\d+)(?:\.(\d+))?>)?/i);

            if (uid || /\bUID\b/i.test(dataItem))
                responseParts.push(`UID ${email.uid}`);

            if (/\bFLAGS\b/i.test(dataItem)) {
                const flags = Array.isArray(email.flags) ? email.flags.join(" ") : "";

                responseParts.push(`FLAGS (${flags})`);
            }

            if (/\bRFC822\.SIZE\b/i.test(dataItem)) {
                const raw = await this.createRawEmail(email, true);
                let size = Buffer.byteLength(raw, "utf8");

                for (const attachment of email.attachments ?? [])
                    size += 4 * Math.ceil(attachment.size / 3);

                responseParts.push(`RFC822.SIZE ${size}`);
            }

            if (bodyMatch) {
                const req = bodyMatch[1];

                if (req == "") {
                    const raw = await this.createRawEmail(email);
                    const size = Buffer.byteLength(raw, "utf8");

                    responseParts.push({type: "literal", name: "BODY[]", data: raw, size});
                } else if (req == "TEXT") {
                    const raw = await this.createMessageBody(email);

                    const hasPartial = bodyMatch[3] !== undefined;
                    const start = hasPartial ? Number(bodyMatch[3]) : 0;

                    const requestedLength = bodyMatch[3] !== undefined ? Number(bodyMatch[4]) : raw.length - start;
                    const text = raw.slice(start, start + requestedLength);
                    const size = Buffer.byteLength(text, "utf8");

                    responseParts.push({type: "literal", name: hasPartial ? `BODY[TEXT]<${start}>` : "BODY[TEXT]", data: text, size});
                } else if (req == "HEADER") {
                    const headers = this.createRawHeaders(email);
                    const hasPartial = bodyMatch[4] !== undefined;
                    const start = hasPartial ? Number(bodyMatch[3]) : 0;

                    const requestedLength = bodyMatch[3] !== undefined ? Number(bodyMatch[4]) : Buffer.byteLength(headers, "utf8") - start;
                    const text = Buffer.from(headers, "utf8").subarray(start, start + requestedLength).toString("utf8");
                    const size = Buffer.byteLength(text, "utf8");

                    responseParts.push({type: "literal", name: hasPartial ? `BODY[HEADER]<${start}>` : "BODY[HEADER]", data: text, size});
                } else if (req == "HEADER.FIELDS") {
                    const requestedHeaders = bodyMatch[2].split(/\s+/).filter(Boolean);
                    const headers = this.createRequestedHeaders(email, requestedHeaders);
                    const size = Buffer.byteLength(headers, "utf8");

                    responseParts.push({type: "literal", name: `BODY[HEADER.FIELDS (${requestedHeaders.join(" ")})]`, data: headers, size});
                } else if (req == "HEADER.FIELDS.NOT") {
                    const requestedHeaders = bodyMatch[2].split(/\s+/).filter(Boolean);
                    const headers = this.createRawHeaders(email);
                    let out_headers = "";

                    for (let header of headers.split('\r\n'))
                        if (requestedHeaders.includes(header))
                            out_headers += `${header}\r\n`;

                    const size = Buffer.byteLength(header, "utf8");
                    responseParts.push({type: "literal", name: `BODY[HEADER.FIELDS.NOT (${requestedHeaders.join(" ")})]`, data: out_headers, size});
                } else if (/^\d+(?:\.\d+)*$/.test(req)) {
                    // Select body part.
                    const body = this.createRawEmail(email);

                    const parts = this.parseMimeParts(body, email.boundary);
                    const part = this.getMimeSection(parts, req);

                    if (part) {
                        const hasPartial = bodyMatch[3] !== undefined;
                        const start = hasPartial ? Number(bodyMatch[3]) : 0;

                        const content = part.content;
                        const text = hasPartial ? content.slice(start, start + Number(bodyMatch[4])) : content;

                        const size = Buffer.byteLength(text, "utf8");
                        responseParts.push({type: "literal", name: hasPartial ? `BODY[${req}]<${start}>` : `BODY[${req}]`, data: text, size});
                    }
                }
            }

            if (/\bRFC822\b/i.test(dataItem) && !/\bRFC822\.SIZE\b/i.test(dataItem)) {
                const raw = await this.createRawEmail(email);
                const size = Buffer.byteLength(raw, "utf8");

                responseParts.push({type: "literal", name: "RFC822", data: raw, size});
            }

            if (/\bINTERNALDATE\b/i.test(dataItem)) {
                const dateObj = new Date(Number(email.time));
                const day = String(dateObj.getUTCDate()).padStart(2, '0');
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const month = months[dateObj.getUTCMonth()];
                const year = dateObj.getUTCFullYear();
                const hours = String(dateObj.getUTCHours()).padStart(2, '0');
                const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
                const seconds = String(dateObj.getUTCSeconds()).padStart(2, '0');
                
                responseParts.push(`INTERNALDATE "${day}-${month}-${year} ${hours}:${minutes}:${seconds} +0000"`);
            }

            if (/\bENVELOPE\b/i.test(dataItem)) {
                const dateStr = new Date(Number(email.time)).toUTCString();
                const subject = email.subject ? `"${email.subject}"` : "NIL";
                const msgId = email.message_id ? `"${email.message_id}"` : "NIL";

                const parseAddress = (addrStr) => {
                    if (!addrStr) return "NIL";

                    const match = addrStr.match(/(?:"?([^"<]*)"?\s+)?<?([^@>]+)@([^>]+)>?/);
                    if (!match) return "NIL";

                    const name = match[1] ? `"${match[1]}"` : "NIL";
                    return `((${name} NIL "${match[2]}" "${match[3]}"))`;
                };

                const fromArr = parseAddress(email.mail_from);
                const toArr = parseAddress(email.mail_to);
                
                responseParts.push(`ENVELOPE ("${dateStr}" ${subject} ${fromArr} ${fromArr} ${fromArr} ${toArr} NIL NIL NIL ${msgId})`);
            }

            if (/\bBODYSTRUCTURE\b/i.test(dataItem)) {
                // TODO
            }

            this.connection.sendRaw(`* ${sequenceNumber} FETCH (`);

            const normalParts = responseParts.filter(part => typeof part === "string");
            const literalParts = responseParts.filter(part => part.type === "literal");
            let first = true;

            for (const part of normalParts) {
                if (!first)
                    this.connection.sendRaw(" ");

                this.connection.sendRaw(part);

                first = false;
            }

            for (const part of literalParts) {
                if (!first)
                    this.connection.sendRaw(" ");

                this.connection.sendRaw(`${part.name} {${part.size}}\r\n`);
                this.connection.sendRaw(part.data);

                first = false;
            }

            if (literalParts.length > 0)
                this.connection.sendRaw(" )\r\n");
            else
                this.connection.sendRaw(")\r\n");
        }

        this.connection.send(`${tag} OK FETCH completed`);
    };

    createRequestedHeaders(email, requestedHeaders) {
        let headers = "";

        for (const requestedHeader of requestedHeaders) {
            const header = requestedHeader.toLowerCase();

            if (header === "from")
                headers += `From: ${email.mail_from}\r\n`;

            else if (header === "to")
                headers += `To: ${email.mail_to.join(",")}\r\n`;

            else if (header === "cc" && email.cc && email.cc.length > 0)
                headers += `Cc: ${email.cc.join(", ")}\r\n`;

            else if (header === "bcc" && email.bcc && email.bcc.length > 0)
                    headers += `Bcc: ${email.bcc.join(", ")}\r\n`;

            else if (header === "subject" && email.subject)
                headers += `Subject: ${email.subject}\r\n`;

            else if (header === "date" && email.time)
                headers += `Date: ${new Date(Number(email.time)).toUTCString()}\r\n`;

            else if (header === "message-id" && email.message_id)
                    headers += `Message-ID: ${email.message_id}\r\n`;

            else if (header === "priority" && email.priority)
                headers += `Priority: ${email.priority}\r\n`;

            else if (header === "x-priority" && email.x_priority)
                headers += `X-Priority: ${email.x_priority}\r\n`;

            else if (header === "references" && email.email_references)
                headers += `References: ${email.email_references}\r\n`;

            else if (header === "in-reply-to" && email.in_reply_to)
                headers += `In-Reply-To: ${email.in_reply_to}\r\n`;

            else if (header === "content-type")
                headers += `Content-Type: ${email.content_type}; charset=${email.charset ?? 'utf-8'}\r\n`;

            else if (header === "content-transfer-encoding")
                headers += `Content-Transfer-Encoding: ${this.getContentTransferEncoding(email)}\r\n`;

            else if (header === "reply-to" && email.reply_to)
                headers += `Reply-To: ${email.reply_to}\r\n`;

            else if (header === "received" && email.received)
                headers += `Received: ${email.received}\r\n`;

            else if (header === "x-received" && email.x_received)
                headers += `X-Received: ${email.x_received}\r\n`;
        }

        return headers + "\r\n";
    }

    parseMimeParts(body, boundary) {
        if (!boundary)
            return [];

        const delimiter = `--${boundary}`;
        const sections = body.split(delimiter);

        const parts = [];

        for (let section of sections.slice(1)) {
            section = section.replace(/^\r?\n/, "");

            if (section.startsWith("--"))
                break;

            section = section.replace(/\r?\n$/, "");

            if (!section.trim())
                continue;

            const separator = section.indexOf("\r\n\r\n");
            const separatorLength = 4;

            if (separator === -1)
                continue;

            const rawHeaders = section.slice(0, separator);
            const content = section.slice(separator + separatorLength);

            const headers = {};

            for (const line of rawHeaders.split(/\r\n/)) {
                const index = line.indexOf(":");

                if (index === -1)
                    continue;

                headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
            }

            const contentType = headers["content-type"] ?? "text/plain";
            const childBoundary = contentType.match(/boundary="?([^";]+)"?/i)?.[1];

            parts.push({headers, content, contentType, boundary: childBoundary, parts: childBoundary ? this.parseMimeParts(content, childBoundary) : []});
        }

        return parts;
    }

    getMimeSection(parts, section) {
        const indexes = section.split(".").map(Number);

        let currentParts = parts;
        let current = null;

        for (const index of indexes) {
            if (index < 1 || index > currentParts.length)
                return null;

            current = currentParts[index - 1];
            currentParts = current.parts;
        }

        return current;
    }
}