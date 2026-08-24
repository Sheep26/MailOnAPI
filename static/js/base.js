const main = document.getElementById('main');
const mail_boxes = document.getElementById('mail_boxes');
let openComposes = 0;
let composeIndex = 0;

async function addMailBoxes() {
    let index = 0;
    const mailbox_req = await fetch('/api/get_mailboxes');
    const mailboxes = await mailbox_req.json();

    for (let mail_box of mailboxes) {
        if (index) {
            // Excuse my spelling.
            let devidor = document.createElement('hr');
            devidor.style.width = "100%";

            mail_boxes.appendChild(devidor);
        }

        let element = document.createElement('a');
        element.innerText = mail_box;
        element.href = `/?mail_box=${index}`;

        mail_boxes.appendChild(element);

        index++;
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

window.addEventListener('message', function(event) {
    if (event.origin != window.location.origin)
        return;

    if (event.data.type === 'close-me')
        closeCompose(event.data.compose);

    if (event.data.type === 'hide-me')
        hideCompose(event.data.compose);
});

addMailBoxes();