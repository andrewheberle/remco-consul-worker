export interface EnvBindings {
    KV?: KVNamespace
    R2?: R2Bucket
    DO: DurableObjectNamespace
}

export type EasyKvWatchOption = {
    keys: string[]
    waitIndex: number
}