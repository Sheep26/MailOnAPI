import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class CopyCommand extends Command {
    command = async (tag, args, options) => {
        if (this.connection.state != STATES.SELECTED)
            return this.connection.send(`${tag} NO Select a mailbox first`);

        const uid = options.uid ?? false;
        const sequence = args[0];
        const target_mailbox_name = args[1];

        const target_mailbox = await this.database.getMailBox(this.connection.user.email, target_mailbox_name);

        const emails = await this.database.getUsersEmails(this.connection.user.email);
        const mailboxEmails = emails.filter(email => email.mail_box === this.connection.mailbox.uid).sort((a, b) => a.uid - b.uid);
        const selectedMails = this.selectEmails(mailboxEmails, sequence, uid);

        for (let email of selectedMails)
            await this.database.addEmail(email.belongs_to, email.mail_to, email.mail_from, email.reply_to, email.bcc, email.cc, crypto.randomBytes(8).readUInt32BE(), email.message_id, email.html_format, email.subject, email.content, email.attachments, email.email_references, target_mailbox.uid, email.flags);

        return this.connection.send(`${tag} OK COPY completed`);
    };
}