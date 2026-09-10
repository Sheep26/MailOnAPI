import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class SubscribeCommand extends Command {
    command = async (tag, args) => {
        if (this.connection.state == STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} NO Please Authenticate First`);

        if (args.length != 1)
            return this.connection.send(`${tag} BAD SUBSCRIBE Expects 1 arg`);

        // this.database.markSubscribed(this.connection.user.email, args[0]);
        this.connection.send(`${tag} OK SUBSCRIBE completed`);
    };
}