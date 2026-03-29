'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase-client';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import styles from './ChatSidebar.module.css';

interface ChatSidebarProps {
  onSelect: (user: any) => void;
  activeId?: string;
}

export default function ChatSidebar({ onSelect, activeId }: ChatSidebarProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      const q = query(collection(db, 'users'), orderBy('role', 'asc'));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }
    fetchUsers();
  }, []);

  if (loading) return <div className={styles.loading}>Loading chat list...</div>;

  return (
    <div className={styles.sidebar}>
      <h2 className={styles.title}>All Team Members</h2>
      <div className={styles.userList}>
        {users.map((u) => (
          <div 
            key={u.id} 
            className={`${styles.userRow} ${activeId === u.id ? styles.active : ''}`}
            onClick={() => onSelect(u)}
          >
            <div className={styles.avatar}>{u.display_name[0]}</div>
            <div className={styles.info}>
              <span className={styles.name}>{u.display_name}</span>
              <span className={styles.role}>{u.role === 'agent' ? '🤖 AI Bot' : '👤 Human'}</span>
            </div>
            {u.id.startsWith('agent_') && <div className={styles.botBadge} />}
          </div>
        ))}
      </div>
    </div>
  );
}
