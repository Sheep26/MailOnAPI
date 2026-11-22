import tls from "tls";
import net from "net";
import fs from "fs";
import { ImapConnection } from "./imapConnection.js";
import { getConfig } from "../config.js";

const config = getConfig();
const capabilities = ["IMAP4rev1", "UNSELECT", "AUTH=PLAIN", "IDLE"];

let connections = [];
let blockedIps = [];

export function removeConnection(connection) {
    connections = connections.filter(connectio => connectio != connection);
}

export function blockIP(ip) {
    blockedIps.push({ip: ip, timestamp: Date.now()});

    console.warn(`Ip ${ip} blocked at ${new Date().toISOString()}`);
}

export function imapHandleRecieved(belongs_to, exists, updated_mailbox) {
    const filtered_connections = connections.filter(connection => connection.user.email == belongs_to && connection.active && connection.idle && connection.mailbox.uid == updated_mailbox);

    for (let connection of filtered_connections)
        connection.send(`* ${exists} EXISTS`);
}

function create_connection(socket, database, secure) {
    const connection = new ImapConnection(socket, database, capabilities, secure);
    const connectionsFromIP = connections.filter(conn => conn.remoteAddress === connection.remoteAddress);
    const blockedIPAdresses = blockedIps.map(ip => ip.ip);

    if (connectionsFromIP.length >= 10) { // Too many concurrent connections.
        console.warn(`Too many concurrent connections from ${connection.remoteAddress}`);
        socket.destroy();

        return;
    }

    if (blockedIPAdresses.includes(connection.remoteAddress)) {
        console.warn(`Blocked IP attempted to connect to server ${connection.remoteAddress}`);
        socket.destroy();

        return;
    }

    connections.push(connection);
    connection.start();

    socket.on("close", () => {
        connections = connections.filter(connectio => connectio != connection);
    });
}

export function startImap(database) {
    const server = tls.createServer({key: fs.readFileSync(config.tls.private_key), cert: fs.readFileSync(config.tls.cert)}, (socket) => {
        create_connection(socket, database, true);
    });

    const server_unsecure = net.createServer((socket) => {
        create_connection(socket, database, false);
    });

    server_unsecure.listen(config.imap_port, () => {
        console.log(`IMAP server listening on port ${config.imap_port}`);
    });

    server.listen(config.imaps_port, () => {
        console.log(`IMAPS server listening on port ${config.imaps_port}`);
    });
}