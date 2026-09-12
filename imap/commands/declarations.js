import { LoginCommand } from "./login.js";
import { LogoutCommand } from "./logout.js";
import { CapabilityCommand } from "./capability.js";
import { NOOPCommand } from "./noop.js";
import { ListCommand } from "./list.js";
import { LSUBCommand } from "./lsub.js";
import { SelectCommand } from "./select.js";
import { FetchCommand } from "./fetch.js";
import { CloseCommand } from "./close.js";
import { CreateCommand } from "./create.js";
import { SubscribeCommand } from "./subscribe.js";
import { DeleteCommand } from "./delete.js";
import { RenameCommand } from "./rename.js";
import { UnsubscribeCommand } from "./unsubscribe.js";
import { StoreCommand } from "./store.js";
import { StatusCommand } from "./status.js";

export default function declarations(database, connection) {
    return {
        "LOGIN": new LoginCommand(database, connection).command,
        "LOGOUT": new LogoutCommand(database, connection).command,
        "CAPABILITY": new CapabilityCommand(database, connection).command,
        "NOOP": new NOOPCommand(database, connection).command,
        "LIST": new ListCommand(database, connection).command,
        "LSUB": new LSUBCommand(database, connection).command,
        "SELECT": new SelectCommand(database, connection).command,
        "FETCH": new FetchCommand(database, connection).command,
        "CLOSE": new CloseCommand(database, connection).command,
        "CREATE": new CreateCommand(database, connection).command,
        "SUBSCRIBE": new SubscribeCommand(database, connection).command,
        "DELETE": new DeleteCommand(database, connection).command,
        "RENAME": new RenameCommand(database, connection).command,
        "UNSUBSCRIBE": new UnsubscribeCommand(database, connection).command,
        "STORE": new StoreCommand(database, connection).command,
        "STATUS": new StatusCommand(database, connection).command
    };
}