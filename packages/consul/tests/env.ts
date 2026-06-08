import { EnvBindings } from "../src"
import { MockKVNameSpace } from "./helpers/kv"

export const makeEnv = (overrides: Partial<EnvBindings> = {}): EnvBindings => ({
    KV: new MockKVNameSpace() as unknown as KVNamespace,
    ...overrides
})

export const env = makeEnv()
