import { Command } from "./command.js";
import STATES from '../imapStates.js';

export class CreateCommand extends Command {
    command = async (tag, args) => {
        if (this.connection.state == STATES.NOT_AUTHENTICATED)
            return this.connection.send(`${tag} NO Please Authenticate First`);

        if (args.length < 1)
            return this.connection.send(`${tag} BAD CREATE Expects at least 1 arg`);

        let special_use_flags = [];

        if (args.length > 1)
            for (let arg of args)
                if (Array.isArray(arg))
                    if (arg[0] == 'USE')
                        for (let flag of arg[1])
                            special_use_flags.push(flag);
        
        console.log(special_use_flags);

        await this.database.addMailBox(this.connection.user.email, args[0], "\\Seen \\Deleted", special_use_flags.join(" "));
        this.connection.send(`${tag} OK CREATE completed`);
    };
}