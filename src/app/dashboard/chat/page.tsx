'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatSidebar from '@/components/ChatSidebar/ChatSidebar';
import ChatWindow from '@/components/ChatWindow/ChatWindow';
import styles from './chat.module.css';

export default function ChatPage() {
  const [activeUser, setActiveUser] = useState<any>(null);
  const searchParams = useSearchParams();
  const targetId = searchParams.get('u');

  // Handle auto-selection if 'u' is in URL
  const handleUsersLoaded = (users: any[]) => {
    if (targetId) {
      const found = users.find(u => u.id === targetId);
      if (found) setActiveUser(found);
    }
  };

  return (
    <div className={styles.container}>
       <ChatSidebar 
         onSelect={setActiveUser} 
         activeId={activeUser?.id} 
         onLoaded={handleUsersLoaded}
       />
       <ChatWindow target={activeUser} />
    </div>
  );
}

