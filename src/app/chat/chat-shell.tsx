'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import {
  decryptMessage,
  encryptMessage,
} from '@/lib/crypto/keys';
import { getOrDeriveConversationKey } from '@/lib/crypto/conversation';
import {
  clearCryptoSession,
  getIdentityPrivateKey,
} from '@/lib/crypto/session';
import { UnlockModal } from './unlock-modal';

interface Conversation {
  id: string;
  otherUserId: string;
  otherUsername: string;
  otherDisplayName: string;
  otherPublicKey: JsonWebKey;
}

interface DecryptedMessage {
  id: string;
  senderId: string;
  plaintext: string;
  createdAt: string;
}

interface RawMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  ciphertext: string;
  iv: string;
  created_at: string;
}

export function ChatShell({
  currentUserId,
  currentUsername,
  currentDisplayName,
}: {
  currentUserId: string;
  currentUsername: string;
  currentDisplayName: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [unlocked, setUnlocked] = useState(() => !!getIdentityPrivateKey());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const globalChannelRef = useRef<RealtimeChannel | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  const handleSignOut = useCallback(async () => {
    clearCryptoSession();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }, [supabase, router]);

  // ----------------------------------------------------------------------------
  // Chargement des conversations
  // ----------------------------------------------------------------------------
  const loadConversations = useCallback(async () => {
    const { data, error: convError } = await supabase
      .from('conversations')
      .select(
        `
        id,
        user_a,
        user_b,
        user_a_profile:profiles!conversations_user_a_fkey(id, username, display_name, public_key),
        user_b_profile:profiles!conversations_user_b_fkey(id, username, display_name, public_key)
        `,
      )
      .order('created_at', { ascending: false });

    if (convError) {
      setError(convError.message);
      return;
    }
    type Row = {
      id: string;
      user_a: string;
      user_b: string;
      user_a_profile: { id: string; username: string; display_name: string | null; public_key: JsonWebKey | null } | null;
      user_b_profile: { id: string; username: string; display_name: string | null; public_key: JsonWebKey | null } | null;
    };

    const list: Conversation[] = (data as unknown as Row[] | null ?? [])
      .map((row) => {
        const other =
          row.user_a === currentUserId ? row.user_b_profile : row.user_a_profile;
        if (!other || !other.public_key) return null;
        return {
          id: row.id,
          otherUserId: other.id,
          otherUsername: other.username,
          otherDisplayName: other.display_name ?? other.username,
          otherPublicKey: other.public_key,
        };
      })
      .filter((c): c is Conversation => c !== null);
    setConversations(list);
  }, [supabase, currentUserId]);

  // ----------------------------------------------------------------------------
  // Subscription globale aux nouveaux messages (toutes conversations).
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (!unlocked) return;
    loadConversations();

    const channel = supabase
      .channel('messages-inbox')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as RawMessage;
          // Si le message concerne une conversation qu'on ne connaît pas
          // encore, rafraîchit la liste.
          const exists = conversationsRef.current.some(
            (c) => c.id === msg.conversation_id,
          );
          if (!exists) {
            await loadConversations();
          }
          // Si on est dans la conversation courante, on ignore (channel
          // dédié s'en occupe).
          if (msg.conversation_id === selectedIdRef.current) return;
        },
      )
      .subscribe();

    globalChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      globalChannelRef.current = null;
    };
  }, [unlocked, supabase, loadConversations]);

  const conversationsRef = useRef(conversations);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // ----------------------------------------------------------------------------
  // Chargement + déchiffrement des messages quand on sélectionne une conv
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (!unlocked || !selectedConversation) return;
    let cancelled = false;
    setLoadingMessages(true);
    setMessages([]);

    (async () => {
      const convKey = await getOrDeriveConversationKey(
        selectedConversation.id,
        selectedConversation.otherPublicKey,
      );
      if (!convKey) return;

      const { data, error: msgError } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, ciphertext, iv, created_at')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true })
        .limit(200);

      if (cancelled) return;
      if (msgError) {
        setError(msgError.message);
        setLoadingMessages(false);
        return;
      }

      const decrypted: DecryptedMessage[] = [];
      for (const m of (data ?? []) as RawMessage[]) {
        try {
          const plaintext = await decryptMessage(convKey, {
            ciphertext: m.ciphertext,
            iv: m.iv,
          });
          decrypted.push({
            id: m.id,
            senderId: m.sender_id,
            plaintext,
            createdAt: m.created_at,
          });
        } catch {
          decrypted.push({
            id: m.id,
            senderId: m.sender_id,
            plaintext: '⚠️ Message indéchiffrable (clés changées ?)',
            createdAt: m.created_at,
          });
        }
      }
      if (cancelled) return;
      setMessages(decrypted);
      setLoadingMessages(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [unlocked, selectedConversation, supabase]);

  // ----------------------------------------------------------------------------
  // Subscription Realtime sur les messages de la conversation sélectionnée
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (!unlocked || !selectedConversation) return;
    const conv = selectedConversation;

    const channel = supabase
      .channel(`conversation:${conv.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conv.id}`,
        },
        async (payload) => {
          const m = payload.new as RawMessage;
          // Évite les doublons (le sender voit déjà son propre message via le push optimiste)
          setMessages((prev) => {
            if (prev.some((p) => p.id === m.id)) return prev;
            return prev;
          });
          const convKey = await getOrDeriveConversationKey(
            conv.id,
            conv.otherPublicKey,
          );
          if (!convKey) return;
          try {
            const plaintext = await decryptMessage(convKey, {
              ciphertext: m.ciphertext,
              iv: m.iv,
            });
            setMessages((prev) =>
              prev.some((p) => p.id === m.id)
                ? prev
                : [
                    ...prev,
                    {
                      id: m.id,
                      senderId: m.sender_id,
                      plaintext,
                      createdAt: m.created_at,
                    },
                  ],
            );
          } catch {
            // ignore
          }
        },
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [unlocked, selectedConversation, supabase]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ----------------------------------------------------------------------------
  // Envoyer un message
  // ----------------------------------------------------------------------------
  async function sendMessage() {
    if (!selectedConversation || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const convKey = await getOrDeriveConversationKey(
        selectedConversation.id,
        selectedConversation.otherPublicKey,
      );
      if (!convKey) throw new Error('Clé non disponible.');
      const enc = await encryptMessage(convKey, draft.trim());
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: currentUserId,
          ciphertext: enc.ciphertext,
          iv: enc.iv,
        })
        .select('id, created_at')
        .single();
      if (insertError) throw insertError;
      if (data) {
        setMessages((prev) => [
          ...prev,
          {
            id: data.id,
            senderId: currentUserId,
            plaintext: draft.trim(),
            createdAt: data.created_at,
          },
        ]);
      }
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur d’envoi');
    } finally {
      setSending(false);
    }
  }

  // ----------------------------------------------------------------------------
  // Démarrer une conversation avec un autre user (par username)
  // ----------------------------------------------------------------------------
  async function startConversationWith(otherUsername: string) {
    setError(null);
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, public_key')
        .eq('username', otherUsername)
        .single();
      if (profileError) throw profileError;
      if (!profile) throw new Error('Utilisateur introuvable.');
      if (profile.id === currentUserId) {
        throw new Error('Tu ne peux pas converser avec toi-même.');
      }
      if (!profile.public_key) {
        throw new Error(
          'Cet utilisateur n’a pas encore activé son chiffrement (connexion initiale requise).',
        );
      }

      const [userA, userB] = sortIds(currentUserId, profile.id);
      // upsert / find-or-create
      const existing = conversations.find((c) => c.otherUserId === profile.id);
      if (existing) {
        setSelectedId(existing.id);
        return;
      }
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({ user_a: userA, user_b: userB })
        .select('id')
        .single();
      if (convError) {
        // Si conflit unique (déjà créée), retrouve-la
        if (convError.code === '23505') {
          const { data: existingConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('user_a', userA)
            .eq('user_b', userB)
            .single();
          if (existingConv) {
            await loadConversations();
            setSelectedId(existingConv.id);
            return;
          }
        }
        throw convError;
      }
      const newOne: Conversation = {
        id: newConv!.id,
        otherUserId: profile.id,
        otherUsername: profile.username,
        otherDisplayName: profile.display_name ?? profile.username,
        otherPublicKey: profile.public_key as JsonWebKey,
      };
      setConversations((prev) => [newOne, ...prev]);
      setSelectedId(newOne.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  // ----------------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------------
  if (!unlocked) {
    return (
      <UnlockModal
        userId={currentUserId}
        onUnlocked={() => setUnlocked(true)}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="flex-1 flex h-[100dvh] min-h-0">
      <Sidebar
        currentUsername={currentUsername}
        currentDisplayName={currentDisplayName}
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onStartConversation={startConversationWith}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-[color:var(--bg)]">
        {selectedConversation ? (
          <>
            <header className="border-b border-[color:var(--line)] px-6 py-4 flex items-center gap-4">
              <Avatar name={selectedConversation.otherDisplayName} />
              <div className="min-w-0 flex-1">
                <div className="font-[family-name:var(--font-instrument-serif)] text-xl tracking-tight text-[color:var(--ink)] truncate">
                  {selectedConversation.otherDisplayName}
                </div>
                <div className="text-[11px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)] flex items-center gap-2">
                  <span>@{selectedConversation.otherUsername}</span>
                  <span className="size-0.5 rounded-full bg-[color:var(--muted)]" />
                  <span className="inline-flex items-center gap-1.5 text-[color:var(--accent)]">
                    <span className="size-1.5 rounded-full bg-[color:var(--accent)] animate-pulse" />
                    end-to-end · aes-gcm-256
                  </span>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
              {loadingMessages && (
                <p className="text-[12px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)] text-center">
                  · déchiffrement ·
                </p>
              )}
              {!loadingMessages && messages.length === 0 && (
                <div className="text-center pt-16">
                  <p className="font-[family-name:var(--font-instrument-serif)] text-2xl italic text-[color:var(--muted)]">
                    Aucun message encore.
                  </p>
                  <p className="mt-2 text-[12px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)]">
                    écris la première ligne ↓
                  </p>
                </div>
              )}
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const sameAuthor = prev && prev.senderId === m.senderId;
                return (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    isMe={m.senderId === currentUserId}
                    grouped={!!sameAuthor}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="border-t border-[color:var(--line)] px-6 py-4"
            >
              <div className="flex items-center gap-3 rounded-full hairline bg-[color:var(--surface)] pl-5 pr-1.5 py-1.5 focus-within:border-[color:var(--accent)] transition">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="écris un message…"
                  disabled={sending}
                  className="flex-1 bg-transparent text-[15px] text-[color:var(--ink)] placeholder:text-[color:var(--muted)]/70 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="rounded-full bg-[color:var(--accent)] text-[color:var(--accent-ink)] size-9 inline-flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition"
                  title="Envoyer"
                >
                  {sending ? (
                    <span className="text-[11px] font-[family-name:var(--font-geist-mono)]">···</span>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M13 6l6 6-6 6" />
                    </svg>
                  )}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-[12px] text-[color:var(--danger)]">{error}</p>
              )}
            </form>
          </>
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  );
}

function sortIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// ----------------------------------------------------------------------------
// Sidebar
// ----------------------------------------------------------------------------
function Sidebar({
  currentUsername,
  currentDisplayName,
  conversations,
  selectedId,
  onSelect,
  onStartConversation,
  onSignOut,
}: {
  currentUsername: string;
  currentDisplayName: string;
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStartConversation: (username: string) => void;
  onSignOut: () => void;
}) {
  const [newUsername, setNewUsername] = useState('');

  return (
    <aside className="w-80 border-r border-[color:var(--line)] bg-[color:var(--bg-elev)] flex flex-col min-h-0">
      <header className="px-5 py-5 border-b border-[color:var(--line)]">
        <div className="flex items-center gap-2 text-[10px] font-[family-name:var(--font-geist-mono)] uppercase tracking-[0.18em] text-[color:var(--muted)]">
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            className="text-[color:var(--accent)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="4" y="11" width="16" height="9" rx="1.5" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          secure<span className="text-[color:var(--muted)]"> / </span>chat
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-[family-name:var(--font-instrument-serif)] text-xl tracking-tight text-[color:var(--ink)] truncate">
              {currentDisplayName}
            </div>
            <div className="text-[11px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)] truncate">
              @{currentUsername}
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="text-[11px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)] hover:text-[color:var(--ink)] transition"
            title="Se déconnecter"
          >
            sortir →
          </button>
        </div>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newUsername.trim()) {
            onStartConversation(newUsername.trim().toLowerCase());
            setNewUsername('');
          }
        }}
        className="px-5 py-4 border-b border-[color:var(--line)]"
      >
        <label className="small-caps text-[10px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)]">
          nouvelle conversation
        </label>
        <div className="mt-2 flex items-center gap-2 hairline rounded-full bg-[color:var(--surface)] pl-4 pr-1 py-0.5 focus-within:border-[color:var(--accent)] transition">
          <input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="@username"
            className="flex-1 bg-transparent text-[13px] text-[color:var(--ink)] placeholder:text-[color:var(--muted)] focus:outline-none py-1.5"
          />
          <button
            type="submit"
            className="rounded-full bg-[color:var(--accent)] text-[color:var(--accent-ink)] size-7 inline-flex items-center justify-center hover:opacity-90 transition"
            title="Démarrer"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </form>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-[12px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)] leading-relaxed">
            aucun fil pour l’instant.
            <br />
            saisis un @username ci-dessus pour ouvrir une conversation chiffrée.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((c) => {
              const active = selectedId === c.id;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => onSelect(c.id)}
                    className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition ${
                      active
                        ? 'bg-[color:var(--surface)] shadow-[inset_0_0_0_1px_var(--line-strong)]'
                        : 'hover:bg-[color:var(--surface)]/60'
                    }`}
                  >
                    <Avatar name={c.otherDisplayName} />
                    <div className="min-w-0 flex-1">
                      <div className="font-[family-name:var(--font-instrument-serif)] text-[16px] leading-tight tracking-tight text-[color:var(--ink)] truncate">
                        {c.otherDisplayName}
                      </div>
                      <div className="text-[11px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)] truncate">
                        @{c.otherUsername}
                      </div>
                    </div>
                    {active && (
                      <span className="size-1.5 rounded-full bg-[color:var(--accent)]" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="px-5 py-3 border-t border-[color:var(--line)] text-[10px] font-[family-name:var(--font-geist-mono)] text-[color:var(--muted)] flex items-center justify-between">
        <span>session locale</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[color:var(--accent)] animate-pulse" />
          live
        </span>
      </footer>
    </aside>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------
function Avatar({ name }: { name: string }) {
  const initial = name.trim()[0]?.toUpperCase() ?? '?';
  return (
    <div className="size-10 rounded-full bg-[color:var(--accent-soft)] hairline flex items-center justify-center font-[family-name:var(--font-instrument-serif)] text-[18px] text-[color:var(--accent)] shrink-0">
      {initial}
    </div>
  );
}

function MessageBubble({
  message,
  isMe,
  grouped,
}: {
  message: DecryptedMessage;
  isMe: boolean;
  grouped: boolean;
}) {
  return (
    <div
      className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${
        grouped ? '-mt-1.5' : 'mt-1'
      }`}
    >
      <div
        className={`max-w-[75%] px-4 py-2.5 text-[14.5px] leading-snug whitespace-pre-wrap break-words ${
          isMe
            ? 'bg-[color:var(--accent)] text-[color:var(--accent-ink)] rounded-2xl rounded-br-md'
            : 'bg-[color:var(--surface)] text-[color:var(--ink)] hairline rounded-2xl rounded-bl-md'
        }`}
      >
        {message.plaintext}
        <div
          className={`mt-1 text-[10px] font-[family-name:var(--font-geist-mono)] tabular ${
            isMe ? 'text-[color:var(--accent-ink)]/60' : 'text-[color:var(--muted)]'
          }`}
        >
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="inline-flex size-14 items-center justify-center rounded-full bg-[color:var(--accent-soft)] hairline">
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            className="text-[color:var(--accent)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="4" y="11" width="16" height="9" rx="1.5" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <h2 className="mt-5 font-[family-name:var(--font-instrument-serif)] text-3xl tracking-tight text-[color:var(--ink)]">
          Choisis un fil
          <br />
          ou <em className="italic text-[color:var(--accent)]">commences-en un</em>.
        </h2>
        <p className="mt-3 text-[13px] text-[color:var(--ink-soft)]">
          Saisis un @username dans la barre latérale pour ouvrir une nouvelle
          conversation chiffrée bout en bout.
        </p>
      </div>
    </div>
  );
}
