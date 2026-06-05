import { Hono } from "hono"
import type { EnvBindings } from "./types"
import { list } from "./list"

export const app = new Hono<{ Bindings: EnvBindings }>()

app.get("/v1/kv/:key{.+}", async (c) => {
    const key = c.req.param("key")
    const recurse = c.req.query("recurse") !== undefined

    const kv = await list(c.env, `/${key}`, recurse)

    if (kv.length === 0) {
        return c.notFound() 
    }

    return c.json(kv)
})
