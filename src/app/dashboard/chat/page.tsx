import Header from '@/components/Header/Header';
import styles from '../page.module.css';

export default function ChatPage() {
  return (
    <>
      <Header title="Chat" />
      <div className={styles.page}>
        <div className={styles.welcome}>
          <h1>Chat</h1>
          <p>Team messaging and communication.</p>
        </div>
        <div className={`${styles.panel} glass`}>
          <div className={styles.empty}>
            <span>◎</span>
            <p>No messages yet</p>
          </div>
        </div>
      </div>
    </>
  );
}
