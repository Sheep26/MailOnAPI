import net from "net";
import { ImapConnection } from "./imapConnection.js";

let connections = [];

export function imapHandleRecieved(belongs_to, exists, updated_mailbox) {
    const filtered_connections = connections.filter(connection => connection.user.email == belongs_to, connection.active, connection.idle, connection.mailbox.uid == updated_mailbox);

    for (let connection of filtered_connections)
        connection.send(`* ${exists} EXISTS`);
}

export function startImap(database) {
    const server = net.createServer((socket) => {
        const connection = new ImapConnection(socket, database);
        connections.push(connection);

        connection.start();

        socket.on("close", () => {
			connections = connections.filter(connectio => connectio != connection);
		});
    });

    server.listen(1143, () => { // Please implement TLS at some point.
        console.log("IMAP server listening on port 1143");
    });
}