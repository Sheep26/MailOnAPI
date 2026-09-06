import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class ListCommand extends Command {
    command = async (tag, args) => {
        if (this.connection.state == STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} Please Authenticate First`);

        const mailboxes = await this.database.getMailBoxes(this.connection.user.email);

        for (const mailbox of mailboxes)
            this.connection.send(`* LIST (\\HasNoChildren) "/" "${mailbox.name}"`);

        this.connection.send(`${tag} OK LIST completed`);
    }
}