import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class LogoutCommand extends Command {
    command = (tag, args) => {
        this.connection.send("* BYE Logging out");
        this.connection.send(`${tag} OK LOGOUT completed`);
        this.connection.state = STATES.NOT_AUTHENTICATED;

        this.connection.socket.end();
    }
}