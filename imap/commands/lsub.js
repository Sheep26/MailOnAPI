import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class LSUBCommand extends Command {
    command = async (tag, args) => {
        if (this.connection.state == STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} NO Please Authenticate First`);

        const mailboxes = await this.database.getMailBoxes(this.connection.user.email);

        for (const mailbox of mailboxes)
            this.connection.send(`* LSUB (\\HasNoChildren${mailbox.special_use_flags ? ` ${mailbox.special_use_flags}` : ""}) "/" "${mailbox.name}"`);

        this.connection.send(`${tag} OK LSUB completed`);
    };
}