import { decrypt, ProtectedPrefix } from "./protect"

export class KVPair {
    key: string
    value: string

    constructor(key: string, value: string) {
        this.key = key
        this.value = value
    }

    /**
     * 
     * @returns A decrypted version of the KVPair
     */
    async decrypt(key: CryptoKey): Promise<KVPair> {
        // skip unprotected keys
        if (!this.value.startsWith(ProtectedPrefix)) {
            return this
        }

        let v = this.value

        // remove prefix then decrypt
        v = v.slice(ProtectedPrefix.length)
        v = await decrypt(key, v)
        
        return new KVPair(this.key, v)
    }

    /**
     * 
     * @returns A Consul KV compatible response
     */
    toJSON() {
        const bytes = new TextEncoder().encode(this.value)
        const binary = bytes.reduce((s, b) => s + String.fromCharCode(b), '')

        return {
            Key: this.key,
            Value: btoa(binary),
            ModifyIndex: 1,
            CreateIndex: 1,
            LockIndex: 0,
            Flags: 0,
            Session: ""
        }
    }

    /**
     * 
     * @returns The key as a string
     */
    toString() {
        const bytes = new TextEncoder().encode(this.value)
        const binary = bytes.reduce((s, b) => s + String.fromCharCode(b), '')

        return btoa(binary)
    }
}
