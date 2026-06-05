import { app, createDurableObject } from "@andrewheberle/remco-kv-json-rpc"
import { DurableObject } from "cloudflare:workers"

export const RemcoKvJsonRpc = createDurableObject(DurableObject)

export default app
