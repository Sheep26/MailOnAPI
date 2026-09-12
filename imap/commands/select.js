import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class SelectCommand extends Command {
    command = async (tag, args) => {
        if (this.connection.state == STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} NO Please Authenticate First`);

        if (!args[0])
            return this.connection.send(`${tag} BAD SELECT requires mailbox`);

        const mailbox = await this.database.getMailBox(this.connection.user.email, args[0]);

        if (!mailbox)
            return this.connection.send(`${tag} NO Mailbox does not exist`);

        const emails = await this.database.getUsersEmails(this.connection.user.email);
        const filtered_emails = emails.filter(email => email.mail_box == mailbox.uid);

        const unread = filtered_emails.filter(email => !email.flags.includes("\\Seen"));
        const recent = filtered_emails.filter(email => email.recent);

        this.connection.mailbox = mailbox;
        this.connection.state = STATES.SELECTED;

        this.connection.send(`* ${filtered_emails.length} EXISTS`);

        if (unread.length) {
            this.connection.send(`* ${recent.length} RECENT`);
            this.connection.send(`* OK [UNSEEN ${unread.length}] Message ${unread[0].uid} is first unseen`);
        }

        this.connection.send(`* OK [UIDVALIDITY ${mailbox.uid}] UIDs valid`);
        this.connection.send(`* OK [UIDNEXT ${mailbox.uid_next}] Predicted next UID`);

        this.connection.send(`* FLAGS (${mailbox.flags})`);
        this.connection.send(`${tag} OK [READ-WRITE] SELECT completed`);

        recent.forEach(async email => {
            await this.database.markNotRecent(this.connection.user.email, email.mail_id);
        });
    };
}