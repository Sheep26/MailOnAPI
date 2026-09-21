import { Command } from "./command.js";

export class StartTLSCommand extends Command {
    command = (tag, args) => {
        if (this.connection.secure)
            return this.connection.send(`${tag} BAD already secure`);

        this.connection.send(`${tag} OK Begin TLS negotiation now`, () => {this.connection.startTLS()});
    };
}