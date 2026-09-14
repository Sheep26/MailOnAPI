import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class IdleCommand extends Command {
    command = (tag, args) => {
        if (this.connection.state != STATES.SELECTED)
            return this.connection.send(`${tag} NO Select a mailbox first`);

        this.connection.idle = true;
        this.tag = tag;
        this.connection.send(`+ idling`);

        this.idleListenerBound = this.idleListener.bind(this);
        this.connection.addListener(this.idleListenerBound);
    };

    async idleListener(line, next) {
        if (!this.connection.idle)
            return next();

        if (line.toUpperCase() === `DONE${this.connection.newLine}` && this.connection.idle) {
            this.connection.idle = false;
            this.connection.send(`${this.tag} OK IDLE terminated`);

            this.tag = null; // Free the couple bytes of memory.
            this.connection.removeListener(this.idleListenerBound);
        }
    }
}