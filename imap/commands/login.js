import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class LoginCommand extends Command {
    command = async (tag, args) => {
        if (!this.connection.secure)
            return this.connection.send(`${tag} NO connection not secure`);

        if (this.connection.state != STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} NO Already authenticated`);

        if (args.length != 2)
            return this.connection.send(`${tag} BAD LOGIN requires username and password`);

        const email = args[0];
        const password = args[1];

        const session = await this.database.login(email, password);

        if (!session) {
            this.connection.failedLogins++;

            if (this.connection.failedLogins >= this.connection.kickThreashhold) {
                await this.connection.kick(tag, 'NO Authentication failed too many times killing connection', true);

                return;
            }

            return this.connection.send(`${tag} NO Authentication failed`);
        }

        this.connection.user = await this.database.getUser(email);
        console.log(`${this.connection.remoteAddress} ${this.connection.user.email} LOGIN SUCCESSFUL`);

        this.connection.state = STATES.AUTHENTICATED;
        this.connection.send(`${tag} OK LOGIN success`);
    };
}