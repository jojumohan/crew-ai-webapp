'use client';

const quickEmoji = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, collection, query, where, deleteDoc, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
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
  TriangleIcon,
  SeenIcon,
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
      participantIds: string[];
    }
  | {
      kind: 'member';
      id: string;
      title: string;
      subtitle: string;
      meta: string;
      avatarLabel: string;
      accent: string;
      participantIds: string[];
    };



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
          lastActivityLabel: 'Just now',
          unreadCount: 0,
          presence: 'online',
          participantIds: conversation.participantIds,
        } satisfies ConversationSummary
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
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
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
  const [isCalling, setIsCalling] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({}); // conversationId -> userNames[]
  const [isSearchingInChat, setIsSearchingInChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [forwardingMessage, setForwardingMessage] = useState<MessagingMessage | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [audioChunksRef, setAudioChunksRef] = useState<Blob[]>([]); // Using state for simplicity in some places
  const [isGroupCreating, setIsGroupCreating] = useState(false);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
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

  // Real-time Messages listener
  useEffect(() => {
    if (!selectedConversationId) return;

    const messagesRef = collection(db, 'messaging_conversations', selectedConversationId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const messages: MessagingMessage[] = [];
      const unreadIds: string[] = [];
      
      querySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const createdAt = (data.createdAt?.toDate?.() || new Date(data.createdAt)).toISOString();
        
        const message: MessagingMessage = {
          id: doc.id,
          clientId: data.clientId || doc.id,
          conversationId: selectedConversationId,
          senderId: data.senderId,
          senderName: data.senderName,
          body: data.body,
          kind: data.kind || 'text',
          createdAt,
          createdAtLabel: formatClock(createdAt),
          delivery: data.delivery || 'sent',
          direction: data.senderId === snapshot.viewer.id ? 'outgoing' : 'incoming',
          mediaUrl: data.mediaUrl,
          fileName: data.fileName,
          fileSize: data.fileSize,
          reactions: data.reactions || {},
          isForwarded: data.isForwarded || false,
        };

        messages.push(message);

        // Track unread messages received by the current viewer
        if (message.direction === 'incoming' && message.delivery !== 'read') {
          unreadIds.push(doc.id);
        }
      });

      setSnapshot((current) => ({
        ...current,
        messagesByConversation: {
          ...current.messagesByConversation,
          [selectedConversationId]: messages,
        },
      }));

      // Automatically mark as read
      if (unreadIds.length > 0) {
        for (const messageId of unreadIds) {
          const messageDocRef = doc(db, 'messaging_conversations', selectedConversationId, 'messages', messageId);
          void updateDoc(messageDocRef, { delivery: 'read' }).catch(() => {});
        }
      }
    });

    return () => unsubscribe();
  }, [selectedConversationId, snapshot.viewer.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversationId, snapshot.messagesByConversation, typingUsers]);

  // Typing indicators listener
  useEffect(() => {
    const currentId = selectedConversationId;
    if (!currentId) return;

    const typingRef = collection(db, 'messaging_conversations', currentId, 'typing');
    
    const unsubscribe = onSnapshot(typingRef, (querySnapshot) => {
      const typingNow: string[] = [];
      
      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (doc.id !== snapshot.viewer.id) {
          typingNow.push(data.userName);
        }
      });
      
      setTypingUsers(prev => ({
        ...prev,
        [currentId]: typingNow
      }));
    });

    return () => unsubscribe();
  }, [selectedConversationId, snapshot.viewer.id]);

  const typingLabel = useMemo(() => {
    if (!selectedConversationId) return null;
    const typing = typingUsers[selectedConversationId] || [];
    if (typing.length === 0) return null;
    if (typing.length === 1) return `${typing[0]} is typing...`;
    if (typing.length === 2) return `${typing[0]} and ${typing[1]} are typing...`;
    return `${typing.length} people are typing...`;
  }, [typingUsers, selectedConversationId]);

  const activeConversation = selectedConversationId 
    ? (snapshot.conversations.find((conversation) => conversation.id === selectedConversationId) || null)
    : null;
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
            participantIds: conversation.participantIds,
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
            participantIds: [member.id, snapshot.viewer.id],
          }) satisfies SearchResult
      );

    return [...conversationResults, ...memberResults];
  }, [normalizedQuery, otherMembers, snapshot.conversations, snapshot.viewer.id]);

  // Real-time Conversations listener
  useEffect(() => {
    const convoQuery = query(
      collection(db, 'messaging_conversations'),
      where('participantIds', 'array-contains', snapshot.viewer.id)
    );

    const unsubscribe = onSnapshot(convoQuery, (querySnapshot) => {
      const convos: ConversationSummary[] = [];

      querySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const otherParticipantId = data.participantIds.find((id: string) => id !== snapshot.viewer.id) || '';
        
        // Find other member for title/avatar if it's direct
        const otherMember = snapshot.members.find(m => m.id === otherParticipantId);
        
        const title = data.type === 'direct' 
          ? otherMember?.displayName || data.title || 'Direct Chat'
          : data.title || 'Group Chat';

        const lastActivity = toIso(data.lastMessageAt || data.createdAt) || new Date().toISOString();

        convos.push({
          id: doc.id,
          type: data.type || 'direct',
          title,
          subtitle: data.type === 'direct' ? (otherMember?.email || 'Active') : `${data.memberCount} members`,
          avatarLabel: title.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || 'C',
          accent: getMemberAccent(doc.id),
          unreadCount: 0, // Simplified for now
          memberCount: data.memberCount || 2,
          lastMessagePreview: data.lastMessageText || 'No messages yet',
          lastActivityLabel: formatRelative(lastActivity),
          presence: 'online',
          participantIds: data.participantIds,
        });
      });

      // Sort by last activity
      convos.sort((a, b) => b.id.localeCompare(a.id)); // Simpler sort, real one would use timestamps

      setSnapshot((current) => ({
        ...current,
        conversations: convos,
      }));
    });

    return () => unsubscribe();
  }, [snapshot.viewer.id, snapshot.members]);

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

  // Helper inside component since we might need it
  function toIso(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'object' && value.toDate) return value.toDate().toISOString();
    return value;
  }

  function formatRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
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

  async function handleCreateGroup() {
    if (!groupName.trim() || selectedGroupMembers.length === 0) return;

    try {
      const response = await fetch('/api/v1/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'group',
          title: groupName,
          participantIds: [...selectedGroupMembers, snapshot.viewer.id],
        }),
      });

      if (!response.ok) throw new Error('group_creation_failed');
      
      const data = await response.json();
      setSelectedConversationId(data.conversationId);
      setIsGroupCreating(false);
      setSelectedGroupMembers([]);
      setGroupName('');
      setMenuOpen(false);
    } catch (err) {
      console.error('Group creation failed:', err);
    }
  }

  const toggleGroupMember = (id: string) => {
    setSelectedGroupMembers(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

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

  async function handleCall(type: 'voice' | 'video') {
    if (!activeConversation || isCalling) return;
    
    const otherParticipantId = activeConversation.type === 'direct' 
      ? activeConversation.id.replace('direct_', '').replace(Buffer.from(snapshot.viewer.id).toString('base64url'), '').replace('_', '')
      : null;
    
    setIsCalling(true);
    try {
      const otherId = activeConversation.type === 'direct' 
        ? activeConversation.participantIds.find(id => id !== snapshot.viewer.id)
        : null;

      const body = activeConversation.type === 'direct' 
        ? { targetUserId: otherId } 
        : { title: `📞 Group call: ${activeConversation.title}` };

      await fetch('/api/push/ring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error("Call failed:", err);
      setIsCalling(false);
    } finally {
      // Keep isCalling true until user cancels or call is established normally
    }
  }

  async function handleReaction(messageId: string, emoji: string) {
    if (!selectedConversationId) return;

    const messageDocRef = doc(db, 'messaging_conversations', selectedConversationId, 'messages', messageId);
    const existingReactions = (snapshot.messagesByConversation[selectedConversationId] || [])
      .find(m => m.id === messageId)?.reactions || {};
    
    const nextReactions = { ...existingReactions };
    
    // Toggle: if same user + same emoji, remove it
    if (nextReactions[snapshot.viewer.id] === emoji) {
      delete nextReactions[snapshot.viewer.id];
    } else {
      nextReactions[snapshot.viewer.id] = emoji;
    }

    try {
      await updateDoc(messageDocRef, { reactions: nextReactions });
    } catch (err) {
      console.error("Reaction failed:", err);
    }
  }

  async function handleForward(targetConversationId: string) {
    if (!forwardingMessage) return;

    try {
      const response = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: targetConversationId,
          body: forwardingMessage.body,
          kind: forwardingMessage.kind,
          mediaUrl: forwardingMessage.mediaUrl,
          fileName: forwardingMessage.fileName,
          fileSize: forwardingMessage.fileSize,
          isForwarded: true,
        }),
      });

      if (!response.ok) throw new Error('forward_failed');
      
      setForwardingMessage(null);
      setSelectedConversationId(targetConversationId);
    } catch (err) {
      console.error('Forward failed:', err);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      setAudioChunksRef([]);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) setAudioChunksRef(prev => [...prev, event.data]);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
        handleFileUpload(audioFile, 'audio');
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Recording failed:', err);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  }

  function cancelRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null; // Don't trigger send
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  }

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTypingStatus = useCallback(() => {
    if (!selectedConversationId) return;

    const typingDocRef = doc(db, 'messaging_conversations', selectedConversationId, 'typing', snapshot.viewer.id);
    
    void setDoc(typingDocRef, {
      userName: snapshot.viewer.displayName,
      timestamp: serverTimestamp()
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      void deleteDoc(typingDocRef).catch(() => {});
    }, 3000);
  }, [selectedConversationId, snapshot.viewer.id, snapshot.viewer.displayName]);

  async function handleFileUpload(file: File, kind: 'image' | 'file' | 'audio') {
    if (!activeConversation) return;
    
    setAttachmentsOpen(false);
    setUploadProgress(0);

    const createdAt = new Date().toISOString();
    const optimisticId = `temp_${Date.now()}`;
    const previewUrl = URL.createObjectURL(file);

    const optimisticMessage: MessagingMessage = {
      id: optimisticId,
      clientId: optimisticId,
      conversationId: activeConversation.id,
      senderId: snapshot.viewer.id,
      senderName: snapshot.viewer.displayName,
      body: kind === 'image' ? '' : file.name,
      kind,
      createdAt,
      createdAtLabel: formatClock(createdAt),
      delivery: 'sent',
      direction: 'outgoing',
      mediaUrl: previewUrl,
      fileName: file.name,
      fileSize: `${(file.size / 1024).toFixed(1)} KB`
    };

    setSnapshot((current) => insertMessage(current, optimisticMessage));

    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setUploadProgress(null);
        // Here we would normally call the real upload API
      }
      setUploadProgress(progress);
    }, 200);
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
                  <span className={typingUsers[conversation.id]?.length > 0 ? styles.typingText : ''}>
                    {(typingUsers[conversation.id]?.length > 0)
                      ? 'Typing...' 
                      : conversation.lastMessagePreview}
                  </span>
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
      {isGroupCreating && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>Create New Group</span>
                <h2>New Group</h2>
              </div>
              <button 
                 className={styles.headerAction} 
                 onClick={() => setIsGroupCreating(false)}
              >
                 <CloseIcon />
              </button>
            </div>

            <div className={styles.modalSection}>
              <input 
                type="text" 
                placeholder="Group Name" 
                className={styles.memberInput}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>

            <div className={styles.modalSection}>
              <h4>Select Members ({selectedGroupMembers.length})</h4>
              <div className={styles.modalList}>
                {snapshot.members.map(member => (
                  <button 
                     key={member.id} 
                     className={`${styles.memberRow} ${selectedGroupMembers.includes(member.id) ? styles.memberSelected : ''}`}
                     onClick={() => toggleGroupMember(member.id)}
                  >
                     <div className={styles.memberIdentity}>
                       <div className={styles.memberAvatar}>{member.avatarLabel}</div>
                       <div>
                         <strong>{member.displayName}</strong>
                         <span>{member.email}</span>
                       </div>
                     </div>
                     {selectedGroupMembers.includes(member.id) && (
                       <span className={styles.checkMark}>✅</span>
                     )}
                  </button>
                ))}
              </div>
            </div>

            <button 
               className={styles.modalPrimaryButton} 
               onClick={handleCreateGroup}
               disabled={!groupName.trim() || selectedGroupMembers.length === 0}
            >
               Create Group
            </button>
          </div>
        </div>
      )}

      {isCalling && (
        <div className={styles.callOverlay}>
           <div className={styles.callCard}>
              <div className={styles.callAvatar} style={{ backgroundColor: activeConversation?.accent }}>
                 {activeConversation?.avatarLabel}
              </div>
              <h2>{activeConversation?.title}</h2>
              <p>Calling...</p>
              <div className={styles.callActions}>
                 <button 
                   className={styles.declineButton} 
                   onClick={() => setIsCalling(false)}
                 >
                    <CloseIcon className={styles.icon} />
                 </button>
              </div>
           </div>
        </div>
      )}

      <div className={`${styles.workspace} ${selectedConversationId ? styles.activeChat : ''}`}>
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

              <div className={styles.sidebarActions}>
                <button 
                  className={styles.sidebarAction} 
                  onClick={() => setIsGroupCreating(true)}
                  title="New Group"
                >
                   👥
                </button>
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
                <button 
                  className={styles.mobileBack} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedConversationId(null);
                    setSearch('');
                    setIsSearchingInChat(false);
                    setChatSearchQuery('');
                  }}
                  title="Back to list"
                >
                  <BackIcon className={styles.icon} />
                </button>
                <div className={styles.chatIdentity} onClick={() => setIsInfoPanelOpen(!isInfoPanelOpen)} style={{ cursor: 'pointer' }}>
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
                      {typingLabel ||
                        (activeConversation.type === 'group'
                          ? `${activeConversation.memberCount} participants`
                          : activeConversation.subtitle)}
                    </span>
                  </div>
                </div>

                <div className={styles.chatHeaderActions}>
                  <button 
                    className={`${styles.headerAction} ${isSearchingInChat ? styles.active : ''}`}
                    onClick={() => {
                      setIsSearchingInChat(!isSearchingInChat);
                      if (!isSearchingInChat) setChatSearchQuery('');
                    }}
                    title="Search in chat"
                  >
                    <SearchIcon className={styles.icon} />
                  </button>
                  <button 
                    className={styles.headerAction} 
                    onClick={() => handleCall('video')}
                  >
                    <VideoIcon className={styles.icon} />
                  </button>
                  <button 
                    className={styles.headerAction} 
                    onClick={() => handleCall('voice')}
                    disabled={isCalling}
                  >
                    <PhoneIcon className={styles.icon} />
                  </button>
                  <button className={styles.headerAction}>
                    <DotsIcon className={styles.icon} />
                  </button>
                </div>
              </header>

              <div className={styles.messagesSurface}>
                <div className={`${styles.messagesScroller} ${styles.scrollbar}`}>
                  {visibleMessages.map((message) => (
                    <article
                      key={message.id}
                      className={`${styles.message} ${
                        message.direction === 'outgoing' ? styles.messageOutgoing : styles.messageIncoming
                      } ${chatSearchQuery && message.body?.toLowerCase().includes(chatSearchQuery.toLowerCase()) ? styles.messageMatched : ''}`}
                    >
                      <div
                        className={`${styles.messageBubble} ${
                          message.direction === 'outgoing'
                            ? styles.messageBubbleOutgoing
                            : styles.messageBubbleIncoming
                        }`}
                      >
                        {message.isForwarded && (
                          <div className={styles.forwardedLabel}>
                             ↪️ Forwarded
                          </div>
                        )}
                        {message.direction === 'incoming' && activeConversation.type === 'group' ? (
                          <p className={styles.messageSender}>{message.senderName}</p>
                        ) : null}
                        
                        {message.kind === 'image' && message.mediaUrl && (
                          <div className={styles.mediaFrame}>
                            <img src={message.mediaUrl} alt="" className={styles.mediaImage} />
                          </div>
                        )}

                        {message.kind === 'file' && (
                          <div className={styles.fileFrame}>
                            <div className={styles.fileInfo}>
                              <strong>{message.fileName}</strong>
                              <span>{message.fileSize}</span>
                            </div>
                          </div>
                        )}

                        {message.kind === 'audio' && (
                          <div className={styles.audioFrame}>
                             <div className={styles.audioIcon}>🎙️</div>
                             <div className={styles.audioControls}>
                                <audio src={message.mediaUrl} controls className={styles.audioPlayer} />
                             </div>
                          </div>
                        )}

                        {message.body ? <p className={styles.messageText}>{message.body}</p> : null}
                        
                        {Object.keys(message.reactions || {}).length > 0 && (
                          <div className={styles.reactionsWrap}>
                            {Object.entries(message.reactions!).map(([uid, emoji]) => (
                               <span 
                                 key={uid} 
                                 className={`${styles.reaction} ${uid === snapshot.viewer.id ? styles.myReaction : ''}`}
                                 title={uid === snapshot.viewer.id ? 'You' : ''}
                                 onClick={() => handleReaction(message.id, emoji)}
                               >
                                 {emoji}
                               </span>
                            ))}
                          </div>
                        )}

                        <div className={styles.reactionPickerTrigger}>
                          <button 
                             type="button" 
                             className={styles.forwardButton}
                             onClick={() => setForwardingMessage(message)}
                             title="Forward message"
                          >
                             ↪️
                          </button>
                          {quickEmoji.map(emoji => (
                            <button 
                              key={emoji} 
                              type="button" 
                              onClick={() => handleReaction(message.id, emoji)}
                            >
                      {emoji}
                            </button>
                          ))}
                        </div>

                        <div className={styles.messageMeta}>
                          <span className={styles.messageTime}>{message.createdAtLabel}</span>
                          {message.direction === 'outgoing' && (
                            <SeenIcon className={`${styles.deliveryIcon} ${message.delivery === 'read' ? styles.seen : ''}`} />
                          )}
                        </div>

                        {message.direction === 'outgoing' ? (
                          <TriangleIcon className={styles.triangleOutgoing} />
                        ) : (
                          <TriangleIcon className={styles.triangleIncoming} />
                        )}
                      </div>
                    </article>
                  ))}
                  {typingLabel ? (
                    <div className={styles.typingMarker}>{typingLabel}</div>
                  ) : null}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {isSearchingInChat && (
                <div className={styles.chatSearchRow}>
                   <div className={styles.chatSearchInputWrap}>
                      <SearchIcon className={styles.chatSearchIcon} />
                      <input 
                        type="text" 
                        placeholder="Search message" 
                        className={styles.chatSearchInput} 
                        value={chatSearchQuery}
                        onChange={(e) => setChatSearchQuery(e.target.value)}
                        autoFocus
                      />
                      <button 
                        className={styles.chatSearchClose}
                        onClick={() => {
                          setIsSearchingInChat(false);
                          setChatSearchQuery('');
                        }}
                      >
                         <CloseIcon className={styles.smallIcon} />
                      </button>
                   </div>
                </div>
              )}

              {forwardingMessage && (
                <div className={styles.modalOverlay}>
                  <div className={styles.modalCard}>
                    <div className={styles.modalHeader}>
                      <div>
                        <span className={styles.modalEyebrow}>Forward message to...</span>
                        <h2>Select Contact</h2>
                      </div>
                      <button 
                        className={styles.headerAction} 
                        onClick={() => setForwardingMessage(null)}
                      >
                        <CloseIcon />
                      </button>
                    </div>

                    <div className={styles.forwardingSearch}>
                      <input 
                         type="text" 
                         className={styles.memberInput} 
                         placeholder="Search people or groups" 
                         onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>

                    <div className={styles.modalList}>
                      {searchResults.map(result => (
                        <button 
                          key={result.id} 
                          className={styles.memberRow}
                          onClick={() => handleForward(result.kind === 'conversation' ? result.id : result.id /* result.id is memberId */)}
                        >
                          <div className={styles.memberIdentity}>
                            <div className={styles.memberAvatar}>
                              {result.avatarLabel}
                            </div>
                            <div>
                               <strong>{result.title}</strong>
                               <span>{result.subtitle}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <form className={styles.composerBar} onSubmit={handleSubmit}>
                {isRecording ? (
                  <div className={styles.recordingOverlay}>
                    <div className={styles.recordingIndicator}>
                       <span className={styles.recordingDot} />
                       <span className={styles.recordingFreq}>Recording... {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div className={styles.recordingActions}>
                       <button type="button" className={styles.cancelRecording} onClick={cancelRecording}>Cancel</button>
                       <button type="button" className={styles.stopRecording} onClick={stopRecording}>Stop & Send</button>
                    </div>
                  </div>
                ) : (
                  <>
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
                          <button 
                            type="button" 
                            className={styles.attachmentShortcut}
                            onClick={() => mediaInputRef.current?.click()}
                          >
                            <PlusIcon className={styles.smallIcon} />
                            <span>Photo or video</span>
                          </button>
                          <button 
                            type="button" 
                            className={styles.attachmentShortcut}
                            onClick={() => documentInputRef.current?.click()}
                          >
                            <PlusIcon className={styles.smallIcon} />
                            <span>Document</span>
                          </button>
                          
                          <input 
                            type="file" 
                            hidden 
                            ref={mediaInputRef} 
                            accept="image/*,video/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, 'image');
                            }}
                          />
                          <input 
                            type="file" 
                            hidden 
                            ref={documentInputRef} 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, 'file');
                            }}
                          />
                        </div>
                      ) : null}

                      <textarea
                        value={draft}
                        onChange={(event) => {
                          setDraft(event.target.value);
                          handleTypingStatus();
                        }}
                        className={styles.composerInput}
                        placeholder="Type a message"
                        rows={1}
                      />
                    </div>

                    {!draft.trim() ? (
                      <button
                        type="button"
                        className={styles.micButton}
                        onClick={startRecording}
                        title="Record Voice"
                      >
                        🎙️
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className={styles.sendButton}
                        disabled={isPending || !draft.trim()}
                      >
                        <SendIcon className={styles.sendIcon} />
                      </button>
                    )}
                  </>
                )}

                {uploadProgress !== null && (
                  <div className={styles.uploadOverlay}>
                    <div className={styles.progressTrack}>
                      <div 
                        className={styles.progressBar} 
                        style={{ width: `${uploadProgress}%` }} 
                      />
                    </div>
                    <span>Uploading... {Math.round(uploadProgress)}%</span>
                  </div>
                )}
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

        {isInfoPanelOpen && (
          <aside className={styles.infoPanel}>
             <header className={styles.infoPanelHeader}>
                <button className={styles.closePanel} onClick={() => setIsInfoPanelOpen(false)}>
                   <CloseIcon className={styles.icon} />
                </button>
                <h3>Contact Info</h3>
             </header>
             <div className={styles.infoPanelContent}>
                <div className={styles.infoHero}>
                   <div className={styles.infoAvatar} style={{ backgroundColor: activeConversation?.accent }}>
                      {activeConversation?.avatarLabel}
                   </div>
                   <h2>{activeConversation?.title}</h2>
                   <span>{activeConversation?.type === 'direct' ? activeConversation.subtitle : `${activeConversation?.memberCount} members`}</span>
                </div>

                <div className={styles.infoSection}>
                   <h4>About</h4>
                   <p>{activeConversation?.type === 'direct' ? 'Personal workspace member' : activeConversation?.subtitle || 'Group chat'}</p>
                </div>

                {activeConversation?.type === 'group' && (
                   <div className={styles.infoSection}>
                      <h4>Participants ({activeConversation.memberCount})</h4>
                      <div className={styles.infoList}>
                         {snapshot.members
                           .filter(m => activeConversation.participantIds.includes(m.id))
                           .map(member => (
                              <div key={member.id} className={styles.infoMemberRow}>
                                 <div className={styles.memberIdentity}>
                                    <div className={styles.memberAvatar} style={{ backgroundColor: getMemberAccent(member.id) }}>
                                       {member.avatarLabel}
                                    </div>
                                    <div>
                                       <strong>{member.displayName}</strong>
                                       <span>{member.role === 'admin' ? 'Group Admin' : 'Member'}</span>
                                    </div>
                                 </div>
                              </div>
                           ))
                         }
                      </div>
                   </div>
                )}
                
                <div className={styles.infoActions}>
                   <button className={styles.dangerAction}>Block Contact</button>
                   <button className={styles.dangerAction}>Report Contact</button>
                </div>
             </div>
          </aside>
        )}
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
