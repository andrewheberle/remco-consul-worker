import { connect } from "./db"
import { seconds } from "itty-time"
import { EnvBindings } from "./types"
import { logger } from "./logger"
import { Logger } from "@andrewheberle/ts-slog"

export class AccessController {
    private env: EnvBindings
    private user: string
    private ttl: number
    private _access?: string[]
    private logger: Logger

    constructor(env: EnvBindings, user: string = "*", ttl: number = seconds("5 minutes")) {
        this.env = env
        this.user = user
        this.ttl = ttl

        this.logger = logger(env).with("in", "AccessController", "user", user, "ttl", ttl)
    }

    async canAccess(key: string): Promise<boolean> {
        const access = await this.access()
        const ok = canAccess(access, key)

        this.logger.debug("canAccess()", "key", key, "access", access, "ok", ok)
        
        return ok
    }

    private async access(): Promise<string[]> {
        if (this._access !== undefined) {
            this.logger.debug("access(): already set", "this._access", this._access)

            return this._access
        }

        // if theres no database then return full access
        if (this.env.DB === undefined) {
            this._access = ["/*"]

            this.logger.debug("access(): no database", "this._access", this._access)

            return this._access
        }

        // check for cached response
        const cacheKey = `${this.user}:access`
        if (this.ttl !== 0) {
            const cached = await this.env.KV.get<string[]>(cacheKey, "json")
            if (cached !== null) {
                this._access = cached

                this.logger.debug("access(): cached response", "this._access", this._access)

                return this._access
            }
        }

        // pull from database
        const qb = await connect(this.env.DB)
        const where = this.user === "*"
            ? { conditions: "user = '*'" }
            : { conditions: "user = ? OR user = '*'", params: this.user }
        const res = await qb.fetchAll({
            tableName: "access_controls",
            where: where,
            fields: ["prefix"]
        })
            .execute()

        if (!res.success) {
            throw Error("query failed")
        }

        if (res.results === undefined) {
            // no results is no access
            this._access = []

            this.logger.debug("access(): no results", "this._access", this._access)

            await this.cache()

            return this._access
        }

        this._access = res.results.map((v) => v.prefix)
        await this.cache()

        this.logger.debug("access(): results from database", "this._access", this._access)

        return this._access
    }

    private async cache() {
        // don't cache when undefined
        if (this._access === undefined) {
            this.logger.debug("cache(): nothing to cache")
            return
        }

        // cache for later if ttl was not zero
        if (this.ttl !== 0) {
            const cacheKey = `${this.user}:access`
            await this.env.KV.put(cacheKey, JSON.stringify(this._access), { expirationTtl: this.ttl })

            this.logger.debug("cache(): cached access", "this._access", this._access)
        } else {
            this.logger.debug("cache(): not caching as ttl was zero")
        }
    }
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