# remco-consul-worker

This package implements the bare minimum of the Consul HTTP API for KV reads
so that it can be used as a backend for
[Remco](https://github.com/heavyhorst/remco)

## Implemented Endpoints

The only Consul endpoint that is implemented by this package is `/v1/kv`

## Missing Features

Apart from the stated lack of support of all but the `/v1/kv` endpoint, 
this package does not implement watch support for key changes so this should
not be enabled in your remco configuration.

## Storage

After this is deployed on Cloudflare Workers the Key/Value data is stored in
Cloudflare Workers KV.

### Secrets

Although it may not be recommended, it is possible to have data encrypted at
rest using AES-GCM based on a static key stored as a secret in `Secrets Store`.

Any encrypted values will be decrypted before being sent to the client so this
is only to protect data at rest.

To enable this create secret and then add the additional binding to your
`wrangler.jsonc`:

1. Generate a secret:
    ```sh
    openssl rand -base64 32
    ```
2. Add the binding:
    ```jsonc
    {
        // add the secrets_store binding
        "secrets_store_secrets": [
            {
                "binding": "KEY",
                "secret_name": "secret-name",
                "store_id": "secret-store-id"
            }
        ]
    }
    ```
3. Regenerate your Worker types:
    ```sh
    npm run cf-typegen
    ```

**Note:** There is currently no admin UI or API to encrypt secrets, however a
manually encrypted value can be written to Workers KV in the following format:

```ts
`$protected$:<BASE64 encoded encrypted data>`
```

Any values with the "magic prefix" will be assumed to be encrypted and will be
decrypted before being returned to clients.

**Important:** If the encryption key is lost or changed then all protected
values will be unreadable and will need to be re-created. 

### Access Controls

An optional D1 Database can be used with access patterns added to the
`access_controls` table as follows:

```sql
--- A wildcard match (only a wildcard at the end of a prefix is supported
INSERT INTO access_controls (user, prefix) VALUES ("user1","/foo/*");
--- An exact match
INSERT INTO access_controls (user, prefix) VALUES ("user2","/secret/key");
```

Access controls are only possible to check when mTLS based authentication is
configured for the Worker hostname and the username is based on the
`Common Name` component of the `Distinguished Named` on the presented
certificate.

1. Add the D1 binding:
    ```jsonc
    {
        // add the secrets_store binding
        "d1_databases": [
            {
                "binding": "DB",
                "database_name": "db-name",
                "database_id": "database-id"
            }
        ],
    }
    ```
2. Regenerate your Worker types:
    ```sh
    npm run cf-typegen
    ```

Access controls are cached on a per user (ie based on the certificate CN value)
using Workers KV for 5-minutes by default however this can be adjusted by
adding the following variable to your `wrangler.jsonc` config:

```jsonc
{
    "vars": {
        "CACHE_TTL": "5 minutes"
    }
}
```

The `CACHE_TTL` is a human readable string that is converted to seconds using
[itty-time](https://itty.dev/itty-time/) with a zero value (e.g. `0` or
`0 minutes`) disabling caching completley.

If this variable is omitted the default value of `5 minutes` is used. 

## Deployment

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fandrewheberle%2Fremco-consul-worker-template)

The simplest option is to use the Deploy to Cloudflare button above.

Please review the template respository here for further information:

https://github.com/andrewheberle/remco-consul-worker-template

## Usage

After deployment please follow the remco documentation and use this in place
of the Consul backend.
