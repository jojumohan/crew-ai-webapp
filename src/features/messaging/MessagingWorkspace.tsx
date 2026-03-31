'use client';

import { useDeferredValue, useEffect, useState, useTransition } from 'react';
import { signOut } from 'next-auth/react';
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

type WorkspaceSection = 'chats' | 'members' | 'calls' | 'media';

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatCreatedAtLabel(iso?: string): string {
  if (!iso) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

function deriveAvatarLabel(title: string): string {
  const words = title
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return 'TM';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function mapTeamMembers(users: TeamApiMember[]) {
  const members = users.map((user) => {
    const displayName = user.display_name?.trim() || user.username?.trim() || 'Team member';
    const status = user.status === 'pending' ? 'pending' : 'active';

    return {
      id: user.id,
      username: user.username || 'member',
      displayName,
      email: user.email || null,
      role: user.role || 'staff',
      status,
      avatarLabel: deriveAvatarLabel(displayName),
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
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('chats');
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedConversationId, setSelectedConversationId] = useState(
    initialSnapshot.conversations[0]?.id || ''
  );
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [memberNotice, setMemberNotice] = useState('');
  const [memberError, setMemberError] = useState('');
  const [newMember, setNewMember] = useState({
    display_name: '',
    username: '',
    email: '',
    password: '',
    role: 'staff',
  });
  const [isPending, startTransition] = useTransition();
  const [isMemberPending, startMemberTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);
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

  const normalizedQuery = deferredSearch.trim().toLowerCase();
  const filteredConversations = normalizedQuery
    ? snapshot.conversations.filter((conversation) => {
        const haystack =
          `${conversation.title} ${conversation.subtitle} ${conversation.lastMessagePreview}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : snapshot.conversations;

  const activeConversation =
    snapshot.conversations.find((conversation) => conversation.id === selectedConversationId) ||
    snapshot.conversations[0];

  const visibleMessages = activeConversation
    ? snapshot.messagesByConversation[activeConversation.id] || []
    : [];
  const otherMembers = snapshot.members.filter((member) => member.id !== snapshot.viewer.id);
  const isChatsSection = activeSection === 'chats';

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

    setNewMember((current) => ({
      ...current,
      [name]: value,
    }));
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
            body: JSON.stringify({
              memberId,
            }),
          });

          const payload = (await response.json()) as ConversationCreateResponse & { error?: string };

          if (!response.ok) {
            throw new Error(payload.error || 'conversation_create_failed');
          }

          setSnapshot(payload.snapshot);
          setSelectedConversationId(payload.conversationId);
          setActiveSection('chats');
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

  function renderMembersDirectoryCard() {
    return (
      <div className={styles.detailCard}>
        <div className={styles.detailHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Members</p>
            <h3>{snapshot.members.length} active accounts</h3>
          </div>
          {snapshot.pendingMembers.length > 0 ? (
            <span className={styles.pendingBadge}>{snapshot.pendingMembers.length} pending</span>
          ) : null}
        </div>

        <div className={styles.memberList}>
          {otherMembers.length > 0 ? (
            otherMembers.map((member) => (
              <div key={member.id} className={styles.memberCard}>
                <div className={styles.memberMeta}>
                  <span className={styles.memberAvatar}>{member.avatarLabel}</span>
                  <div>
                    <strong>{member.displayName}</strong>
                    <p>
                      @{member.username} | {member.role}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.memberAction}
                  onClick={() => handleStartConversation(member.id)}
                  disabled={isMemberPending}
                >
                  Start chat
                </button>
              </div>
            ))
          ) : (
            <div className={styles.infoBox}>
              <strong>No other approved members yet</strong>
              <p>
                {canManageMembers
                  ? 'Create one below or approve a pending request to open the first real chat.'
                  : 'Ask an admin to create or approve another account before testing chat.'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderMemberManagementCard() {
    if (canManageMembers) {
      return (
        <div className={styles.detailCard}>
          <p className={styles.sectionEyebrow}>Add member</p>
          <h3>Create a real account</h3>
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
              required
              minLength={6}
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
            <button type="submit" className={styles.memberPrimaryAction} disabled={isMemberPending}>
              {isMemberPending ? 'Saving...' : 'Add member'}
            </button>
          </form>

          {snapshot.pendingMembers.length > 0 ? (
            <div className={styles.pendingList}>
              {snapshot.pendingMembers.map((member) => (
                <div key={member.id} className={styles.pendingCard}>
                  <div>
                    <strong>{member.displayName}</strong>
                    <p>
                      @{member.username} | requested {member.createdAtLabel}
                    </p>
                  </div>
                  <div className={styles.pendingActions}>
                    <button
                      type="button"
                      className={styles.memberApprove}
                      onClick={() => handleApproval(member.id, 'approve')}
                      disabled={isMemberPending}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className={styles.memberReject}
                      onClick={() => handleApproval(member.id, 'reject')}
                      disabled={isMemberPending}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.infoBox}>
              <strong>No pending requests</strong>
              <p>Anyone who signs up at `/register` will appear here for approval.</p>
            </div>
          )}

          {renderMemberFeedback()}
        </div>
      );
    }

    return (
      <div className={styles.detailCard}>
        <p className={styles.sectionEyebrow}>New members</p>
        <h3>How to add people</h3>
        <ul className={styles.detailList}>
          <li>Admins can create members directly from this dashboard.</li>
          <li>Anyone else can request access at `/register`.</li>
          <li>Pending requests need admin approval before login works.</li>
        </ul>
        {renderMemberFeedback()}
      </div>
    );
  }

  function renderSectionScreen() {
    if (activeSection === 'members') {
      return (
        <div className={styles.panelScreen}>
          <div className={styles.panelHero}>
            <p className={styles.sectionEyebrow}>Members</p>
            <h2>Manage and start chats with your team</h2>
            <p>
              Active members, pending requests, and account creation all live here now, even on
              laptop-sized screens.
            </p>
          </div>
          <div className={styles.panelGrid}>
            {renderMembersDirectoryCard()}
            {renderMemberManagementCard()}
          </div>
        </div>
      );
    }

    if (activeSection === 'calls') {
      return (
        <div className={styles.placeholderScreen}>
          <h2>Calls are coming next</h2>
          <p>Voice and video will land after the core chat and member management flow is stable.</p>
        </div>
      );
    }

    return (
      <div className={styles.placeholderScreen}>
        <h2>Media uploads stay in the chat flow</h2>
        <p>Once uploads are wired, this area will show shared files, previews, and delivery status.</p>
      </div>
    );
  }

  return (
    <div className={styles.workspace}>
      <aside className={styles.rail}>
        <div className={styles.brandBlock}>
          <span className={styles.brandMark}>{snapshot.viewer.avatarLabel}</span>
          <div>
            <p className={styles.brandEyebrow}>Messaging rebuild</p>
            <h1 className={styles.brandTitle}>Real members only</h1>
          </div>
        </div>

        <nav className={styles.railNav}>
          <button
            type="button"
            className={activeSection === 'chats' ? styles.railActionActive : styles.railAction}
            onClick={() => setActiveSection('chats')}
          >
            <span>Chats</span>
            <small>Live</small>
          </button>
          <button
            type="button"
            className={activeSection === 'members' ? styles.railActionActive : styles.railAction}
            onClick={() => setActiveSection('members')}
          >
            <span>Members</span>
            <small>{snapshot.members.length}</small>
          </button>
          <button
            type="button"
            className={activeSection === 'calls' ? styles.railActionActive : styles.railAction}
            onClick={() => setActiveSection('calls')}
          >
            <span>Calls</span>
            <small>Soon</small>
          </button>
          <button
            type="button"
            className={activeSection === 'media' ? styles.railActionActive : styles.railAction}
            onClick={() => setActiveSection('media')}
          >
            <span>Media</span>
            <small>Phase 1</small>
          </button>
        </nav>

        <button
          type="button"
          className={styles.signOut}
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          Sign out
        </button>
      </aside>

      {isChatsSection ? (
        <section className={styles.listColumn}>
        <div className={styles.viewerCard}>
          <div className={styles.viewerAvatar}>{snapshot.viewer.avatarLabel}</div>
          <div>
            <h2>{snapshot.viewer.displayName}</h2>
            <p>
              {snapshot.viewer.handle} | {snapshot.viewer.role}
            </p>
          </div>
        </div>

        <div className={styles.searchCard}>
          <label htmlFor="chat-search" className={styles.searchLabel}>
            Search conversations
          </label>
          <input
            id="chat-search"
            className={styles.searchInput}
            placeholder="Search by name, member, or message"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Inbox</p>
            <h3>{snapshot.conversations.length} real threads</h3>
          </div>
          <span className={styles.statusPill}>Firestore live</span>
        </div>

        <div className={styles.conversationList}>
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conversation) => {
              const isActive = conversation.id === activeConversation?.id;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={isActive ? styles.conversationActive : styles.conversation}
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  <span
                    className={styles.conversationAvatar}
                    style={{ backgroundColor: conversation.accent }}
                  >
                    {conversation.avatarLabel}
                  </span>
                  <div className={styles.conversationMeta}>
                    <div className={styles.conversationRow}>
                      <strong>{conversation.title}</strong>
                      <span>{conversation.lastActivityLabel}</span>
                    </div>
                    <p>{conversation.typingLabel || conversation.lastMessagePreview}</p>
                    <div className={styles.conversationFooter}>
                      <span>{conversation.subtitle}</span>
                      {conversation.unreadCount > 0 ? (
                        <span className={styles.unreadBadge}>{conversation.unreadCount}</span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className={styles.emptyListCard}>
              <h4>No real chats yet</h4>
              <p>Add or approve a real member, then open the Members tab to start a direct conversation.</p>
            </div>
          )}
        </div>
        </section>
      ) : null}

      <section className={`${styles.chatColumn} ${!isChatsSection ? styles.chatColumnWide : ''}`}>
        {isChatsSection ? (
          activeConversation ? (
          <>
            <header className={styles.chatHeader}>
              <div className={styles.chatIdentity}>
                <span
                  className={styles.chatAvatar}
                  style={{ backgroundColor: activeConversation.accent }}
                >
                  {activeConversation.avatarLabel}
                </span>
                <div>
                  <h2>{activeConversation.title}</h2>
                  <p>{activeConversation.typingLabel || activeConversation.subtitle}</p>
                </div>
              </div>

              <div className={styles.chatActions}>
                <span className={styles.actionChip}>Uploads</span>
                <span className={styles.actionChip}>Presence</span>
                <span className={styles.actionChipMuted}>Calls next</span>
              </div>
            </header>

            <div className={styles.messageStream}>
              {visibleMessages.length > 0 ? (
                visibleMessages.map((message) => (
                  <article
                    key={message.id}
                    className={message.direction === 'outgoing' ? styles.outgoing : styles.incoming}
                  >
                    <div className={styles.messageBubble}>
                      {message.direction === 'incoming' ? (
                        <p className={styles.messageSender}>{message.senderName}</p>
                      ) : null}
                      <p className={styles.messageBody}>{message.body}</p>
                      <div className={styles.messageMeta}>
                        <span>{message.createdAtLabel}</span>
                        <span>{message.delivery}</span>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className={styles.emptyThread}>
                  <h3>No messages yet</h3>
                  <p>This thread is ready. Send the first message when you are ready to test.</p>
                </div>
              )}
            </div>

            <form className={styles.composer} onSubmit={handleSubmit}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className={styles.composerInput}
                placeholder={`Message ${activeConversation.title}`}
                rows={1}
              />
              <button type="submit" className={styles.sendButton} disabled={isPending || !draft.trim()}>
                {isPending ? 'Sending...' : 'Send'}
              </button>
            </form>

            {error ? <p className={styles.error}>{error}</p> : null}
          </>
        ) : (
          <div className={styles.emptyState}>
            <h2>Only connected accounts can chat here</h2>
            <p>
              The demo accounts are gone. Add or approve a real member, then start a direct chat
              from the member panel.
            </p>
          </div>
        )
        ) : (
          renderSectionScreen()
        )}
      </section>

      {isChatsSection ? (
        <aside className={styles.detailColumn}>
        <div className={styles.detailCard}>
          <p className={styles.sectionEyebrow}>Build status</p>
          <h3>Real account workspace</h3>
          <p>
            The inbox now stays empty until a real approved member exists. Demo conversations and
            seed contacts are blocked from the UI and cleaned up from the messaging store.
          </p>
          <div className={styles.stackList}>
            <span>Next.js 16</span>
            <span>NextAuth</span>
            <span>Firebase</span>
            <span>Firestore</span>
            <span>Real members</span>
          </div>
        </div>

        {renderMembersDirectoryCard()}
        {renderMemberManagementCard()}
        </aside>
      ) : null}
    </div>
  );
}
