import { resolve } from 'path';
import { pathToFileURL } from 'url';

const args = process.argv.slice(2);
let config_path = args.includes('dev') ? resolve('./config.json') : process.env.CONFIG_PATH || '/etc/mailonapi/config.json';

const config = await import(pathToFileURL(config_path).href, { with: { type: 'json' } });

export function getConfig() {
    return config.default;
}

export function getConfigPath() {
    return config_path;
}