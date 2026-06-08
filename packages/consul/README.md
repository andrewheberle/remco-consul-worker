# remco-consul-worker

This package implements the bare minimum of the Consul HTTP API for KV reads
so that it can be used as a backend for
[Remco](https://github.com/heavyhorst/remco)

## Implemented Endpoints

The only Consul endpoint that is implemented by this package is `/v1/kv`

## Missing Features

This package does not implement watch support for key changes so this should
not be enabled in the remco configuration.

## Storage

After this is deployed on Cloudflare Workers the Key/Value data is stored in
Cloudflare Workers KV.

## Usage

After deployment please follow the remco documentation and use this in place
of the Consul backend.
