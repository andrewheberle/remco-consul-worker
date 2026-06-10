export interface EnvBindings {
    CACHE_TTL?: string
    DB?: D1Database
    LOG_LEVEL?: string
    KEY?: SecretsStoreSecret
    KV: KVNamespace
}
