import { auth } from '@/auth';
import InstallButton from '@/components/InstallButton/InstallButton';
import RingButton from '@/components/RingButton/RingButton';
import Link from 'next/link';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
}

export default async function Header({ title }: HeaderProps) {
  const session = await auth();
  const name = session?.user?.name ?? 'User';
  const initials = name
    .split(' ')
    .map((part: string) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h2 className={styles.title}>{title}</h2>
        <nav className={styles.nav}>
          <Link href="/dashboard" className={title === 'Overview' ? styles.active : ''}>
            Overview
          </Link>
          <Link href="/dashboard/team" className={title === 'Workspace' ? styles.active : ''}>
            Workspace
          </Link>
          <Link href="/dashboard/chat" className={title === 'Chat' ? styles.active : ''}>
            Chat
          </Link>
        </nav>
      </div>
      <div className={styles.right}>
        <InstallButton />
        <RingButton />
        <div className={styles.user}>
          <span className={styles.name}>{name}</span>
          <div className={styles.avatar}>{initials}</div>
        </div>
      </div>
    </header>
  );
}
