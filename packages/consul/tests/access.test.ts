import { describe, it, expect } from "vitest"
import { canAccess } from "../src/list"

describe("canAccess", () => {
    it("no access", () => {
        expect(canAccess([], "/foo")).toBe(false)
    })

    it("without access", () => {
        expect(canAccess(["/bar"], "/foo")).toBe(false)
    })

    it("multiple without access", () => {
        expect(canAccess(["/bar", "/baz"], "/foo")).toBe(false)
    })

    it("full access", () => {
        expect(canAccess(["/*",], "/foo")).toBe(true)
    })

    it("full access (2nd)", () => {
        expect(canAccess(["/bar/*", "/*",], "/foo")).toBe(true)
    })

    it("non-matching wildcard", () => {
        expect(canAccess(["/bar/*"], "/foo")).toBe(false)
    })

    it("non-matching wildcard with exact match second", () => {
        expect(canAccess(["/bar/*", "/foo"], "/foo")).toBe(true)
    })

    it("short matching wildcard", () => {
        expect(canAccess(["/foo/*"], "/foo/bar/baz")).toBe(true)
    })

    it("short matching wildcard after non-matching", () => {
        expect(canAccess(["/bar/*", "/foo/*"], "/foo/bar/baz")).toBe(true)
    })

    it("long matching wildcard after non-matching", () => {
        expect(canAccess(["/bar/*", "/foo/bar/*"], "/foo/bar/baz")).toBe(true)
    })

    it("long non-matching wildcard", () => {
        expect(canAccess(["/foo/bar/baz/*"], "/foo/bar/baz")).toBe(false)
    })
})