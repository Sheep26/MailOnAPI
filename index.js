import express from 'express';
import cookieParser from "cookie-parser";
import morgan from 'morgan';
import config from "./config.json" with { type: "json" };
import { email_types } from './email/types.js';
import { DatabaseManager } from './database/database.js';
import { SessionManager } from './sessions/sessionManager.js';
import { existsSync } from 'fs';
import renderUtils from './renderUtils.js';

const app = express();
const PORT = config.port | 8080;

const database = new DatabaseManager();
const email = new email_types[config.email.type](database, config.email.auth);
const sessionManager = new SessionManager();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', './templates');
app.use('/static', express.static('static'));
app.use(cookieParser());
app.use(morgan('combined'));

app.post('/recieve', (req, res) => {
    email.handle(req.body);

    res.sendStatus(200);
});

app.post("/api/send", async (req, res) => {
    const session = await sessionManager.getSession(req.cookies.session);

    if (!session)
        return res.sendStatus(401);

    const user = await database.getUser(session.user_id);

    await email.send(user, req.body.to, session.user_id, req.body.subject, req.body.content);
    res.redirect('/');
});

app.post("/api/reply", async (req, res) => {
    const session = await sessionManager.getSession(req.cookies.session);

    if (!session)
        return res.sendStatus(401);

    const user = await database.getUser(session.user_id);

    await email.reply(user, req.body.mail_id, req.body.content);
    res.redirect('/');
});

app.post('/api/login', async (req, res) => {
    const session = await database.login(req.body.email, req.body.password);

    if (!session)
        return res.sendStatus(401);

    sessionManager.addSession(session);

    res.cookie('session', session.session, { maxAge: 7.884e+9, httpOnly: true, secure: config.cookies_secure, sameSite: 'strict' });
    res.redirect("/");
});

app.post('/api/valid_login', async (req, res) => {
    const session = await database.login(req.body.email, req.body.password);

    res.sendStatus(session ? 200 : 401);
});

app.get('/api/get_emails', async (req, res) => {
    const session = await sessionManager.getSession(req.cookies.session);

    if (!session)
        return res.sendStatus(401);

    res.send(await database.getUsersEmails(session.user_id));
});

app.get('/api/get_email', async (req, res) => {
    const session = await sessionManager.getSession(req.cookies.session);

    if (!session)
        return res.sendStatus(401);

    res.send(await database.getEmail(req.query.mail_id, session.user_id));
});

app.post('/api/delete_email', async (req, res) => {
    const session = await sessionManager.getSession(req.cookies.session);

    if (!session)
        return res.sendStatus(401);

    await database.deleteEmail(req.body.mail_id, session.user_id);
    res.sendStatus(200);
});

app.get('/api/get_mailboxes', async (req, res) => {
    const session = await sessionManager.getSession(req.cookies.session);

    if (!session)
        return res.sendStatus(401);

    res.send(await database.getMailBoxes(session.user_id));
});

app.get('/attachment/:email_id/:attachment_id', async (req, res) => {
    const session = await sessionManager.getSession(req.cookies.session);
    const { email_id, attachment_id } = req.params;

    if (!session)
        return res.sendStatus(401);

    const mail = await database.getEmail(email_id, session.user_id);

    if (!mail)
        return res.sendStatus(403);

    try {
        const { download_url, error } = await email.getAttatchment(email_id, attachment_id);

        if (error) {
            console.error(error);

            return res.status(500).send('Failed to get attachment');
        }

        return res.redirect(download_url);
    } catch (err) {
        console.error(err);

        res.status(500).send('Failed to download attachment');
    }
});

app.use(async (req, res, next) => {
    /*
    * This function catches all uncaught routes and sends either a 404 for if the content is missing or sends the requested webpage.
    * The purpose of this is to cut down on unnessacary routes.
    * All routes that haven't been caught yet will go here, as a result this will get the requested content from the uri and check if it exists.
    * If it exists, it will return it if not it goes to 404 not found.
    */

    const page = req.path.replace('/', '') || 'home';

    if (page != 'login' && (!req.cookies.session || !sessionManager.getSession(req.cookies.session)))
        return res.render('login', { title: 'Login', renderUtils: renderUtils });

    // Check if requested content exists.
    if (!existsSync(`templates/${page}.ejs`))
        return res.status(404).render('base', { title: '404', content: '404', renderUtils: renderUtils });

    res.render('base', { title: page, content: page, renderUtils: renderUtils });
});

app.listen(PORT, '0.0.0.0', function (err) {
    if (err) {
        console.log(err);

        process.exit(1);
    }

    console.log(`Server running on http://localhost:${PORT}`);
});