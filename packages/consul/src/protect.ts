export const ProtectedPrefix = "$protected$"

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

export async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(plaintext)

    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)

    const result = new Uint8Array(iv.byteLength + ciphertext.byteLength)
    result.set(iv, 0)
    result.set(new Uint8Array(ciphertext), iv.byteLength)

    return `${ProtectedPrefix}${btoa(String.fromCharCode(...result))}`
}

export async function decrypt(key: CryptoKey, stored: string): Promise<string> {
    const data = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));

    const iv = data.slice(0, 12)
    const ciphertext = data.slice(12)

    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)

    return new TextDecoder().decode(plaintext)
}
