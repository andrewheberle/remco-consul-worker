import { Hono } from "hono"
import type { EnvBindings } from "./types"
import { list } from "./list"
import { encrypt, keyFromString } from "./protect"
import { AccessController, userFromRequest } from "./access"
import { seconds } from "itty-time"
import { logger } from "./logger"

export const app = new Hono<{ Bindings: EnvBindings }>()

app.get("/v1/kv/:key{.+}", async (c) => {
    const key = c.req.param("key")
    const recurse = c.req.query("recurse") !== undefined
    const l = logger(c.env).with("key", key, "recurse", recurse)

    // fetch from KV
    l.debug(`${c.req.method} ${c.req.path}: fetching keys`)
    const kv = await list(c.env, `/${key}`, recurse)
    if (kv.length === 0) {
        l.debug("no results found")
        return c.notFound()
    }

    // filter based on access controls (if present)
    const user = userFromRequest(c.req.raw)
    const ttl = c.env.CACHE_TTL !== undefined ? seconds(c.env.CACHE_TTL) : undefined
    const ll = l.with("user", user, "ttl", ttl)

    ll.debug(`${c.req.method} ${c.req.path}: filtering key list`)

    const access = new AccessController(c.env, user, ttl)
    const filtered = kv.filter(async (v) => {
        if (await access.canAccess(v.key)) {
            return v
        }
    })
    if (filtered.length === 0) {
        ll.debug(`${c.req.method} ${c.req.path}: no keys left after filtering`)

        return c.notFound()
    }

    // decrypt  any protected values if key is available/set
    if (c.env.KEY !== undefined) {
        const keyString = await c.env.KEY.get()
        const key = await keyFromString(keyString)
        const decrypted = await Promise.all(filtered.map(v => v.decrypt(key)))

        ll.debug(`${c.req.method} ${c.req.path}: returning keys after filtering and decryption process`, "length", decrypted.length)

        return c.json(decrypted)
    }

    ll.debug(`${c.req.method} ${c.req.path}: returning keys after filtering process`, "length", filtered.length)

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
