import { Command } from "./command.js";
import STATES from '../imapStates.js';

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
        const dataItem = args.slice(1).join(" ");

        const emails = await this.database.getUsersEmails(this.connection.user.email);
        const mailboxEmails = emails.filter(email => email.mail_box === this.connection.mailbox.uid).sort((a, b) => a.uid - b.uid);

        const selectedEmails = this.selectEmails(mailboxEmails, sequence, uid);

        console.log("FETCH:", {uid, sequence, dataItem});

        console.log("Selected emails:", selectedEmails.map(email => ({uid: email.uid, sequence: mailboxEmails.indexOf(email) + 1})));

        for (const email of selectedEmails) {
            const sequenceNumber = mailboxEmails.indexOf(email) + 1;

            const responseParts = [];
            const upperDataItem = dataItem.toUpperCase();

            if (uid || upperDataItem.includes("UID"))
                responseParts.push(`UID ${email.uid}`);

            if (upperDataItem.includes("FLAGS")) {
                const flags = this.getFlags(email);

                responseParts.push(`FLAGS (${flags.join(" ")})`);
            }

            if (upperDataItem.includes("RFC822.SIZE")) {
                const raw = this.createRawEmail(email);
                const size = Buffer.byteLength(raw, "utf8");

                responseParts.push(`RFC822.SIZE ${size}`);
            }

            const headerFieldsMatch = dataItem.match(/BODY\.PEEK\[HEADER\.FIELDS\s*\((.*?)\)\]/i);

            if (headerFieldsMatch) {
                const requestedHeaders = headerFieldsMatch[1].split(/\s+/).filter(Boolean);

                const headers = this.createRequestedHeaders(email, requestedHeaders);

                const size = Buffer.byteLength(headers, "utf8");

                responseParts.push(`BODY[HEADER.FIELDS (${requestedHeaders.join(" ")})] {${size}}\r\n${headers}`);
            }

            else if (upperDataItem.includes("BODY.PEEK[]") || upperDataItem.includes("BODY[]")) {
                const raw = this.createRawEmail(email);
                const size = Buffer.byteLength(raw, "utf8");

                responseParts.push(`BODY[] {${size}}\r\n${raw}`);
            }

            else if (upperDataItem.includes("RFC822")) {
                const raw = this.createRawEmail(email);
                const size = Buffer.byteLength(raw, "utf8");

                responseParts.push(`RFC822 {${size}}\r\n${raw}`);
            }

            const response = `* ${sequenceNumber} FETCH (${responseParts.join(" ")})`;
            this.connection.send(response);
        }

        this.connection.send(`${tag} OK FETCH completed`);
    }

    selectEmails(mailboxEmails, sequence, uid) {
        if (!sequence)
            return [];

        const selectedEmails = new Set();

        for (const part of sequence.split(",")) {
            const range = part.trim();

            if (!range)
                continue;

            if (range.includes(":")) {
                const [startValue, endValue] = range.split(":");

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

        if (value == "*") {
            if (mailboxEmails.length == 0)
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

    getFlags(email) {
        const flags = [];

        if (email.seen)
            flags.push("\\Seen");

        /* if (email.answered)
            flags.push("\\Answered");

        if (email.flagged)
            flags.push("\\Flagged");

        if (email.deleted)
            flags.push("\\Deleted");

        if (email.draft)
            flags.push("\\Draft"); */

        return flags;
    }

    createRequestedHeaders(email, requestedHeaders) {
        let headers = "";

        for (const requestedHeader of requestedHeaders) {
            const header = requestedHeader.toLowerCase();

            if (header == "from")
                if (email.mail_from)
                    headers += `From: ${email.mail_from}\r\n`;

            else if (header == "to")
                if (email.mail_to)
                    headers += `To: ${email.mail_to}\r\n`;

            else if (header == "cc")
                if (Array.isArray(email.cc))
                    if (email.cc.length > 0)
                        headers += `Cc: ${email.cc.join(", ")}\r\n`;
                    else if (email.cc)
                        headers += `Cc: ${email.cc}\r\n`;

            else if (header == "bcc")
                if (Array.isArray(email.bcc))
                    if (email.bcc.length > 0)
                        headers += `Bcc: ${email.bcc.join(", ")}\r\n`;
                else if (email.bcc)
                    headers += `Bcc: ${email.bcc}\r\n`;

            else if (header == "subject")
                if (email.subject)
                    headers += `Subject: ${email.subject}\r\n`;

            else if (header == "date")
                headers += `Date: ${new Date(Number(email.time)).toUTCString()}\r\n`;

            else if (header == "message-id")
                if (email.message_id)
                    headers += `Message-ID: ${email.message_id}\r\n`;

            else if (header == "priority")
                if (email.priority)
                    headers += `Priority: ${email.priority}\r\n`;

            else if (header == "x-priority")
                if (email.x_priority)
                    headers += `X-Priority: ${email.x_priority}\r\n`;

            else if (header == "references")
                if (email.references)
                    headers += `References: ${email.references}\r\n`;

            else if (header == "newsgroups")
                if (email.newsgroups)
                    headers += `Newsgroups: ${email.newsgroups}\r\n`;

            else if (header == "in-reply-to")
                if (email.in_reply_to)
                    headers += `In-Reply-To: ${email.in_reply_to}\r\n`;

            else if (header == "content-type")
                headers += `Content-Type: ${email.html_format ? "text/html" : "text/plain"}; charset=utf-8\r\n`;

            else if (header == "reply-to")
                if (email.reply_to)
                    headers += `Reply-To: ${email.reply_to}\r\n`;

            else if (header == "received")
                if (email.received)
                    headers += `Received: ${email.received}\r\n`;
        }

        return headers + "\r\n";
    }

    createRawEmail(email) {
        let message = "";

        message += `From: ${email.mail_from}\r\n`;
        message += `To: ${email.mail_to}\r\n`;

        if (email.reply_to)
            message += `Reply-To: ${email.reply_to}\r\n`;

        if (Array.isArray(email.cc))
            if (email.cc.length > 0)
                message += `Cc: ${email.cc.join(", ")}\r\n`;
        else if (email.cc)
            message += `Cc: ${email.cc}\r\n`;

        if (email.subject)
            message += `Subject: ${email.subject}\r\n`;

        if (email.message_id)
            message += `Message-ID: ${email.message_id}\r\n`;

        message += `Date: ${new Date(Number(email.time)).toUTCString()}\r\n`;
        message += `MIME-Version: 1.0\r\n`;

        if (email.html_format)
            message += `Content-Type: text/html; charset=utf-8\r\n`;
        else
            message += `Content-Type: text/plain; charset=utf-8\r\n`;

        message += `\r\n`;
        message += email.content ?? "";

        return message;
    }
}