export type ConversationType = 'direct' | 'group';

export type PresenceState = 'online' | 'away' | 'offline';

export type MessageDeliveryState = 'sent' | 'delivered' | 'read';

export interface MessagingViewer {
  id: string;
  displayName: string;
  handle: string;
  avatarLabel: string;
  phoneLabel: string;
  about: string;
}

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  title: string;
  subtitle: string;
  avatarLabel: string;
  accent: string;
  unreadCount: number;
  memberCount: number;
  lastMessagePreview: string;
  lastActivityLabel: string;
  presence: PresenceState;
  typingLabel?: string;
}

export interface MessagingMessage {
  id: string;
  clientId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  kind: 'text';
  createdAt: string;
  createdAtLabel: string;
  delivery: MessageDeliveryState;
  direction: 'incoming' | 'outgoing';
}

export interface MessagingSnapshot {
  viewer: MessagingViewer;
  conversations: ConversationSummary[];
  messagesByConversation: Record<string, MessagingMessage[]>;
}

export interface SendMessageInput {
  conversationId: string;
  body: string;
}

export interface ViewerSession {
  id?: string;
  name?: string | null;
}
