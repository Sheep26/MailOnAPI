import bcrypt from "bcrypt";
import { getConfig } from '../config.js';

const config = getConfig();

export class BcryptCache {
    constructor(string, hash) {
        this.string = string;
        this.hash = hash;
    }
}

export class BcryptManager {
    constructor() {
        this.cache = [];
    }

    getCache() {
        return this.cache;
    }

    async hash(string) {
        return await bcrypt.hash(string, config.salt_rounds);
    }

    async compareHashes(string, hash) {
        for (let cache_instance of this.cache)
            if (cache_instance.string == string && cache_instance.hash == hash)
                return true;

        let result = await bcrypt.compare(string, hash);

        if (result)
            this.cache.push(new BcryptCache(string, hash));

        return result;
    }
}