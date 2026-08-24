const urlParams = new URLSearchParams(window.location.search);
const mail_box = urlParams.get('mail_box') ?? 0;

document.getElementById('back').onclick = function () { window.location = `/?mail_box=${mail_box}` };

let email;

async function loadEmail() {
    const email_req = await fetch(`/api/get_email?mail_id=${urlParams.get('mail_id')}`);
    email = await email_req.json();

    const main_element = document.getElementById('email');
    const email_subject = document.getElementById('email-subject');
    const email_name = document.getElementById('email-name');
    const email_email = document.getElementById('email-email');

    email_subject.innerText = email.subject;
    email_name.innerText = email.name_from ?? email.mail_from;
    email_email.innerText = email.name_from ? `<${email.mail_from}>` : "";
    console.log(email.attachments);

    main_element.innerHTML = `
    <span>${email.content}</span>
    <div class='flex column gap-1'>
        ${email.attachments ? function () {
            let out = "<hr style='width: 100%;'><span>Attachments</span>";

            for (let attachment of email.attachments)
                out += `<a href='/attachment/${email.mail_id}/${attachment.id}'>${attachment.filename}</a>`;

            return out;
        }() : ""}
    </div>
    `;
}

function replyEmail() {
    openReply(email);
}

async function deleteEmail() {
    const delete_req = await fetch(`/api/delete_email`, { method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            mail_id: urlParams.get('mail_id')
        })});

    if (delete_req.status == 200)
        window.location = "/";
}

loadEmail();