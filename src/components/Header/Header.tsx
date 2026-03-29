import { auth } from '@/auth';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
}

export default async function Header({ title }: HeaderProps) {
  const session = await auth();
  const name = session?.user?.name ?? 'User';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header className={styles.header}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.user}>
        <span className={styles.name}>{name}</span>
        <div className={styles.avatar}>{initials}</div>
      </div>
    </header>
  );
}
