import net from "net";
import { ImapConnection } from "./imapConnection.js";

export function startImap(database) {
    const server = net.createServer((socket) => {
        const connection = new ImapConnection(socket, database);

        connection.start();
    });

    server.listen(1143, () => {
        console.log("IMAP server listening on port 1143");
    });
}