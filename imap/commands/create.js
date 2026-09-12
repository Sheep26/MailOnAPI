import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class CreateCommand extends Command {
    command = async (tag, args) => {
        if (this.connection.state == STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} NO Please Authenticate First`);

        if (args.length < 1)
            return this.connection.send(`${tag} BAD CREATE Expects at least 1 arg`);

        await this.database.addMailBox(this.connection.user.email, args[0], "\\Seen \\Deleted", this.makeSpecialUseFlags(args).join(" "));
        this.connection.send(`${tag} OK CREATE completed`);
    };

    makeSpecialUseFlags(args) {
        if (args.length < 2)
            return [];

        let special_use_flags = [];

        for (let arg of args) {
            if (!Array.isArray(arg))
                continue;
        
            if (arg[0] != 'USE')
                continue;

            for (let flag of arg[1])
                special_use_flags.push(flag);
        }

        return special_use_flags;
    }
}