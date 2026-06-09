export class MockKVNameSpace {
    private kv: Map<string, string>

    constructor(kv?: Map<string, string>) {
        if (kv !== undefined) {
            this.kv = kv
        } else {
            this.kv = new Map<string, string>()
        }
    }

    async get(
        key: string | Array<string>) : Promise<Map<string, string | null> | string | null>{
        if (typeof key === "string") {
            const v = this.kv.get(key)
            if (v === undefined)
                return null

            return v
        }

        const res = new Map<string, string>()
        for (const k of key) {
            const v = this.kv.get(k)
            if (v !== undefined) {
                res.set(k, v)
            }

        }

        if (res.size === 0) {
            return null
        }

        return res
    }

    async list<Metadata = unknown>(
    options?: KVNamespaceListOptions,
  ): Promise<KVNamespaceListResult<Metadata, string>> {
        const keys: KVNamespaceListKey<Metadata, string>[] = []
        for (const key of this.kv.keys()) {
            if (options !== undefined && options.prefix !== undefined && typeof options.prefix === "string" && key.startsWith(options.prefix)) {
                keys.push({metadata: undefined, name: key})
            }
        }

        return {
            list_complete: true,
            keys: keys,
            cacheStatus: null
        }
    }

    async put(
        key: string,
        value: string,
        options?: KVNamespacePutOptions,
    ): Promise<void> {
        this.kv.set(key, value as string)
    }

    async delete(key: string): Promise<void> {
        this.kv.delete(key)
    }
}