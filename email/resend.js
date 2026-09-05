import { Resend } from 'resend';
import { Email, parseEmailAddress } from './email.js';

export class EmailResend extends Email {
    constructor (database, auth) {
        super(database, auth);
        this.resend = new Resend(auth);
    }

    async send(user, to, reply_to, subject, text) {
        const { data } = await this.resend.emails.send({
            from: `${user.username} <${user.email}>`,
            to: to,
            replyTo: reply_to,
            subject: subject,
            text: text
        });

        console.log(`Email ${data.id} has been sent`);

        const mailbox = await this.database.getMailBox(user.email, 'Sent');

        if (mailbox)
            this.database.addEmail(user.email, to, `${user.username} <${user.email}>`, reply_to, JSON.stringify([]), JSON.stringify([]), data.id, null, null, subject, text, null, null, 1, mailbox.uid);
    }

    async sendHTML(user, to, reply_to, subject, html) {
        const { data } = await this.resend.emails.send({
            from: `${user.username} <${user.email}>`,
            to: to,
            replyTo: reply_to,
            subject: subject,
            html: html
        });

        console.log(`Email ${data.id} has been sent`);

        const mailbox = await this.database.getMailBox(user.email, 'Sent');

        if (mailbox)
            this.database.addEmail(user.email, to, `${user.username} <${user.email}>`, reply_to, JSON.stringify([]), JSON.stringify([]), data.id, null, null, subject, html, null, null, 1, mailbox.uid);
    }

    async reply(user, mail_id, content) {
        const mail = await this.database.getEmail(mail_id, user.email);

        if (!mail)
            return;

        const references = [...mail.email_references ?? "", mail.message_id].join(' ');

        const { data }  = await this.resend.emails.send({
            from: `${user.username} <${user.email}>`,
            to: mail.reply_to,
            replyTo: user.email,
            subject: `Re: ${mail.subject}`,
            text: content,
            headers: {
                'In-Reply-To': mail.message_id,
                'References': references
            }
        });

        console.log(`Email ${data.id} has been sent`);

        const mailbox = await this.database.getMailBox(user.email, 'Sent');

        if (mailbox)
            this.database.addEmail(user.email, mail.reply_to, `${user.username} <${user.email}>`, user.email, JSON.stringify([]), JSON.stringify([]), data.id, null, null, `Re: ${mail.subject}`, content, null, [...mail.email_references ?? "", mail.message_id], 1, mailbox.uid);
    }

    async handle(body) {
        const { data } = await this.resend.emails.receiving.get(body.data.email_id);
        const user = await this.database.getUser(data.to[0]);

        if (!user)
            return;

        let parsed = parseEmailAddress(data.headers.from);

        let references = data.headers.references ?? null;

        if (references)
            try {
                references = JSON.parse(references);
            } catch (error) {
                if (error instanceof SyntaxError)
                    references = [references];
            }

        const mailbox = await this.database.getMailBox(user.email, 'Inbox');

        if (mailbox)
            this.database.addEmail(data.to[0], data.to[0], data.headers.from, data.headers['return-path'], JSON.stringify(data.bcc), JSON.stringify(data.cc), data.id, data.message_id, data.html_format, data.subject, data.html, data.attachments, references, mailbox.uid);

        console.log(`Email ${data.id} has been recieved from ${data.headers.from}`);
    }

    async getAttatchment(email_id, attachment_id) {
        const { data, error } = await this.resend.emails.receiving.attachments.get({emailId: email_id, id: attachment_id});
        const download_url = data.download_url;

        return { download_url, error };
    }
}