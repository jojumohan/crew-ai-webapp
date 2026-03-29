'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatSidebar from '@/components/ChatSidebar/ChatSidebar';
import ChatWindow from '@/components/ChatWindow/ChatWindow';
import styles from './chat.module.css';

// Client component that reads searchParams safely
function ChatContent() {
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
    <>
      <ChatSidebar 
        onSelect={setActiveUser} 
        activeId={activeUser?.id} 
        onLoaded={handleUsersLoaded}
      />
      <ChatWindow target={activeUser} />
    </>
  );
}

// Wrap in Suspense to prevent rendering issues related to useSearchParams
export default function ChatPage() {
  return (
    <div className={styles.container}>
      <Suspense fallback={<div className={styles.loading}>Loading chat interface...</div>}>
         <ChatContent />
      </Suspense>
    </div>
  );
}
