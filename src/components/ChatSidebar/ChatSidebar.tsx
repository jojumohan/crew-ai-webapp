'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase-client';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { ChatTarget } from '@/lib/types/chat';
import styles from './ChatSidebar.module.css';

interface ChatSidebarProps {
  onSelect: (target: ChatTarget) => void;
  activeId?: string;
  onLoaded?: (targets: ChatTarget[]) => void;
}

export default function ChatSidebar({ onSelect, activeId, onLoaded }: ChatSidebarProps) {
  const [targets, setTargets] = useState<ChatTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'mentions' | 'channels'>('all');
  
  // Custom folder state (Mocked until Phase 3 backend connection)
  const [folders, setFolders] = useState([
    { id: 'f1', name: 'Project X', items: [] as string[] }
  ]);

  useEffect(() => {
    async function fetchData() {
      try {
        const usersQ = query(collection(db, 'users'), orderBy('role', 'asc'));
        const usersSnap = await getDocs(usersQ);
        const usersList: ChatTarget[] = usersSnap.docs.map(doc => ({ 
          id: doc.id, ...doc.data(), isChannel: false 
        } as ChatTarget));
        
        let channelsList: ChatTarget[] = [];
        try {
           const chanQ = query(collection(db, 'channels'));
           const chanSnap = await getDocs(chanQ);
           channelsList = chanSnap.docs.map(doc => ({ 
             id: doc.id, ...doc.data(), isChannel: true 
           } as ChatTarget));
        } catch (e) {
           console.log("Channels collection not ready yet");
        }

        const combined = [...channelsList, ...usersList];
        setTargets(combined);
        setLoading(false);
        onLoaded?.(combined);
      } catch (err) {
        console.error("Failed to fetch sidebar targets:", err);
        setLoading(false);
      }
    }
    fetchData();
  }, [onLoaded]);

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent, targetId: string) => {
    e.dataTransfer.setData('targetId', targetId);
  };
  
  const handleDropToFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('targetId');
    if (!draggedId) return;
    
    setFolders(prev => prev.map(f => {
      if (f.id === folderId && !f.items.includes(draggedId)) {
        return { ...f, items: [...f.items, draggedId] };
      }
      return f;
    }));
  };

  const filteredTargets = targets.filter(t => {
    if (filter === 'channels') return t.isChannel;
    // Mocking logic for unreads/mentions for layout purposes
    if (filter === 'unread') return t.id.length % 2 === 0; // Fake filter
    if (filter === 'mentions') return t.id.length % 3 === 0; // Fake filter
    return true;
  });

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.spinner}></div>
      <span>Loading Workspace...</span>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerAvatar}>A</div>
        <div className={styles.headerTitle}>Unified Hub</div>
      </div>
      
      {/* Filters */}
      <div className={styles.filters}>
        <button className={filter === 'all' ? styles.activeFilter : ''} onClick={() => setFilter('all')}>All</button>
        <button className={filter === 'unread' ? styles.activeFilter : ''} onClick={() => setFilter('unread')}>Unread</button>
        <button className={filter === 'mentions' ? styles.activeFilter : ''} onClick={() => setFilter('mentions')}>@Mentions</button>
        <button className={filter === 'channels' ? styles.activeFilter : ''} onClick={() => setFilter('channels')}>Channels</button>
      </div>

      <div className={styles.searchBar}>
        <div className={styles.searchInput}>
          <span className={styles.searchIcon}>🔍</span>
          <input type="text" placeholder="Search team or channels" />
        </div>
      </div>

      <div className={styles.list}>
        {/* Render Folders */}
        {folders.map(f => (
          <div 
            key={f.id} 
            className={styles.folder}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDropToFolder(e, f.id)}
          >
            <div className={styles.folderHeader}>📁 {f.name}</div>
            <div className={styles.folderContent}>
              {f.items.map(itemId => {
                const u = targets.find(t => t.id === itemId);
                if (!u) return null;
                return (
                  <div 
                     key={u.id} 
                     className={`${styles.smallItem} ${activeId === u.id ? styles.active : ''}`}
                     onClick={() => onSelect(u)}
                  >
                    <span className={styles.folderItemName}>
                      {u.isChannel ? '#' : '@'} {u.isChannel ? u.name : u.display_name}
                    </span>
                  </div>
                );
              })}
              {f.items.length === 0 && <span className={styles.emptyFolder}>Drop chats here</span>}
            </div>
          </div>
        ))}

        <div className={styles.sectionTitle}>Conversations</div>
        {filteredTargets.map((u) => {
           // Skip if it's currently inside a folder
           if (folders.some(f => f.items.includes(u.id))) return null;
           
           return (
            <div 
              key={u.id} 
              className={`${styles.item} ${activeId === u.id ? styles.active : ''}`}
              onClick={() => onSelect(u)}
              draggable
              onDragStart={(e) => handleDragStart(e, u.id)}
            >
              <div className={styles.avatarWrapper}>
                <div className={`${styles.avatar} ${u.isChannel ? styles.channelAvatar : ''}`}>
                  {u.isChannel ? '#' : u.display_name?.[0] || '?'}
                  {!u.isChannel && u.role === 'agent' && <span className={styles.agentBadge}>🤖</span>}
                </div>
                {!u.isChannel && <div className={`${styles.status} ${u.role === 'agent' ? styles.online : ''}`}></div>}
              </div>
              <div className={styles.memberInfo}>
                <div className={styles.memberHeader}>
                  <span className={styles.memberName}>{u.isChannel ? u.name : u.display_name}</span>
                  <span className={styles.time}>{u.isChannel ? 'channel' : 'now'}</span>
                </div>
                <div className={styles.lastMsg}>
                  {u.isChannel ? 'View channel...' : (u.role === 'agent' ? 'Ready to assist...' : 'Online')}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
