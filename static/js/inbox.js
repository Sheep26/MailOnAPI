const urlSearchParams = new URLSearchParams(window.location.search);

function moveElementTo(a, b) {
    const targetRect = b.getBoundingClientRect();

    const top = targetRect.top + window.scrollY;
    const left = targetRect.left + window.scrollX;

    a.style.top = top + 'px';
    a.style.left = left - a.offsetWidth + 'px';
}

async function deleteEmail(mail_id, event) {
    event.preventDefault();
    event.stopPropagation();

    const delete_req = await fetch(`/api/delete_email`, { method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            mail_id: mail_id
        })});

    if (delete_req.status == 200)
        document.getElementById(mail_id).remove();
}

async function submitMoveEmail(event) {
    event.preventDefault();
    event.stopPropagation();

    const data = new FormData(event.target);
    const entries = Object.fromEntries(data.entries());

    const move_req = await fetch(`/api/move_mail`, { method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            mail_id: entries.mail_id,
            mail_box: entries.mail_box
        })});

    if (move_req.status == 200)
        document.getElementById(entries.mail_id).remove();
    else
        document.getElementById(`${entries.mail_id}-move-element`).remove();
}

async function moveEmail(mail_id, event) {
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

    element.style.position = "absolute";

    element.id = `${mail_id}-move-element`;

    element.innerHTML = `
    <span>Move ${mail_id}</span>
    <form class="flex column gap-1" onsubmit="submitMoveEmail(event)">
        <input type="text" style="display: none;" name="mail_id" value="${mail_id}">
        ${function () {
            let out = ``;

            for (let mail_box of mailboxes) {
                out += `
                <div class="flex row centered">
                    <label for="${mail_box.uid}">${mail_box.name}</label><br>
                    <input type="radio" name="mail_box" value="${mail_box.uid}">
                </div>
                `;
            }

            return out;
        }()}
        <input type="submit">
    </form>
    `;

    element.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    document.getElementById(mail_id).appendChild(element);
    moveElementTo(element, document.getElementById(`${mail_id}-move`));
}

async function loadInbox() {
    const emails_req = await fetch(`/api/get_emails`);
    const emails = await emails_req.json();

    const inbox = document.getElementById("inbox");

    const mail_box = urlSearchParams.get('mail_box') ? await async function() {
        const box_req = await fetch(`/api/get_mailbox?uid=${urlSearchParams.get('mail_box')}`);
        const box = box_req.json();

        return box;
    }() : await async function() {
        const box_req = await fetch(`/api/get_mailbox?box=Inbox`);
        const box = box_req.json();

        return box;
    }();

    const mail_box_emails = emails.filter((email) => email.mail_box == mail_box.uid);

    document.getElementById('mailbox-text').innerText = mail_box.name;
    document.getElementById(`${mail_box.uid}-side-element`).classList.add('open-box');

    if (!mail_box_emails.length) {
        inbox.innerHTML = `<span class="unselectable bold">Nothing yet</span>`;

        return;
    }

    var index = 0;

    const ms_in_minute = 60 * 1000;
    const ms_in_hour = 60 * ms_in_minute;
    const ms_in_day = 24 * ms_in_hour;

    mail_box_emails.reverse();

    for (let email of mail_box_emails) {
        let element = document.createElement('div');

        element.id = email.mail_id;

        const time_diff = Date.now() - email.time;

        const minutes_ago = Math.floor((time_diff % ms_in_hour) / ms_in_minute);
        const hours_ago = Math.floor((time_diff % ms_in_day) / ms_in_hour);
        const days_ago = Math.floor(time_diff / ms_in_day);

        const time_thingy = days_ago ? `${days_ago} days ago` : hours_ago ? `${hours_ago} hours ago` : `${minutes_ago} minutes ago`;

        element.classList.add("card");
        element.classList.add("inbox-card");
        element.classList.add("email");
        element.classList.add("email-hoverable");
        element.classList.add("unselectable");

        if (email.seen)
            element.classList.add('readmsg');

        element.onclick = function() {window.location = `/view_email?mail_id=${email.mail_id}&mail_box=${mail_box.uid}`};

        const parsed = parseEmailAddress(email.mail_from);

        element.innerHTML = `
        <div class="flex column">
            <span>${parsed.name ?? parsed.email}</span>
            <span>${email.subject}</span>
        </div>

        <div class="flex row vcentered gap-1">
            <img src="/static/assets/drive_file_move_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" id="${email.mail_id}-move" onclick="moveEmail('${email.mail_id}', event)"></img>
            <img src="/static/assets/delete_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" onclick="deleteEmail('${email.mail_id}', event)"></img>

            <span>${time_thingy}</span>
        </div>
        `;

        inbox.appendChild(element);
        index++;
    }
}

document.body.addEventListener('click', function(event) {
    if (!event.target.classList.contains('move-mail-element'))
        document.querySelectorAll('.move-mail-element').forEach(element => element.remove());
});

loadInbox();