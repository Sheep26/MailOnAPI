import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class SearchCommand extends Command {
    command = (tag, args) => {
        this.connection.send(`* SEARCH`);
        this.connection.send(`${tag} OK SEARCH COMPLETE`);
    };
}