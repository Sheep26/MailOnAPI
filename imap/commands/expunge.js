import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class ExpungeCommand extends Command {
    command = async (tag, args) => {
        if (this.connection.state != STATES.SELECTED)
            return this.connection.send(`${tag} NO Select a mailbox first`);

        const marked = await this.database.getMarkedDeleted(this.connection.user.email);

        for (let email of marked) {
            let index = this.database.getEmailIndex(this.connection.user.email, email.mail_id, email.mail_box);

            this.connection.send(`* ${index} EXPUNGE`);
        }

        await this.database.deleteMarkedDeleted(this.connection.user.email);
        return this.connection.send(`${tag} OK EXPUNGE completed`);
    };
}