import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class CloseCommand extends Command {
    command = (tag, args) => {
        if (this.connection.state != STATES.SELECTED)
            return this.connection.send(`${tag} NO Select a mailbox first`);

        this.database.deleteMarkedDeleted(this.connection.user.email);

        this.connection.mailbox = null;
        this.connection.state = STATES.AUTHENTICATED;

        return this.connection.send(`${tag} OK CLOSE completed`);
    };
}