import mysql from "mysql2/promise";
import config from "../config.json" with { type: "json" };

export let db;

export async function setDB(name) {
    db = mysql.createPool({
        host: config.database.mysql_host,
        user: config.database.mysql_user,
        password: config.database.mysql_password,
        database: name,
        port: config.database.mysql_port
    });

    await db.execute('CREATE TABLE IF NOT EXISTS users (user_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, username TEXT NOT NULL, passwd TEXT NOT NULL, email TEXT NOT NULL)');
    await db.execute('CREATE TABLE IF NOT EXISTS mailboxes (mailbox_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, belongs_to TEXT NOT NULL, name TEXT NOT NULL, uid INT UNSIGNED DEFAULT 0)');
    await db.execute('CREATE TABLE IF NOT EXISTS emails (email_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, belongs_to TEXT NOT NULL, mail_to TEXT NOT NULL, mail_from TEXT NOT NULL, name_from TEXT, reply_to TEXT NOT NULL, bcc TEXT NOT NULL, cc TEXT NOT NULL, mail_id TEXT NOT NULL, message_id TEXT, subject TEXT, content TEXT, attachments JSON, html_format TEXT, time BIGINT NOT NULL, email_references JSON, mail_box INT NOT NULL, seen INT DEFAULT 0)');
}

export async function initDB() {
    const connection = await mysql.createConnection({
        host: config.database.mysql_host,
        user: config.database.mysql_user,
        password: config.database.mysql_password,
        port: config.database.mysql_port
    });

    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${config.database.mysql_db}\``);
    await connection.end();

    await setDB(config.database.mysql_db);
}