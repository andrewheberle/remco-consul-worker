import { connect } from "./db"
import { seconds } from "itty-time"
import { EnvBindings } from "./types"
import { logger } from "./logger"

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

export const fetchAccess = async (env: EnvBindings, user: string = "*", ttl: number = seconds("5 minutes")): Promise<string[]> => {
    const l = logger(env)
    // if theres no database then return full access
    if (env.DB === undefined) {
        l.debug("access(): no database", "access", ["/*"])

        return ["/*"]
    }

    // check for cached response
    const cacheKey = `${user}:access`
    l.debug("access(): checking for previously cached response", "cacheKey", cacheKey)
    if (ttl !== 0) {
        const cached = await env.KV.get<string[]>(cacheKey, "json")
        if (cached !== null) {
            l.debug("access(): cached response", "access", cached)

            return cached
        }
    }

    l.debug("access(): no cached response so looking up from database", "cacheKey", cacheKey)

    if (env.LOG_LEVEL === "debug") {
        // test database first
        l.debug("access(): testing raw D1 binding")
        const testResult = await env.DB.prepare("SELECT 1").first()
        l.debug("access(): raw D1 binding works", "result", testResult)
    }

    // pull from database
    const qb = await connect(env)
    const where = user === "*"
        ? { conditions: "user = '*'" }
        : { conditions: "user = ? OR user = '*'", params: user }
    const res = await qb.fetchAll({
        tableName: "access_controls",
        where: where,
        fields: ["prefix"]
    })
        .execute()

    if (!res.success) {
        l.error("access(): query failed")
        throw Error("query failed")
    }

    if (res.results === undefined) {
        // no results is no access
        l.debug("access(): no results", "access", [])

        await cache(env, [], user, ttl)

        return []
    }

    const access = res.results.map((v) => v.prefix)
    await cache(env, access, user, ttl)

    l.debug("access(): results from database", "access", access)

    return access
}

export const cache = async (env: EnvBindings, access: string[] | undefined, user: string, ttl: number): Promise<void> => {
    const l = logger(env)
    // don't cache when undefined
    if (access === undefined) {
        l.debug("cache(): nothing to cache")
        return
    }

    // cache for later if ttl was not zero
    if (ttl !== 0) {
        const cacheKey = `${user}:access`
        await env.KV.put(cacheKey, JSON.stringify(access), { expirationTtl: ttl })

        l.debug("cache(): cached access", "this._access", access)
    } else {
        l.debug("cache(): not caching as ttl was zero")
    }
}

export const userFromRequest = (req: Request<unknown, CfProperties<unknown>>): string => {
    if (req.cf === undefined) {
        return "*"
    }

    const auth = req.cf.tlsClientAuth as IncomingRequestCfPropertiesTLSClientAuth | IncomingRequestCfPropertiesTLSClientAuthPlaceholder
    if (auth.certPresented === "0") {
        return "*"
    }

    for (const v of auth.certSubjectDN.split(",")) {
        if (v.startsWith("CN=")) {
            return v.slice(3)
        }
    }

    throw new Error("presented certificate did not contain a Common Name (CN)")
}