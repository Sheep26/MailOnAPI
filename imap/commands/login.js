import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class LoginCommand extends Command {
    command = async (tag, args) => {
        if (this.connection.state !== STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} BAD Already authenticated`);

        if (args.length != 2)
            return this.connection.send(`${tag} BAD LOGIN requires username and password`);

        const email = args[0];
        const password = args[1];

        const session = await this.database.login(email, password);

        if (!session)
            return this.connection.send(`${tag} NO Authentication failed`);

        this.connection.user = await this.database.getUser(email);
        this.connection.state = STATES.AUTHENTICATED;

        this.connection.send(`${tag} OK LOGIN completed`);
    }
}