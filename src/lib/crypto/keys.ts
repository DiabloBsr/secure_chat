import {
  bufferToBase64,
  base64ToBuffer,
  textToBuffer,
  bufferToText,
  randomBytes,
} from './encoding';

/**
 * E2E crypto layer (ECDH P-256 + AES-GCM 256 + PBKDF2-SHA-256).
 *
 * - Chaque utilisateur a une paire ECDH P-256.
 * - La clé publique (JWK) est stockée en clair dans `profiles.public_key`.
 * - La clé privée (JWK) est chiffrée avec une clé AES-GCM dérivée du mot
 *   de passe utilisateur (PBKDF2 600 000 itérations, sel 16 octets).
 * - Le ciphertext + IV + sel sont stockés dans `user_keys`.
 * - Pour une conversation A↔B : ECDH(A_priv, B_pub) → HKDF/AES-GCM key.
 *
 * Limites (Phase 1) :
 * - Pas de Double Ratchet (pas de forward secrecy par message).
 * - La clé d'une conversation est dérivée à chaque chiffrement.
 */

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

// ----------------------------------------------------------------------------
// Génération de paire ECDH
// ----------------------------------------------------------------------------

export async function generateIdentityKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );
}

export async function exportPublicJwk(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key);
}

export async function exportPrivateJwk(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key);
}

export async function importPublicJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );
}

export async function importPrivateJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );
}

// ----------------------------------------------------------------------------
// Wrap / unwrap de la clé privée avec le mot de passe utilisateur
// ----------------------------------------------------------------------------

async function deriveWrappingKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    textToBuffer(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface WrappedPrivateKey {
  ciphertext: string;
  iv: string;
  salt: string;
}

export async function wrapPrivateKey(
  privateKey: CryptoKey,
  password: string,
): Promise<WrappedPrivateKey> {
  const jwk = await exportPrivateJwk(privateKey);
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const wrapKey = await deriveWrappingKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    wrapKey,
    textToBuffer(JSON.stringify(jwk)),
  );
  return {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
  };
}

export async function unwrapPrivateKey(
  wrapped: WrappedPrivateKey,
  password: string,
): Promise<CryptoKey> {
  const salt = new Uint8Array(base64ToBuffer(wrapped.salt));
  const iv = new Uint8Array(base64ToBuffer(wrapped.iv));
  const ciphertext = base64ToBuffer(wrapped.ciphertext);
  const wrapKey = await deriveWrappingKey(password, salt);
  const jsonBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    wrapKey,
    ciphertext,
  );
  const jwk = JSON.parse(bufferToText(jsonBuffer)) as JsonWebKey;
  return importPrivateJwk(jwk);
}

// ----------------------------------------------------------------------------
// Dérivation de clé de conversation (ECDH → AES-GCM 256)
// ----------------------------------------------------------------------------

export async function deriveConversationKey(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ----------------------------------------------------------------------------
// Chiffrement / déchiffrement de message
// ----------------------------------------------------------------------------

export interface EncryptedMessage {
  ciphertext: string;
  iv: string;
}

export async function encryptMessage(
  key: CryptoKey,
  plaintext: string,
): Promise<EncryptedMessage> {
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    textToBuffer(plaintext),
  );
  return {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv),
  };
}

export async function decryptMessage(
  key: CryptoKey,
  encrypted: EncryptedMessage,
): Promise<string> {
  const iv = new Uint8Array(base64ToBuffer(encrypted.iv));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    base64ToBuffer(encrypted.ciphertext),
  );
  return bufferToText(plaintext);
}
