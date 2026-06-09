import { Hono } from "hono"
import type { EnvBindings } from "./types"
import { list } from "./list"
import { connect } from "./db"
import { encrypt, keyFromString } from "./protect"
import { canAccess, fetchAccessControls } from "./access"
import { seconds } from "itty-time"

export const app = new Hono<{ Bindings: EnvBindings }>()

app.get("/v1/kv/:key{.+}", async (c) => {
    const key = c.req.param("key")
    const recurse = c.req.query("recurse") !== undefined

    const kv = await list(c.env.KV, `/${key}`, recurse)
    if (kv.length === 0) {
        return c.notFound()
    }

    if (c.req.raw.cf !== undefined) {
        const auth = c.req.raw.cf.tlsClientAuth as IncomingRequestCfPropertiesTLSClientAuth | IncomingRequestCfPropertiesTLSClientAuthPlaceholder
        if (auth.certPresented === "1") {

            let cn = ""
            for (const v of auth.certSubjectDN.split(",")) {
                if (v.startsWith("CN=")) {
                    cn = v.slice(3)
                    break
                }
            }

            // if no CN value was found treat it as no access
            if (cn === "") {
                return c.json({})
            }

            const qb = await connect(c.env.DB)
            const access = await fetchAccessControls(c.env.KV, qb, cn, c.env.CACHE_TTL !== undefined ? seconds(c.env.CACHE_TTL) : undefined)

            const filtered = kv.filter((v) => {
                if (canAccess(access, v.key)) {
                    return v
                }
            })

            if (c.env.KEY !== undefined) {
                const keyString = await c.env.KEY.get()
                const key = await keyFromString(keyString)
                const decrypted = await Promise.all(filtered.map(v => v.decrypt(key)))

                return c.json(decrypted)
            }

            return c.json(filtered)
        }
    }

    return c.json(kv)
})

type protectBody = {
    plaintext: string
}

app.post("/api/v1/protect",
    async (c) => {
        const json: protectBody = await c.req.json()

        if (json.plaintext === undefined || typeof json.plaintext !== "string" ) {
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
