import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class IdleCommand extends Command {
    command = (tag, args) => {
        if (this.connection.state != STATES.SELECTED)
            return this.connection.send(`${tag} NO Select a mailbox first`);

        this.connection.idle = true;
        this.connection.idle_tag = tag;
        return this.connection.send(`+ idling`);
    };
}