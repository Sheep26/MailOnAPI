import { LoginCommand } from "./commands/login.js";
import { LogoutCommand } from "./commands/logout.js";
import { CapabilityCommand } from "./commands/capability.js";
import { NOOPCommand } from "./commands/noop.js";
import { ListCommand } from "./commands/list.js";
import { LSUBCommand } from "./commands/lsub.js";
import { SelectCommand } from "./commands/select.js";
import { FetchCommand } from "./commands/fetch.js";
import { CloseCommand } from "./commands/close.js";
import { CreateCommand } from "./commands/create.js";
import { SubscribeCommand } from "./commands/subscribe.js";
import { DeleteCommand } from "./commands/delete.js";
import { RenameCommand } from "./commands/rename.js";
import { UnsubscribeCommand } from "./commands/unsubscribe.js";
import { StoreCommand } from "./commands/store.js";
import { StatusCommand } from "./commands/status.js";
import { AuthenticateCommand } from "./commands/authenticate.js";
import { UnselectCommand } from "./commands/unselect.js";

export default function getCommands(database, connection) {
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
        "STATUS": new StatusCommand(database, connection).command,
        "AUTHENTICATE": new AuthenticateCommand(database, connection).command,
        "UNSELECT": new UnselectCommand(database, connection).command
    };
}