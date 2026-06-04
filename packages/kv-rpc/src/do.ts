import { handleRpc } from "typed-rpc/server"
import { type EnvBindings } from "./types"
import { rpcServer } from "./rpc"

export const createDurableObject = (Base: abstract new (ctx: DurableObjectState, env: EnvBindings) => any) => {
    return class KvJsonRpcDurableObject extends Base {
        readonly ctx: DurableObjectState
        readonly env: EnvBindings
        rpc: rpcServer

        constructor(ctx: DurableObjectState, env: EnvBindings) {
            super(ctx, env)
            this.ctx = ctx
            this.env = env
            this.rpc = new rpcServer(env)
        }

        async fetch(request: Request): Promise<Response> {
            const webSocketPair = new WebSocketPair();
            const [client, server] = Object.values(webSocketPair);

            if (client === undefined || server === undefined) {
                return new Response("Internal Server Error", { status: 503 })
            }

            this.ctx.acceptWebSocket(server);

            return new Response(null, {
                status: 101,
                webSocket: client,
            });
        }

        async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
            const req = JSON.parse(message as string)
            const res = await handleRpc(req, this.rpc)           
            ws.send(JSON.stringify(res))
        }
    }
}
