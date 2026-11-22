import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class RenameCommand extends Command {
    command = async (tag, args) => {
        if (this.connection.state == STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} NO Please Authenticate First`);

        if (args.length != 2)
            return this.connection.send(`${tag} BAD RENAME Expects 2 args`);

        await this.database.renameMailBox(this.connection.user.email, args[0], args[1]);
        this.connection.send(`${tag} OK RENAME completed`);
    };
}