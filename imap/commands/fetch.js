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
            const upperDataItem = dataItem.toUpperCase();

            if (uid || /\bUID\b/i.test(dataItem))
                responseParts.push(`UID ${email.uid}`);

            if (/\bFLAGS\b/i.test(dataItem)) {
                const flags = Array.isArray(email.flags) ? email.flags.join(" ") : "";

                responseParts.push(`FLAGS (${flags})`);
            }

            if (/\bRFC822\.SIZE\b/i.test(dataItem)) {
                const raw = this.createRawEmail(email);
                const size = Buffer.byteLength(raw, "utf8");

                responseParts.push(`RFC822.SIZE ${size}`);
            }

            const headerFieldsMatch = dataItem.match(/BODY(?:\.PEEK)?\[HEADER\.FIELDS\s*\(\s*([^)]*?)\s*\)\s*\]/i); // /BODY(?:\.PEEK)?\[HEADER\.FIELDS\s*\(([^)]*)\)\]/i

            if (headerFieldsMatch) {
                const requestedHeaders = headerFieldsMatch[1].split(/\s+/).filter(Boolean);
                const headers = this.createRequestedHeaders(email, requestedHeaders);
                const size = Buffer.byteLength(headers, "utf8");

                responseParts.push({type: "literal", name: `BODY[HEADER.FIELDS (${requestedHeaders.join(" ")})]`, data: headers, size});
            }

            const bodyTextMatch = dataItem.match(/BODY(?:\.PEEK)?\[TEXT\](?:<(\d+)(?:\.(\d+))?>)?/i);

            if (bodyTextMatch && !headerFieldsMatch) {
                const raw = email.content ?? "";
                const hasPartial = bodyTextMatch[1] !== undefined;
                const start = hasPartial ? Number(bodyTextMatch[1]) : 0;
                const requestedLength = bodyTextMatch[2] !== undefined ? Number(bodyTextMatch[2]) : raw.length - start;
                const text = raw.slice(start, start + requestedLength);
                const size = Buffer.byteLength(text, "utf8");

                responseParts.push({type: "literal", name: hasPartial ? `BODY[TEXT]<${start}>` : "BODY[TEXT]", data: text, size});
            }

            const wantsBody = /BODY(?:\.PEEK)?\[\]/i.test(dataItem);

            if (wantsBody) {
                const raw = this.createRawEmail(email);
                const size = Buffer.byteLength(raw, "utf8");

                responseParts.push({type: "literal", name: "BODY[]", data: raw, size});
            }

            if (/\bRFC822\b/i.test(dataItem) && !/\bRFC822\.SIZE\b/i.test(dataItem)) {
                const raw = this.createRawEmail(email);
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

            this.connection.sendRaw(")\r\n");
        }

        this.connection.send(`${tag} OK FETCH completed`);
    };

    createRequestedHeaders(email, requestedHeaders) {
        let headers = "";

        const cc = JSON.parse(email.cc);
        const bcc = JSON.parse(email.bcc);

        for (const requestedHeader of requestedHeaders) {
            const header = requestedHeader.toLowerCase();

            if (header === "from" && email.mail_from)
                headers += `From: ${email.mail_from}\r\n`;

            else if (header === "to" && email.mail_to)
                headers += `To: ${email.mail_to}\r\n`;

            else if (header === "cc" && cc && cc.length > 0)
                headers += `Cc: ${cc.join(", ")}\r\n`;

            else if (header === "bcc" && bcc && bcc.length > 0)
                    headers += `Bcc: ${bcc.join(", ")}\r\n`;

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

            else if (header === "newsgroups" && email.newsgroups)
                headers += `Newsgroups: ${email.newsgroups}\r\n`;

            else if (header === "in-reply-to" && email.in_reply_to)
                headers += `In-Reply-To: ${email.in_reply_to}\r\n`;

            else if (header === "content-type")
                headers += `Content-Type: ${email.content_type == "multipart/alternative" ? 'text/html' : email.content_type}; charset=utf-8\r\n`;

            else if (header === "content-transfer-encoding")
                headers += `Content-Transfer-Encoding: 8bit\r\n`;

            else if (header === "reply-to" && email.reply_to)
                headers += `Reply-To: ${email.reply_to}\r\n`;

            else if (header === "received" && email.received)
                headers += `Received: ${email.received}\r\n`;

            else if (header === "x-received" && email.x_received)
                headers += `Received: ${email.x_received}\r\n`;
        }

        return headers + "\r\n";
    }

    createRawEmail(email) {
        let message = "";

        const cc = JSON.parse(email.cc);
        const bcc = JSON.parse(email.bcc);

        message += `From: ${email.mail_from}\r\n`;
        message += `To: ${email.mail_to}\r\n`;

        if (email.reply_to)
            message += `Reply-To: ${email.reply_to}\r\n`;

        if (cc && cc.length)
            message += `Cc: ${cc.join(", ")}\r\n`;

        if (bcc && bcc.length)
            message += `Bcc: ${bcc.join(", ")}\r\n`;

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
        message += `Content-Type: ${email.content_type == "multipart/alternative" ? 'text/html' : email.content_type}; charset=${email.charset}\r\n`;
        message += `Content-Transfer-Encoding: 8bit\r\n`;
        message += "\r\n";
        message += email.content ?? "";

        return message;
    }
}