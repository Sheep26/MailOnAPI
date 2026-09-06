import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class SelectCommand extends Command {
    command = async (tag, args) => {
        if (this.connection.state == STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} BAD Please Authenticate First`);

        if (!args[0])
            return this.connection.send(`${tag} BAD SELECT requires mailbox`);

        const mailbox = await this.database.getMailBox(this.connection.user.email, args[0]);

        if (!mailbox)
            return this.connection.send(`${tag} NO Mailbox does not exist`);

        const emails = await this.database.getUsersEmails(this.connection.user.email);
        const filtered_emails = emails.filter(email => email.mail_box == mailbox.uid);

        const unread = filtered_emails.filter(email => !email.seen);

        this.connection.mailbox = mailbox;
        this.connection.state = STATES.SELECTED;

        this.connection.send(`* ${filtered_emails.length} EXISTS`);
        if (unread.length) {
            this.connection.send(`* ${unread.length} RECENT`);
            this.connection.send(`* OK [UNSEEN ${unread.length}] Message ${unread[0].uid} is first unseen`);
        }
        this.connection.send(`* OK [UIDVALIDITY ${mailbox.uid}] UIDs valid`);
        this.connection.send(`* OK [UIDNEXT ${mailbox.uid_next}] Predicted next UID`);

        this.connection.send(`${tag} OK [READ-WRITE] SELECT completed`);
    }
}