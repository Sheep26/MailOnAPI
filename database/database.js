import { db, initDB } from './connection.js';
import { BcryptManager, BcryptCache } from './encryption.js';
import { Session } from '../sessions/sessionManager.js';
import config from "../config.json" with { type: "json" };
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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

    async addEmail(belongs_to, to, from, reply_to, bcc, cc, mail_id, message_id, html_format, subject, content, attachments, references, mail_box, flags=[], in_reply_to=null, mime_version=null, charset='utf-8', content_type="text/plain", received=null, boundary=null) {
        const mailbox = await this.getMailBoxUID(belongs_to, mail_box);

        if (!mailbox)
            return;

        await db.execute('INSERT INTO emails (belongs_to, mail_to, mail_from, reply_to, bcc, cc, mail_id, message_id, html_format, subject, content, attachments, email_references, time, mail_box, flags, uid, in_reply_to, mime_version, charset, content_type, received, boundary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
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
            content,
            attachments,
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
            boundary ?? this.randStr(28)
        ]);

        for (let attachment of attachments ?? []) {
            if (!fs.existsSync(path.join(config.attachment_path, String(mail_id), String(attachment.id)))) {
                console.log(`Downloading attachment ${attachment.filename}`);

                await this.attachments.downloadAttachment(String(mail_id), String(attachment.id));
            }
        }

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
        await db.execute(
            `UPDATE emails
            SET flags = (
                SELECT COALESCE(JSON_ARRAYAGG(f.flag), JSON_ARRAY())
                FROM JSON_TABLE(
                    emails.flags,
                    '$[*]' COLUMNS (
                        flag VARCHAR(255) PATH '$'
                    )
                ) AS f
                WHERE f.flag <> ?
            )
            WHERE mail_id = ? AND belongs_to = ?`,
            [flag, mail_id, email]
        );
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