import { EnvBindings } from "./types"

export const ProtectedPrefix = "$protected$:"

/**
 * 
 * @param s a base64 encoded string that is 32-bytes long before base64 encoding
 * @returns a CryptoKey that can be used for encryption and decryption
 */
export const keyFromString = async (s: string): Promise<CryptoKey> => {
    const keyBytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
    return await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
        "encrypt",
        "decrypt",
    ])
}

export const encrypt = async (key: CryptoKey, plaintext: string): Promise<string> => {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(plaintext)

    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)

    const result = new Uint8Array(iv.byteLength + ciphertext.byteLength)
    result.set(iv, 0)
    result.set(new Uint8Array(ciphertext), iv.byteLength)

    return `${ProtectedPrefix}${btoa(String.fromCharCode(...result))}`
}

export const decrypt = async (key: CryptoKey, stored: string): Promise<string> => {
    if (!stored.startsWith(ProtectedPrefix))
        throw new Error("ciphertext was missing expected prefix")

    stored = stored.slice(ProtectedPrefix.length)

    const data = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));

    const iv = data.slice(0, 12)
    const ciphertext = data.slice(12)

    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)

    return new TextDecoder().decode(plaintext)
}

export const protect = async (env: EnvBindings, plaintext: string): Promise<string> => {
    if (env.KEY === undefined)
        throw new Error("no secret key available")

    const keyString = await env.KEY.get()
    const key = await keyFromString(keyString)
    return await encrypt(key, plaintext)
}

export const unprotect = async (env: EnvBindings, ciphertext: string): Promise<string> => {
    if (env.KEY === undefined)
        throw new Error("no secret key available")

    if (!ciphertext.startsWith(ProtectedPrefix))
        throw new Error("ciphertext was missing expected prefix")
    
    const keyString = await env.KEY.get()
    const key = await keyFromString(keyString)
    return await decrypt(key, ciphertext)
} 
