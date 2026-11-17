import { imapHandleRecieved } from "../imap/imapServer.js";
import crypto from 'crypto';

export function parseEmailAddress(value) {
    const match = value.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
    let values = {name: null, email: value.trim()};

    if (match) {
        values.name = match[1].trim().replaceAll("\"", "");
        values.email = match[2].trim();
    }

    return values;
};

export class Email {
    constructor (database, auth) {
        this.database = database;
    }

    async send(user, to, reply_to, subject, text) {
        
    }

    async sendHTML(user, to, reply_to, subject, html) {
        
    }

    async handle(req) {

    }

    async reply(user, mail_id, content) {

    }

    async getAttatchment(email_id, attachment_id) {
        
    }

    async createMessageBody(ctx={}) {
        return null;
    }

    randStr(len) {
        return crypto.randomBytes(len).toString('base64url').slice(0, len);
    }

    async downloadAttachment(email_id, attachment_id) {
        const { download_url, error } = await this.getAttatchment(email_id, attachment_id);

        if (error)
            throw new Error(`Failed to get attachment: ${error}`);

        if (!download_url)
            throw new Error("No download URL returned");

        const response = await fetch(download_url);

        if (!response.ok)
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);

        return await response.arrayBuffer();
    }

    async updateImap(email, mailbox) {
        const emails = await this.database.getUsersEmails(email);
        const emails_filtered = emails.filter(email => email.mail_box == mailbox);

        imapHandleRecieved(email, emails_filtered.length, mailbox);
    }
}