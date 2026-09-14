import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class CopyCommand extends Command {
    command = (tag, args) => {
        if (this.connection.state != STATES.SELECTED)
            return this.connection.send(`${tag} NO Select a mailbox first`);

        

        return this.connection.send(`${tag} OK COPY completed`);
    };
}