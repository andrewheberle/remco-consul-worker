import { Hono } from "hono"
import type { EnvBindings } from "./types"

export const app = new Hono<{ Bindings: EnvBindings }>()

app.get("/json-rpc", (c) => {
    const upgradeHeader = c.req.header("Upgrade")
    if (!upgradeHeader || upgradeHeader !== "websocket") {
        return new Response("Expected Upgrade: websocket", {
            status: 426,
        });
    }

    const id = c.env.DO.newUniqueId()
    const stub = c.env.DO.get(id)

    return stub.fetch(c.req.raw)
})
