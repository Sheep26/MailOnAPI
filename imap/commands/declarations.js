import { LoginCommand } from "./login.js";
import { LogoutCommand } from "./logout.js";
import { CapabilityCommand } from "./capability.js";
import { NOOPCommand } from "./noop.js";

export default function declarations(database, connection) {
    return {
        "LOGIN": new LoginCommand(database, connection).command,
        "LOGOUT": new LogoutCommand(database, connection).command,
        "CAPABILITY": new CapabilityCommand(database, connection).command,
        "NOOP": new NOOPCommand(database, connection).command
    };
}