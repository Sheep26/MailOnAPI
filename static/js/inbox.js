const urlSearchParams = new URLSearchParams(window.location.search);
const mail_box = urlSearchParams.get('mail_box') ?? 0;

async function loadInbox() {
    const emails_req = await fetch(`/api/get_emails`);
    const emails = await emails_req.json();

    const inbox = document.getElementById("inbox");

    if (!emails.length) {
        inbox.innerHTML = `<span class="unselectable bold">Nothing yet</span>`;
        return;
    }

    var index = 0;

    const ms_in_minute = 60 * 1000;
    const ms_in_hour = 60 * ms_in_minute;
    const ms_in_day = 24 * ms_in_hour;

    emails.reverse();

    for (let email of emails) {
        if (email.mail_box != mail_box)
            continue;

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

        element.onclick = function() {window.location = `/view_email?mail_id=${email.mail_id}&mail_box=${mail_box}`};

        const parsed = parseEmailAddress(email.mail_from);

        element.innerHTML = `
        <div class="flex column">
            <span>${parsed.name ?? parsed.email}</span>
            <span>${email.subject}</span>
        </div>

        <span>${time_thingy}</span>
        `;

        if (index > 0)
            inbox.appendChild(hr);

        inbox.appendChild(element);
        index++;
    }
}

loadInbox();