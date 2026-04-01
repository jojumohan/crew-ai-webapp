'use client';
import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { getSocket } from '@/lib/socket';

export default function MessageInput({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState(''); const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const isTyping = useRef(false); const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emitStopTyping = useCallback(() => { if (isTyping.current) { getSocket()?.emit('user:stop-typing', { conversationId }); isTyping.current = false; } }, [conversationId]);
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    const socket = getSocket(); if (!socket) return;
    if (!isTyping.current) { socket.emit('user:typing', { conversationId }); isTyping.current = true; }
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
    stopTypingTimer.current = setTimeout(emitStopTyping, 2000);
    const ta = textareaRef.current; if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 144)}px`; }
  }
  function send() {
    const content = text.trim(); if (!content) return;
    const socket = getSocket(); if (!socket) return;
    socket.emit('message:send', { conversationId, content, type: 'TEXT' });
    setText(''); if (textareaRef.current) textareaRef.current.style.height = 'auto'; emitStopTyping();
  }
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }
  return (
    <div className="flex items-end gap-2 px-3 py-3 bg-wa-panel border-t border-wa-hover">
      <textarea ref={textareaRef} value={text} onChange={handleChange} onKeyDown={handleKeyDown} placeholder="Type a message" rows={1} className="flex-1 resize-none bg-wa-hover rounded-2xl px-4 py-2.5 text-wa-text placeholder-wa-muted outline-none text-[15px] leading-snug max-h-36 overflow-y-auto" />
      <button onClick={send} disabled={!text.trim()} className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full bg-wa-green hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white rotate-45"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
  );
}
