import { describe, it, expect } from "vitest"
import { KVPair } from "../src/kvpair"

describe("KVPair", () => {
    it("single item - toJSON", () => {
        expect(new KVPair("foo", "bar").toJSON()).toStrictEqual({
            CreateIndex: 1,
            Flags: 0,
            Key: "foo",
            Value: btoa("bar"),
            LockIndex: 0,
            ModifyIndex: 1,
            Session: ""
        })
    })

    it("single item - toString", () => {
        expect(new KVPair("foo", "bar").toString()).toBe(btoa("bar"))
    })
})