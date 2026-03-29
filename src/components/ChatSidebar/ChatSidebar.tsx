'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase-client';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import styles from './ChatSidebar.module.css';

interface ChatSidebarProps {
  onSelect: (user: any) => void;
  activeId?: string;
  onLoaded?: (users: any[]) => void;
}

export default function ChatSidebar({ onSelect, activeId, onLoaded }: ChatSidebarProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const q = query(collection(db, 'users'), orderBy('role', 'asc'));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(list);
        setLoading(false);
        onLoaded?.(list);
      } catch (err) {
        console.error("Failed to fetch users:", err);
        setLoading(false);
      }
    }
    fetchUsers();
  }, [onLoaded]);

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.spinner}></div>
      <span>Connecting to Team...</span>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerAvatar}>A</div>
        <div className={styles.headerTitle}>Chats</div>
      </div>
      
      <div className={styles.searchBar}>
        <div className={styles.searchInput}>
          <span className={styles.searchIcon}>🔍</span>
          <input type="text" placeholder="Search team or AI agents" />
        </div>
      </div>

      <div className={styles.list}>
        {users.map((u) => (
          <div 
            key={u.id} 
            className={`${styles.item} ${activeId === u.id ? styles.active : ''}`}
            onClick={() => onSelect(u)}
          >
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>
                {u.display_name[0]}
                {u.role === 'agent' && <span className={styles.agentBadge}>🤖</span>}
              </div>
              <div className={`${styles.status} ${u.role === 'agent' ? styles.online : ''}`}></div>
            </div>
            <div className={styles.memberInfo}>
              <div className={styles.memberHeader}>
                <span className={styles.memberName}>{u.display_name}</span>
                <span className={styles.time}>now</span>
              </div>
              <div className={styles.lastMsg}>
                {u.role === 'agent' ? 'Ready to assist...' : 'Online'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
