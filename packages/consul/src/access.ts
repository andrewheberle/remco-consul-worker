import { D1QB } from "workers-qb"
import { Schema } from "./db"
import { seconds } from "itty-time"

export const fetchAccessControls = async (KV: KVNamespace, DB: D1QB<Schema> | undefined, user: string, ttl?: number): Promise<string[]> => {
    // if theres no database then return full access
    if (DB === undefined) {
        return ["/*"]
    }

    // check for cached response
    const cacheKey = `${user}:access`
    if (ttl !== 0) {
        const cached = await KV.get(cacheKey)
        if (cached !== null) {
            const access: string[] = JSON.parse(cached)

            return access
        }
    }

    // pull from database
    const res = await DB.fetchAll({
        tableName: "access_controls",
        where: {
            conditions: "user = ? OR user = '*'",
            params: user
        },
        fields: ["prefix"]
    })
        .execute()

    if (!res.success) {
        throw Error("query failed")
    }

    if (res.results === undefined) {
        // no results is no access
        return []
    }

    const access = res.results.map((v) => v.prefix)

    // cache for later if ttl was not zero
    if (ttl !== 0) {
        const expirationTtl = ttl === undefined ? seconds("5 minutes") : ttl
        await KV.put(cacheKey, JSON.stringify(access), { expirationTtl: expirationTtl })
    }

    return access
}

export const canAccess = (access: string[], key: string): boolean => {
    // no access if key does not look right
    if (!key.startsWith("/")) {
        return false
    }

    for (const p of access) {
        // skip if it is not a valid access pattern
        if (!p.match(/^(\/[a-zA-Z0-9.]+)*(\/\*)?$/)) {
            continue
        }

        if (p.endsWith("/*")) {
            // handle wildcard
            const aparts = p.split("/")
            const kparts = key.split("/")

            // if access list is longer then it cannot match
            if (aparts.length > kparts.length) {
                continue
            }

            let matched = true
            for (let i = 0; i < kparts.length; i++) {
                // skip at wildcard
                if (aparts[i] === "*") {
                    break
                }

                // ensure this part matches
                if (aparts[i] !== kparts[i]) {
                    matched = false
                    break
                }
            }

            if (matched) {
                return true
            }
        }

        // exact match
        if (p === key) {
            return true
        }
    }

    return false
}
