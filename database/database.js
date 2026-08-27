import { db, initDB } from './connection.js';
import { BcryptManager, BcryptCache } from './encryption.js';
import { Session } from '../sessions/sessionManager.js';

const hasher = new BcryptManager();

export class DatabaseManager {
    constructor() {
        initDB();
    }

    async addEmail(belongs_to, to, from, reply_to, bcc, cc, mail_id, message_id, html_format, subject, content, attachments, references, mail_box, seen=0) {
        await db.execute('INSERT INTO emails (belongs_to, mail_to, mail_from, reply_to, bcc, cc, mail_id, message_id, html_format, subject, content, attachments, email_references, time, mail_box, seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
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
            seen
        ]);
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

        await db.execute('INSERT INTO users (username, passwd, email, mail_boxes) VALUES (?, ?, ?, ?)', [username, await hasher.hash(passwd), email, ['Inbox', 'Sent']]);
        return true;
    }

    async getUser(email) {
        const [rows] = await db.query("SELECT * FROM users WHERE email=?", [email]);

        return rows[0];
    }

    async deleteEmail(mail_id, user_email) {
        await db.execute('DELETE FROM emails WHERE mail_id=? AND belongs_to=?', [mail_id, user_email]);
    }

    async getMailBoxes(email) {
        const [rows] = await db.query("SELECT mail_boxes FROM users WHERE email=?", [email]);

        if (!rows[0])
            return null;

        return rows[0].mail_boxes;
    }

    async addMailBox(email, mail_box) {
        const [rows] = await db.query('SELECT mail_boxes FROM users WHERE email=?');

        if (!rows[0])
            return;

        for (let mailbox of user.mail_boxes)
            if (mailbox == mail_box)
                return;

        await db.execute("UPDATE users SET mail_boxes=JSON_ARRAY_APPEND(mail_boxes, '$', ?) WHERE email=?", [mail_box, email])
    }

    async deleteMailBoxName(email, mail_box) {
        if (mail_box.toLowerCase() == "inbox" || mail_box.toLowerCase() == "sent")
            return;

        await db.execute("UPDATE users SET mail_boxes=JSON_REMOVE(mail_boxes, REPLACE(JSON_SEARCH(mail_boxes, 'one', ?))) WHERE JSON_SEARCH(mail_boxes, 'one', ?) IS NOT NULL AND email=?", [mail_box, mail_box, email]);
    }

    async deleteMailBox(email, mail_box) {
        await db.execute("UPDATE users SET mail_boxes=JSON_REMOVE(mail_boxes, '$[?]')  WHERE email=?", [mail_box, email]);
    }

    async markSeen(mail_id, email) {
        await db.execute("UPDATE emails SET seen=1 WHERE mail_id=? AND belongs_to=?", [mail_id, email]);
    }

    async login(email, password) {
        const user = await this.getUser(email);

        if (!user || !hasher.compareHashes(password, user.passwd))
            return null;

        const session = new Session(email, 7.884e+9);
        return session;
    }
}