'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { callFunction } from '@/lib/firebase-functions';
import { getFirestoreInstance } from '@/lib/firebase-client';
import { ChatMessage } from '@/types/pvp';
import { useDisplayName } from '@/stores/authStore';

const SUPPORTED_REACTIONS = ['😄', '❤️', '🔥', '🎮', '⚔️', '💎', '😂', '👏'];

interface ChatSidebarProps {
  chatType?: 'arena' | 'match';
  matchId?: string;
  className?: string;
}

export default function ChatSidebar({ chatType = 'arena', matchId, className = '' }: ChatSidebarProps) {
  const { address, isConnected } = useAccount();
  const displayName = useDisplayName(address);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const collectionPath = chatType === 'match' ? `pvpMatches/${matchId}/chat` : 'pvpChat';

  const fetchMessages = useCallback(async () => {
    try {
      const db = await getFirestoreInstance();
      const { collection: col, query, orderBy, limit, getDocs, where } = await import('firebase/firestore');

      const q = query(
        col(db, collectionPath),
        where('isDeleted', '==', false),
        orderBy('timestamp', 'desc'),
        limit(25)
      );

      const snap = await getDocs(q);
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse() as ChatMessage[];
      setMessages(msgs);
      setPinnedMessages(msgs.filter(m => m.isPinned));
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Chat fetch error:', err);
      setLoading(false);
    }
  }, [collectionPath]);

  // ── Poll every 30s; also called immediately after send ─────────────────
  useEffect(() => {
    fetchMessages();
    const timer = setInterval(fetchMessages, 30000);
    return () => clearInterval(timer);
  }, [fetchMessages]);

  const send = async () => {
    if (!input.trim() || !isConnected || sending) return;

    setSending(true);
    const text = input.trim();
    setInput('');
    const replyTarget = replyTo;
    setReplyTo(null);

    try {
      await callFunction('sendChatMessage', {
        text,
        chatType,
        matchId: matchId || null,
        replyToId: replyTarget?.id || null,
      });
      fetchMessages(); // refresh immediately so the sent message appears
    } catch (err: any) {
      console.error('Send error:', err);
      setInput(text); // restore on failure
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!isConnected) return;
    setShowReactionPicker(null);
    try {
      await callFunction('addReaction', { messageId, emoji, chatType, matchId });
    } catch (err) { console.error(err); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === 'Escape') { setReplyTo(null); setShowReactionPicker(null); }
  };

  const formatTime = (ts: any) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const truncate = (addr: string) =>
    addr?.length > 20 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  return (
    <div className={`flex flex-col bg-arcade-dark/95 border-l border-arcade-green/30 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-arcade-green/20">
        <div className="flex items-center gap-2">
          <span className="text-arcade-green font-pixel text-xs">
            {chatType === 'match' ? '⚔️ MATCH CHAT' : '💬 ARENA CHAT'}
          </span>
          <span className="text-gray-500 text-xs font-pixel">({messages.length})</span>
        </div>
      </div>

      {/* Pinned messages */}
      {pinnedMessages.length > 0 && (
        <div className="px-3 py-1 bg-arcade-green/10 border-b border-arcade-green/20">
          {pinnedMessages.slice(0, 1).map(pm => (
            <div key={pm.id} className="flex items-start gap-1">
              <span className="text-arcade-green text-xs">📌</span>
              <span className="text-gray-300 text-xs truncate">{pm.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 min-h-0 scrollbar-thin scrollbar-thumb-arcade-green/30">
        {loading ? (
          <div className="text-center text-gray-500 font-pixel text-xs py-4">Loading chat...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-600 font-pixel text-xs py-4">No messages yet. Say something!</div>
        ) : (
          messages.map(msg => (
            <ChatMessageItem
              key={msg.id}
              msg={msg}
              currentAddress={address?.toLowerCase()}
              onReply={() => { setReplyTo(msg); inputRef.current?.focus(); }}
              onReaction={(emoji) => handleReaction(msg.id, emoji)}
              showReactionPicker={showReactionPicker === msg.id}
              onToggleReactions={() =>
                setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)
              }
              formatTime={formatTime}
              truncate={truncate}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="mx-2 mb-1 px-2 py-1 bg-arcade-green/10 border border-arcade-green/30 rounded flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-arcade-green text-xs font-pixel">↩ {replyTo.displayName}</span>
            <p className="text-gray-400 text-xs truncate">{replyTo.text}</p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="text-gray-500 hover:text-red-400 text-xs shrink-0"
          >✕</button>
        </div>
      )}

      {/* Input */}
      <div className="px-2 pb-2 pt-1">
        {isConnected ? (
          <div className="flex gap-1">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={replyTo ? `Reply to ${replyTo.displayName}...` : 'Type a message...'}
              maxLength={500}
              className="flex-1 bg-black/40 border border-arcade-green/30 rounded px-2 py-1.5
                         text-xs text-gray-200 placeholder-gray-600 font-pixel
                         focus:outline-none focus:border-arcade-green/70 min-w-0"
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="bg-arcade-green/20 hover:bg-arcade-green/40 border border-arcade-green/50
                         text-arcade-green font-pixel text-xs px-2 py-1.5 rounded
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {sending ? '...' : '▶'}
            </button>
          </div>
        ) : (
          <div className="text-center text-gray-600 font-pixel text-xs py-1">
            Connect wallet to chat
          </div>
        )}
      </div>
    </div>
  );
}

// ── Individual message component ────────────────────────────────────────────

interface MessageItemProps {
  msg: ChatMessage;
  currentAddress?: string;
  onReply: () => void;
  onReaction: (emoji: string) => void;
  showReactionPicker: boolean;
  onToggleReactions: () => void;
  formatTime: (ts: any) => string;
  truncate: (addr: string) => string;
}

function ChatMessageItem({
  msg, currentAddress, onReply, onReaction,
  showReactionPicker, onToggleReactions, formatTime, truncate,
}: MessageItemProps) {
  const isOwn = msg.author === currentAddress;
  const reactionEntries = Object.entries(msg.reactions || {});

  return (
    <div className={`group relative ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
      {/* Reply context */}
      {msg.replyTo && (
        <div className={`mb-0.5 px-2 py-0.5 rounded bg-white/5 border-l-2 border-arcade-green/40
                         max-w-[90%] ${isOwn ? 'self-end' : 'self-start'}`}>
          <span className="text-arcade-green/70 text-xs">↩ {msg.replyToAuthor}: </span>
          <span className="text-gray-500 text-xs truncate">{msg.replyToText}</span>
        </div>
      )}

      {/* Message bubble */}
      <div className={`flex gap-1 max-w-[95%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`rounded px-2 py-1 text-xs max-w-full
          ${isOwn
            ? 'bg-arcade-green/20 border border-arcade-green/40 text-gray-100'
            : 'bg-white/5 border border-white/10 text-gray-200'
          }`}
        >
          {!isOwn && (
            <div className="font-pixel text-arcade-cyan/80 text-xs mb-0.5 truncate max-w-[120px]">
              {msg.displayName || truncate(msg.author)}
            </div>
          )}
          {msg.gifUrl ? (
            <img src={msg.gifUrl} alt="GIF" className="max-w-[150px] rounded" />
          ) : (
            <span className="break-words">{msg.text}</span>
          )}
          <span className="text-gray-600 text-xs ml-2 float-right">{formatTime(msg.timestamp)}</span>
        </div>
      </div>

      {/* Reactions display */}
      {reactionEntries.length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-0.5 ${isOwn ? 'self-end' : 'self-start'}`}>
          {reactionEntries.map(([emoji, reactors]) => (
            <button
              key={emoji}
              onClick={() => onReaction(emoji)}
              className={`text-xs px-1 py-0.5 rounded border transition-colors
                ${reactors.includes(currentAddress || '')
                  ? 'border-arcade-green/60 bg-arcade-green/20'
                  : 'border-white/10 bg-white/5 hover:border-arcade-green/40'
                }`}
            >
              {emoji} <span className="text-gray-400">{reactors.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Hover actions */}
      <div className={`absolute top-0 hidden group-hover:flex gap-1 z-10
                       ${isOwn ? 'left-0' : 'right-0'}`}>
        {/* Reaction picker toggle */}
        <button
          onClick={onToggleReactions}
          className="text-xs px-1 py-0.5 bg-arcade-dark border border-arcade-green/30
                     rounded text-gray-400 hover:text-arcade-green"
        >😀</button>
        {/* Reply */}
        <button
          onClick={onReply}
          className="text-xs px-1 py-0.5 bg-arcade-dark border border-arcade-green/30
                     rounded text-gray-400 hover:text-arcade-green"
        >↩</button>
      </div>

      {/* Reaction emoji picker popup */}
      {showReactionPicker && (
        <div className={`absolute top-6 z-20 bg-arcade-dark border border-arcade-green/40
                         rounded p-1 flex gap-1 shadow-xl
                         ${isOwn ? 'left-0' : 'right-0'}`}>
          {SUPPORTED_REACTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => onReaction(emoji)}
              className="text-base hover:scale-125 transition-transform p-0.5"
            >{emoji}</button>
          ))}
        </div>
      )}
    </div>
  );
}
