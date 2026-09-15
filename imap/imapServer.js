import tls from "tls";
import config from "../config.json" with { type: "json" };
import fs from "fs";
import { ImapConnection } from "./imapConnection.js";

let connections = [];

export function imapHandleRecieved(belongs_to, exists, updated_mailbox) {
    const filtered_connections = connections.filter(connection => connection.user.email == belongs_to && connection.active && connection.idle && connection.mailbox.uid == updated_mailbox);

    for (let connection of filtered_connections)
        connection.send(`* ${exists} EXISTS`);
}

export function startImap(database) {
    const server = tls.createServer({key: fs.readFileSync(config.tls.private_key), cert: fs.readFileSync(config.tls.cert)}, (socket) => {
        const connection = new ImapConnection(socket, database);
        connections.push(connection);

        connection.start();

        socket.on("close", () => {
			connections = connections.filter(connectio => connectio != connection);
		});
    });

    server.listen(config.imaps_port, () => {
        console.log(`IMAP server listening on port ${config.imap_port}`);
    });
}