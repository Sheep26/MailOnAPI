import { Command } from "./command.js";
import STATES from '../imapStates.js';

const data_funcs = {
    "MESSAGES": (mailbox, emails, unread, recent) => {
        return emails.length;
    },
    "RECENT": (mailbox, emails, unread, recent) => {
        return recent.length;
    },
    "UNSEEN": (mailbox, emails, unread, recent) => {
        return unread.length;
    },
    "UIDNEXT": (mailbox, emails, unread, recent) => {
        return mailbox.uid_next;
    },
    "UIDVALIDITY": (mailbox, emails, unread, recent) => {
        return mailbox.uid;
    }
}

export class StatusCommand extends Command {
    command = async (tag, args) => {
        if (this.connection.state == STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} NO Please Authenticate First`);

        const requested_mailbox = args[0];
        const requested = args[1];

        const mailbox = await this.database.getMailBox(this.connection.user.email, requested_mailbox);
        const emails = await this.database.getUsersEmails(this.connection.user.email);
        const filtered_emails = emails.filter(email => email.mail_box == mailbox.uid);

        const unread = filtered_emails.filter(email => !email.flags.includes("\\Seen"));
        const recent = filtered_emails.filter(email => email.recent);

        let message = `* STATUS "${requested_mailbox}" (`;
        let index = 0;

        for (let requested_data of requested) {
            const handler = data_funcs[requested_data.toUpperCase()];

            if (!handler)
                return this.connection.send(`${tag} BAD Invalid Arguments`);

            index++;message += `${requested_data.toUpperCase()} ${handler(mailbox, filtered_emails, unread, recent)}${index != requested.length ? " " : ""}`;
        }

        message += ")";

        this.connection.send(message);
        this.connection.send(`${tag} OK STATUS Completed`);
    };
}