import { Hono } from "hono"
import type { EnvBindings } from "./types"
import { list } from "./list"
import { encrypt, keyFromString } from "./protect"
import { canAccess, fetchAccess, userFromRequest } from "./access"
import { seconds } from "itty-time"
import { logger } from "./logger"

export const app = new Hono<{ Bindings: EnvBindings }>()

app.get("/v1/kv/:key{.+}", async (c) => {
    const key = c.req.param("key")
    const recurse = c.req.query("recurse") !== undefined
    const valueOnly = c.req.query("valueOnly") !== undefined
    const l = logger(c.env).with("key", key, "recurse", recurse, "valueOnly", valueOnly)

    // valueOnly and recurse are mutually exclusive
    if (valueOnly && recurse) {
        return c.text("400 Bad Request", 400)
    }

    // fetch from KV
    l.debug(`${c.req.method} ${c.req.path}: fetching keys`)
    const kv = await list(c.env, `/${key}`, recurse)
    if (kv.length === 0) {
        if (recurse === false) {
            // no keys for a non-recursive lookup so respond with a 404
            l.debug(`${c.req.method} ${c.req.path}: no results found`)
            return c.notFound()
        }

        // no keys for a recursive lookup so return an empty response
        l.debug(`${c.req.method} ${c.req.path}: empty list of keys`)

        return c.json([])
    }

    // get user info from request
    l.debug(`${c.req.method} ${c.req.path}: fethcing user data from request`)
    const user = userFromRequest(c.req.raw)
    const ttl = c.env.CACHE_TTL !== undefined ? seconds(c.env.CACHE_TTL) : undefined
    const ll = l.with("user", user, "ttl", ttl)

    // filter based on access controls (if present)
    ll.debug(`${c.req.method} ${c.req.path}: filtering key list`)
    const access = await fetchAccess(c.env, user, ttl)
    const filtered = kv.filter(async (v) => {
        if (canAccess(access, v.key)) {
            return v
        }
    })

    // add header to let client know that ACLs have limited the results
    if (filtered.length !== kv.length) {
        ll.debug(`${c.req.method} ${c.req.path}: some keys were filtered based on access controls`)
        c.header("X-Consul-Results-Filtered-By-ACLs", "true")
    }

    // return empty result if no keys are left after filtering
    if (filtered.length === 0) {
        ll.debug(`${c.req.method} ${c.req.path}: no keys left after filtering`)
        if (valueOnly) {
            c.text("")
        }

        return c.json([])
    }

    // decrypt any protected values if secret key is available/set
    if (c.env.KEY !== undefined) {
        const keyString = await c.env.KEY.get()
        const key = await keyFromString(keyString)
        const decrypted = await Promise.all(filtered.map(v => v.decrypt(key)))

        ll.debug(`${c.req.method} ${c.req.path}: returning keys after filtering and decryption process`, "length", decrypted.length)
        if (valueOnly) {
            c.text(decrypted[0]!.toString())
        }

        return c.json(decrypted)
    }

    ll.debug(`${c.req.method} ${c.req.path}: returning keys after filtering process`, "length", filtered.length)
    if (valueOnly) {
        c.text(filtered[0]!.toString())
    }
    return c.json(filtered)
})

type protectBody = {
    plaintext: string
}

app.post("/api/v1/protect", async (c) => {
    const json = await c.req.json<protectBody>()

    if (json.plaintext === undefined || typeof json.plaintext !== "string") {
        return c.json({ message: "parse error" }, 400)
    }

    if (c.env.KEY === undefined) {
        return c.json({ message: "unable to handle request" }, 503)
    }

    const keyString = await c.env.KEY.get()
    const key = await keyFromString(keyString)
    const v = await encrypt(key, json.plaintext)

    return c.json({ ciphertext: v })
})
