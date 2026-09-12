import { imapHandleRecieved } from "../imap/imapServer.js";

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

    async updateImap(email, mailbox) {
        console.log(email);
        const emails = await this.database.getUsersEmails(email);
        const emails_filtered = emails.filter(email => email.mail_box == mailbox);

        imapHandleRecieved(email, emails_filtered.length, mailbox);
    }
}