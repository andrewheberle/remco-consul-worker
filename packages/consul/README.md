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

### Access Controls

An optional D1 Database can be used with access patterns added to the
`access_controls` tabled as follows:

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

## Usage

After deployment please follow the remco documentation and use this in place
of the Consul backend.
