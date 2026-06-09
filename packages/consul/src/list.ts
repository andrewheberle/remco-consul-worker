import { logger } from "./logger"
import { EnvBindings, KVPair } from "./types"

export const list = async (env: EnvBindings, prefix: string, recurse?: boolean): Promise<KVPair[]> => {
    if (!prefix.startsWith("/")) {
        prefix = `/${prefix}`
    }

    const l = logger(env).with("prefix", prefix, "recurse", recurse)

    if (recurse) {
        l.debug("list(): handling recursive lookup")
        const list = await env.KV.list({ prefix: prefix })

        const keyList = list.keys
            .filter((v) => {
                // exact match is ok
                if (v.name === prefix)
                    return v


                // match with seperator next is ok
                if (v.name.slice(prefix.length).startsWith("/"))
                    return v
            })
            .map((v) => v.name)
        if (keyList.length === 0) {
            return []
        }

        const v = await env.KV.get(keyList)
        if (v === null) {
            return []
        }

        const res: KVPair[] = []
        v.forEach((v, k) => {
            if (v === null) return

            res.push(new KVPair(k, v))
        })

        return res
    }

    l.debug("list(): handling individual prefix lookup")

    const v = await env.KV.get(prefix)
    if (v === null) {
        return []
    }

    return [new KVPair(prefix, v)]
}
