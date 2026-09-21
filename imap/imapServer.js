import tls from "tls";
import net from "net";
import config from "../config.json" with { type: "json" };
import fs from "fs";
import { ImapConnection } from "./imapConnection.js";

let connections = [];
const capabilities = ["IMAP4rev1", "UNSELECT", "AUTH=PLAIN", "IDLE"];

export function removeConnection(connection) {
    connections = connections.filter(connectio => connectio != connection);
}

export function imapHandleRecieved(belongs_to, exists, updated_mailbox) {
    const filtered_connections = connections.filter(connection => connection.user.email == belongs_to && connection.active && connection.idle && connection.mailbox.uid == updated_mailbox);

    for (let connection of filtered_connections)
        connection.send(`* ${exists} EXISTS`);
}

export function startImap(database) {
    const server = tls.createServer({key: fs.readFileSync(config.tls.private_key), cert: fs.readFileSync(config.tls.cert)}, (socket) => {
        const connection = new ImapConnection(socket, database, capabilities, true);
        connections.push(connection);

        connection.start();

        socket.on("close", () => {
			connections = connections.filter(connectio => connectio != connection);
		});
    });

    const server_unsecure = net.createServer((socket) => {
        const connection = new ImapConnection(socket, database, capabilities, false);
        connections.push(connection);

        connection.start();

        socket.on("close", () => {
			connections = connections.filter(connectio => connectio != connection);
		});
    });

    server_unsecure.listen(config.imap_port, () => {
        console.log(`IMAP server listening on port ${config.imap_port}`);
    });

    server.listen(config.imaps_port, () => {
        console.log(`IMAPS server listening on port ${config.imaps_port}`);
    });
}