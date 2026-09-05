import crypto from 'node:crypto';

function randStr(len) {
    return crypto.randomBytes(len).toString('base64url').slice(0, len);
}

export class SessionManager {
    constructor() {
        /*
        * Session manager constructor.
        * Sets sessions array.
        */

        this.sessions = [];
    }

    addSession(session) {
        /*
        * This function registers a session into the session manager.
        * 
        * @param session - The session to register (type=Session)
        */

        this.sessions.push(session);
    }

    removeSession(session) {
        /*
        * This function removes a session from the session manager.
        * 
        * @param session - The session to remove (type=Session)
        */

        this.sessions = this.sessions.filter(x => x != session);
    }

    getSession(token) {
        /*
        * This function will find the session allocated to a session token.
        * This function will return a Session if it can find one otherwise it'll return null.
        * 
        * @param token - The session token.
        */

        if (!token)
            return null;

        for (let session of this.sessions)
            if (session.session == token)
                return session;

        return null;
    }
}

export class Session {
    constructor(user_id, expires) {
        /*
        * Session constructor.
        * This acts to set the values for the session class.
        * 
        * @param user_id - The user id for the session
        * @param expires - How long the session will be valid for, in milliseconds.
        */

        this.user_id = user_id;
        this.session = randStr(64);
        this.expires = Date.now() + expires;
    }
}