export interface EnvBindings {
    KV?: KVNamespace
    R2?: R2Bucket
}

export class KVPair {
    key: string
    value: string

    constructor(key: string, value: string) {
        this.key = key
        this.value = value
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
}
