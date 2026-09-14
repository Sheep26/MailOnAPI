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
        this.tag = tag;
        this.connection.send("+");

        this.authenticationListnerBound = this.authenticationListner.bind(this);
        this.connection.addListener(this.authenticationListnerBound);
    };

    async authenticationListner(line, next) {
        if (this.connection.state == STATES.AUTHENTICATING_PLAIN) {
            try {
                const authenication_parts = new TextDecoder().decode(Uint8Array.fromBase64(line.replace(/\r?\n$/, ''))).split('\0');
                
                const email = authenication_parts[1];
                const password = authenication_parts[2];

                const session = await this.database.login(email, password);

                if (!session) {
                    this.connection.state = STATES.NOT_AUTHENTICATED;

                    this.connection.removeListener(this.authenticationListnerBound);
                    return this.connection.send(`${this.tag} NO Authentication failed`);
                }

                this.connection.user = await this.database.getUser(email);
                this.connection.state = STATES.AUTHENTICATED;

                this.connection.send(`${this.tag} OK AUTHENTICATE success`);
                this.tag = null; // Free the couple bytes of memory.
            } catch (e) {
                this.connection.send(`${this.tag} BAD Invalid Request`);
            }
        } else {
            this.connection.removeListener(this.authenticationListnerBound);

            return next();
        }

        this.connection.removeListener(this.authenticationListnerBound);
    }
}