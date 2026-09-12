import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class LSUBCommand extends Command {
    command = async (tag, args) => {
        if (this.connection.state == STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} NO Please Authenticate First`);

        const mailboxes = await this.database.getMailBoxes(this.connection.user.email);
        const filtered_mailboxes = mailboxes.filter(mailbox => mailbox.subscribed);

        for (const mailbox of filtered_mailboxes)
            this.connection.send(`* LSUB (\\HasNoChildren${mailbox.special_use_flags ? ` ${mailbox.special_use_flags}` : ""}) "/" "${mailbox.name}"`);

        this.connection.send(`${tag} OK LSUB completed`);
    };
}