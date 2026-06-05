import { KVPair } from "./types"

export const list = async (R2: R2Bucket, prefix: string, recurse?: boolean): Promise <KVPair[]> => {
    if (!prefix.startsWith("/")) {
        prefix = `/${prefix}`
    }

    if (recurse) {
        const list = await R2.list({ prefix: prefix })
        const keyList = list.objects
            .filter((v) => {
                // exact match is ok
                if (v.key === prefix)
                    return v

                // match with seperator next is ok
                if (v.key.slice(prefix.length).startsWith("/"))
                    return v
            })
            .map((v) => v.key)

        if (keyList.length === 0) {
            return []
        }

        const res: KVPair[] = []
        for (const k in keyList) {
            const v = await R2.get(k)
            if (v === null) {
                continue
            }

            const text = await v.text()

            res.push(new KVPair(k, text))
        }

        return res
    }

    const v = await R2.get(prefix)
    if (v === null) {
        return []
    }

    return [new KVPair(prefix, await v.text())]
}
