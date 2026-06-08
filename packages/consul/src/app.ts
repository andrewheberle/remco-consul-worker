import { Hono } from "hono"
import type { EnvBindings } from "./types"
import { canAccess, fetchAccessControls, list } from "./list"
import { connect } from "./db"
import { encrypt, keyFromString } from "./protect"
import * as z from "zod"
import { validator } from "hono/validator"

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
            const access = await fetchAccessControls(c.env.KV, qb, cn)

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

const protectSchema = z.object({
    body: z.object({
        plaintext: z.string()
    })
})

app.post("/api/v1/protect",
    validator("form", (value, c) => {
        const parsed = protectSchema.safeParse(value)
        if (!parsed.success) {
            return c.json({ message: "parse error" }, 400)
        }

        return parsed.data
    }),
    async (c) => {
        const { body } = c.req.valid("form")

        if (c.env.KEY === undefined) {
            return c.json({ message: "unable to handle request" }, 503)
        }

        const keyString = await c.env.KEY.get()
        const key = await keyFromString(keyString)
        const v = await encrypt(key, body.plaintext)

        return c.json({ ciphertext: v })
    })
