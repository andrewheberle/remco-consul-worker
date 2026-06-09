import { describe, it, expect } from "vitest"
import { list } from "../src/list"
import { makeEnv } from "./env"
import { KVPair } from "../src/types"

describe("list", () => {
    it("no keys", async () => {
        const env = makeEnv()
        expect(await list(env, "/foo", true)).toStrictEqual([])
    })

    it("non matching prefix", async () => {
        const env = makeEnv()

        await env.KV.put("/bar", "baz")
        expect(await list(env, "/foo", true)).toStrictEqual([])
    })

    it("matching prefix returning single key", async () => {
        const env = makeEnv()

        await env.KV.put("/foo", "bar")
        
        const res = await list(env, "/foo", true)
        expect(res.length).toBe(1)
        expect(res[0]!.key).toBe("/foo")
        expect(res[0]!.value).toBe("bar")
    })

    it("matching prefix returning multiple keys", async () => {
        const env = makeEnv()

        await env.KV.put("/foo", "bar")
        await env.KV.put("/foo/bar", "baz")

        const res = await list(env, "/foo", true)
        expect(res.length).toBe(2)
        expect(res[0]).toStrictEqual(new KVPair("/foo", "bar"))
        expect(res[1]).toStrictEqual(new KVPair("/foo/bar", "baz"))
    })

    it("matching prefix returning subset of keys", async () => {
        const env = makeEnv()

        await env.KV.put("/foo", "bar")
        await env.KV.put("/foo/bar", "baz")
        await env.KV.put("/bing", "bong")

        const res = await list(env, "/foo", true)
        expect(res.length).toBe(2)
        expect(res[0]).toStrictEqual(new KVPair("/foo", "bar"))
        expect(res[1]).toStrictEqual(new KVPair("/foo/bar", "baz"))
    })
})
