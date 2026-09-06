import { db, initDB } from './connection.js';
import { BcryptManager, BcryptCache } from './encryption.js';
import { Session } from '../sessions/sessionManager.js';
import crypto from 'crypto';

const hasher = new BcryptManager();

export class DatabaseManager {
    constructor() {
        initDB();
    }

    async addEmail(belongs_to, to, from, reply_to, bcc, cc, mail_id, message_id, html_format, subject, content, attachments, references, mail_box, seen=0) {
        const mailbox = await this.getMailBoxUID(belongs_to, mail_box);

        if (!mailbox)
            return;

        await db.execute('INSERT INTO emails (belongs_to, mail_to, mail_from, reply_to, bcc, cc, mail_id, message_id, html_format, subject, content, attachments, email_references, time, mail_box, seen, uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            belongs_to,
            to,
            from,
            reply_to,
            bcc,
            cc,
            mail_id,
            message_id,
            html_format,
            subject,
            content,
            attachments,
            references,
            Date.now(),
            mail_box,
            seen,
            mailbox.uid_next
        ]);

        this.incrementUIDNext(mailbox.belongs_to, mailbox.name);
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

    async getUsers() {
        const [rows] = await db.query("SELECT * FROM users");

        return rows;
    }

    async addUser(username, passwd, email) {
        const [rows] = await db.query('SELECT email FROM users WHERE email=?', [email]);

        if (rows[0])
            return false;

        await db.execute('INSERT INTO users (username, passwd, email) VALUES (?, ?, ?)', [username, await hasher.hash(passwd), email]);
        await this.addMailBox(email, 'Inbox');
        await this.addMailBox(email, 'Sent');

        return true;
    }

    async getUser(email) {
        const [rows] = await db.query("SELECT * FROM users WHERE email=?", [email]);

        return rows[0];
    }

    async deleteEmail(mail_id, user_email) {
        await db.execute('DELETE FROM emails WHERE mail_id=? AND belongs_to=?', [mail_id, user_email]);
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

    async addMailBox(email, name) {
        const [rows] = await db.query('SELECT * FROM mailboxes WHERE belongs_to=? AND name=?', [email, name]);

        if (rows[0])
            return;

        const allBoxes = this.getMailBoxes(email);

        await db.execute("INSERT INTO mailboxes (belongs_to, name, uid) VALUES (?, ?, ?)", [email, name, crypto.randomBytes(4).readUint32BE()])
    }

    async deleteMailBox(email, name) {
        await db.execute('DELETE FROM mailboxes WHERE belongs_to=? AND name=?', [email, name]);
    }

    async moveMail(email, mail_id, mail_box) {
        const mailbox = await this.getMailBoxUID(email, mail_box);

        if (!mailbox)
            return;

        await db.execute("UPDATE emails SET mail_box=?, uid=? WHERE belongs_to=? AND mail_id=?", [mail_box, mailbox.uid_next, email, mail_id]);
        this.incrementUIDNext(email, mailbox.name);
    }

    async markSeen(mail_id, email) {
        await db.execute("UPDATE emails SET seen=1 WHERE mail_id=? AND belongs_to=?", [mail_id, email]);
    }

    async login(email, password) {
        const user = await this.getUser(email);

        if (!user || !await hasher.compareHashes(password, user.passwd))
            return null;

        const session = new Session(email, 7.884e+9);
        return session;
    }
}