import type {
  ConversationSummary,
  MessagingMessage,
  MessagingSnapshot,
  MessagingViewer,
  SendMessageInput,
  ViewerSession,
} from './types';

function slugify(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'user'
  );
}

function buildViewer(viewerSession?: ViewerSession): MessagingViewer {
  const displayName = viewerSession?.name?.trim() || 'Workspace User';
  const firstLetter = displayName[0]?.toUpperCase() || 'W';

  return {
    id: viewerSession?.id || 'viewer-session',
    displayName,
    handle: `@${slugify(displayName)}`,
    avatarLabel: firstLetter,
    phoneLabel: 'Connected account',
    about: 'Signed in to the messaging workspace.',
    email: viewerSession?.email || null,
    role: viewerSession?.role || 'staff',
  };
}

export function getMessagingSnapshot(viewerSession?: ViewerSession): MessagingSnapshot {
  return {
    viewer: buildViewer(viewerSession),
    conversations: [],
    messagesByConversation: {},
    members: [],
    pendingMembers: [],
  };
}

export function getConversationMessages(
  conversationId: string,
  viewerSession?: ViewerSession
): MessagingMessage[] | null {
  void conversationId;
  void viewerSession;
  return null;
}

export function appendMessage(
  input: SendMessageInput,
  viewerSession?: ViewerSession
): { message: MessagingMessage; conversations: ConversationSummary[] } | null {
  void input;
  void viewerSession;
  return null;
}
