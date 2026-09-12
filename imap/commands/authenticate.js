import { Command } from "./command.js";
import STATES from '../imapStates.js';

const supported_mechanisms = {
    "PLAIN": STATES.AUTHENTICATING_PLAIN
}

export class AuthenticateCommand extends Command {
    command = async (tag, args) => {
        if (this.connection.state != STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} NO Already authenticated`);

        if (!args.length)
            return this.connection.send(`${tag} BAD AUTHENTICATE requires mechanism`);

        const mechanism = supported_mechanisms[args[0].toUpperCase()];

        if (!mechanism)
            return this.connection.send(`${tag} NO unsupported mechanism`);

        this.connection.state = mechanism;
        this.connection.auth_tag = tag;
        this.connection.send("+");
    };
}