import { Command } from "./command.js";
import STATES from '../imapStates.js';
import { connections } from "../imapServer.js";

export class LogoutCommand extends Command {
    command = async (tag, args) => {
        this.connection.send("* BYE Logging out");
        this.connection.send(`${tag} OK LOGOUT completed`);
        this.connection.state = STATES.NOT_AUTHENTICATED;

        await setTimeout(5000);
        this.connection.socket.end();
        this.active = false;

        connections = connections.filter(connection => connection != this.connection);
    };
}