const main = document.getElementById('main');
const mail_boxes = document.getElementById('mail_boxes');
let mailboxes = null;
let openComposes = 0;
let composeIndex = 0;

function parseEmailAddress(value) {
    const match = value.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
    let values = {name: null, email: value.trim()};

    if (match) {
        values.name = match[1].trim().replaceAll("\"", "");
        values.email = match[2].trim();
    }

    return values;
};

async function addMailBoxes() {
    const mailbox_req = await fetch('/api/get_mailboxes');
    mailboxes = await mailbox_req.json();

    mailboxes.reverse();

    for (let mail_box in mailboxes) {
        // Excuse my spelling.
        let devidor = document.createElement('hr');
        devidor.style.width = "100%";

        mail_boxes.prepend(devidor);

        let element = document.createElement('a');
        element.classList.add('flex');
        element.classList.add('row');
        element.classList.add('vcentered');
        element.classList.add('space-between');

        element.innerHTML = `<span>${mailboxes[mail_box]}</span> <img src="/static/assets/delete_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" width="20px" onclick="deleteMailbox(${mailboxes.length - 1 - mail_box}, event)"></img>` ;
        element.href = `/?mail_box=${mailboxes.length - 1 - mail_box}`;

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

window.addEventListener('message', function(event) {
    if (event.origin != window.location.origin)
        return;

    if (event.data.type === 'close-me')
        closeCompose(event.data.compose);

    if (event.data.type === 'hide-me')
        hideCompose(event.data.compose);
});

addMailBoxes();