import { Command } from "./command.js";
import STATES from "../imapStates.js";

export class SearchCommand extends Command {
    command = async (tag, args, options = {}) => {
        const uid = options.uid === true;

        if (this.connection.state === STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} NO Please Authenticate First`);

        if (this.connection.state !== STATES.SELECTED)
            return this.connection.send(`${tag} NO Select a mailbox first`);

        try {
            const emails = await this.database.getUsersEmails(this.connection.user.email);

            const mailboxEmails = emails.filter(email => email.mail_box === this.connection.mailbox.uid).sort((a, b) => Number(a.uid) - Number(b.uid));

            let criteria = this.flattenArgs(args);
            let selectedEmails = mailboxEmails;

            if (criteria.length && this.isNumberSet(criteria[0])) {
                const sequenceSet = this.parseNumberSet(criteria.shift(), mailboxEmails, uid);

                selectedEmails = mailboxEmails.filter((email, index) => {
                    const value = uid ? Number(email.uid) : index + 1;

                    return this.numberSetContains(sequenceSet, value);
                });
            }

            if (criteria.length)
                selectedEmails = this.searchEmails(selectedEmails, criteria);

            const results = selectedEmails.map((email) => {
                if (uid)
                    return email.uid;

                return mailboxEmails.indexOf(email) + 1;
            });

            this.connection.send(`* SEARCH${results.length ? " " + results.join(" ") : ""}`);

            return this.connection.send(`${tag} OK SEARCH completed`);
        } catch (error) {
            return this.connection.send(`${tag} BAD ${error.message}`);
        }
    };

    searchEmails(emails, criteria) {
        let position = 0;

        const parseCriterion = () => {
            if (position >= criteria.length)
                throw new Error("Missing search criteria");

            if (criteria[position] === "(") {
                position++;

                const criterion = parseCriterion();

                if (position >= criteria.length || criteria[position] !== ")")
                    throw new Error("Missing closing ')'");

                position++;

                return criterion;
            }

            if (criteria[position] === ")")
                throw new Error("Unexpected ')'");

            const key = String(criteria[position++]).toUpperCase();

            switch (key) {
                case "ALL":
                    return () => true;

                case "UID": {
                    const value = this.nextArgument(criteria, position++);
                    const uidSet = this.parseNumberSet(value);

                    return email => this.numberSetContains(uidSet, email.uid);
                }

                case "SEEN":
                    return email => this.hasFlag(email, "\\Seen");

                case "UNSEEN":
                    return email => !this.hasFlag(email, "\\Seen");

                case "ANSWERED":
                    return email => this.hasFlag(email, "\\Answered");

                case "UNANSWERED":
                    return email => !this.hasFlag(email, "\\Answered");

                case "FLAGGED":
                    return email => this.hasFlag(email, "\\Flagged");

                case "UNFLAGGED":
                    return email => !this.hasFlag(email, "\\Flagged");

                case "DELETED":
                    return email => this.hasFlag(email, "\\Deleted");

                case "UNDELETED":
                    return email => !this.hasFlag(email, "\\Deleted");

                case "DRAFT":
                    return email => this.hasFlag(email, "\\Draft");

                case "UNDRAFT":
                    return email => !this.hasFlag(email, "\\Draft");

                case "RECENT":
                    return email => email.recent == 1;

                case "OLD":
                    return email => email.recent != 1;

                case "FROM": {
                    const value = this.readArgument(criteria, () => position++);

                    return email => this.contains(email.mail_from, value);
                }

                case "TO": {
                    const value = this.readArgument(criteria, () => position++);

                    return email => this.contains(email.mail_to, value);
                }

                case "CC": {
                    const value = this.readArgument(criteria, () => position++);

                    return email => this.containsJSON(email.cc, value);
                }

                case "BCC": {
                    const value = this.readArgument(criteria, () => position++);

                    return email => this.containsJSON(email.bcc, value);
                }

                case "SUBJECT": {
                    const value = this.readArgument(criteria, () => position++);

                    return email => this.contains(email.subject, value);
                }

                case "BODY": {
                    const value = this.readArgument(criteria, () => position++);

                    return email => this.contains(email.content, value);
                }

                case "TEXT": {
                    const value = this.readArgument(criteria, () => position++);

                    return email => {
                        const fields = [email.mail_from, email.mail_to, email.subject, email.content];

                        return fields.some(field => this.contains(field, value));
                    };
                }

                case "KEYWORD": {
                    const value = this.readArgument(criteria, () => position++);

                    return email => this.hasFlag(email, value);
                }

                case "UNKEYWORD": {
                    const value = this.readArgument(criteria, () => position++);

                    return email => !this.hasFlag(email, value);
                }

                case "LARGER": {
                    const value = this.readArgument(criteria, () => position++);
                    const size = Number(value);

                    if (!Number.isFinite(size) || size < 0)
                        throw new Error(`Invalid LARGER value: ${value}`);

                    return email => this.getEmailSize(email) > size;
                }

                case "SMALLER": {
                    const value = this.readArgument(criteria, () => position++);
                    const size = Number(value);

                    if (!Number.isFinite(size) || size < 0)
                        throw new Error(`Invalid SMALLER value: ${value}`);

                    return email => this.getEmailSize(email) < size;
                }

                case "NOT": {
                    const criterion = parseCriterion();

                    return email => !criterion(email);
                }

                case "OR": {
                    const left = parseCriterion();
                    const right = parseCriterion();

                    return email => left(email) || right(email);
                }

                case "BEFORE": {
                    const value = this.readArgument(criteria, () => position++);
                    const date = this.parseIMAPDate(value);

                    return email => this.getEmailDate(email) < date;
                }

                case "SINCE": {
                    const value = this.readArgument(criteria, () => position++);
                    const date = this.parseIMAPDate(value);

                    return email => this.getEmailDate(email) >= date;
                }

                case "ON": {
                    const value = this.readArgument(criteria, () => position++);

                    const date = this.parseIMAPDate(value);
                    const nextDay = new Date(date);

                    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

                    return email => {
                        const emailDate = this.getEmailDate(email);

                        return (emailDate >= date && emailDate < nextDay);
                    };
                }

                case "SENTBEFORE": {
                    const value = this.readArgument(criteria, () => position++);
                    const date = this.parseIMAPDate(value);

                    return email => this.getEmailDate(email) < date;
                }

                case "SENTSINCE": {
                    const value = this.readArgument(criteria, () => position++);
                    const date = this.parseIMAPDate(value);

                    return email => this.getEmailDate(email) >= date;
                }

                case "SENTON": {
                    const value = this.readArgument(criteria, () => position++);

                    const date = this.parseIMAPDate(value);
                    const nextDay = new Date(date);

                    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

                    return email => {
                        const emailDate = this.getEmailDate(email);

                        return (emailDate >= date && emailDate < nextDay);
                    };
                }

                default:
                    throw new Error(`Unsupported SEARCH key: ${key}`);
            }
        };

        const predicates = [];

        while (position < criteria.length) {
            if (criteria[position] === ")")
                throw new Error("Unexpected ')'");

            predicates.push(parseCriterion());
        }

        return emails.filter(email => predicates.every(predicate => predicate(email)));
    }

    readArgument(criteria, getPosition) {
        const position = getPosition();

        if (position >= criteria.length || criteria[position] === "(" || criteria[position] === ")")
            throw new Error("Missing search argument");

        return criteria[position];
    }

    contains(value, search) {
        if (value == null)
            return false;

        return String(value).toLowerCase().includes(String(search).toLowerCase());
    }

    containsJSON(value, search) {
        if (!value)
            return false;

        let parsed;

        try {
            parsed = Array.isArray(value) ? value : JSON.parse(value);
        } catch {
            return false;
        }

        if (!Array.isArray(parsed))
            return false;

        return parsed.some(item => this.contains(item, search));
    }

    getEmailDate(email) {
        const date = new Date(email.time);

        if (Number.isNaN(date.getTime()))
            throw new Error(`Invalid email date: ${email.time}`);

        return date;
    }

    parseIMAPDate(value) {
        const match = String(value).match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);

        if (!match)
            throw new Error(`Invalid date: ${value}`);

        const [, day, month, year] = match;

        const months = {
            JAN: 0,
            FEB: 1,
            MAR: 2,
            APR: 3,
            MAY: 4,
            JUN: 5,
            JUL: 6,
            AUG: 7,
            SEP: 8,
            OCT: 9,
            NOV: 10,
            DEC: 11
        };

        const monthNumber = months[month.toUpperCase()];

        if (monthNumber === undefined)
            throw new Error(`Invalid date: ${value}`);

        const date = new Date(Date.UTC(Number(year), monthNumber,Number(day)));

        if (date.getUTCDate() !== Number(day))
            throw new Error(`Invalid date: ${value}`);

        return date;
    }

    getEmailSize(email) {
        const raw = this.createRawEmail(email);

        return Buffer.byteLength(raw, "utf8");
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

    isNumberSet(value) {
        return /^(?:\d+|\*)(?::(?:\d+|\*))?(?:,(?:\d+|\*)(?::(?:\d+|\*))?)*$/.test(String(value));
    }

    parseNumberSet(value, mailboxEmails = [], uid = false) {
        const ranges = [];

        for (const part of String(value).split(",")) {
            const trimmed = part.trim();

            if (!trimmed)
                throw new Error(`Invalid number set: ${value}`);

            if (trimmed.includes(":")) {
                const values = trimmed.split(":");

                if (values.length !== 2)
                    throw new Error(`Invalid number set: ${value}`);

                let [start, end] = values;

                start = this.resolveNumberSetValue(start, mailboxEmails, uid);
                end = this.resolveNumberSetValue(end, mailboxEmails, uid);

                if (start === null || end === null)
                    throw new Error(`Invalid number set: ${value}`);

                ranges.push([Math.min(start, end), Math.max(start, end)]);
            } else {
                const number = this.resolveNumberSetValue(trimmed, mailboxEmails, uid);

                if (number === null)
                    throw new Error(`Invalid number set: ${value}`);

                ranges.push([number, number]);
            }
        }

        return ranges;
    }

    resolveNumberSetValue(value, mailboxEmails, uid) {
        value = String(value).trim();

        if (value === "*") {
            if (!mailboxEmails.length)
                return null;

            if (uid)
                return Number(mailboxEmails[mailboxEmails.length - 1].uid);

            return mailboxEmails.length;
        }

        const number = Number(value);

        if (!Number.isInteger(number) || number < 1)
            return null;

        return number;
    }

    numberSetContains(ranges, number) {
        return ranges.some(([start, end]) => number >= start && number <= end);
    }
}