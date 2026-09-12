import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class StoreCommand extends Command {
    command = async (tag, args, options) => {
        if (this.connection.state == STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} NO Please Authenticate First`);

        if (this.connection.state != STATES.SELECTED)
            return this.connection.send(`${tag} NO Please Select a mailbox first`);

        const uid = options.uid ?? false;
        const sequence = args[0];
        const action = args[1];

        const emails = await this.database.getUsersEmails(this.connection.user.email);
        const mailboxEmails = emails.filter(email => email.mail_box === this.connection.mailbox.uid).sort((a, b) => a.uid - b.uid);
        const selectedMails = this.selectEmails(mailboxEmails, sequence, uid);

        for (let email of selectedMails) {
            if (action.startsWith("+Flags"))
                for (let flag of args[2])
                    this.database.addFlag(email.mail_id, this.connection.user.email, flag);

            if (action.startsWith("-Flags"))
                for (let flag of args[2])
                    await this.database.removeFlag(email.mail_id, this.connection.user.email, flag);
            
            if (!action.endsWith(".SILENT")) {
                const email_updated = await this.database.getEmail(email.mail_id, this.connection.user.email);
                const email_sequence = await this.connection.database.getEmailIndex(this.connection.user.email, email.mail_id, email.mail_box);
                
                this.connection.send(`* ${email_sequence} FETCH (FLAGS (${email_updated.flags}))`);
            }
        }

        this.connection.send(`${tag} OK STORE completed`);
    };

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
}