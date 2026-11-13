import { db, initDB } from './connection.js';
import { BcryptManager } from './encryption.js';
import { Session } from '../sessions/sessionManager.js';
import config from "../config.json" with { type: "json" };
import crypto from 'crypto';

const hasher = new BcryptManager();

export class DatabaseManager {
    constructor() {
        this.attachments = null;

        initDB();
    }

    setAttachmentManager(attachmentManager) {
        this.attachments = attachmentManager;
    }

    randStr(len) {
        return crypto.randomBytes(len).toString('base64url').slice(0, len);
    }

    getContentTransferEncoding(charset='utf-8') {
        for (const [encoding, charsets] of Object.entries(config.encodings))
            if (charsets.includes(charset.toLowerCase()))
                return encoding;

        return "quoted-printable";
    }

    async createMessageBody(content, content_type, boundary, charset, attachments, mail_id) {
        if (!content_type?.startsWith("multipart") && (!attachments || attachments?.length == 0))
            return content;

        let body = `${content}\r\n`;

        /*
        [{"id": "a4725d19-3628-43e3-917c-ee2eebe9d5e4", "size": 3879, "filename": "Screenshot_20260820_101002.png",
        "content_id": "<ii_muuvphhg0>", "content_type": "image/png",
        "content_disposition": "inline"},
        {"id": "7a7fc67b-8a6e-48d1-89f1-be8e50d60ace", "size": 4045216,
        "filename": "Composition 2 - FINAL.mp3", "content_id": "<f_muuvpkn01>",
        "content_type": "audio/mpeg", "content_disposition": "attachment"}]
        */

        if (!body.trim().startsWith(`--${boundary}`) && !body.trim().toLowerCase().replaceAll('-', '').startsWith(`this is a multipart message in mime format.`)) {
            body = `--${boundary}\r\n`;
            body += `Content-Type: text/html; charset=${charset ?? 'utf-8'}\r\n`;
            body += `Content-Transfer-Encoding: ${this.getContentTransferEncoding(charset)}\r\n`
            body += `\r\n${content}\r\n`;
        }

        for (let attachment of attachments ?? []) {
            const buffer = Buffer.from(await this.attachments.downloadAttachment(String(mail_id), String(attachment.id)));

            body += `--${boundary}\r\n`;
            body += `Content-Type: ${attachment.content_type || "application/octet-stream"}\r\n`;
            body += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
            body += `Content-Transfer-Encoding: base64\r\n`;

            body += `\r\n`;
            body += `${buffer.toString('base64')}\r\n`;
        }

        if (!body.trim().endsWith(`--${boundary}--`))
            body += `--${boundary}--`;

        return body;
    }

    async addEmail(context={}) {
        // belongs_to, to, from, reply_to, bcc, cc, mail_id, message_id, html_format, subject, content, attachments, references, mail_box, flags=[], in_reply_to=null, mime_version=null, charset='utf-8', content_type="text/plain", received=null, boundary=null, headers={}
        const belongs_to = context.belongs_to ?? null;
        const to = context.to ?? null;
        const from = context.from ?? null;
        const reply_to = context.reply_to ?? null;
        const bcc = context.bcc ?? [];
        const cc = context.cc ?? [];
        const mail_id = context.mail_id ?? null;
        const message_id = context.message_id ?? null;
        const html_format = context.html_format ?? null;
        const subject = context.subject ?? null;
        const content = context.content ?? null;
        const attachments = context.attachments ?? null;
        const references = context.references ?? null;
        const mail_box = context.mail_box ?? null;
        const flags = context.flags ?? [];
        const in_reply_to = context.in_reply_to ?? null;
        const mime_version = context.mime_version ?? null;
        const charset = context.charset ?? "utf-8";
        const content_type = context.content_type ?? "text/plain";
        const received = context.received ?? null;
        const boundary = context.boundary ?? this.randStr(28);
        const headers = context.headers ?? {};

        const mailbox = await this.getMailBoxUID(belongs_to, mail_box);

        if (!mailbox)
            return;

        await db.execute('INSERT INTO emails (belongs_to, mail_to, mail_from, reply_to, bcc, cc, mail_id, message_id, html_format, subject, content, email_references, time, mail_box, flags, uid, in_reply_to, mime_version, charset, content_type, received, boundary, headers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            belongs_to,
            to,
            from,
            reply_to,
            bcc,
            cc,
            mail_id,
            message_id,
            html_format ?? 'text/plain',
            subject,
            await this.createMessageBody(content, content_type, boundary, charset, attachments, mail_id),
            references,
            Date.now(),
            mail_box,
            flags,
            mailbox.uid_next,
            in_reply_to,
            mime_version,
            charset,
            content_type,
            received,
            boundary,
            headers
        ]);

        await this.incrementUIDNext(mailbox.belongs_to, mailbox.name);
    }

    async getUsersEmails(email) {
        const [rows] = await db.query('SELECT * FROM emails WHERE belongs_to=?', [email]);

        return rows;
    }

    async getEmail(mail_id, email) {
        const [rows] = await db.query('SELECT * FROM emails WHERE mail_id=? AND belongs_to=?', [mail_id, email]);

        if (rows.length > 0)
            return rows[0];

        return null;
    }

    async getEmailUID(belongs_to, UID, mailbox_UID) {
        const [rows] = await db.query('SELECT * FROM emails WHERE uid=? AND mail_box=? AND belongs_to=?', [UID, mailbox_UID, belongs_to]);

        if (rows.length > 0)
            return rows[0];

        return null;
    }

    async getUsers() {
        const [rows] = await db.query("SELECT * FROM users");

        return rows;
    }

    async addUser(username, passwd, email) {
        const [rows] = await db.query('SELECT email FROM users WHERE email=?', [email]);

        if (rows[0])
            return false;

        await db.execute('INSERT INTO users (username, passwd, email) VALUES (?, ?, ?)', [username, await hasher.hash(passwd), email]);
        await this.addMailBox(email, 'Inbox', "\\Answered \\Flagged \\Deleted \\Seen \\Draft", "", true);
        await this.addMailBox(email, 'Sent', "\\Answered \\Flagged \\Deleted \\Seen \\Draft", "\\Sent", true);
        await this.addMailBox(email, 'Drafts', "\\Answered \\Flagged \\Deleted \\Seen \\Draft", "\\Drafts", true);
        await this.addMailBox(email, 'Trash', "\\Answered \\Flagged \\Deleted \\Seen \\Draft", "\\Trash", true);
        await this.addMailBox(email, 'Spam', "\\Answered \\Flagged \\Deleted \\Seen \\Draft", "\\Junk", true);

        return true;
    }

    async getUser(email) {
        const [rows] = await db.query("SELECT * FROM users WHERE email=?", [email]);

        return rows[0];
    }

    async markDeleted(mail_id, user_email) {
        await db.execute(`UPDATE emails SET flags=JSON_ARRAY_APPEND(flags, '$', ?) WHERE mail_id=? AND belongs_to=?`, ['\\Deleted', mail_id, user_email]);
    }

    async deleteMarkedDeleted(email) {
        await db.execute(`DELETE FROM emails WHERE belongs_to=? AND JSON_CONTAINS(flags, ?)`, [email, JSON.stringify('\\Deleted')]);
    }

    async getMarkedDeleted(email) {
        const [rows] = await db.query(`SELECT * FROM emails WHERE belongs_to=? AND JSON_CONTAINS(flags, ?)`, [email, JSON.stringify('\\Deleted')]);

        return rows;
    }

    async deleteEmail(mail_id, user_email) {
        await db.execute('DELETE FROM emails WHERE mail_id=? AND belongs_to=?', [mail_id, user_email]);
    }

    async markNotRecent(email, mail_id) {
        await db.execute('UPDATE emails SET recent=0 WHERE belongs_to=? AND mail_id=?', [email, mail_id])
    }

    async incrementUIDNext(email, name) {
        await db.execute('UPDATE mailboxes SET uid_next=uid_next + 1 WHERE belongs_to=? AND name=?', [email, name]);
    }

    async incrementUIDNextUID(email, uid) {
        await db.execute('UPDATE mailboxes SET uid_next=uid_next + 1 WHERE belongs_to=? AND uid=?', [email, uid]);
    }

    async getMailBox(email, name) {
        const [rows] = await db.query('SELECT * FROM mailboxes WHERE belongs_to=? AND name=?', [email, name]);

        return rows[0];
    }

    async getMailBoxUID(email, uid) {
        const [rows] = await db.query('SELECT * FROM mailboxes WHERE belongs_to=? AND uid=?', [email, uid]);

        return rows[0];
    }

    async getMailBoxes(email) {
        const [rows] = await db.query("SELECT * FROM mailboxes WHERE belongs_to=?", [email]);

        return rows;
    }

    async renameMailBox(email, mailbox, name) {
        await db.execute('UPDATE mailboxes SET name=? WHERE name=? AND belongs_to=?', [name, mailbox, email]);
    }

    async addMailBox(email, name, flags="\\Answered \\Flagged \\Deleted \\Seen \\Draft", special_use_flags="", permanent=false) {
        const [rows] = await db.query('SELECT * FROM mailboxes WHERE belongs_to=? AND name=?', [email, name]);

        if (rows[0])
            return;

        await db.execute("INSERT INTO mailboxes (belongs_to, name, uid, flags, special_use_flags, permanent) VALUES (?, ?, ?, ?, ?, ?)", [email, name, crypto.randomBytes(4).readUint32BE(), flags, special_use_flags, permanent])
    }

    async deleteMailBox(email, name) {
        await db.execute('DELETE FROM mailboxes WHERE belongs_to=? AND name=? AND permanent=0', [email, name]);
    }

    async moveMail(email, mail_id, mail_box) {
        const mailbox = await this.getMailBoxUID(email, mail_box);

        if (!mailbox)
            return;

        await db.execute("UPDATE emails SET mail_box=?, uid=? WHERE belongs_to=? AND mail_id=?", [mail_box, mailbox.uid_next, email, mail_id]);
        this.incrementUIDNext(email, mailbox.name);
    }

    async getEmailIndex(email, mail_id, mailbox) {
        const [rows] = await db.query("SELECT row_num FROM (SELECT *, ROW_NUMBER() OVER (ORDER BY email_id) AS row_num FROM emails WHERE belongs_to=? AND mail_box=?) AS temp_table WHERE mail_id=?", [email, mailbox, mail_id]);

        return rows[0].row_num;
    }

    async addFlag(mail_id, email, flag) {
        await db.execute("UPDATE emails SET flags=JSON_ARRAY_APPEND(flags, '$', ?) WHERE mail_id=? AND belongs_to=?", [flag, mail_id, email]);
    }

    async removeFlag(mail_id, email, flag) {
        await db.execute(`UPDATE emails SET flags=(SELECT COALESCE(JSON_ARRAYAGG(f.flag), JSON_ARRAY()) FROM JSON_TABLE(emails.flags, '$[*]' COLUMNS (flag VARCHAR(255) PATH '$')) AS f WHERE f.flag <> ?) WHERE mail_id = ? AND belongs_to = ?`, [flag, mail_id, email]);
    }

    async markSeen(mail_id, email) {
        await db.execute("UPDATE emails SET flags=JSON_ARRAY_APPEND(flags, '$', ?) WHERE mail_id=? AND belongs_to=?", ['\\Seen', mail_id, email]);
    }

    async updateUsername(email, new_username) {
        await db.execute("UPDATE users SET username=? WHERE email=?", [new_username, email]);
    }

    async markSubscribed(email, mailbox) {
        await db.execute("UPDATE mailboxes SET subscribed=1 WHERE belongs_to=? AND name=?", [email, mailbox]);
    }

    async markUnsubscribed(email, mailbox) {
        await db.execute("UPDATE mailboxes SET subscribed=0 WHERE belongs_to=? AND name=?", [email, mailbox]);
    }

    async login(email, password) {
        const user = await this.getUser(email);

        if (!user || !await hasher.compareHashes(password, user.passwd))
            return null;

        const session = new Session(email, 7.884e+9);
        return session;
    }
}