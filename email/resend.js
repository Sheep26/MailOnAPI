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
            this.database.addEmail({
                belongs_to: user.email,
                to: [to],
                from: `${user.username} <${user.email}>`,
                reply_to: [reply_to],
                bcc: bcc,
                cc: cc,
                mail_id: data.id,
                subject: subject,
                content: text,
                mail_box: mailbox.uid,
                flags: ["\\Seen"],
                content_type: 'text/html',
                mime_version: '1.0'
            });
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
            this.database.addEmail({
                //user.email, [to], `${user.username} <${user.email}>`, [reply_to], bcc, cc, data.id, null, null, subject, html, null, null, mailbox.uid, ["\\Seen"], null,
                // '1.0', 'utf-8', 'text/html'
                belongs_to: user.email,
                to: [to],
                from: `${user.username} <${user.email}>`,
                reply_to: [reply_to],
                bcc: bcc,
                cc: cc,
                mail_id: data.id,
                subject: subject,
                content: html,
                mail_box: mailbox.uid,
                flags: ["\\Seen"],
                content_type: 'text/html',
                mime_version: '1.0'
            });
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
            this.database.addEmail({
                belongs_to: user.email,
                to: [mail.reply_to],
                from: `${user.username} <${user.email}>`,
                reply_to: [user.email],
                mail_id: data.id,
                subject: `Re: ${mail.subject}`,
                content: content,
                references: [...mail.email_references ?? "", mail.message_id],
                mail_box: mailbox.uid,
                flags: ["\\Seen"]
            });
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
            const user = await this.database.getUser(to);
            const mailbox = await this.database.getMailBox(to, 'Inbox');

            if (!user) {
                console.log(`Email Address ${to} does not exist`);

                /* await this.resend.emails.send({
                    from: `Email bounce <noreply@drewfitzgerald.co.nz>`,
                    to: data.from,
                    replyTo: 'noreply@drewfitzgerald.co.nz',
                    subject: `Email address ${to} is not active`,
                    html: `<strong>Email address ${to} is not currently active</strong>`
                }); */ // Don't it bounces when addresses don't exist that we send to and damages our trust.

                continue;
            }

            if (mailbox) {
                const boundary = this.randStr(28);

                await this.database.addEmail({
                    belongs_to: to,
                    to: data.to,
                    from: data.headers.from,
                    reply_to: data.reply_to.length ? data.reply_to : [data.from],
                    bcc: data.bcc,
                    cc: data.cc,
                    mail_id: data.id,
                    message_id: data.message_id,
                    html_format: data.html_format,
                    subject: data.subject,
                    content: await this.createMessageBody({
                        text: data.text,
                        html: data.html,
                        content_type: data.headers['content-type'],
                        boundary: boundary,
                        attachments: data.attachments,
                        mail_id: data.id
                    }),
                    references: references,
                    mail_box: mailbox.uid,
                    in_reply_to: data.headers['in-reply-to'],
                    mime_version: data.headers['mime-version'],
                    content_type: data.headers['content-type'],
                    received: data.headers['received'],
                    headers: data.headers,
                    boundary: boundary
                });

                await super.updateImap(user.email, mailbox.uid);
            }
        }

        console.log(`Email ${data.id} has been recieved from ${data.headers.from}`);
    }

    async createMessageBody(ctx={}) { // text, html, content_type, boundary, attachments, mail_id
        const text = ctx.text;
        const html = ctx.html;
        const content_type = ctx.content_type;
        const boundary = ctx.boundary;
        const attachments = ctx.attachments;
        const mail_id = ctx.mail_id;

        if (!content_type?.startsWith("multipart") && attachments?.length == 0)
            return content_type == "text/plain" ? text : html;

        let body = `This is a multipart message in mime format.\r\n\r\n`;

        if (html) {
            body += `--${boundary}\r\n`;
            body += `Content-Type: text/html; charset='utf-8'\r\n`;
            body += `Content-Transfer-Encoding: 8bit\r\n`;
            body += `\r\n${html}\r\n`;
        }

        if (text) {
            body += `--${boundary}\r\n`;
            body += `Content-Type: text/plain; charset='utf-8'\r\n`;
            body += `Content-Transfer-Encoding: 8bit\r\n`;
            body += `\r\n${text}\r\n`;
        }

        /*
        [{"id": "a4725d19-3628-43e3-917c-ee2eebe9d5e4", "size": 3879, "filename": "Screenshot_20260820_101002.png",
        "content_id": "<ii_muuvphhg0>", "content_type": "image/png",
        "content_disposition": "inline"},
        {"id": "7a7fc67b-8a6e-48d1-89f1-be8e50d60ace", "size": 4045216,
        "filename": "Composition 2 - FINAL.mp3", "content_id": "<f_muuvpkn01>",
        "content_type": "audio/mpeg", "content_disposition": "attachment"}]
        */

        for (let attachment of attachments ?? []) {
            const buffer = Buffer.from(await this.downloadAttachment(String(mail_id), String(attachment.id)));

            body += `--${boundary}\r\n`;
            body += `Content-Type: ${attachment.content_type || "application/octet-stream"}\r\n`;
            body += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
            body += `Content-Transfer-Encoding: base64\r\n`;

            body += `\r\n`;
            body += `${buffer.toString('base64')}\r\n`;
        }

        body += `--${boundary}--`;
        return body;
    }

    async getAttatchment(email_id, attachment_id) {
        const { data, error } = await this.resend.emails.receiving.attachments.get({emailId: email_id, id: attachment_id});
        const download_url = data.download_url;

        return { download_url, error };
    }
}