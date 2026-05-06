/**
 * AES-GCM encryption utilities for client-side fingerprint PNG encryption.
 * Uses WebCrypto SubtleCrypto for AES-256-GCM.
 */

export interface EncryptedPayload {
  iv: string; // base64-encoded IV (12 bytes)
  ciphertext: string; // base64-encoded ciphertext
  tag?: string; // included in ciphertext with GCM
}

/**
 * Derive a stable AES-256 key from a passphrase using PBKDF2.
 * Used for session or hardcoded passphrases; KMS integration can replace this.
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array = new Uint8Array(16),
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  // WebCrypto expects a BufferSource for the salt; use the underlying ArrayBuffer
  const saltBuffer = salt.buffer as ArrayBuffer;
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    256,
  );

  return crypto.subtle.importKey("raw", derivedBits, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Generate a random AES-256 key for symmetric encryption.
 */
export async function generateAESKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns IV and ciphertext as base64 strings.
 */
export async function encryptAESGCM(
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate a random 12-byte IV (nonce)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt with AES-GCM; tag is automatically appended to ciphertext
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );

  return {
    iv: btoa(String.fromCharCode(...Array.from(iv))),
    ciphertext: btoa(
      String.fromCharCode(...Array.from(new Uint8Array(ciphertext))),
    ),
  };
}

/**
 * Decrypt ciphertext encrypted with AES-256-GCM.
 * Expects IV and ciphertext as base64 strings.
 */
export async function decryptAESGCM(
  payload: EncryptedPayload,
  key: CryptoKey,
): Promise<string> {
  const decoder = new TextDecoder();

  // Decode base64
  const iv = new Uint8Array(
    atob(payload.iv)
      .split("")
      .map((c) => c.charCodeAt(0)),
  );
  const ciphertext = new Uint8Array(
    atob(payload.ciphertext)
      .split("")
      .map((c) => c.charCodeAt(0)),
  );

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  return decoder.decode(decrypted);
}

/**
 * Export a CryptoKey to raw bytes (for storage/transmission).
 * Only works if key was generated with `extractable: true`.
 */
export async function exportKeyToRaw(key: CryptoKey): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(exported);
}

/**
 * Import a raw key from bytes.
 */
export async function importKeyFromRaw(
  keyBytes: Uint8Array,
): Promise<CryptoKey> {
  // Ensure we pass a proper ArrayBuffer (BufferSource) to satisfy TypeScript
  // and WebCrypto. If the Uint8Array references a sub-range of an ArrayBuffer,
  // slice out the exact bytes as a new ArrayBuffer view.
  let raw: ArrayBuffer;
  if (
    keyBytes.byteOffset === 0 &&
    keyBytes.byteLength === keyBytes.buffer.byteLength
  ) {
    raw = keyBytes.buffer as ArrayBuffer;
  } else {
    // Create a new ArrayBuffer containing only the requested subrange to
    // guarantee we have a plain ArrayBuffer (not SharedArrayBuffer).
    const tmp = new Uint8Array(keyBytes.byteLength);
    tmp.set(
      new Uint8Array(keyBytes.buffer, keyBytes.byteOffset, keyBytes.byteLength),
    );
    raw = tmp.buffer;
  }

  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
