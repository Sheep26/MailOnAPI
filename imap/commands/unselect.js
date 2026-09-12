import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class UnselectCommand extends Command {
    command = (tag, args) => {
        if (this.connection.state != STATES.SELECTED)
            return this.connection.send(`${tag} NO Select a mailbox first`);


        this.connection.mailbox = null;
        this.connection.state = STATES.AUTHENTICATED;

        return this.connection.send(`${tag} OK UNSELECT completed`);
    };
}