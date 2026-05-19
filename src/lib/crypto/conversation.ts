import {
  deriveConversationKey,
  importPublicJwk,
} from './keys';
import {
  cacheConversationKey,
  getCachedConversationKey,
  getIdentityPrivateKey,
} from './session';

/**
 * Récupère ou dérive la clé AES-GCM partagée pour une conversation.
 * Retourne null si la clé d'identité n'est pas en mémoire (utilisateur
 * pas encore déverrouillé).
 */
export async function getOrDeriveConversationKey(
  conversationId: string,
  theirPublicJwk: JsonWebKey,
): Promise<CryptoKey | null> {
  const cached = getCachedConversationKey(conversationId);
  if (cached) return cached;

  const myPrivate = getIdentityPrivateKey();
  if (!myPrivate) return null;

  const theirPub = await importPublicJwk(theirPublicJwk);
  const key = await deriveConversationKey(myPrivate, theirPub);
  cacheConversationKey(conversationId, key);
  return key;
}
