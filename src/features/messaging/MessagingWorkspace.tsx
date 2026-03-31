'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { signOut } from 'next-auth/react';
import { getSignOutCallbackUrl } from '@/lib/auth-client';
import {
  BackIcon,
  BellIcon,
  ChatBubbleIcon,
  ClipIcon,
  CloseIcon,
  CommunityIcon,
  DotsIcon,
  FilterIcon,
  LockIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  SmileyIcon,
  StatusIcon,
  VideoIcon,
} from './InterfaceIcons';
import styles from './MessagingWorkspace.module.css';
import type {
  ConversationSummary,
  MessagingMessage,
  MessagingSnapshot,
  WorkspaceMember,
} from './types';

type MessageCreateResponse = {
  message: MessagingMessage;
  conversations: ConversationSummary[];
};

type ConversationCreateResponse = {
  conversationId: string;
  snapshot: MessagingSnapshot;
};

type TeamApiMember = {
  id: string;
  username?: string;
  display_name?: string;
  email?: string | null;
  role?: string;
  status?: 'active' | 'pending' | string;
  created_at?: string;
};

type TeamApiResponse = {
  users: TeamApiMember[];
};

type SearchResult =
  | {
      kind: 'conversation';
      id: string;
      title: string;
      subtitle: string;
      meta: string;
      avatarLabel: string;
      accent: string;
    }
  | {
      kind: 'member';
      id: string;
      title: string;
      subtitle: string;
      meta: string;
      avatarLabel: string;
      accent: string;
    };

const quickEmoji = ['😀', '😂', '😍', '🙏', '🔥', '👍'];

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function formatCreatedAtLabel(iso?: string): string {
  if (!iso) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

function getMemberAccent(memberId: string): string {
  const colors = ['#00a884', '#53bdeb', '#7d8cf8', '#f28b82', '#f3b04f'];
  let hash = 0;

  for (const char of memberId) {
    hash = (hash * 31 + char.charCodeAt(0)) % colors.length;
  }

  return colors[Math.abs(hash) % colors.length];
}

function mapTeamMembers(users: TeamApiMember[]) {
  const members = users.map((user) => {
    const displayName = user.display_name?.trim() || user.username?.trim() || 'Team member';
    const initials = displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'TM';
    const status = user.status === 'pending' ? 'pending' : 'active';

    return {
      id: user.id,
      username: user.username || 'member',
      displayName,
      email: user.email || null,
      role: user.role || 'staff',
      status,
      avatarLabel: initials,
      createdAtLabel: formatCreatedAtLabel(user.created_at),
    } satisfies WorkspaceMember;
  });

  return {
    members: members.filter((member) => member.status === 'active'),
    pendingMembers: members.filter((member) => member.status === 'pending'),
  };
}

function reorderConversations(
  conversations: ConversationSummary[],
  conversationId: string,
  preview: string
): ConversationSummary[] {
  const updated = conversations.map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          lastMessagePreview: preview,
          lastActivityLabel: 'now',
          unreadCount: 0,
        }
      : conversation
  );

  return updated.sort((left, right) => {
    if (left.id === conversationId) {
      return -1;
    }

    if (right.id === conversationId) {
      return 1;
    }

    return 0;
  });
}

function insertMessage(snapshot: MessagingSnapshot, message: MessagingMessage): MessagingSnapshot {
  const currentMessages = snapshot.messagesByConversation[message.conversationId] || [];
  const nextMessages = [...currentMessages, message];
  const nextConversations = reorderConversations(
    snapshot.conversations,
    message.conversationId,
    `You: ${message.body}`
  );

  return {
    ...snapshot,
    conversations: nextConversations,
    messagesByConversation: {
      ...snapshot.messagesByConversation,
      [message.conversationId]: nextMessages,
    },
  };
}

function replaceMessage(
  snapshot: MessagingSnapshot,
  conversationId: string,
  temporaryId: string,
  message: MessagingMessage,
  conversations: ConversationSummary[]
): MessagingSnapshot {
  const nextMessages = (snapshot.messagesByConversation[conversationId] || []).map((item) =>
    item.id === temporaryId ? message : item
  );

  return {
    ...snapshot,
    conversations,
    messagesByConversation: {
      ...snapshot.messagesByConversation,
      [conversationId]: nextMessages,
    },
  };
}

function removeMessage(
  snapshot: MessagingSnapshot,
  conversationId: string,
  temporaryId: string
): MessagingSnapshot {
  const nextMessages = (snapshot.messagesByConversation[conversationId] || []).filter(
    (message) => message.id !== temporaryId
  );

  return {
    ...snapshot,
    messagesByConversation: {
      ...snapshot.messagesByConversation,
      [conversationId]: nextMessages,
    },
  };
}

export default function MessagingWorkspace({
  initialSnapshot,
}: {
  initialSnapshot: MessagingSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedConversationId, setSelectedConversationId] = useState(
    initialSnapshot.conversations[0]?.id || ''
  );
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [memberNotice, setMemberNotice] = useState('');
  const [memberError, setMemberError] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    display_name: '',
    username: '',
    email: '',
    password: '',
    role: 'staff',
  });
  const [isPending, startTransition] = useTransition();
  const [isMemberPending, startMemberTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const canManageMembers = snapshot.viewer.role === 'admin';

  useEffect(() => {
    if (snapshot.conversations.length === 0) {
      if (selectedConversationId) {
        setSelectedConversationId('');
      }
      return;
    }

    const exists = snapshot.conversations.some(
      (conversation) => conversation.id === selectedConversationId
    );

    if (!exists) {
      setSelectedConversationId(snapshot.conversations[0].id);
    }
  }, [selectedConversationId, snapshot.conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversationId, snapshot.messagesByConversation]);

  const activeConversation =
    snapshot.conversations.find((conversation) => conversation.id === selectedConversationId) ||
    snapshot.conversations[0] ||
    null;
  const visibleMessages = activeConversation
    ? snapshot.messagesByConversation[activeConversation.id] || []
    : [];
  const otherMembers = snapshot.members.filter((member) => member.id !== snapshot.viewer.id);
  const normalizedQuery = search.trim().toLowerCase();

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!normalizedQuery) {
      return [];
    }

    const conversationResults = snapshot.conversations
      .filter((conversation) => {
        const haystack =
          `${conversation.title} ${conversation.subtitle} ${conversation.lastMessagePreview}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .map(
        (conversation) =>
          ({
            kind: 'conversation',
            id: conversation.id,
            title: conversation.title,
            subtitle: conversation.lastMessagePreview,
            meta: conversation.lastActivityLabel,
            avatarLabel: conversation.avatarLabel,
            accent: conversation.accent,
          }) satisfies SearchResult
      );

    const memberResults = otherMembers
      .filter((member) => {
        const haystack = `${member.displayName} ${member.username} ${member.email || ''}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .map(
        (member) =>
          ({
            kind: 'member',
            id: member.id,
            title: member.displayName,
            subtitle: member.email || `@${member.username}`,
            meta: member.role,
            avatarLabel: member.avatarLabel,
            accent: getMemberAccent(member.id),
          }) satisfies SearchResult
      );

    return [...conversationResults, ...memberResults];
  }, [normalizedQuery, otherMembers, snapshot.conversations]);

  async function refreshMembers() {
    const response = await fetch('/api/team', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error('member_refresh_failed');
    }

    const payload = (await response.json()) as TeamApiResponse;
    const team = mapTeamMembers(payload.users);

    setSnapshot((current) => ({
      ...current,
      members: team.members,
      pendingMembers: team.pendingMembers,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeConversation) {
      return;
    }

    const body = draft.trim();
    if (!body) {
      return;
    }

    const createdAt = new Date().toISOString();
    const optimisticId = `temp_${Date.now()}`;
    const optimisticMessage: MessagingMessage = {
      id: optimisticId,
      clientId: optimisticId,
      conversationId: activeConversation.id,
      senderId: snapshot.viewer.id,
      senderName: snapshot.viewer.displayName,
      body,
      kind: 'text',
      createdAt,
      createdAtLabel: formatClock(createdAt),
      delivery: 'sent',
      direction: 'outgoing',
    };

    setError('');
    setDraft('');
    setEmojiOpen(false);
    setAttachmentsOpen(false);
    setSnapshot((current) => insertMessage(current, optimisticMessage));

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch('/api/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conversationId: activeConversation.id,
              body,
            }),
          });

          if (!response.ok) {
            throw new Error('send_failed');
          }

          const payload = (await response.json()) as MessageCreateResponse;

          setSnapshot((current) =>
            replaceMessage(current, activeConversation.id, optimisticId, payload.message, payload.conversations)
          );
        } catch {
          setSnapshot((current) => removeMessage(current, activeConversation.id, optimisticId));
          setDraft(body);
          setError('Message could not be sent. Try again in a moment.');
        }
      })();
    });
  }

  function handleMemberFieldChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setNewMember((current) => ({ ...current, [name]: value }));
  }

  async function handleCreateMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMemberError('');
    setMemberNotice('');

    startMemberTransition(() => {
      void (async () => {
        try {
          const response = await fetch('/api/team', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(newMember),
          });

          const payload = (await response.json()) as { error?: string };

          if (!response.ok) {
            throw new Error(payload.error || 'member_create_failed');
          }

          await refreshMembers();
          setNewMember({
            display_name: '',
            username: '',
            email: '',
            password: '',
            role: 'staff',
          });
          setMemberNotice('New member added. They can sign in right away.');
        } catch (cause) {
          setMemberError(
            cause instanceof Error ? cause.message : 'New member could not be added right now.'
          );
        }
      })();
    });
  }

  function handleApproval(memberId: string, action: 'approve' | 'reject') {
    setMemberError('');
    setMemberNotice('');

    startMemberTransition(() => {
      void (async () => {
        try {
          const response = await fetch('/api/team/approve', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: memberId,
              action,
            }),
          });

          const payload = (await response.json()) as { error?: string };

          if (!response.ok) {
            throw new Error(payload.error || 'member_update_failed');
          }

          await refreshMembers();
          setMemberNotice(action === 'approve' ? 'Member approved.' : 'Pending request removed.');
        } catch (cause) {
          setMemberError(
            cause instanceof Error ? cause.message : 'Member status could not be updated right now.'
          );
        }
      })();
    });
  }

  function handleStartConversation(memberId: string) {
    setError('');
    setMemberError('');
    setMemberNotice('');

    startMemberTransition(() => {
      void (async () => {
        try {
          const response = await fetch('/api/v1/conversations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ memberId }),
          });

          const payload = (await response.json()) as ConversationCreateResponse & { error?: string };

          if (!response.ok) {
            throw new Error(payload.error || 'conversation_create_failed');
          }

          setSnapshot(payload.snapshot);
          setSelectedConversationId(payload.conversationId);
          setSearch('');
          setMemberModalOpen(false);
        } catch (cause) {
          setMemberError(
            cause instanceof Error ? cause.message : 'Conversation could not be opened right now.'
          );
        }
      })();
    });
  }

  function renderMemberFeedback() {
    return (
      <>
        {memberNotice ? <p className={styles.success}>{memberNotice}</p> : null}
        {memberError ? <p className={styles.error}>{memberError}</p> : null}
      </>
    );
  }

  function renderConversationList() {
    if (normalizedQuery) {
      return (
        <div className={styles.listScroller}>
          {searchResults.length > 0 ? (
            searchResults.map((result) => (
              <button
                key={`${result.kind}-${result.id}`}
                type="button"
                className={styles.conversationRow}
                onClick={() => {
                  if (result.kind === 'conversation') {
                    setSelectedConversationId(result.id);
                    setSearch('');
                    return;
                  }

                  handleStartConversation(result.id);
                }}
              >
                <span className={styles.rowAvatar} style={{ backgroundColor: result.accent }}>
                  {result.avatarLabel}
                </span>
                <span className={styles.rowCopy}>
                  <strong>{result.title}</strong>
                  <span>{result.subtitle}</span>
                </span>
                <span className={styles.rowMeta}>{result.meta}</span>
              </button>
            ))
          ) : (
            <div className={styles.emptySidebarState}>
              <h4>No results found</h4>
              <p>Try another name, username, or email to open a real chat.</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={`${styles.listScroller} ${styles.scrollbar}`}>
        {snapshot.conversations.length > 0 ? (
          snapshot.conversations.map((conversation) => {
            const isActive = conversation.id === activeConversation?.id;

            return (
              <button
                key={conversation.id}
                type="button"
                className={`${styles.conversationRow} ${isActive ? styles.conversationRowActive : ''}`}
                onClick={() => setSelectedConversationId(conversation.id)}
              >
                <span
                  className={`${styles.rowAvatar} ${
                    conversation.presence === 'online' && conversation.type === 'direct'
                      ? styles.rowAvatarOnline
                      : ''
                  }`}
                  style={{ backgroundColor: conversation.accent }}
                >
                  {conversation.avatarLabel}
                </span>
                <span className={styles.rowCopy}>
                  <span className={styles.rowTitleLine}>
                    <strong>{conversation.title}</strong>
                    <small>{conversation.lastActivityLabel}</small>
                  </span>
                  <span>{conversation.typingLabel || conversation.lastMessagePreview}</span>
                </span>
              </button>
            );
          })
        ) : (
          <div className={styles.emptySidebarState}>
            <h4>No chats yet</h4>
            <p>Start a conversation from search or open the new chat panel to message a team member.</p>
            <button
              type="button"
              className={styles.sidebarPrimaryButton}
              onClick={() => setMemberModalOpen(true)}
            >
              Open new chat
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <header className={styles.sidebarHeader}>
            <div className={styles.viewerAvatar}>{snapshot.viewer.avatarLabel}</div>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setMemberModalOpen(true)}
                title="Community"
              >
                <CommunityIcon className={styles.icon} />
              </button>
              <button type="button" className={styles.iconButton} title="Status">
                <StatusIcon className={styles.icon} />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setMemberModalOpen(true)}
                title="New chat"
              >
                <ChatBubbleIcon className={styles.icon} />
              </button>
              <div className={styles.menuWrap}>
                <button
                  type="button"
                  className={`${styles.iconButton} ${menuOpen ? styles.iconButtonActive : ''}`}
                  onClick={() => setMenuOpen((current) => !current)}
                  title="Menu"
                >
                  <DotsIcon className={styles.icon} />
                </button>
                {menuOpen ? (
                  <div className={styles.menuPanel}>
                    <button
                      type="button"
                      onClick={() => {
                        setMemberModalOpen(true);
                        setMenuOpen(false);
                      }}
                    >
                      New chat
                    </button>
                    {canManageMembers ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMemberModalOpen(true);
                          setMenuOpen(false);
                        }}
                      >
                        Add member
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        void refreshMembers();
                        setMenuOpen(false);
                      }}
                    >
                      Refresh members
                    </button>
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: getSignOutCallbackUrl() })}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {notificationsOpen ? (
            <div className={styles.notifications}>
              <div className={styles.notificationsIcon}>
                <BellIcon className={styles.notificationBell} />
              </div>
              <div className={styles.notificationsCopy}>
                <strong>Get notified of new messages</strong>
                <span>Turn on desktop notifications</span>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setNotificationsOpen(false)}
              >
                <CloseIcon className={styles.smallIcon} />
              </button>
            </div>
          ) : null}

          <div className={styles.searchBarWrap}>
            <div className={styles.searchBar}>
              {normalizedQuery ? (
                <button
                  type="button"
                  className={styles.searchBackButton}
                  onClick={() => setSearch('')}
                >
                  <BackIcon className={styles.smallIcon} />
                </button>
              ) : (
                <span className={styles.searchLead}>
                  <SearchIcon className={styles.smallIcon} />
                </span>
              )}
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={styles.searchInput}
                placeholder="Search or start a new chat"
              />
            </div>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setMemberModalOpen(true)}
              title="Filter"
            >
              <FilterIcon className={styles.icon} />
            </button>
          </div>

          {renderConversationList()}
        </aside>

        <section className={styles.chatShell}>
          {activeConversation ? (
            <>
              <header className={styles.chatHeader}>
                <div className={styles.chatIdentity}>
                  <span
                    className={`${styles.chatAvatar} ${
                      activeConversation.presence === 'online' && activeConversation.type === 'direct'
                        ? styles.chatAvatarOnline
                        : ''
                    }`}
                    style={{ backgroundColor: activeConversation.accent }}
                  >
                    {activeConversation.avatarLabel}
                  </span>
                  <div className={styles.chatIdentityCopy}>
                    <h2>{activeConversation.title}</h2>
                    <span>
                      {activeConversation.typingLabel ||
                        (activeConversation.type === 'group'
                          ? `${activeConversation.memberCount} participants`
                          : activeConversation.subtitle)}
                    </span>
                  </div>
                </div>

                <div className={styles.chatActions}>
                  <button type="button" className={styles.iconButton} title="Video call">
                    <VideoIcon className={styles.icon} />
                  </button>
                  <button type="button" className={styles.iconButton} title="Call">
                    <PhoneIcon className={styles.icon} />
                  </button>
                  <button type="button" className={styles.iconButton} title="Search">
                    <SearchIcon className={styles.icon} />
                  </button>
                  <button type="button" className={styles.iconButton} title="More">
                    <DotsIcon className={styles.icon} />
                  </button>
                </div>
              </header>

              <div className={styles.messagesSurface}>
                <div className={`${styles.messagesScroller} ${styles.scrollbar}`}>
                  {visibleMessages.map((message) => (
                    <article
                      key={message.id}
                      className={`${styles.messageRow} ${
                        message.direction === 'outgoing' ? styles.messageRowOutgoing : ''
                      }`}
                    >
                      <div
                        className={`${styles.messageBubble} ${
                          message.direction === 'outgoing'
                            ? styles.messageBubbleOutgoing
                            : styles.messageBubbleIncoming
                        }`}
                      >
                        {message.direction === 'incoming' && activeConversation.type === 'group' ? (
                          <p className={styles.messageSender}>{message.senderName}</p>
                        ) : null}
                        <p className={styles.messageText}>{message.body}</p>
                        <span className={styles.messageTime}>{message.createdAtLabel}</span>
                      </div>
                    </article>
                  ))}
                  {activeConversation.typingLabel ? (
                    <div className={styles.typingMarker}>{activeConversation.typingLabel}</div>
                  ) : null}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <form className={styles.composerBar} onSubmit={handleSubmit}>
                <div className={styles.composerTools}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => {
                      setEmojiOpen((current) => !current);
                      setAttachmentsOpen(false);
                    }}
                  >
                    <SmileyIcon className={styles.icon} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => {
                      setAttachmentsOpen((current) => !current);
                      setEmojiOpen(false);
                    }}
                  >
                    <ClipIcon className={styles.icon} />
                  </button>
                </div>

                <div className={styles.composerInputWrap}>
                  {emojiOpen ? (
                    <div className={styles.emojiPicker}>
                      {quickEmoji.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className={styles.emojiButton}
                          onClick={() => setDraft((current) => `${current}${emoji}`)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {attachmentsOpen ? (
                    <div className={styles.attachmentsMenu}>
                      <div>
                        <strong>Attachments</strong>
                        <span>Media and file uploads will plug into this same tray.</span>
                      </div>
                      <button type="button" className={styles.attachmentShortcut}>
                        <PlusIcon className={styles.smallIcon} />
                        <span>Photo or video</span>
                      </button>
                      <button type="button" className={styles.attachmentShortcut}>
                        <PlusIcon className={styles.smallIcon} />
                        <span>Document</span>
                      </button>
                    </div>
                  ) : null}

                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className={styles.composerInput}
                    placeholder="Type a message"
                    rows={1}
                  />
                </div>

                <button
                  type="submit"
                  className={styles.sendButton}
                  disabled={isPending || !draft.trim()}
                >
                  <SendIcon className={styles.sendIcon} />
                </button>
              </form>

              {error ? <p className={styles.error}>{error}</p> : null}
            </>
          ) : (
            <div className={styles.welcomeScreen}>
              <div className={styles.welcomeMark}>W</div>
              <h2>WhatsApp Web</h2>
              <p>
                Send and receive messages without keeping your phone online.
                <br />
                Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
              </p>
              <div className={styles.welcomeFooter}>
                <LockIcon className={styles.smallIcon} />
                <span>End-to-end encrypted personal messages</span>
              </div>
            </div>
          )}
        </section>
      </div>

      {memberModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => setMemberModalOpen(false)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalEyebrow}>New chat</p>
                <h3>Members and approvals</h3>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setMemberModalOpen(false)}
              >
                <CloseIcon className={styles.icon} />
              </button>
            </div>

            <div className={styles.modalSection}>
              <h4>Active members</h4>
              <div className={`${styles.modalList} ${styles.scrollbar}`}>
                {otherMembers.length > 0 ? (
                  otherMembers.map((member) => (
                    <div key={member.id} className={styles.memberRow}>
                      <div className={styles.memberIdentity}>
                        <span
                          className={styles.memberAvatar}
                          style={{ backgroundColor: getMemberAccent(member.id) }}
                        >
                          {member.avatarLabel}
                        </span>
                        <div>
                          <strong>{member.displayName}</strong>
                          <span>{member.email || `@${member.username}`}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={styles.memberAction}
                        onClick={() => handleStartConversation(member.id)}
                        disabled={isMemberPending}
                      >
                        Chat
                      </button>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyModalState}>
                    <p>No active teammates yet. Create one below to start your first chat.</p>
                  </div>
                )}
              </div>
            </div>

            {canManageMembers ? (
              <div className={styles.modalSection}>
                <h4>Add member</h4>
                <form className={styles.memberForm} onSubmit={handleCreateMember}>
                  <input
                    name="display_name"
                    className={styles.memberInput}
                    placeholder="Full name"
                    value={newMember.display_name}
                    onChange={handleMemberFieldChange}
                    required
                  />
                  <input
                    name="username"
                    className={styles.memberInput}
                    placeholder="Username"
                    value={newMember.username}
                    onChange={handleMemberFieldChange}
                    required
                  />
                  <input
                    name="email"
                    className={styles.memberInput}
                    placeholder="Email"
                    type="email"
                    value={newMember.email}
                    onChange={handleMemberFieldChange}
                  />
                  <input
                    name="password"
                    className={styles.memberInput}
                    placeholder="Temporary password"
                    type="password"
                    value={newMember.password}
                    onChange={handleMemberFieldChange}
                    minLength={6}
                    required
                  />
                  <select
                    name="role"
                    className={styles.memberInput}
                    value={newMember.role}
                    onChange={handleMemberFieldChange}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="submit"
                    className={styles.modalPrimaryButton}
                    disabled={isMemberPending}
                  >
                    {isMemberPending ? 'Saving...' : 'Add member'}
                  </button>
                </form>
              </div>
            ) : null}

            <div className={styles.modalSection}>
              <h4>Pending approvals</h4>
              <div className={styles.modalList}>
                {snapshot.pendingMembers.length > 0 ? (
                  snapshot.pendingMembers.map((member) => (
                    <div key={member.id} className={styles.pendingRow}>
                      <div>
                        <strong>{member.displayName}</strong>
                        <span>{member.createdAtLabel}</span>
                      </div>
                      {canManageMembers ? (
                        <div className={styles.pendingActions}>
                          <button
                            type="button"
                            className={styles.approveButton}
                            onClick={() => handleApproval(member.id, 'approve')}
                            disabled={isMemberPending}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className={styles.rejectButton}
                            onClick={() => handleApproval(member.id, 'reject')}
                            disabled={isMemberPending}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className={styles.pendingHint}>Waiting for admin</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyModalState}>
                    <p>No pending requests right now.</p>
                  </div>
                )}
              </div>
            </div>

            {renderMemberFeedback()}
          </div>
        </div>
      ) : null}
    </>
  );
}
