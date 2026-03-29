import Header from '@/components/Header/Header';
import styles from '../page.module.css';

export default function TasksPage() {
  return (
    <>
      <Header title="Tasks" />
      <div className={styles.page}>
        <div className={styles.welcome}>
          <h1>Tasks</h1>
          <p>Manage and track your team's tasks.</p>
        </div>
        <div className={`${styles.panel} glass`}>
          <div className={styles.empty}>
            <span>✦</span>
            <p>No tasks yet</p>
          </div>
        </div>
      </div>
    </>
  );
}
