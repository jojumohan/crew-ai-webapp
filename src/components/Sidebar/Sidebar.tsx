'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import styles from './Sidebar.module.css';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: '◈' },
  { href: '/dashboard/tasks', label: 'Tasks', icon: '✦' },
  { href: '/dashboard/agents', label: 'AI Agents', icon: '◉' },
  { href: '/dashboard/chat', label: 'Chat', icon: '◎' },
  { href: '/dashboard/calendar', label: 'Calendar', icon: '◇' },
  { href: '/dashboard/files', label: 'Files', icon: '▣' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar + ' glass'}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>⚡</span>
        <span className={styles.logoText}>Crew AI</span>
      </div>

      <nav className={styles.nav}>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.navItem} ${active ? styles.active : ''}`}
            >
              <span className={styles.icon}>{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        className={styles.signOut}
        onClick={() => signOut({ callbackUrl: '/login' })}
      >
        <span className={styles.icon}>⊗</span>
        <span>Sign Out</span>
      </button>
    </aside>
  );
}
