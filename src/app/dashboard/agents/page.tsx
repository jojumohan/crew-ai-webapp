import Header from '@/components/Header/Header';
import styles from '../page.module.css';

export default function AgentsPage() {
  return (
    <>
      <Header title="AI Agents" />
      <div className={styles.page}>
        <div className={styles.welcome}>
          <h1>AI Agents</h1>
          <p>Trigger and monitor your AI agents.</p>
        </div>
        <div className={`${styles.panel} glass`}>
          <div className={styles.empty}>
            <span>◉</span>
            <p>No agents running</p>
          </div>
        </div>
      </div>
    </>
  );
}
