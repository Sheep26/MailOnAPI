import { LoginCommand } from "./login.js";
import { LogoutCommand } from "./logout.js";
import { CapabilityCommand } from "./capability.js";
import { NOOPCommand } from "./noop.js";
import { ListCommand } from "./list.js";
import { SelectCommand } from "./select.js";
import { FetchCommand } from "./fetch.js";
import { CloseCommand } from "./close.js";

export default function declarations(database, connection) {
    return {
        "LOGIN": new LoginCommand(database, connection).command,
        "LOGOUT": new LogoutCommand(database, connection).command,
        "CAPABILITY": new CapabilityCommand(database, connection).command,
        "NOOP": new NOOPCommand(database, connection).command,
        "LIST": new ListCommand(database, connection).command,
        "SELECT": new SelectCommand(database, connection).command,
        "FETCH": new FetchCommand(database, connection).command,
        "CLOSE": new CloseCommand(database, connection).command
    };
}