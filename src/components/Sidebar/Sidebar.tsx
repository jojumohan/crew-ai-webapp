'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import styles from './Sidebar.module.css';

const NAV = [
  { href: '/dashboard',          label: 'Overview', icon: '◈' },
  { href: '/dashboard/tasks',    label: 'Tasks',    icon: '✦' },
  { href: '/dashboard/agents',   label: 'Agents',   icon: '◉' },
  { href: '/dashboard/chat',     label: 'Chat',     icon: '◎' },
  { href: '/dashboard/calendar', label: 'Calendar', icon: '◇' },
  { href: '/dashboard/files',    label: 'Files',    icon: '▣' },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === href
      : pathname.startsWith(href);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={styles.sidebar + ' glass'}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⚡</span>
          <span className={styles.logoText}>Aronlabz Teams</span>
        </div>

        <nav className={styles.nav}>
          {NAV.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.navItem} ${isActive(href) ? styles.active : ''}`}
            >
              <span className={styles.icon}>{icon}</span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <button
          className={styles.signOut}
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <span className={styles.icon}>⊗</span>
          <span>Sign Out</span>
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <nav className={styles.bottomNav}>
        {NAV.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.bottomNavItem} ${isActive(href) ? styles.active : ''}`}
          >
            <span className={styles.bottomNavIcon}>{icon}</span>
            <span>{label}</span>
          </Link>
        ))}
        <button
          className={styles.bottomSignOut}
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <span className={styles.bottomNavIcon}>⊗</span>
          <span>Out</span>
        </button>
      </nav>
    </>
  );
}
