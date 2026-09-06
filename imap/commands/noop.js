import { Command } from "./command.js";

export class NOOPCommand extends Command {
    command = (tag, args) => {
        this.connection.send(`${tag} OK NOOP completed`);
    }
}