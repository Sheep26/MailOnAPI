const urlSearchParams = new URLSearchParams(window.location.search);
let mail_box = urlSearchParams.get('mail_box') ?? 0;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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
        window.location.reload();
}

async function loadInbox() {
    const emails_req = await fetch(`/api/get_emails`);
    const emails = await emails_req.json();

    const inbox = document.getElementById("inbox");

    const mailbox_req = await fetch('/api/get_mailboxes');
    const mailboxes = await mailbox_req.json();

    mail_box = clamp(mail_box, 0, mailboxes.length - 1);

    const mail_box_emails = emails.filter((email) => email.mail_box == mail_box);

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
        let hr = document.createElement('hr');
        hr.style.width = "100%";

        const time_diff = Date.now() - email.time;

        const minutes_ago = Math.floor((time_diff % ms_in_hour) / ms_in_minute);
        const hours_ago = Math.floor((time_diff % ms_in_day) / ms_in_hour);
        const days_ago = Math.floor(time_diff / ms_in_day);

        const time_thingy = days_ago ? `${days_ago} days ago` : hours_ago ? `${hours_ago} hours ago` : `${minutes_ago} minutes ago`;

        element.classList.add("email");
        element.classList.add("email-hoverable");
        element.classList.add("unselectable");

        if (email.seen)
            element.classList.add('readmsg');

        element.onclick = function() {window.location = `/view_email?mail_id=${email.mail_id}&mail_box=${mail_box}`};

        const parsed = parseEmailAddress(email.mail_from);

        element.innerHTML = `
        <div class="flex column">
            <span>${parsed.name ?? parsed.email}</span>
            <span>${email.subject}</span>
        </div>

        <div class="flex row vcentered gap-1">
            <img src="/static/assets/delete_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" onclick="deleteEmail('${email.mail_id}', event)"></img>
            <span>${time_thingy}</span>
        </div>
        `;

        if (index > 0)
            inbox.appendChild(hr);

        inbox.appendChild(element);
        index++;
    }
}

loadInbox();