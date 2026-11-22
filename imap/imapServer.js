import tls from "tls";
import net from "net";
import fs from "fs";
import geoip from 'geoip-lite';
import { ImapConnection } from "./imapConnection.js";
import { getConfig } from "../config.js";

const config = getConfig();
const capabilities = ["IMAP4rev1", "UNSELECT", "AUTH=PLAIN", "IDLE"];

let connections = [];
let blockedIps = new Map();

const localRanges = new net.BlockList();

localRanges.addSubnet('127.0.0.0', 8, 'ipv4');
localRanges.addSubnet('10.0.0.0', 8, 'ipv4');
localRanges.addSubnet('172.16.0.0', 12, 'ipv4');
localRanges.addSubnet('192.168.0.0', 16, 'ipv4');
localRanges.addSubnet('169.254.0.0', 16, 'ipv4');

localRanges.addAddress('::1', 'ipv6');
localRanges.addSubnet('fc00::', 7, 'ipv6');
localRanges.addSubnet('fe80::', 10, 'ipv6');

function isBlocked(ip) {
    const entry = blockedIps.get(ip);

    if (!entry) return false;

    if (Date.now() >= entry.expires) {
        blockedIps.delete(ip);

        return false;
    }

    return true;
}

function isLocalIP(ip) {
    const family = net.isIPv4(ip) ? 'ipv4' : net.isIPv6(ip) ? 'ipv6' : null;
    if (!family) return false; // Invalid IP

    return localRanges.check(ip, family);
}

export function removeConnection(connection) {
    connections = connections.filter(connectio => connectio != connection);
}

export function blockIP(ip, duration = 3600000) {
    blockedIps.set(ip, { expires: Date.now() + duration });
}

export function imapHandleRecieved(belongs_to, exists, updated_mailbox) {
    const filtered_connections = connections.filter(connection => connection.user.email == belongs_to && connection.active && connection.idle && connection.mailbox.uid == updated_mailbox);

    for (let connection of filtered_connections)
        connection.send(`* ${exists} EXISTS`);
}

function create_connection(socket, database, secure) {
    const connection = new ImapConnection(socket, database, capabilities, secure);
    const connectionsFromIP = connections.filter(conn => conn.remoteAddress === connection.remoteAddress);
    const localIp = isLocalIP(connection.remoteAddress);

    if (localIp)
        console.info(`Local IP connected`);

    if (!localIp) {
        const geo = geoip.lookup(connection.remoteAddress);
        console.info(geo);

        if (config.geoblock.enabled && (!geo || !config.geoblock.allowed_countries.includes(geo.country))) {
            console.warn(`Geo Block blocked ${connection.remoteAddress} from country ${geo.country}`);
            socket.destroy();

            return;
        }
    }

    if (connectionsFromIP.length >= 10) { // Too many concurrent connections.
        console.warn(`Too many concurrent connections from ${connection.remoteAddress}`);
        socket.destroy();

        return;
    }

    if (isBlocked(connection.remoteAddress)) { // Check if the ip is blocked.
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