/**
 * Cache en mémoire pour la clé privée déverrouillée + clés de conversation
 * dérivées. Volontairement en mémoire (pas IndexedDB ni localStorage) :
 * tout est perdu au refresh et l'utilisateur doit ressaisir son mot de passe.
 */

let identityPrivateKey: CryptoKey | null = null;
const conversationKeys = new Map<string, CryptoKey>();

export function setIdentityPrivateKey(key: CryptoKey | null) {
  identityPrivateKey = key;
  conversationKeys.clear();
}

export function getIdentityPrivateKey(): CryptoKey | null {
  return identityPrivateKey;
}

export function cacheConversationKey(conversationId: string, key: CryptoKey) {
  conversationKeys.set(conversationId, key);
}

export function getCachedConversationKey(
  conversationId: string,
): CryptoKey | null {
  return conversationKeys.get(conversationId) ?? null;
}

export function clearCryptoSession() {
  identityPrivateKey = null;
  conversationKeys.clear();
}
