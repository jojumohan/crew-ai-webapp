'use client';

import { useState } from 'react';
import ChatSidebar from '@/components/ChatSidebar/ChatSidebar';
import ChatWindow from '@/components/ChatWindow/ChatWindow';
import styles from './chat.module.css';

export default function ChatPage() {
  const [activeUser, setActiveUser] = useState<any>(null);

  return (
    <div className={styles.container}>
       <ChatSidebar onSelect={setActiveUser} activeId={activeUser?.id} />
       <ChatWindow target={activeUser} />
    </div>
  );
}
