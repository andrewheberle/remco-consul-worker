import { KVPair } from "./types"

export const list = async (KV: KVNamespace, prefix: string, recurse?: boolean): Promise<KVPair[]> => {
    if (!prefix.startsWith("/")) {
        prefix = `/${prefix}`
    }

    if (recurse) {
        const list = await KV.list({ prefix: prefix })

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

        const v = await KV.get(keyList)
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

    const v = await KV.get(prefix)
    if (v === null) {
        return []
    }

    return [new KVPair(prefix, v)]
}

