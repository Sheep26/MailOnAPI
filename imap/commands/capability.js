import { Command } from "./command.js";

export class CapabilityCommand extends Command {
    command = (tag, args) => {
        this.connection.send(`* CAPABILITY ${this.connection.capabilities.join(' ')}`);
        this.connection.send(`${tag} OK CAPABILITY completed`);
    }
}