import { Command } from "./command.js";

export class CapabilityCommand extends Command {
    command = (tag, args) => {
        this.connection.send("* CAPABILITY IMAP4rev1 UNSELECT AUTH=PLAIN IDLE");
        this.connection.send(`${tag} OK CAPABILITY completed`);
    }
}