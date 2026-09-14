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
        const flags = args[2];

        const emails = await this.database.getUsersEmails(this.connection.user.email);
        const mailboxEmails = emails.filter(email => email.mail_box === this.connection.mailbox.uid).sort((a, b) => a.uid - b.uid);
        const selectedMails = this.selectEmails(mailboxEmails, sequence, uid);

        for (let email of selectedMails) {
            for (let flag of flags)
                if (action.toUpperCase().startsWith("+FLAGS"))
                    if (!email.flags.includes(flag))
                        await this.database.addFlag(email.mail_id, this.connection.user.email, flag);
                else if (action.toUpperCase().startsWith("-FLAGS"))
                    if (email.flags.includes(flag))
                        await this.database.removeFlag(email.mail_id, this.connection.user.email, flag);
            
            if (!action.toUpperCase().endsWith(".SILENT")) {
                const email_updated = await this.database.getEmail(email.mail_id, this.connection.user.email);
                const email_sequence = await this.connection.database.getEmailIndex(this.connection.user.email, email.mail_id, email.mail_box);
                
                this.connection.send(`* ${email_sequence} FETCH (FLAGS (${email_updated.flags}))`);
            }
        }

        this.connection.send(`${tag} OK STORE completed`);
    };
}