import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class CheckCommand extends Command {
    command = async (tag, args) => {
        this.connection.send(`${tag} OK CHECK completed`);
    };
}