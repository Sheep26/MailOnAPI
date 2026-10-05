import config from "../config.json" with { type: "json" };
import fs from "fs";
import { pipeline } from "stream/promises";
import path from 'path';

export class AttachmentManager {
    constructor(email) {
        this.email = email;

        if (!fs.existsSync(config.attachment_path))
            fs.mkdirSync(config.attachment_path);
    }

    async downloadAttachment(email_id, attachment_id) {
        const { download_url, error } = await this.email.getAttatchment(email_id, attachment_id);
        const output_path = path.join(config.attachment_path, email_id, attachment_id);

        if (error)
            throw new Error(`Failed to get attachment: ${error}`);

        if (!download_url)
            throw new Error("No download URL returned");

        const response = await fetch(download_url);

        if (!response.ok)
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);

        await pipeline(response.body, fs.createWriteStream(output_path));
    }
}