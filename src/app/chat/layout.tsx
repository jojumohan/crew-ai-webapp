'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useSocket } from '@/hooks/useSocket';
import Sidebar from '@/components/chat/Sidebar';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  useSocket();
  useEffect(() => { if (!token) router.replace('/login'); }, [token, router]);
  if (!token) return null;
  return <div className="flex h-screen overflow-hidden"><Sidebar /><main className="flex-1 flex flex-col min-w-0">{children}</main></div>;
}
