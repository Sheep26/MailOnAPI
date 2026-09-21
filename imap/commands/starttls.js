import { Command } from "./command.js";
import tls from "tls";
import fs from "fs";
import { removeConnection } from "../imapServer.js";
import config from "../../config.json" with { type: "json" };

export class StartTLSCommand extends Command {
    command = (tag, args) => {
        if (this.connection.secure)
            return this.connection.send(`${tag} BAD already secure`);

        const oldSocket = this.connection.socket;

        this.connection.send(`${tag} OK Begin TLS negotiation now`, () => {
            oldSocket.pause();

            oldSocket.removeAllListeners("data");
            oldSocket.removeAllListeners("error");

            this.connection.buffer = "";

            const secureContext = tls.createSecureContext({
                key: fs.readFileSync(config.tls.private_key),
                cert: fs.readFileSync(config.tls.cert),
                minVersion: 'TLSv1.2',
                maxVersion: 'TLSv1.3'
            });

            const tlsSocket = new tls.TLSSocket(oldSocket, {
                isServer: true,
                secureContext: secureContext,
                isReadable: true, 
                isWritable: true
            });

            this.connection.socket = tlsSocket;

            tlsSocket.on("error", (error) => {
                console.error("STARTTLS error:", error);
            });
    
            tlsSocket.on("close", () => {
                removeConnection(this);
            });
    
            tlsSocket.once("secure", () => {
                console.log("STARTTLS handshake completed", tlsSocket.getProtocol());
    
                this.connection.secure = true;
    
                this.connection.removeCapability("STARTTLS");
                this.connection.removeCapability("LOGINDISABLED");
    
                this.connection.addCapabiltity("AUTH=PLAIN");
    
                tlsSocket.on("data", (data) => {
                    this.connection.buffer += data.toString();
    
                    this.connection.processBuffer();
                });
            });
    
            tlsSocket.resume();
        });
    };
}