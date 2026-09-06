import { Command } from "./command.js";

export class LogoutCommand extends Command {
    command = (tag, args) => {
        this.connection.send("* BYE Logging out");
        this.connection.send(`${tag} OK LOGOUT completed`);

        this.connection.socket.end();
    }
}