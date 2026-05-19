# Secure Chat

Messagerie temps réel chiffrée bout en bout. Stack : Next.js 16 (App Router, PWA), Supabase (Auth + Postgres + Realtime), WebCrypto (ECDH P-256 + AES-GCM 256 + PBKDF2-SHA-256).

## Architecture E2E

1. À l'inscription :
   - Le client génère une paire ECDH P-256
   - La clé publique (JWK) est stockée en clair dans `profiles.public_key`
   - La clé privée est chiffrée avec une clé AES-GCM dérivée du mot de passe (PBKDF2 600 000 itérations, sel 16 octets)
   - Le ciphertext + IV + sel sont stockés dans `user_keys`
2. À la connexion :
   - Le client récupère son `user_keys`, déchiffre la clé privée avec le mot de passe
   - La clé privée vit uniquement en mémoire (perdue au refresh → modale de déverrouillage)
3. Pour chaque conversation :
   - `ECDH(myPrivate, theirPublic)` → clé AES-GCM 256
   - Chaque message est chiffré avec un IV aléatoire 12 octets
4. Le serveur ne voit que `ciphertext` et `iv` (base64). Il ne peut pas lire les messages.

**Limites Phase 1** : pas de Double Ratchet (pas de forward secrecy par message), pas de validation de la clé publique (un serveur malveillant pourrait substituer la clé publique d'un user → MITM). À renforcer pour un usage critique.

## Setup

### 1. Créer un projet Supabase

1. Va sur https://supabase.com → New project
2. Récupère :
   - `Project URL` (https://xxxx.supabase.co)
   - `anon` public key
3. **Désactive la confirmation email pour démarrer** : Dashboard → Authentication → Sign In / Up → Email → décoche "Confirm email" (sinon il faut configurer un SMTP avant les premiers tests).

### 2. Appliquer le schéma SQL

Ouvre Dashboard → SQL Editor → New query, copie tout le contenu de `supabase/migrations/20260519000001_init.sql`, puis Run.

Le script crée : `profiles`, `user_keys`, `conversations`, `messages` + RLS + trigger profil auto + ajoute `messages` à la publication `supabase_realtime`.

### 3. Variables d'env

Copie `.env.local.example` → `.env.local` et remplis :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 4. Lancer

```bash
npm install
npm run dev
```

Ouvre http://localhost:3000.

## Tester avec deux comptes

1. Onglet 1 (mode normal) → /signup → crée `alice` (mot de passe ≥ 10 caractères)
2. Onglet 2 (mode privé / autre navigateur) → /signup → crée `bob`
3. Côté Alice : sidebar → nouvelle conversation → tape `bob` → +
4. Envoie un message. Bob le reçoit en temps réel (chiffré).
5. Vérifie dans le Dashboard Supabase → Table Editor → `messages` : seul du ciphertext base64 est visible.

## Routes

- `/` — landing
- `/signup` — création de compte + génération de clés
- `/login` — connexion + déverrouillage de la clé
- `/forgot` — demande de reset password
- `/auth/reset` — nouveau mot de passe (regénère les clés → l'historique devient illisible)
- `/auth/callback` — handler OAuth / confirmation email
- `/chat` — messagerie

## Roadmap

- **Phase 2** : appels audio/vidéo (WebRTC peer-to-peer, signalisation via Supabase Realtime, E2E natif WebRTC + DTLS-SRTP)
- **Phase 3** : partage de fichiers chiffrés (Supabase Storage + chiffrement client)
- **Phase 4** : Double Ratchet (forward secrecy par message), vérification des clés (QR code / safety numbers)
