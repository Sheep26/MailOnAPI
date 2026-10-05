import { Resend } from 'resend';
import { Email, parseEmailAddress } from './email.js';

export class EmailResend extends Email {
    constructor (database, auth) {
        super(database, auth);
        this.resend = new Resend(auth);
    }

    async send(user, to, reply_to, subject, text, bcc=[], cc=[]) {
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
            this.database.addEmail(user.email, [to], `${user.username} <${user.email}>`, [reply_to], bcc, cc, data.id, null, null, subject, text, null, null, mailbox.uid, ["\\Seen"]);
    }

    async sendHTML(user, to, reply_to, subject, html, bcc=[], cc=[]) {
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
            this.database.addEmail(user.email, [to], `${user.username} <${user.email}>`, [reply_to], bcc, cc, data.id, null, null, subject, html, null, null, mailbox.uid, ["\\Seen"], null, '1.0', 'utf-8', 'text/html');
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
            this.database.addEmail(user.email, mail.reply_to, `${user.username} <${user.email}>`, [user.email], [], [], data.id, null, null, `Re: ${mail.subject}`, content, null, [...mail.email_references ?? "", mail.message_id], mailbox.uid, ["\\Seen"]);
    }

    async handle(body) {
        const { data } = await this.resend.emails.receiving.get(body.data.email_id);

        let references = data.headers.references ?? null;

        if (references)
            try {
                references = JSON.parse(references);
            } catch (error) {
                if (error instanceof SyntaxError)
                    references = [references];
            }

        for (let to of data.to) {  
            const mailbox = await this.database.getMailBox(to, 'Inbox');

            if (mailbox) {
                const user = await this.database.getUser(to);

                if (!user) {
                    await this.resend.emails.send({
                        from: `Email bounce <noreply@drewfitzgerald.co.nz>`,
                        to: data.from,
                        replyTo: 'noreply@drewfitzgerald.co.nz',
                        subject: `Email address ${to} is not active`,
                        html: `<span>Email address <strong>${to}</string> is not currently active</span>`
                    });

                    continue;
                }

                await this.database.addEmail(to, data.to, data.from, data.reply_to, data.bcc, data.cc, data.id, data.message_id, data.html_format, data.subject, data.headers['content-type'] == 'text/plain' ? data.text : data.html, data.attachments, references, mailbox.uid, [], data.headers['in-reply-to'], data.headers['mime-version'], 'utf-8', data.headers['content-type'], data.headers['received']);
                await super.updateImap(user.email, mailbox.uid);
            }
        }

        console.log(`Email ${data.id} has been recieved from ${data.headers.from}`);
    }

    async getAttatchment(email_id, attachment_id) {
        const { data, error } = await this.resend.emails.receiving.attachments.get({emailId: email_id, id: attachment_id});
        const download_url = data.download_url;

        return { download_url, error };
    }
}