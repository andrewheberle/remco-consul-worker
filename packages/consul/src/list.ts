import { EnvBindings, KVPair } from "./types"
import { list as kvList } from "./kv"
import { list as r2List } from "./r2"

export const list = async (env: EnvBindings, prefix: string, recurse?: boolean): Promise <KVPair[]> => {
    if (env.KV !== undefined)
        return await kvList(env.KV, prefix, recurse)

    if (env.R2 !== undefined)
        return await r2List(env.R2, prefix, recurse)

    throw new Error("no backend store available")
}
