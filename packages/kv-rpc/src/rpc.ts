import { RpcError } from "typed-rpc"
import { EasyKvWatchOption, EnvBindings } from "./types"

export class rpcServer {
    private kv?: KVNamespace
    private r2?: R2Bucket
    private namespace?: string

    constructor(env: EnvBindings, namespace?: string) {
        this.kv = env.KV
        this.r2 = env.R2
        this.namespace = namespace
    }

    async getValues(keys: string[]): Promise<Record<string, string>> {
        if (this.kv === undefined && this.r2 === undefined) {
            throw new RpcError("there was no available backend store", 101)
        }

        // filter and add namespace as a prefix if defined
        if (this.namespace !== undefined) {
            // filter out any keys that match the namespace
            const filtered = keys
                .filter((v) => {
                    // dont allow querying the namespace direct
                    if (v === `/${this.namespace}`)
                        return

                    // dont allow querying below the namespace either
                    if (v.startsWith(`/${this.namespace}/`))
                        return

                    return v
                })

            const prefixed = filtered
                .map(v => `/${this.namespace}${v}`)

            keys = [...filtered, ...prefixed]
        }

        const res: Record<string, string> = {}
        for (const key of keys) {
            if (this.kv !== undefined) {
                const list = await this.kv.list({ prefix: key })
                const keyList = list.keys
                    .filter((v) => {
                        // exact match is ok
                        if (v.name === key)
                            return v


                        // match with seperator next is ok
                        if (v.name.slice(key.length).startsWith("/"))
                            return v
                    })
                    .map((v) => v.name)
                if (keyList.length === 0) {
                    return res
                }

                const v = await this.kv.get(keyList)
                if (v === null) {
                    continue
                }

                v.forEach((v, k) => {
                    if (v === null) return

                    res[transformKey(k, this.namespace)] = v
                })
            } else if (this.r2 !== undefined) {
                const list = await this.r2.list({ prefix: key })
                const keyList = list.objects
                    .filter((v) => {
                        // exact match is ok
                        if (v.key === key)
                            return v

                        // match with seperator next is ok
                        if (v.key.slice(key.length).startsWith("/"))
                            return v
                    })
                    .map((v) => v.key)

                if (keyList.length === 0) {
                    return res
                }

                for (const k in keyList) {
                    const v = await this.r2.get(k)
                    if (v === null) {
                        continue
                    }

                    const text = await v.text()

                    res[transformKey(k, this.namespace)] = text
                }
            }
        }

        return res
    }

    watchPrefix(prefix: string, opts?: EasyKvWatchOption): never {
        throw new RpcError("this plugin doesn't support watches - use polling instead", 100)
    }
}

export type RpcServer = typeof rpcServer

const transformKey = (key: string, namespace?: string): string => {
    if (namespace === undefined)
        return key

    // if this is a namespaced key then transform it
    if (key.startsWith(`/${namespace}/`))
        return key.slice(namespace.length + 1)

    return key
}