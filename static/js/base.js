const main = document.getElementById('main');
const mail_boxes = document.getElementById('mail_boxes');

let mailboxes = null;
let openComposes = 0;
let composeIndex = 0;

globalThis.user ??= null;

globalThis.listeners ??= [];

function moveSettingsElementTo(a, b) {
    const targetRect = b.getBoundingClientRect();

    const top = targetRect.top + window.scrollY;
    const left = targetRect.left + window.scrollX;

    a.style.top = top - a.offsetHeight - 8 + 'px';
    a.style.left = Math.max(left - a.offsetWidth, 0) + 'px';
}

function parseEmailAddress(value) {
    const match = value.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
    let values = {name: null, email: value.trim()};

    if (match) {
        values.name = match[1].trim().replaceAll("\"", "");
        values.email = match[2].trim();
    }

    return values;
};

async function callListeners() {
    try {
        for (let listener of globalThis.listeners)
            await listener();
    } catch (e) {
        console.log(e);
    }
}

async function setupName() {
    const user_req = await fetch('/api/get_user');
    globalThis.user = await user_req.json();

    document.getElementById('user-email').innerText = user.email;
    document.getElementById('user-name').innerText = user.username;
}

async function addMailBoxes() {
    const mailbox_req = await fetch('/api/get_mailboxes');
    mailboxes = await mailbox_req.json();

    mailboxes.reverse();

    for (let mail_box of mailboxes) {
        // Excuse my spelling.
        let devidor = document.createElement('hr');
        devidor.style.width = "100%";

        mail_boxes.prepend(devidor);

        let element = document.createElement('a');

        element.classList.add('flex');
        element.classList.add('row');
        element.classList.add('vcentered');
        element.classList.add('space-between');

        element.style.color = "lightgray";

        element.id = `${mail_box.uid}-side-element`;

        element.innerHTML = `<span>${mail_box.name}</span> <img src="/static/assets/delete_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" width="20px" onclick="deleteMailbox('${mail_box.name}', event)"></img>` ;
        element.href = `/?mail_box=${mail_box.uid}`;

        mail_boxes.prepend(element);
    }
}

function openCompose() {
    let element = document.createElement('iframe');
    element.id = `compose-${composeIndex}`;
    element.classList.add('compose-panel');
    element.src = `/static/html/compose.html?compose=${composeIndex}`;

    element.bottom = 0;
    element.style.right = `${42 * openComposes}svw`;

    composeIndex++;
    openComposes++;
    main.appendChild(element);
}

function openReply(email) {
    let element = document.createElement('iframe');
    element.id = `compose-${composeIndex}`;
    element.classList.add('compose-panel');
    element.src = `/static/html/reply.html?compose=${composeIndex}&mail_id=${email.mail_id}&from=${email.mail_from}`;

    element.bottom = 0;
    element.style.right = `${42 * openComposes}svw`;

    composeIndex++;
    openComposes++;
    main.appendChild(element);
}

function moveComposes() {
    let elements = main.querySelectorAll('iframe');
    let found_composes = 0;

    elements.forEach((iframe) => {
        iframe.style.right = `${26 * found_composes}svw`;
        found_composes++;
    });
}

function closeCompose(compose) {
    main.removeChild(document.getElementById(`compose-${compose}`));
    openComposes--;

    moveComposes();
}

function hideCompose(compose) {
    document.getElementById(`compose-${compose}`).style.display = "none";
    openComposes--;

    moveComposes();
}

async function newMailBox() {
    const mailbox = document.getElementById('new_mailbox').value;

    await fetch(`/api/add_mailbox`, { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ 'mailbox': mailbox }) });
    window.location.reload();
}

async function deleteMailbox(mailbox, event) {
    event.preventDefault();

    await fetch(`/api/remove_mailbox`, { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ 'mailbox': mailbox }) });
    window.location.reload();
}

function logout() {
    window.location = '/api/logout';
}

function openSettings(event) {
    event.preventDefault();
    event.stopPropagation();

    /*
    <div class="flex card grow inbox scrollable column no-padding gap-2">
        <h1>Hello world</h1>
    </div>
    */

    let element = document.createElement('div');

    element.classList.add('flex');
    element.classList.add('card');
    element.classList.add('scrollable');
    element.classList.add('column');
    element.classList.add('gap-1');
    element.classList.add('move-mail-element');
    element.classList.add('centered');

    element.style.position = "absolute";

    element.id = `settings-element`;

    element.innerHTML = `
    <span class="bold">Settings</span>
    <form class="flex row gap-1 vcentered" action="/api/update_username" method="POST">
        <label for="username">Username: </label>
        <input placeholder="Username" name="username" id="username" value="${globalThis.user.username}">
        <input type="submit" class="settings-btn" value="Update Username">
    </form>
    `;

    element.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    document.getElementById('main').appendChild(element);
    moveSettingsElementTo(element, document.getElementById(`settings-button`));
}

window.addEventListener('message', function(event) {
    if (event.origin != window.location.origin)
        return;

    if (event.data.type === 'close-me')
        closeCompose(event.data.compose);

    if (event.data.type === 'hide-me')
        hideCompose(event.data.compose);
});

document.body.addEventListener('click', function(event) {
    if (!event.target.classList.contains('move-mail-element'))
        document.querySelectorAll('.move-mail-element').forEach(element => element.remove());
});

globalThis.listeners.unshift(addMailBoxes);
globalThis.listeners.unshift(setupName);
callListeners();