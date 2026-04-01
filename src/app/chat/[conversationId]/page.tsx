'use client';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useChatStore, Message } from '@/store/chatStore';
import { api } from '@/lib/api';
import ChatWindow from '@/components/chat/ChatWindow';

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const setMessages = useChatStore((s) => s.setMessages);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  useEffect(() => {
    if (!conversationId) return;
    setActiveConversation(conversationId);
    api.get<Message[]>(`/api/messages/${conversationId}`).then((msgs) => setMessages(conversationId, msgs)).catch(console.error);
    return () => setActiveConversation('');
  }, [conversationId, setMessages, setActiveConversation]);
  return <ChatWindow conversationId={conversationId} />;
}
