import net from "net";
import { ImapConnection } from "./imapConnection.js";

export let connections = [];

export function imapHandleRecieved(belongs_to, exists, updated_mailbox) {
    console.log(belongs_to)
    const filtered_connections = connections.filter(connection => console.log(connection.user.email == belongs_to, connection.active, connection.idle, connection.mailbox == updated_mailbox) || true);

    for (let connection of filtered_connections)
        connection.send(`* ${exists} EXISTS`);
}

export function startImap(database) {
    const server = net.createServer((socket) => {
        const connection = new ImapConnection(socket, database);
        connections.push(connection);

        connection.start();
    });

    server.listen(1143, () => {
        console.log("IMAP server listening on port 1143");
    });
}